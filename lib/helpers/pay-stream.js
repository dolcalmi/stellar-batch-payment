'use strict';

const stream = require('stream');
const util = require('util');

const StellarHelper = require('./stellar-helper');
const TxHelper = require('./transaction-helper');

function PayStream (senderAccount, payerQueue, stellarOptions) {
  this._senderAccount = senderAccount;
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
            txh.addPayment(self._senderAccount.publicKey(), r.destination, r.amount, r.asset);
          });
          const signers = [payer];
          if (payer.publicKey() !== self._senderAccount.publicKey()) {
            signers.push(self._senderAccount);
          }
          return self._stellarHelper.buildAndSubmit(txh.getTransaction(), signers);
        })
        .then((response) => {
          return {
            transactionId: response.hash,
            items: chunk,
          }
        })
        .catch(( /*err */) => {
          // console.log('An error has occured:', JSON.stringify(err.response.data ? err.response.data.extras.result_codes : err.response));
          return {
            transactionId: null,
            items: chunk,
          }
        })
        .then(r => {
          self._payerQueue.push(payer);
          self.push(r)
        });

      done();
    });
};

module.exports = PayStream;
