import test from 'tape'
import LineItemStateCsvParser from 'lineitemstate-csv-parser'
import StreamTest from 'streamtest'
import path from 'path'
import { SphereClient } from 'sphere-node-sdk'
import fs from 'fs'
import CONSTANTS from '../src/constants'

let PROJECT_KEY

if (process.env.CI === 'true')
  PROJECT_KEY = process.env.CT_PROJECT_KEY
else
  PROJECT_KEY = process.env.npm_config_projectkey

const logger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  verbose: () => {},
}

const apiClientConfig = {
  config: {
    project_key: PROJECT_KEY,
    client_id: '*********',
    client_secret: '*********',
  },
  rest: {
    config: {},
    GET: (endpoint, callback) => {
      callback(null, { statusCode: 200 }, { results: [] })
    },
    POST: (endpoint, payload, callback) => {
      callback(null, { statusCode: 200 })
    },
    PUT: () => {},
    DELETE: () => (/* endpoint, callback */) => {},
    PAGED: () => (/* endpoint, callback */) => {},
    _preRequest: () => {},
    _doRequest: () => {},
  },
}

test('LineItemStateCsvParser module is a class', (t) => {
  t.equal(
    typeof LineItemStateCsvParser,
    'function',
    'LineItemStateCsvParser is a class'
  )

  t.end()
})

test(`LineItemStateCsvParser
  should initialize default values`, (t) => {
  const lineItemStateCsvParser = new LineItemStateCsvParser(apiClientConfig)

  // apiClientConfig
  t.equal(
    lineItemStateCsvParser.client.constructor,
    SphereClient,
    'lineitemStateCsvParser module is an instanceof SphereClient'
  )

  // logger
  t.deepEqual(
    lineItemStateCsvParser.logger,
    /* eslint-disable no-console */
    {
      error: console.error,
      warn: console.warn,
      info: console.log,
      verbose: console.log,
    },
    /* eslint-enable no-console */
    'logger should be set to the standard value'
  )
  // config
  t.equal(
    lineItemStateCsvParser.batchSize,
    CONSTANTS.standardOption.batchSize,
    'parser option should be set to the standard value'
  )

  t.end()
})

test(`LineItemStateCsvParser
  should throw when options is invalid`, (t) => {
  // eslint-disable-next-line no-new
  t.throws(() => { new LineItemStateCsvParser(logger, {}) })
  t.end()
})

test(`LineItemStateCsvParser::parse
  should accept a stream and output a stream`, (t) => {
  const lineItemStateCsvParser = new LineItemStateCsvParser(
    apiClientConfig,
    logger
  )
  const readStream = fs.createReadStream(
    path.join(__dirname, 'helpers/lineitemstate-sample.csv')
  )
  const outputStream = StreamTest['v2'].toText((err, result) => {
    t.equal(JSON.parse(result).length, 1, 'All rows in the csv is parsed')
    t.end()
  })
  lineItemStateCsvParser.parse(readStream, outputStream)
})

test(`LineItemStateCsvParser::processData
  should accept a stream and output a stream`, (t) => {
  const lineItemStateCsvParser = new LineItemStateCsvParser(
    apiClientConfig,
    logger
  )
  const mockOrder = {
    orderNumber: '123',
    fromState: 'ordered',
    toState: 'shipped',
    quantity: '234',
    lineItemId: '123',
  }
  lineItemStateCsvParser.processData(mockOrder).then((result) => {
    t.equal(result.orderNumber, mockOrder.orderNumber, 'orderNumber is parsed')
    t.equal(
      result.lineItems[0].state[0].quantity,
      parseInt(mockOrder.quantity, 10),
      'lineItem quantity is parsed'
    )
    t.equal(
      result.lineItems[0].state[0].state.id,
      mockOrder.toState,
      'lineItem state is parsed'
    )
    t.end()
  })
})

test(`LineItemStateCsvParser::processData
  should return error if required headers is missing`, (t) => {
  const lineItemStateCsvParser = new LineItemStateCsvParser(
    apiClientConfig,
    logger
  )
  const mockOrder = {
    fromState: 'okay',
    toState: 'yeah',
    quantity: '234',
    lineItemId: '123',
  }
  lineItemStateCsvParser.processData(mockOrder)
  .then(t.fail)
  .catch((error) => {
    t.equal(error, 'Required headers missing: \'orderNumber\'')
    t.end()
  })
})
