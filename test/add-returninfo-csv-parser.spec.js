import test from 'tape'
import AddReturnInfoCsvParser from 'add-return-info-csv-parser'
import StreamTest from 'streamtest'
import path from 'path'
import { SphereClient } from 'sphere-node-sdk'
import sinon from 'sinon'
import fs from 'fs'
import CONSTANTS from '../src/constants'

let PROJECT_KEY

if (process.env.CI === 'true')
  PROJECT_KEY = process.env.SPHERE_PROJECT_KEY
else
  PROJECT_KEY = process.env.npm_config_projectkey

const logger = {
  error: console.error,
  warn: console.warn,
  info: console.log,
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

test('AddReturnInfoCsvParser module is a class', (t) => {
  t.equal(
    typeof AddReturnInfoCsvParser,
    'function',
    'AddReturnInfoCsvParser is a class'
  )

  t.end()
})

test(`AddReturnInfoCsvParser
  should initialize default values`, (t) => {
  const addReturnInfo = new AddReturnInfoCsvParser(apiClientConfig)

  // apiClientConfig
  t.equal(
    addReturnInfo.client.constructor,
    SphereClient,
    'lineitemStateCsvParser module is an instanceof SphereClient'
  )

  // logger
  t.deepEqual(
    addReturnInfo.logger,
    {
      error: process.stderr,
      warn: process.stderr,
      info: process.stdout,
      verbose: process.stdout,
    },
    'logger should be set to the standard value'
  )
  // config
  t.equal(
    addReturnInfo.batchSize,
    CONSTANTS.standardOption.batchSize,
    'parser option should be set to the standard value'
  )

  t.end()
})

test(`AddReturnInfoCsvParser
  should throw when options is invalid`, (t) => {
  // eslint-disable-next-line no-new
  t.throws(() => { new AddReturnInfoCsvParser(logger, {}) })
  t.end()
})

test(`AddReturnInfoCsvParser::parse
  should accept a stream and output a stream`, (t) => {
  const addReturnInfo = new AddReturnInfoCsvParser(
    apiClientConfig,
    logger
  )
  const readStream = fs.createReadStream(
    path.join(__dirname, 'helpers/return-info-sample.csv')
  )
  const outputStream = StreamTest['v2'].toText((err, result) => {
    const _result = JSON.parse(result)
    t.equal(_result.length, 2, 'All rows in the csv is parsed')
    t.notOk(err)
    t.end()
  })
  addReturnInfo.parse(readStream, outputStream)
})

test(`AddReturnInfoCsvParser::parse
  should return error with invalid csv`, (t) => {
  const spy = sinon.stub(logger, 'error')
  const addReturnInfo = new AddReturnInfoCsvParser(
    apiClientConfig,
    logger
  )
  const readStream = fs.createReadStream(
    path.join(__dirname, 'helpers/return-info-error-sample.csv')
  )
  const outputStream = StreamTest['v2'].toText((err) => {
    t.ok(
      /Row length does not match headers/.test(spy.args[0][0]),
      'Error with invalid csv is returned'
    )
    logger.error.restore()
    t.notOk(err)
    t.end()
  })
  addReturnInfo.parse(readStream, outputStream)
})

test(`AddReturnInfoCsvParser::parse
  should return error with missing headers`, (t) => {
  const spy = sinon.stub(logger, 'error')
  const addReturnInfo = new AddReturnInfoCsvParser(
    apiClientConfig,
    logger
  )
  const readStream = fs.createReadStream(
    path.join(__dirname, 'helpers/return-info-error2-sample.csv')
  )
  const outputStream = StreamTest['v2'].toText((err) => {
    t.ok(
      /Required headers missing: 'orderNumber'/.test(spy.args[0][0]),
      'Error with missing header is returned'
    )
    logger.error.restore()
    t.notOk(err)
    t.end()
  })
  addReturnInfo.parse(readStream, outputStream)
})

test(`AddReturnInfoCsvParser::processData
  should accept a stream and output a stream`, (t) => {
  const addReturnInfo = new AddReturnInfoCsvParser(
    apiClientConfig,
    logger
  )
  const mockOrder = {
    orderNumber: '123',
    quantity: '234',
    lineItemId: '123',
    shipmentState: 'shipped',
    _returnId: '2',
  }
  addReturnInfo.processData(mockOrder).then((result) => {
    t.equal(result.orderNumber, mockOrder.orderNumber, 'orderNumber is parsed')
    const _mockResult = {
      orderNumber: '123',
      returnInfo: [
        {
          _returnId: '2',
          returnDate: undefined,
          returnTrackingId: undefined,
          items: [
            {
              quantity: 234,
              comment: undefined,
              lineItemId: '123',
              shipmentState: 'shipped',
            },
          ],
        },
      ],
    }
    t.deepEqual(
      result,
      _mockResult,
      'order object is process correctly'
    )
    t.end()
  }).catch(t.fail)
})

test(`AddReturnInfoCsvParser::processData
  should return error if required headers is missing`, (t) => {
  const addReturnInfo = new AddReturnInfoCsvParser(
    apiClientConfig,
    logger
  )
  const mockOrder = {
    quantity: '234',
    lineItemId: '123',
    shipmentState: 'shipped',
    _returnId: '2',
  }
  addReturnInfo.processData(mockOrder)
  .then(t.fail)
  .catch((error) => {
    t.equal(error, 'Required headers missing: \'orderNumber\'')
    t.end()
  })
})
