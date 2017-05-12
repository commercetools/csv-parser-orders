import _ from 'underscore'
import objectPath from 'object-path'
import highland from 'highland'
import JSONStream from 'JSONStream'
import csv from 'csv-parser'
import CONS from './constants'

export default class AddReturnInfoCsvParser {
  constructor (logger, config = {}) {
    /* eslint-disable no-console */
    this.logger = logger || {
      error: console.error,
      warn: console.warn,
      info: console.log,
      verbose: console.log,
    }
    /* eslint-enable no-console */

    this.config = _.defaults(config, CONS.standardOption)
  }

  parse (input, output) {
    this.logger.info('Starting Return Info CSV conversion')

    let rowIndex = 1

    return highland(input)
      .through(csv({
        separator: this.config.delimiter,
        strict: this.config.strictMode,
      }))
      .batch(this.config.batchSize)
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
      .reduce([], (results, newDelivery) => {
        /*
         Reduce deliveries by delivery.id
         1. Group all delivery items by itemGroupId
         2. Group all parcel items by parcel.id
         */

        // if newDelivery is the first record, just push it to the results
        if (!results.length)
          return [newDelivery]

        // find newDelivery in results using its id
        const existingDelivery = results.find(
          delivery => delivery.id === newDelivery.id
        )

        // if this delivery is not yet in results array, insert it
        if (!existingDelivery)
          results.push(newDelivery)
        else {
          AddReturnInfoCsvParser._mergeDeliveryItems(
            existingDelivery.items, newDelivery.items[0], existingDelivery)

          // if delivery have parcels, merge them
          if (newDelivery.parcels)
            AddReturnInfoCsvParser._mergeDeliveryParcels(
              existingDelivery.parcels, newDelivery.parcels[0], existingDelivery
            )
        }

        return results
      })
      .stopOnError(error => this.logger.error(error))
      .pipe(JSONStream.stringify(false))
      .pipe(output)
  }

  // merge delivery parcels to one array based on parcel.id field
  static _mergeDeliveryParcels (allParcels, newParcel, delivery) {
    // try to find this parcel in array using parcel id
    const duplicitParcel = allParcels.find(
      parcel => parcel.id === newParcel.id
    )

    // if this parcel item is not yet in array, insert it
    if (!duplicitParcel)
      return allParcels.push(newParcel)

    // if this parcel is already in array, check if parcels are equal
    if (!_.isEqual(duplicitParcel, newParcel))
      throw new Error(`Delivery with id '${delivery.id}' has a parcel with`
        + ` id '${newParcel.id}' which has different`
        + ` values across multiple rows.
        Original parcel: '${JSON.stringify(duplicitParcel)}'
        Invalid parcel: '${JSON.stringify(newParcel)}'`
      )

    return allParcels
  }

  // merge delivery items to one array based on _groupId field
  static _mergeDeliveryItems (allItems, newItem, delivery) {
    const duplicitItem = allItems.find(
      item => item._groupId === newItem._groupId
    )

    // if an item is not yet in array, insert it
    if (!duplicitItem)
      return allItems.push(newItem)

    // if this item is already in array, check if items are equal
    if (!_.isEqual(duplicitItem, newItem))
      throw new Error(`Delivery with id '${delivery.id}' has an item`
        + ` with itemGroupId '${newItem._groupId}' which has different`
        + ` values across multiple rows.
        Original row: '${JSON.stringify(duplicitItem)}'
        Invalid row: '${JSON.stringify(newItem)}'`
      )

    return allItems
  }

  // take objectized CSV row and create a delivery object from it
  processData (data) {
    this.logger.verbose('Processing data to CTP format')
    const csvHeaders = _.keys(data)
    const headerDiff = _.difference(CONS.requiredHeaders.deliveries, csvHeaders)

    if (headerDiff.length)
      return Promise.reject(
        `Required headers missing: '${headerDiff.join(',')}'`
      )

    /**
     * Sample delivery object that the API supports
     * {
     *   "id": string,
     *   "createdAt": DateTime,
     *   "items": [
     *     {
     *       "id": string,
     *       "quantity": number
     *     }
     *   ],
     *   "parcels": [
     *     {
     *       "id": string,
     *       "createdAt": DateTime,
     *       "measurements": {
     *         "heightInMillimeter": Number,
     *         "lengthInMillimeter": Number,
     *         "widthInMillimeter": Number,
     *         "weightInGram": Number
     *       }
     *       "trackingData": {
     *         "trackingId": string,
     *         "provider": string,
     *         "providerTransaction": string,
     *         "carrier": string,
     *         "isReturn": boolean
     *       }
     *     }
     *   ]
     * }
     */

    // Basic delivery object with delivery item
    const result = {
      id: data['delivery.id'],
      items: [
        {
          _groupId: data['itemGroupId'],
          id: data['item.id'],
          quantity: parseInt(data['item.quantity'], 10),
        },
      ],
    }

    // Add parcel info if it is present
    if (data['parcel.id'])
      result.parcels = [AddReturnInfoCsvParser._parseParcelInfo(data)]

    return Promise.resolve(result)
  }

  static _parseParcelInfo (data) {
    const transitionMap = {
      'parcel.height': 'measurements.heightInMillimeter',
      'parcel.length': 'measurements.lengthInMillimeter',
      'parcel.width': 'measurements.widthInMillimeter',
      'parcel.weight': 'measurements.weightInGram',
      'parcel.trackingId': 'trackingData.trackingId',
      'parcel.providerTransaction': 'trackingData.providerTransaction',
      'parcel.provider': 'trackingData.provider',
      'parcel.carrier': 'trackingData.carrier',
      'parcel.isReturn': 'trackingData.isReturn',
    }

    const parcel = {
      id: data['parcel.id'],
    }

    // Build parcel object
    Object.keys(data).forEach((fieldName) => {
      if (!transitionMap[fieldName])
        return

      // All values are loaded as a string
      let fieldValue = data[fieldName]

      // do not set empty values
      if (fieldValue === '')
        return

      // Cast measurements to Number
      if (/^measurements/.test(transitionMap[fieldName]))
        fieldValue = Number(fieldValue)

      // Cast isReturn field to Boolean
      if (fieldName === 'parcel.isReturn')
        fieldValue = fieldValue === '1'

      objectPath.set(parcel, transitionMap[fieldName], fieldValue)
    })

    return parcel
  }
}
