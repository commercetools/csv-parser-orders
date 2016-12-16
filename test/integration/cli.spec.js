import { exec } from 'child_process'
import fs from 'fs'
import test from 'tape'
import tmp from 'tmp'

import { version } from '../../package.json'

const binPath = './bin/csvparserorders.js'

let PROJECT_KEY
if (process.env.CI === 'true')
  PROJECT_KEY = process.env.CT_PROJECT_KEY
else
  PROJECT_KEY = process.env.npm_config_projectkey

test('CLI help flag', (t) => {
  exec(`${binPath} --help`, (error, stdout, stderr) => {
    t.true(String(stdout).match(/help/), 'outputs help text')
    t.false(error && stderr, 'returns no error')
    t.end()
  })
})

test('CLI version flag', (t) => {
  exec(`${binPath} --version`, (error, stdout, stderr) => {
    t.equal(stdout, `${version}\n`, 'outputs current version number')
    t.false(error && stderr, 'returns no error')
    t.end()
  })
})

test('CLI takes input from file', (t) => {
  const csvFilePath = './test/helpers/lineitemstate-sample.csv'

  exec(
    `${binPath} -p ${PROJECT_KEY} -t lineitemstate --inputFile ${csvFilePath}`,
    (error, stdout, stderr) => {
      const expectedOutput = [{
        orderNumber: '234',
        lineItems: [{
          state: [{
            quantity: 10,
            fromState: 'order',
            toState: 'shipped',
          }],
        }],
      }]
      t.false(error && stderr, 'returns no error')
      t.deepEqual(
        JSON.parse(stdout),
        expectedOutput,
        'lineitemstate csv parser '
      )
      t.end()
    }
  )
})

test('CLI accepts lineitemstate csv type', (t) => {
  const csvFilePath = './test/helpers/lineitemstate-sample.csv'

  exec(
    `${binPath} -p ${PROJECT_KEY} -t lineitemstate --inputFile ${csvFilePath}`,
    (error, stdout, stderr) => {
      const expectedOutput = [{
        orderNumber: '234',
        lineItems: [{
          state: [{
            quantity: 10,
            fromState: 'order',
            toState: 'shipped',
          }],
        }],
      }]
      t.false(error && stderr, 'returns no error')
      t.deepEqual(
        JSON.parse(stdout),
        expectedOutput,
        'CLI parses lineitemstate csv type'
      )
      t.end()
    }
  )
})

test('CLI accepts returninfo csv type', (t) => {
  const csvFilePath = './test/helpers/return-info-sample.csv'

  exec(
    `${binPath} -p ${PROJECT_KEY} -t returninfo --inputFile ${csvFilePath}`,
    (error, stdout, stderr) => {
      const expectedOutput = [
        {
          orderNumber: '123',
          returnInfo: [
            {
              returnTrackingId: 'aefa34fe',
              _returnId: '1',
              returnDate: '2016-11-01T08:01:19+0000',
              items: [
                {
                  quantity: 4,
                  lineItemId: '12ae',
                  comment: 'yeah',
                  shipmentState: 'shipped',
                },
                {
                  quantity: 4,
                  lineItemId: '12ae',
                  comment: 'yeah',
                  shipmentState: 'not-shipped',
                },
              ],
            },
            {
              returnTrackingId: 'aefa34fe',
              _returnId: '2',
              returnDate: '2016-11-01T08:01:19+0000',
              items: [{
                quantity: 4,
                lineItemId: '12ae',
                comment: 'yeah',
                shipmentState: 'not-shipped',
              }],
            },
          ],
        },
        {
          orderNumber: '124',
          returnInfo: [{
            returnTrackingId: 'aefa34fe',
            _returnId: '2',
            returnDate: '2016-11-01T08:01:19+0000',
            items: [
              {
                quantity: 4,
                lineItemId: '12ae',
                comment: 'yeah',
                shipmentState: 'not-shipped',
              },
            ],
          }],
        }]
      t.false(error && stderr, 'returns no error')
      t.deepEqual(
        JSON.parse(stdout),
        expectedOutput,
        'CLI parses returninfo csv type'
      )
      t.end()
    }
  )
})

test('CLI writes output to file', (t) => {
  const csvPath = './test/helpers/lineitemstate-sample.csv'
  const output = tmp.fileSync().name
  const expectedOutput = [{
    orderNumber: '234',
    lineItems: [{
      state: [{
        quantity: 10,
        fromState: 'order',
        toState: 'shipped',
      }],
    }],
  }]
  exec(
    `${binPath} -p ${PROJECT_KEY} -i ${csvPath} -o ${output} -t lineitemstate`,
    (cliError, stdout, stderr) => {
      t.false(cliError && stderr, 'returns no CLI error')

      fs.readFile(output, { encoding: 'utf8' }, (error, data) => {
        t.deepEqual(
          JSON.parse(data),
          expectedOutput,
          'lineitemstate csv parser outputs data to a file'
        )
        t.false(error, 'returns no FS error')
        t.end()
      })
    }
  )
})

test('CLI given a non-existant input file', (t) => {
  exec(`${binPath} -t lineitemstate -p ${PROJECT_KEY} -i nope.csv`, (error) => {
    t.true(error, 'returns error when csv file is not present')
    t.end()
  })
})

test('CLI exits on faulty CSV format', (t) => {
  const csvFile = './test/helpers/faulty-sample.csv'
  const output = tmp.fileSync().name
  const type = 'lineitemstate'

  exec(`${binPath} -p ${PROJECT_KEY} -i ${csvFile} -t ${type} -o ${output}`,
    (error, stdout, stderr) => {
      t.equal(error.code, 1, 'returns process error exit code')
      t.false(stdout, 'returns no stdout data')
      t.true(
        stderr.match(/Row length does not match headers/),
        'returns CSV parsing error on stderr'
      )
      t.end()
    }
  )
})

test('CLI logs stack trace on verbose level', (t) => {
  const csvFile = './test/helpers/faulty-sample.csv'
  const type = 'lineitemstate'
  const logLevel = 'verbose'

  exec(
    // eslint-disable-next-line
    `${binPath} -p ${PROJECT_KEY} -i ${csvFile} -t ${type} --logLevel ${logLevel}`,
    (error, stdout, stderr) => {
      t.equal(error.code, 1, 'returns process error exit code')
      t.false(stdout, 'returns no stdout data')
      t.true(
        stderr.match(/Row length does not match headers/),
        'returns CSV parsing error on stderr'
      )
      t.end()
    }
  )
})

test('CLI should return error if invalid type is passed', (t) => {
  const csvFile = './test/helpers/faulty-sample.csv'
  const type = 'invalid'

  exec(
    `${binPath} -p ${PROJECT_KEY} -i ${csvFile} -t ${type}`,
    (error, stdout, stderr) => {
      t.ok(error)
      t.false(stdout, 'returns no stdout data')
      t.true(
        stderr.match(/Invalid values/),
        'CLI module returns error when invalid type is given'
      )
      t.end()
    }
  )
})
