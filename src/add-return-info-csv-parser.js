import { SphereClient } from 'sphere-node-sdk'
import { userAgent } from 'sphere-node-utils'
import _ from 'underscore'
import highland from 'highland'
import JSONStream from 'JSONStream'
import csv from 'csv-parser'
import CONS from './constants'

import pkg from '../package.json'

export default class AddReturnInfoCsvParser {
  constructor (apiClientConfig, logger, config = {}) {
    this.client = new SphereClient(
      Object.assign(
        apiClientConfig,
        { user_agent: userAgent(pkg.name, pkg.version) }
      )
    )
    /* eslint-disable no-console */
    this.logger = logger || {
      error: console.error,
      warn: console.warn,
      info: console.log,
      verbose: console.log,
    }
    /* eslint-enable no-console */

    this.config = config
    this.batchSize =
      this.config.batchSize || CONS.standardOption.batchSize
    this.delimiter =
      this.config.delimiter || CONS.standardOption.delimiter
    this.strictMode =
      this.config.strictMode || CONS.standardOption.strictMode
  }

  parse (input, output) {
    this.logger.info('Starting Return Info CSV conversion')

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
    .reduce([], (allOrders, currentOrder) => {
      /*
        Reduce all orders to one order object
        1. Groups all orders by the orderNumber,
        2. Group all returnInfo of an order by the _returnId
      */
      if (!allOrders.length)
        allOrders.push(currentOrder)
      else {
        const existingOrders = allOrders.filter(
          order =>
            order.orderNumber === currentOrder.orderNumber
        )

        existingOrders.forEach((existingOrder) => {
          const existingReturnInfos = existingOrder.returnInfo.filter(
            returnInfo =>
              returnInfo._returnId === currentOrder.returnInfo[0]._returnId
          )

          existingReturnInfos.forEach((returnInfo) => {
            returnInfo.items.push(...currentOrder.returnInfo[0].items)
          })

          if (!existingReturnInfos.length)
            existingOrder.returnInfo.push(...currentOrder.returnInfo)
        })

        if (!existingOrders.length)
          allOrders.push(currentOrder)
      }
      return allOrders
    })
    .pipe(JSONStream.stringify(false))
    .pipe(output)
  }

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
