'use strict';

const WaitQueue = require('wait-queue')
const merge = require('lodash.merge');
const streamify = require('stream-array');

const ChunkStream = require('./helpers/chunk-stream');
const PayStream = require('./helpers/pay-stream');
const utils = require('./helpers/utils');

const BP_PUBLIC_NET = 'https://horizon.stellar.org';
const BP_TEST_NET = 'https://horizon-testnet.stellar.org';

function BatchPayment(options) {
  this.options = merge({
    batchSize: 100,
    feePayersSecrets: [],
    useTestnet: true,
    testNetUri: BP_TEST_NET,
    publicNetUri: BP_PUBLIC_NET,
  }, options);

  if (this.options.batchSize <= 0 || this.options.batchSize > 100) {
    this.options.batchSize = 100;
  }

  this.feePayersSecrets = this.options.feePayersSecrets;
}

BatchPayment.prototype = {

  pay(sourceSecret, paymentsArray) {
    const os = this.payWithStream(sourceSecret, streamify(paymentsArray))

    let count = 0;
    const chunks = paymentsArray.length / this.options.batchSize;
    os.on('data', () => {
      count++;
      if (count >= chunks) {
        os.end();
      }
    });

    return utils.streamToArray(os);
  },

  payWithStream(sourceSecret, paymentsStream) {
    const payers = this._getPayers(sourceSecret);

    return paymentsStream
      .pipe(new ChunkStream(this.options.batchSize))
      .pipe(new PayStream(utils.parseSecret(sourceSecret), payers, this.options));
  },

  _getPayers(sourceSecret) {
    const payers = new WaitQueue();
    if (this.feePayersSecrets.length <= 0) {
      this.feePayersSecrets.push(sourceSecret);
    }
    this.feePayersSecrets.forEach(s => {
      payers.push(utils.parseSecret(s));
    });
    return payers;
  }

};

module.exports = BatchPayment;
