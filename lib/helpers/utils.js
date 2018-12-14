'use strict';

const StellarSdk = require('stellar-sdk');
const hasOwn = {}.hasOwnProperty;

module.exports = {

  resolveAddress(address, federationServer) {
    if (!this.isValidAddress(address)) {
      return Promise.reject(new Error('Invalid address'))
    }

    let resolve = null;

    if (federationServer) {
      resolve = federationServer.resolveAddress(address);
    }

    resolve = resolve || StellarSdk.FederationServer.resolve(address);

    return resolve
      .then((federationRecord) => {
        if (!this.isValidPublicKey(federationRecord.account_id)) {
          throw new Error('Invalid account_id from federation response');
        }
        const response = { destination: federationRecord.account_id };
        const memo = this.parseMemo(federationRecord);
        if (memo) {
          response.memo = memo;
        }
        return response;
      });
  },

  isValidDestination(input) {
    return this.isValidAddress(input) || this.isValidPublicKey(input);
  },

  isValidAddress(input) {
    if (input && (typeof input === 'string') || (input instanceof String)) {
      // eslint-disable-next-line no-useless-escape
      return !!input.match(/^[^\*\,]+\*([\-a-zA-Z0-9]+)?(\.[\-a-zA-Z0-9]+)*(\.[a-zA-Z0-9]{2,})$/);
    }
    return false;
  },

  isValidPublicKey(input) {
    if (!input) {
      return false;
    }
    return StellarSdk.StrKey.isValidEd25519PublicKey(input);
  },

  isValidAmount(input) {
    if (!input) {
      return false;
    }
    return StellarSdk.Operation.isValidAmount(input);
  },

  parseSecret(secret) {
    if (secret && StellarSdk.StrKey.isValidEd25519SecretSeed(secret)) {
      return StellarSdk.Keypair.fromSecret(secret);
    }
    return null;
  },

  parseAsset(input) {
    if (!input) {
      throw new Error('Invalid asset');
    }
    const { code, issuer } = input;
    if (code && code.toUpperCase() === 'XLM') {
      return new StellarSdk.Asset.native();
    }
    if (code && issuer) {
      return new StellarSdk.Asset(code, issuer);
    }
    throw new Error('Invalid asset');
  },

  parseMemo(input) {

    if (!input) {
      return null;
    }

    if (typeof input === 'string') {
      return StellarSdk.Memo.text(input)
    }

    const type = input.memo_type || input.type || '';
    const content = input.memo || input.value || input.content || '';

    // Type must not be none
    switch(type.toUpperCase()) {
      case 'TEXT':
      case 'MEMO_TEXT':
        return StellarSdk.Memo.text(content);
      case 'ID':
      case 'MEMO_ID':
        return StellarSdk.Memo.id(content);
      case 'HASH':
      case 'MEMO_HASH':
        return StellarSdk.Memo.hash(content);
      case 'RETURN':
      case 'MEMO_RETURN':
        return StellarSdk.Memo.return(content);
      default:
        if (content) {
          return StellarSdk.Memo.text(content);
        }
        return null;
    }
  },

  /**
  * Provide simple "Class" extension mechanism
  */
  protoExtend: function(sub) {
    var Super = this;
    var Constructor = hasOwn.call(sub, 'constructor') ? sub.constructor : function() {
      Super.apply(this, arguments);
    };

    // This initialization logic is somewhat sensitive to be compatible with
    // divergent JS implementations like the one found in Qt. See here for more
    // context:
    //
    // https://github.com/stripe/stripe-node/pull/334
    Object.assign(Constructor, Super);
    Constructor.prototype = Object.create(Super.prototype);
    Object.assign(Constructor.prototype, sub);

    return Constructor;
  },

};
