import { SphereClient } from 'sphere-node-sdk'
import CONSTANTS from './constants'

export default class LineItemStateCsvParser {
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
      this.config.batchSize || CONSTANTS.standardOption.batchSize
    this.delimiter =
      this.config.delimiter || CONSTANTS.standardOption.delimiter
    this.strictMode =
      this.config.strictMode || CONSTANTS.standardOption.strictMode
  }
}
