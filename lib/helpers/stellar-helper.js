'use strict';

const StellarSdk = require('stellar-sdk');
const utils = require('./utils');
const uniqBy = require('lodash.uniqby');

function configServer(options) {
  let uri = options.testNetUri;
  if (options.useTestnet) {
    StellarSdk.Network.useTestNetwork();
  } else {
    uri = options.publicNetUri;
    StellarSdk.Network.usePublicNetwork();
  }

  return new StellarSdk.Server(uri);
}

// Provide extension mechanism for Sub-Classes
StellarHelper.extend = utils.protoExtend;

function StellarHelper(options) {
  this.server = configServer(options);

  this.initialize.apply(this, arguments);
}

StellarHelper.prototype = {

  initialize: function() {},

  loadAccount(publicKey) {
    return this.getServer().loadAccount(publicKey);
  },

  getServer() {
    return this.server;
  },

  buildAndSubmit(transaction, signers) {
    let tx = transaction.build();
    uniqBy(signers, function (s) {
      return s.publicKey();
    })
    .forEach(function (keypair) {
      tx.sign(keypair);
    });

    return this.getServer().submitTransaction(tx);
  },

};

module.exports = StellarHelper;
