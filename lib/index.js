'use strict';

const merge = require('lodash.merge');
const WaitQueue = require('wait-queue')

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

  payWithStream(sourcePrivate, paymentsStream, outputStream) {
    const payers = this._getPayers(sourcePrivate);

    paymentsStream
      .pipe(new ChunkStream(this.options.batchSize))
      .pipe(new PayStream(utils.parseSecret(sourcePrivate), payers, this.options))
      .pipe(outputStream);
  },

  _getPayers(sourcePrivate) {
    const payers = new WaitQueue();
    if (this.feePayersSecrets.length <= 0) {
      this.feePayersSecrets.push(sourcePrivate);
    }
    this.feePayersSecrets.forEach(s => {
      payers.push(utils.parseSecret(s));
    });
    return payers;
  }

};

module.exports = BatchPayment;
