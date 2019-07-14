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
    defaultMemo: '',
    feePayersSecrets: [],
    fee: 100,
    publicNetUri: BP_PUBLIC_NET,
    testNetUri: BP_TEST_NET,
    useTestnet: true,
  }, options);

  if (this.options.defaultMemo && !utils.hasValidMemoTextSize(this.options.defaultMemo)) {
    throw new Error('Default memo accepts a string of up to 28 bytes and cannot contain only whitespace.');
  }

  if (this.options.batchSize <= 0 || this.options.batchSize > 100) {
    this.options.batchSize = 100;
  }

  this.feePayersSecrets = this.options.feePayersSecrets || [];
  if (this.feePayersSecrets.length <= 0) {
    throw new Error('feePayersSecrets option is required');
  }

  const feePayers = new WaitQueue();
  this.feePayersSecrets.forEach(s => {
    feePayers.push(utils.parseSecret(s));
  });
  this.feePayers = feePayers;
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

    const paymentsStream = PayHelper.validate(payments, this.options);

    const validPayments = PayHelper.pay(
      paymentsStream,
      sourcePublic,
      signersKeypairs,
      this.feePayers,
      this.options
    );

    const invalidPayments = paymentsStream
      .fork()
      .filter((d) => d.invalid)
      .collect()
      .map((items) => {
        if (items && items.length > 0) {
          return {
            transactionId: null,
            error: 'invalid data',
            items,
          };
        }
        return null;
      });

    invalidPayments.resume();
    validPayments.resume();

    const s = _([validPayments, invalidPayments]).merge().compact();

    s.on('end', () => {
      debug('finish');
    });

    return s;
  },

};

module.exports = BatchPayment;
