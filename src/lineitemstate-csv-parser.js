import { SphereClient } from 'sphere-node-sdk'
import { userAgent } from 'sphere-node-utils'
import _ from 'underscore'
import highland from 'highland'
import JSONStream from 'JSONStream'
import csv from 'csv-parser'
import loadSelfPkg from 'load-pkg'
import CONS from './constants'

export default class LineItemStateCsvParser {
  constructor (apiClientConfig, logger, config = {}) {
    const selfPkg = loadSelfPkg.sync(process.cwd())
    this.client = new SphereClient(
      Object.assign(
        apiClientConfig,
        { user_agent: userAgent('csv-parser-orders', selfPkg.version) }
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
    .flatMap(data => highland(this.processData(data)))
    .pipe(JSONStream.stringify())
    .pipe(output)
  }
  // eslint-disable-next-line class-methods-use-this
  processData (data) {
    this.logger.verbose('Processing data to CTP format')
    const _data = _.clone(data)
    const csvHeaders = _.keys(data)
    const headerDiff = _.difference(
      CONS.requiredHeaders.lineItemState,
      csvHeaders
    )
    if (headerDiff.length)
      return Promise.reject(
        `Required headers missing: '${headerDiff.join(',')}'`
      )

    const result = {
      orderNumber: _data.orderNumber,
      lineItems: [{
        state: [{
          quantity: parseInt(_data.quantity, 10),
          state: {
            id: _data.toState,
          },
        }],
      }],
    }
    return Promise.resolve(result)
  }
}
