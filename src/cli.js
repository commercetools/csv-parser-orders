import fs from 'fs'
import log from 'npmlog'
import PrettyError from 'pretty-error'
import yargs from 'yargs'

import CONSTANTS from './constants'
import LineItemStateCsvParser from './lineitemstate-csv-parser'
import AddReturnInfoCsvParser from './add-return-info-csv-parser'
import DeliveriesCsvParser from './deliveries-csv-parser'
import getApiCredentials from './get-api-credentials'
import { version } from '../package.json'

process.title = 'csvparserorders'

const args = yargs
  .usage(
    `\n
Usage: $0 [options]
Convert commercetools orders CSV data to JSON.`
  )
  .showHelpOnFail(false)

  .option('help', {
    alias: 'h',
  })
  .help('help', 'Show help text.')

  .option('version', {
    alias: 'v',
    type: 'boolean',
  })
  .version('version', 'Show version number.', () => version)
  .option('type', {
    alias: 't',
    choices: ['lineitemstate', 'returninfo', 'deliveries'],
    describe: 'Predefined type of csv',
    demand: true,
  })
  .option('inputFile', {
    alias: 'i',
    default: 'stdin',
    describe: 'Path to CSV file.',
  })
  .coerce('inputFile', (arg) => {
    if (arg !== 'stdin')
      return fs.createReadStream(String(arg))

    return process.stdin
  })

  .option('outputFile', {
    alias: 'o',
    default: 'stdout',
    describe: 'Input CSV file.',
  })
  .coerce('outputFile', (arg) => {
    if (arg !== 'stdout')
      return fs.createWriteStream(String(arg))

    // No output file given, log to file to not disturb stdout/stderr
    log.stream = fs.createWriteStream('csvparserorders.log')

    return process.stdout
  })

  .option('batchSize', {
    alias: 'b',
    default: CONSTANTS.standardOption.batchSize,
    describe: 'Number of CSV rows to handle simultaneously.',
  })

  .option('delimiter', {
    alias: 'd',
    default: CONSTANTS.standardOption.delimiter,
    describe: 'Used CSV delimiter.',
  })

  .option('strictMode', {
    alias: 's',
    default: CONSTANTS.standardOption.strictMode,
    describe: 'Parse CSV strictly.',
  })

  .option('projectKey', {
    alias: 'p',
    describe: 'API project key.',
    demand: true,
  })

  .option('host', {
    describe: 'HTTP client host parameter.',
  })

  .option('protocol', {
    describe: 'HTTP client protocol parameter.',
  })

  .option('accessToken', {
    describe: 'HTTP client access token.',
  })

  .option('logLevel', {
    alias: 'l',
    default: 'info',
    describe: 'Logging level: error, warn, info or verbose.',
  })
  .coerce('logLevel', (arg) => {
    log.level = arg
  })
  .demandOption(
    ['projectKey', 'type'],
    'Please provide both projectKey and type arguments.'
  )
  .argv

const errorHandler = (error) => {
  const errorFormatter = new PrettyError()
  let formattedError
  if (log.level === 'verbose')
    formattedError = errorFormatter.render(error)
  else if (error.message)
    formattedError = error.message
  else
    formattedError = error

  process.stderr.write(formattedError)
  process.stderr.write('\n')
  log.error('', formattedError)
  process.exit(1)
}

const loggerConf = {
  error: errorHandler,
  info: message => log.info('', message),
  verbose: message => log.verbose('', message),
}

const csvConf = {
  delimiter: args.delimiter,
}

const methodMapping = {
  lineitemstate: apiConf => new LineItemStateCsvParser(
    apiConf, loggerConf, csvConf
  ),
  returninfo: apiConf => new AddReturnInfoCsvParser(
    apiConf, loggerConf, csvConf
  ),
  deliveries: () => new DeliveriesCsvParser(
    loggerConf, csvConf
  ),
}
getApiCredentials(args.projectKey, args.accessToken)
  .then((apiCredentials) => {
    const apiConf = {
      config: apiCredentials,
      host: args.host,
      protocol: args.protocol,
      access_token: args.accessToken,
    }

    return methodMapping[args.type](apiConf)
  })
  .then((module) => {
    module.parse(args.inputFile, args.outputFile)
  })
