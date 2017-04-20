[![commercetools logo][commercetools-icon]][commercetools]

# CSV Parser Orders
[![Travis Build Status][travis-icon]][travis]
[![Codecov Coverage Status][codecov-icon]][codecov]
[![David Dependencies Status][david-icon]][david]
[![David devDependencies Status][david-dev-icon]][david-dev]

Convert [commercetools orders](http://dev.commercetools.com/http-api-projects-orders.html) CSV data to JSON

This module is [_update actions_](http://dev.commercetools.com/http-api-projects-orders.html#update-actions) based.
Update actions currently supported is:
- [Add ReturnInfo](http://dev.commercetools.com/http-api-projects-orders.html#add-returninfo)
- [Change the state of LineItem according to allowed transitions](http://dev.commercetools.com/http-api-projects-orders.html#change-the-state-of-lineitem-according-to-allowed-transitions)

## Usage

```bash
npm install @commercetools/csv-parser-orders -g
```

### CLI
```
Usage: csvparserorders [options]
Convert commercetools orders CSV data to JSON.

Options:
  --help, -h        Show help text.                                    [boolean]
  --version, -v     Show version number.                               [boolean]
  --type, -t        Predefined type of csv
                             [required] [choices: "lineitemstate", "returninfo"]
  --inputFile, -i   Path to CSV file.                         [default: "stdin"]
  --outputFile, -o  Input CSV file.                          [default: "stdout"]
  --batchSize, -b   Number of CSV rows to handle simultaneously.  [default: 100]
  --delimiter, -d   Used CSV delimiter.                           [default: ","]
  --strictMode, -s  Parse CSV strictly.                          [default: true]
  --projectKey, -p  API project key.                                  [required]
  --host            HTTP client host parameter.
  --protocol        HTTP client protocol parameter.
  --accessToken     HTTP client access token.
  --logLevel        Logging level: error, warn, info or verbose.
                                                               [default: "info"]
```
When running with `--outputFile` set, logging information is shown directly otherwise it goes to `csvparserorders.log` with the exception of fatal errors.

### JS
You can also use this tool as a required module

```js
import { LineItemStateCsvParser } from '@commercetools/csv-parser-orders'
import fs from 'fs'

const apiCredentials = {
    project_key: process.env.CM_PROJECT_KEY,
    client_id: '*********',
    client_secret: '*********'
};

const lineitemstate = new LineItemStateCsvParser(
  {
    config: apiCredentials,
    access_token: <access_token>,
  },
  {
    error: console.error,
    warn: console.warn,
    info: console.log,
    verbose: console.log,
  },
  {
    strictMode: true
  }
)

lineItemState.parse(
  fs.createReadStream('./input.csv'),
  fs.createWriteStream('./output.json')
);
```

Errors on the level `error` come from events that are fatal and thus stop the stream of data

Data is exported in JSON in this format

```json
[{
  "orderNumber": "234",
  "lineItems": [{
    "state": [{
      "quantity": 10,
      "fromState": "processing",
      "toState": "shipped"
    }]
  }]
}]
```

## Configuration
`CsvParserOrders` main methods accepts three objects as arguments:
- API client config (_required_)
  - See the [SDK client documentation](http://sphereio.github.io/sphere-node-sdk/classes/SphereClient.html) for more information.
- Logger takes object with four functions (_optional_)
- Config (_optional_)
  - `batchSize`: number of CSV rows to handle simultaneously. (_default_: `100`)
  - `delimiter`: the used CSV delimiter (_default_: `,`)
  - `strictMode`: whether to parse the CSV strictly (_default_: `true`)

## Sample CSV format
- [ReturnInfo](https://github.com/commercetools/csv-parser-orders/blob/master/test/helpers/return-info-sample.csv)
- [LineItemState](https://github.com/commercetools/csv-parser-orders/blob/master/test/helpers/lineitemstate-sample.csv)

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) for info on contributing to eslint-config

[commercetools]: https://commercetools.com/
[commercetools-icon]: https://cdn.rawgit.com/commercetools/press-kit/master/PNG/72DPI/CT%20logo%20horizontal%20RGB%2072dpi.png
[travis]: https://travis-ci.org/commercetools/csv-parser-orders
[travis-icon]: https://img.shields.io/travis/commercetools/csv-parser-orders/master.svg?style=flat-square
[codecov]: https://codecov.io/gh/commercetools/csv-parser-orders
[codecov-icon]: https://img.shields.io/codecov/c/github/commercetools/csv-parser-orders.svg?style=flat-square
[david]: https://david-dm.org/commercetools/csv-parser-orders
[david-icon]: https://img.shields.io/david/commercetools/csv-parser-orders.svg?style=flat-square
[david-dev]: https://david-dm.org/commercetools/csv-parser-orders?type=dev
[david-dev-icon]: https://img.shields.io/david/dev/commercetools/csv-parser-orders.svg?style=flat-square
