'use strict';

const _ = require('highland');
const fs = require('fs');
const csv = require('csvtojson');
const WaitQueue = require('wait-queue');
const merge = require('lodash.merge');
const debug = require('debug')('stellar-batch-payment:info');

const PayHelper = require('./helpers/pay-helper');
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
    const os = this.fromStream(sourcePublic, signers, paymentsArray)
      .collect()
      .toPromise(Promise);

    return os;
  },

  fromStream(sourcePublic, signers, payments) {
    debug('init');
    const signersKeypairs = [];
    signers.forEach(s => {
      signersKeypairs.push(utils.parseSecret(s));
    });

    const payers = this._getPayers(signersKeypairs);

    const paymentsStream = PayHelper.validate(payments, this.options);

    const validPayments = PayHelper.pay(
      paymentsStream,
      sourcePublic,
      signersKeypairs,
      payers,
      this.options
    );

    const invalidPayments = paymentsStream
      .fork()
      .filter((d) => d.invalid)
      .collect()
      .map((items) => {
        return {
          transactionId: null,
          error: 'invalid data',
          items,
        };
      });

    invalidPayments.resume();
    validPayments.resume();

    const s = _([validPayments, invalidPayments]).merge();

    s.on('end', () => {
      debug('finish');
    });

    return s;
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
