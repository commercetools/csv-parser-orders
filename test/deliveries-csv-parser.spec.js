import test from 'tape'
import DeliveriesCsvParser from 'deliveries-csv-parser'
import StreamTest from 'streamtest'
import path from 'path'
import sinon from 'sinon'
import fs from 'fs'
import CONSTANTS from '../src/constants'

/* eslint-disable no-console */
const logger = {
  error: console.error,
  warn: console.warn,
  info: console.log,
  verbose: () => {},
}
/* eslint-disable no-console */


const deliveriesTestFolder = 'helpers/deliveries/'

test('DeliveriesCsvParser module is a class', (t) => {
  t.equal(
    typeof DeliveriesCsvParser,
    'function',
    'DeliveriesCsvParser is a class'
  )

  t.end()
})

test(`DeliveriesCsvParser
  should initialize default values`, (t) => {
  const deliveriesParser = new DeliveriesCsvParser()

  // logger
  /* eslint-disable no-console */
  t.deepEqual(
    deliveriesParser.logger,
    {
      error: console.error,
      warn: console.warn,
      info: console.log,
      verbose: console.log,
    },
    'logger should be set to the standard value'
  )
  /* eslint-disable no-console */

  t.equal(
    deliveriesParser.config.batchSize,
    CONSTANTS.standardOption.batchSize,
    'parser option should be set to the standard value'
  )

  t.end()
})

test(`DeliveriesCsvParser::parse
  should accept a stream and output a stream`, (t) => {
  const deliveriesParser = new DeliveriesCsvParser(logger)
  const readStream = fs.createReadStream(
    path.join(__dirname, deliveriesTestFolder, 'delivery.csv')
  )
  const outputStream = StreamTest['v2'].toText((err, result) => {
    t.equal(JSON.parse(result).length, 3, 'All rows in the csv are parsed')
    t.notOk(err)
    t.end()
  })
  deliveriesParser.parse(readStream, outputStream)
})

