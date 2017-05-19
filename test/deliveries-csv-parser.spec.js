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
    t.equal(JSON.parse(result).length, 2, 'All rows in the csv are parsed')
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
      // eslint-disable-next-line max-len
      /Required headers missing: 'orderNumber,item\.quantity'/.test(spy.args[0][0]),
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
    orderNumber: '222',
    'delivery.id': '1',
    _itemGroupId: '1',
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
    const _mockResult = {
      orderNumber: '222',
      shippingInfo: {
        deliveries: [{
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
        }],
      },
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
    const orders = JSON.parse(_result)
    t.equal(
      orders.length,
      2,
      'There should be 2 order objects'
    )

    // First order
    t.equal(
      orders[0].orderNumber,
      '222',
      'First order should have a correct orderNumber'
    )

    let deliveries = orders[0].shippingInfo.deliveries
    t.equal(
      deliveries.length,
      3,
      'There should be 3 delivery objects'
    )

    let delivery = deliveries.find(d => d.id === '1')
    t.equal(
      delivery.items.length,
      3,
      'First delivery should have 3 delivery items'
    )

    delivery = deliveries.find(d => d.id === '2')
    t.equal(
      delivery.items.length,
      1,
      'Second delivery should have 1 delivery item'
    )

    delivery = deliveries.find(d => d.id === '3')
    t.equal(
      delivery.items.length,
      4,
      'Third delivery should have 4 delivery items'
    )

    // Second order
    t.equal(
      orders[1].orderNumber,
      '100',
      'Second order should have a correct orderNumber'
    )

    deliveries = orders[1].shippingInfo.deliveries
    t.equal(
      deliveries.length,
      1,
      'There should be 1 delivery object'
    )

    t.equal(
      deliveries[0].id,
      '1',
      'First delivery should have a correct ID'
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
    path.join(__dirname, deliveriesTestFolder, 'delivery-with-parcel.csv')
  )
  const outputStream = StreamTest['v2'].toText((err, _result) => {
    const orders = JSON.parse(_result)

    t.equal(
      orders.length,
      2,
      'There should be two orders'
    )

    // First order
    t.equal(
      orders[0].orderNumber,
      '222',
      'First order should have a correct orderNumber'
    )

    t.equal(
      orders[0].shippingInfo.deliveries.length,
      1,
      'First order should have only one delivery'
    )

    const deliveries = orders[0].shippingInfo.deliveries
    t.equal(
      deliveries.length,
      1,
      'First order should have only one delivery '
    )

    const deliveryParcels = deliveries[0].parcels
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
      parcel.trackingData.carrier,
      undefined,
      'Second parcel should not have carrier field'
    )

    t.equal(
      parcel.trackingData.isReturn,
      true,
      'Second parcel should not have isReturn field'
    )

    // Second order
    t.equal(
      orders[1].orderNumber,
      '111',
      'Second order should have a correct orderNumber'
    )

    t.equal(
      orders[1].shippingInfo.deliveries.length,
      1,
      'First order should have only one delivery'
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

    const _mockResultDeliveries = [
      {
        id: '1',
        items: [
          { id: '123', quantity: 1 },
          { id: '345', quantity: 10 },
          { id: '678', quantity: 90 },
          { id: '908', quantity: 100 },
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
          { id: '345', quantity: 10 },
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

    const _mockResult = [{
      orderNumber: '222',
      shippingInfo: {
        deliveries: _mockResultDeliveries,
      },
    }]

    t.deepEqual(
      result,
      _mockResult,
      'delivery objects are processed correctly'
    )

    t.end()
  })
  deliveriesParser.parse(readStream, outputStream)
})


test(`DeliveriesCsvParser::parse
  should return error when not all measurements are provided`, (t) => {
  const spy = sinon.stub(logger, 'error')
  const deliveriesParser = new DeliveriesCsvParser(
    logger
  )
  const readStream = fs.createReadStream(
    // eslint-disable-next-line max-len
    path.join(__dirname, deliveriesTestFolder, 'delivery-error-measurements.csv')
  )
  const outputStream = StreamTest['v2'].toText((err) => {
    t.ok(
      /All measurement fields are mandatory/.test(spy.args[0][0]),
      'Error with missing measurements'
    )
    logger.error.restore()
    t.notOk(err)
    t.end()
  })
  deliveriesParser.parse(readStream, outputStream)
})
