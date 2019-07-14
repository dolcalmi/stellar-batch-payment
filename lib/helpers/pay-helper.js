'use strict';

const _ = require('highland');
const merge = require('lodash.merge');
const debug = require('debug')('stellar-batch-payment:info');
const debugError = require('debug')('stellar-batch-payment:error');

const utils = require('./utils');
const TxHelper = require('./transaction-helper');
const StellarHelper = require('./stellar-helper');

const isString = str => ((typeof str === 'string') || (str instanceof String));
const hasMemo = memo => memo && (isString(memo) || memo.value || memo.type);

const parseError = (err) => {
  if (err.response) {
    return JSON.stringify(err.response.data ? err.response.data.extras.result_codes : err.response);
  }
  return err.message || err;
}

module.exports = {
  validate(paymentsStream, options) {
    debug('validating data');
    return _(paymentsStream)
      .map((d) => {
        const data = Buffer.isBuffer(d) || isString(d) ? JSON.parse(d.toString()) : d;
        if (!hasMemo(data.memo)) {
          data.memo = null;
        }
        if (utils.isValidAmount(data.amount)) {
          if (utils.isValidPublicKey(data.destination)) {
            return _(Promise.resolve(data));
          }
          if (utils.isValidAddress(data.destination)) {
            return _(utils.resolveAddress(data.destination)
            .then((r) => {
              return merge(data, r);
            })
            .catch(() => {
              return merge(data, { invalid: true });
            }));
          }
        }
        return _(Promise.resolve(merge(data, { invalid: true })));
      })
      .parallel(options.batchSize)
  },

  pay(paymentStream, sourcePublic, signersKeypairs, payers, options) {
    debug(`building payment's batches of ${options.batchSize} items`);
    const stellarHelper = new StellarHelper(options);

    const validWithoutMemo = paymentStream
      .fork()
      .filter((d) => !d.invalid && !d.memo )
      .batch(options.batchSize)
      .map((d) => stellarPay(sourcePublic, d, signersKeypairs, payers, stellarHelper, options))
      .parallel(options.batchSize);

    const validWithMemo = paymentStream
      .fork()
      .filter((d) => !d.invalid && d.memo )
      .batch(1)
      .map((d) => stellarPay(sourcePublic, d, signersKeypairs, payers, stellarHelper, options))
      .parallel(options.batchSize);

    return _([validWithMemo, validWithoutMemo]).merge();
  }
};

function stellarPay(senderAccount, payments, signers, payerQueue, stellarHelper, options) {
  const result = payerQueue.shift()
    .then( payer => {
      debug(`locking payer ${payer.publicKey()} to pay ${payments.length} items`);
      return stellarHelper
        .loadAccount(payer.publicKey())
        .then(account => {
          const txh = new TxHelper(account, options.fee);
          payments.forEach((r) => {
            if (payments.length > 1) {
              if (r.memo) {
                debugError('Internal error. Memo requires only one payment');
                throw new Error('Internal error. Memo requires only one payment');
              } else if (options.defaultMemo) {
                txh.addMemo(options.defaultMemo);
              }
            } else {
              txh.addMemo(r.memo);
            }
            txh.addPayment(senderAccount, r.destination, r.amount, r.asset);
          });

          const signersCopy = signers.slice(0); // clone array
          signersCopy.push(payer);

          return stellarHelper.buildAndSubmit(txh.getTransaction(), signersCopy);
        })
        .then((response) => {
          debug(`${payments.length} items paid with transaction id ${response.hash}`);
          return {
            transactionId: response.hash,
            items: payments,
          }
        })
        .catch((err) => {
          const e = parseError(err);
          debugError(e);
          return {
            transactionId: null,
            error: e,
            items: payments,
          }
        })
        .then(r => {
          debug(`releasing payer ${payer.publicKey()}`);
          payerQueue.push(payer);
          return r;
        });
    });

  return _(result);
}