test(`DeliveriesCsvParser::parse
  should return error with invalid csv`, (t) => {
  const spy = sinon.stub(logger, 'error')
  const deliveriesParser = new DeliveriesCsvParser(
    logger
  )
  const readStream = fs.createReadStream(
    path.join(__dirname, deliveriesTestFolder, 'delivery-error-row-length.csv')
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
  deliveriesParser.parse(readStream, outputStream)
})

test(`DeliveriesCsvParser::parse
  should return an error with missing headers`, (t) => {
  const spy = sinon.stub(logger, 'error')
  const deliveriesParser = new DeliveriesCsvParser(
    logger
  )
  const readStream = fs.createReadStream(
    // eslint-disable-next-line max-len
    path.join(__dirname, deliveriesTestFolder, 'delivery-error-missing-headers.csv')
  )
  const outputStream = StreamTest['v2'].toText((err) => {
    t.ok(
      /Required headers missing: 'item\.quantity'/.test(spy.args[0][0]),
      'Error with missing header is returned'
    )
    logger.error.restore()
    t.notOk(err)
    t.end()
  })
  deliveriesParser.parse(readStream, outputStream)
})

test(`DeliveriesCsvParser::processData
  should accept a stream and output a stream`, (t) => {
  const deliveriesParser = new DeliveriesCsvParser(
    logger
  )
  const mockDelivery = {
    'delivery.id': '1',
    itemGroupId: '1',
    'item.id': '123',
    'item.quantity': '1',
    'parcel.id': '1',
    'parcel.length': '100',
    'parcel.height': '200',
    'parcel.width': '200',
    'parcel.weight': '500',
    'parcel.trackingId': '123456789',
    'parcel.carrier': 'DHL',
    'parcel.provider': 'parcel provider',
    'parcel.providerTransaction': 'parcelTransaction provider',
    'parcel.isReturn': '0',
  }

  deliveriesParser.processData(mockDelivery).then((result) => {
    t.equal(result.id, mockDelivery['delivery.id'], 'orderNumber is parsed')

    const _mockResult = {
      id: '1',
      items: [
        {
          _groupId: '1',
          id: '123',
          quantity: 1,
        },
      ],
      parcels: [
        {
          id: '1',
          measurements: {
            lengthInMillimeter: 100,
            heightInMillimeter: 200,
            widthInMillimeter: 200,
            weightInGram: 500,
          },
          trackingData: {
            trackingId: '123456789',
            carrier: 'DHL',
            provider: 'parcel provider',
            providerTransaction: 'parcelTransaction provider',
            isReturn: false,
          },
        },
      ],
    }

    t.deepEqual(
      result,
      _mockResult,
      'delivery object is processed correctly'
    )
    t.end()
  }).catch(t.fail)
})

test(`DeliveriesCsvParser::parse
  should parse CSV with multiple items`, (t) => {
  const deliveriesParser = new DeliveriesCsvParser(
    logger
  )
  const readStream = fs.createReadStream(
    path.join(__dirname, deliveriesTestFolder, 'delivery.csv')
  )
  const outputStream = StreamTest['v2'].toText((err, _result) => {
    const result = JSON.parse(_result)
    t.equal(
      result.length,
      3,
      'There should be 3 delivery objects'
    )

    let delivery = result.find(d => d.id === '1')
    t.equal(
      delivery.items.length,
      2,
      'First delivery should have 2 delivery items'
    )

    delivery = result.find(d => d.id === '2')
    t.equal(
      delivery.items.length,
      1,
      'Second delivery should have 1 delivery item'
    )

    delivery = result.find(d => d.id === '3')
    t.equal(
      delivery.items.length,
      4,
      'Third delivery should have 4 delivery items'
    )

    t.end()
  })
  deliveriesParser.parse(readStream, outputStream)
})

test(`DeliveriesCsvParser::parse
  should parse CSV with multiple parcels`, (t) => {
  const deliveriesParser = new DeliveriesCsvParser(
    logger
  )
  const readStream = fs.createReadStream(
    path.join(__dirname, deliveriesTestFolder, 'parcel.csv')
  )
  const outputStream = StreamTest['v2'].toText((err, _result) => {
    const result = JSON.parse(_result)
    t.equal(
      result.length,
      1,
      'There should be only one delivery'
    )

    const deliveryParcels = result[0].parcels
    t.equal(
      deliveryParcels.length,
      2,
      'Delivery should have 2 parcels'
    )

    let parcel = deliveryParcels.find(p => p.id === '1')
    t.equal(
      parcel.trackingData.trackingId,
      '123456789',
      'First parcel should be parsed correctly'
    )

    parcel = deliveryParcels.find(p => p.id === '2')
    t.equal(
      parcel.trackingData.trackingId,
      '2222222',
      'Second parcel should be parsed correctly'
    )

    t.equal(
      parcel.measurements.weightInGram,
      undefined,
      'Second parcel should not have weight field'
    )

    t.equal(
      parcel.trackingData.carrier,
      undefined,
      'Second parcel should not have carrier field'
    )

    t.equal(
      parcel.trackingData.isReturn,
      undefined,
      'Second parcel should not have isReturn field'
    )

    t.end()
  })
  deliveriesParser.parse(readStream, outputStream)
})

test(`DeliveriesCsvParser::parse
  should parse CSV with multiple parcels without measurements`, (t) => {
  const deliveriesParser = new DeliveriesCsvParser(
    logger
  )
  const readStream = fs.createReadStream(
    // eslint-disable-next-line max-len
    path.join(__dirname, deliveriesTestFolder, 'parcel-without-measurements.csv')
  )
  const outputStream = StreamTest['v2'].toText((err, _result) => {
    const result = JSON.parse(_result)

    const _mockResult = [
      {
        id: '1',
        items: [
          { _groupId: '1', id: '123', quantity: 1 },
          { _groupId: '2', id: '345', quantity: 10 },
          { _groupId: '3', id: '678', quantity: 90 },
          { _groupId: '4', id: '908', quantity: 100 },
        ],
        parcels: [
          {
            id: '1',
            trackingData: {
              trackingId: '123456789',
              carrier: 'DHL',
              provider: 'provider 1',
              providerTransaction: 'provider transaction 1',
              isReturn: false,
            },
          },
          {
            id: '2',
            trackingData: {
              trackingId: '1111',
              carrier: 'PPL',
              provider: 'provider 2',
              providerTransaction: 'provider transaction 2',
              isReturn: true,
            },
          },
          {
            id: '3',
            trackingData: {
              trackingId: '2222',
              carrier: 'DHL',
              provider: 'provider 3',
              providerTransaction: 'provider transaction 3',
              isReturn: true,
            },
          },
        ],
      },
      {
        id: '2',
        items: [
          { _groupId: '2', id: '345', quantity: 10 },
        ],
        parcels: [
          {
            id: '2',
            trackingData: {
              trackingId: '123456789',
              carrier: 'DHL',
              provider: 'provider 1',
              providerTransaction: 'provider transaction 1',
              isReturn: false,
            },
          },
        ],
      },
    ]

    t.deepEqual(
      result,
      _mockResult,
      'delivery objects are processed correctly'
    )

    t.end()
  })
  deliveriesParser.parse(readStream, outputStream)
})

