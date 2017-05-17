const CONSTANTS = {

  requiredHeaders: {
    lineItemState: [
      'orderNumber',
      'lineItemId',
      'quantity',
      'fromState',
      'toState',
    ],
    returnInfo: [
      'orderNumber',
      'quantity',
      'lineItemId',
      'shipmentState',
      '_returnId',
    ],
    deliveries: [
      'delivery.id',
      '_itemGroupId',
      'item.id',
      'item.quantity',
    ],
  },
  standardOption: {
    batchSize: 100,
    delimiter: ',',
    strictMode: true,
  },
}

// Go through object because `freeze` works shallow
Object.keys(CONSTANTS).forEach((key) => {
  Object.freeze(CONSTANTS[key])
})

export default CONSTANTS
