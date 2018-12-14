# Stellar Batch Payment Library
[![Version](https://img.shields.io/npm/v/stellar-batch-payment.svg)](https://www.npmjs.org/package/stellar-batch-payment)
[![Build Status](https://api.travis-ci.org/dolcalmi/stellar-batch-payment.svg?branch=master)](https://travis-ci.org/dolcalmi/stellar-batch-payment)
[![Coverage Status](https://coveralls.io/repos/github/dolcalmi/stellar-batch-payment/badge.svg?branch=master)](https://coveralls.io/github/dolcalmi/stellar-batch-payment?branch=master)
[![David](https://img.shields.io/david/dolcalmi/stellar-batch-payment.svg)](https://david-dm.org/dolcalmi/stellar-batch-payment)
[![David](https://img.shields.io/david/dev/dolcalmi/stellar-batch-payment.svg)](https://david-dm.org/dolcalmi/stellar-batch-payment?type=dev)
[![Try on RunKit](https://badge.runkitcdn.com/stellar-batch-payment.svg)](https://runkit.com/npm/stellar-batch-payment)

Batch payment library for [Stellar](https://www.stellar.org/)
## Installation

Install the package with:

    npm install stellar-batch-payment --save

## Usage

The library needs to be configured with fee payer accounts (max 50) or the signers will be used as a fee payers.

``` js
const BatchPayment = require('stellar-batch-payment');

const batchPayment = new BatchPayment({
  feePayersSecrets: [ 'SDL...A2J', 'SFK...ABJ', ... ]
});
```

## Configuration

All configuration parameters are optional.

- **batchSize**\
Number of payments per transaction.\
Default value: `100`
- **feePayersSecrets**\
Array of fee payers secret keys .\
Default value: `[]`
- **useTestnet**\
if true then the testnet will be used.\
Default value: `true`
- **testNetUri**\
Testnet horizon uri.\
Default value: `"https://horizon-testnet.stellar.org"`
- **publicNetUri**\
Public horizon uri.\
Default value: `"https://horizon.stellar.org"`

### Batch payments from csv

The csv file must have the next headers:

```
amount, destination, asset.code, asset.issuer, memo.value, memo.type
```
- destination can be Ed25519 public key or federated addresses
- if the payment is XLM then the issuer can be empty
- memo fields are optional

``` js
const stream = batchPayment.fromCsv(
  'GDN...F2K', // source public key
  ['SKY...MZQ'], // signers of source account - secret keys
  'source.csv' // source csv file path
);

const outputStream = fs.createWriteStream('output.csv');
outputStream.write(`transactionId, error, amount, destination, asset.code, asset.issuer, memo.value, memo.type`)

stream.on('data', (item) => {
  const { items, transactionId, error } = item;
  let err = error || '';
  items.forEach((i) => {
    const { amount, asset, destination, memo } = i;
    outputStream.write('\r\n');
    outputStream.write(`${transactionId}, ${err}, ${amount}, ${destination}, ${asset.code}, ${asset.issuer}, ${JSON.stringify(memo && (memo.value || memo || ''))}, ${memo && (memo.type || '')}`)
  });
});
```

### Batch payments from array

``` js

const payments = [];

for (var i = 0; i < 10; i++) {
  payments.push({
    // asset: { code: 'XLM',  issuer: '' },
    // memo: { type: 'text',  value: 'my memo' },
    asset: { code: 'MyAsset', issuer: 'GCN...S2K' },
    amount: 1,
    destination: 'GCD...FXP',
  });
}
batchPayment.fromArray(
  'GDN...F2K', // source public key
  ['SKY...MZQ'], // signers of source account - secret keys
  payments // array of payments
)
.then((result) => {
  console.log('response', result);
});
```
### Batch payments from stream (object mode)

``` js
const payments = new Stream.Readable({objectMode: true});

const stream = batchPayment.fromStream(
  'GDN...F2K', // source public key
  ['SKY...MZQ'], // signers of source account - secret keys
  payments // source stream (object mode)
);

stream.on('data', (item) => {
  const { items, transactionId, error } = item;
  let err = error || '';
  items.forEach((i) => {
    const { amount, asset, destination, memo } = i;
    console.log(`${transactionId}, ${err}, ${amount}, ${destination}, ${asset.code}, ${asset.issuer}, ${JSON.stringify(memo && (memo.value || memo || ''))}, ${memo && (memo.type || '')}`)
  });
});

for (var i = 0; i < 1000; i++) {
  payments.push({
    // asset: { code: 'XLM',  issuer: '' },
    // memo: { type: 'text',  value: 'my memo' },
    asset: { code: 'MyAsset', issuer: 'GCN...S2K' },
    amount: 1,
    destination: 'GCD...FXP',
  });
}

// end the stream
payments.push(null)
```

## Development

Run all tests:

```bash
$ npm install
$ npm test
```

Run a single test suite:

```bash
$ npm run mocha -- test/Error.spec.js
```

Run a single test (case sensitive):

```bash
$ npm run mocha -- test/Batch.spec.js --grep 'Pay from Array'
```
