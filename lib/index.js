'use strict';

const fs = require('fs');
const csv = require('csvtojson');
const WaitQueue = require('wait-queue');
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

  fromCsv(sourcePublic, signers, csvFilePath, csvOptions) {
    const readStream = fs.createReadStream(csvFilePath);
    return this.fromStream(sourcePublic, signers, readStream.pipe(csv(csvOptions || {})))
  },

  fromArray(sourcePublic, signers, paymentsArray) {
    const os = this.fromStream(sourcePublic, signers, streamify(paymentsArray.concat([null])))

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

  fromStream(sourcePublic, signers, paymentsStream) {
    const signersKeypairs = [];
    signers.forEach(s => {
      signersKeypairs.push(utils.parseSecret(s));
    });

    const payers = this._getPayers(signersKeypairs);

    return paymentsStream
      .pipe(new ChunkStream(this.options.batchSize))
      .pipe(new PayStream(sourcePublic, signersKeypairs, payers, this.options));
  },

  _getPayers(signersKeypairs) {
    const payers = new WaitQueue();
    if (this.feePayersSecrets.length <= 0) {
      signersKeypairs.forEach(kp => {
        this.feePayersSecrets.push(kp);
      });
    }
    this.feePayersSecrets.forEach(s => {
      payers.push(utils.parseSecret(s));
    });
    return payers;
  }

};

module.exports = BatchPayment;
