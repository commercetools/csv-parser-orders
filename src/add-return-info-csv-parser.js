import { SphereClient } from 'sphere-node-sdk'
import _ from 'underscore'
import highland from 'highland'
import JSONStream from 'JSONStream'
import csv from 'csv-parser'
import CONS from './constants'

export default class AddReturnInfoCsvParser {
  constructor (apiClientConfig, logger, config = {}) {
    this.client = new SphereClient(
      Object.assign(apiClientConfig, { user_agent: 'csv-parser-orders' })
    )
    this.logger = logger || {
      error: process.stderr,
      warn: process.stderr,
      info: process.stdout,
      verbose: process.stdout,
    }

    this.config = config
    this.batchSize =
      this.config.batchSize || CONS.standardOption.batchSize
    this.delimiter =
      this.config.delimiter || CONS.standardOption.delimiter
    this.strictMode =
      this.config.strictMode || CONS.standardOption.strictMode
  }

  parse (input, output) {
    this.logger.verbose('Starting conversion')

    let rowIndex = 1

    highland(input)
    .through(csv({
      separator: this.delimiter,
      strict: this.strictMode,
    }))
    .batch(this.batchSize)
    .stopOnError(error => this.logger.error(error))
    .doto((data) => {
      this.logger.verbose(`Parsed row-${rowIndex}: ${JSON.stringify(data)}`)
      rowIndex += 1
    })
    .flatMap(highland)
    .flatMap(data => highland(this.processData(data, rowIndex)))
    .stopOnError(error => this.logger.error(error))
    .doto(data => this.logger.verbose(
      `Converted row${rowIndex}: ${JSON.stringify(data)}`
    ))
    .reduce([], (memo, next) => {
      /*
        Reduce all orders to one order object
        1. Groups all orders by the orderNumber,
        2. Group all returnInfo of an order by the _returnId
      */
      const allOrders = memo
      const curOrder = next
      if (!allOrders.length)
        allOrders.push(curOrder)
      else {
        let found1 = false
        _.each(allOrders, (order) => {
          if (order.orderNumber === curOrder.orderNumber) {
            found1 = true
            let found2 = false
            _.each(order.returnInfo, (returnInfo) => {
              if (returnInfo._returnId === curOrder.returnInfo[0]._returnId) {
                found2 = true
                returnInfo.items.push(...curOrder.returnInfo[0].items)
              }
            })
            if (!found2)
              order.returnInfo.push(...curOrder.returnInfo)
          }
        })
        if (!found1)
          allOrders.push(next)
      }
      return allOrders
    })
    .pipe(JSONStream.stringify(false))
    .pipe(output)
  }
  // eslint-disable-next-line class-methods-use-this
  processData (data) {
    this.logger.verbose('Processing data to CTP format')
    const _data = _.clone(data)
    const csvHeaders = _.keys(data)
    const headerDiff = _.difference(CONS.requiredHeaders.returnInfo, csvHeaders)
    if (headerDiff.length)
      return Promise.reject(
        `Required headers missing: '${headerDiff.join(',')}'`
      )
    // Sample returnInfo object that the API supports
    /*
      orderNumber: String,
      returnInfo: [{
        returnTrackingId: String,
        returnDate: DateTime,
        items: [{
          quantity: String,
          lineItemId: String,
          comment: String,
          shipmentState: Ref
        }]
      }]
    */
    const result = {
      orderNumber: _data.orderNumber,
      returnInfo: [{
        returnTrackingId: _data.returnTrackingId,
        _returnId: _data._returnId, // Internal value to group the returnInfo
        returnDate: _data.returnDate,
        items: [{
          quantity: parseInt(_data.quantity, 10),
          lineItemId: _data.lineItemId,
          comment: _data.comment,
          shipmentState: _data.shipmentState,
        }],
      }],
    }
    return Promise.resolve(result)
  }
}
