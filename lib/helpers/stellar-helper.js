'use strict';

const StellarSdk = require('stellar-sdk');
const uniqBy = require('lodash.uniqby');
const debug = require('debug')('stellar-batch-payment:info');

const utils = require('./utils');

function configServer(options) {
  let uri = options.testNetUri;
  if (options.useTestnet) {
    StellarSdk.Network.useTestNetwork();
    debug(`setting up stellar testnet network with ${uri}`)
  } else {
    uri = options.publicNetUri;
    StellarSdk.Network.usePublicNetwork();
    debug(`setting up stellar public network with ${uri}`)
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
    let tx = transaction
      .setTimeout(StellarSdk.TimeoutInfinite)
      .build();
      
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
