const CONSTANTS = {
  requiredHeaders: [
    'orderNumber',
    'lineItemId',
    'quantity',
    'fromState',
    'toState',
  ],

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
