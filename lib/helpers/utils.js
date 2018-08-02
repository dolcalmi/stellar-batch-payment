'use strict';

const StellarSdk = require('stellar-sdk');
const hasOwn = {}.hasOwnProperty;

module.exports = {

  parseSecret(secret) {
    return StellarSdk.Keypair.fromSecret(secret);
  },

  parseAsset(input) {
    if (input.code.toUpperCase() === 'XLM') {
      return new StellarSdk.Asset.native();
    }
    return new StellarSdk.Asset(input.code, input.issuer);
  },

  parseMemo(input) {

    if (!input) {
      return null;
    }

    if (typeof input === 'string') {
      return StellarSdk.Memo.text(input)
    }

    const { type, content } = input;
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
        return StellarSdk.Memo.returnHash(content);
      default:
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

  streamToArray(stream, done) {
    if (!stream) {
      // no arguments, meaning stream = this
      stream = this
    } else if (typeof stream === 'function') {
      // stream = this, callback passed
      done = stream
      stream = this
    }

    var deferred
    if (!stream.readable) deferred = Promise.resolve([])
    else deferred = new Promise(function (resolve, reject) {
      // stream is already ended
      if (!stream.readable) return resolve([])

      var arr = []

      stream.on('data', onData)
      stream.on('end', onEnd)
      stream.on('error', onEnd)
      stream.on('close', onClose)

      function onData(doc) {
        arr.push(doc)
      }

      function onEnd(err) {
        if (err) reject(err)
        else resolve(arr)
        cleanup()
      }

      function onClose() {
        resolve(arr)
        cleanup()
      }

      function cleanup() {
        arr = null
        stream.removeListener('data', onData)
        stream.removeListener('end', onEnd)
        stream.removeListener('error', onEnd)
        stream.removeListener('close', onClose)
      }
    })

    if (typeof done === 'function') {
      deferred.then(function (arr) {
        process.nextTick(function() {
          done(null, arr)
        })
      }, done)
    }

    return deferred
  },

};
