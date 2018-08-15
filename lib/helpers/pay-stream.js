'use strict';

const stream = require('stream');
const util = require('util');

const StellarHelper = require('./stellar-helper');
const TxHelper = require('./transaction-helper');

const parseError = (err) => {
  if (err.response) {
    return JSON.stringify(err.response.data ? err.response.data.extras.result_codes : err.response);
  }
  return err.message || err;
}

function PayStream (senderAccount, signers, payerQueue, stellarOptions) {
  this._senderAccount = senderAccount;
  this._signers = signers;
  this._stellarHelper = new StellarHelper(stellarOptions);

  this._payerQueue = payerQueue;

  stream.Transform.call(this, { objectMode: true });
}

util.inherits(PayStream, stream.Transform);

PayStream.prototype._transform = function (chunk, encoding, done) {

  const self = this;

  this._payerQueue.shift()
    .then( payer => {

      this._stellarHelper.loadAccount(payer.publicKey())
        .then(account => {
          const txh = new TxHelper(account);
          chunk.forEach(function(r) {
            txh.addPayment(self._senderAccount, r.destination, r.amount, r.asset);
          });

          const signers = this._signers.slice(0); // clone array
          signers.push(payer);

          return self._stellarHelper.buildAndSubmit(txh.getTransaction(), signers);
        })
        .then((response) => {
          return {
            transactionId: response.hash,
            items: chunk,
          }
        })
        .catch((err) => {
          // console.log('error: ', parseError(err));
          return {
            transactionId: null,
            error: parseError(err),
            items: chunk,
          }
        })
        .then(r => {
          self._payerQueue.push(payer);
          self.push(r);
          // self.push((r.transactionId || r.error)+ '\n')
        });

      done();
    });
};

module.exports = PayStream;
