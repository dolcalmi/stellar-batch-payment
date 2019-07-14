'use strict';

const StellarSdk = require('stellar-sdk');
const utils = require('./utils');

// Provide extension mechanism for Sub-Classes
TxHelper.extend = utils.protoExtend;

function TxHelper(source, baseFee) {
  this.txb = new StellarSdk.TransactionBuilder(source, {
    fee: baseFee || StellarSdk.BASE_FEE,
  });

  this.initialize.apply(this, arguments);
}

TxHelper.prototype = {

  initialize: function() {},

  getTransaction() {
    return this.txb;
  },

  addMemo(memo) {
    const content = utils.parseMemo(memo);
    if (content) {
      this.txb.addMemo(content);
    }
    return this;
  },

  addPayment(source, destination, amount, asset) {
    this.txb.addOperation(StellarSdk.Operation.payment({
      source,
      destination,
      asset: utils.parseAsset(asset || 'XLM'),
      amount: amount + '',
    }));
    return this;
  },

};

module.exports = TxHelper;
