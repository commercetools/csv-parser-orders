import test from 'tape'
import LineItemStateCsvParser from 'lineitemstate-csv-parser'
import { SphereClient } from 'sphere-node-sdk'

import CONSTANTS from '../src/constants'

let PROJECT_KEY

if (process.env.CI === 'true')
  PROJECT_KEY = process.env.SPHERE_PROJECT_KEY
else
  PROJECT_KEY = process.env.npm_config_projectkey

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
    lineItemStateCsvParser.batchSize,
    CONSTANTS.standardOption.batchSize,
    'parser option should be set to the standard value'
  )

  t.end()
})
