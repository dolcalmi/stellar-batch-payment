const utils = require('../../lib/helpers/utils');

describe('utils', function() {

  beforeEach(function () {
    this.server = new StellarSdk.FederationServer('https://acme.com:1337/federation', 'stellar.org');
    this.axiosMock = sinon.mock(axios);
    StellarSdk.Config.setDefault();
  });

  afterEach(function () {
    this.axiosMock.verify();
    this.axiosMock.restore();
  });

  describe('resolveAddress', function() {

    it('should return a valid object without memo', function(done) {
      this.axiosMock.expects('get')
        .withArgs(sinon.match('https://acme.com:1337/federation?type=name&q=bob%2Astellar.org'))
        .returns(Promise.resolve({
          data: {
            stellar_address: 'bob*stellar.org',
            account_id: 'GB5XVAABEQMY63WTHDQ5RXADGYF345VWMNPTN2GFUDZT57D57ZQTJ7PS'
          }
        }));
      utils.resolveAddress('bob*stellar.org', this.server)
        .then((d) => {
          expect(d.destination).to.equal('GB5XVAABEQMY63WTHDQ5RXADGYF345VWMNPTN2GFUDZT57D57ZQTJ7PS');
          expect(d.memo).to.equal(undefined);
        })
        .finally(() => {
          done();
        });
    });

    it('should return a valid object with memo', function(done) {
      this.axiosMock.expects('get')
        .withArgs(sinon.match('https://acme.com:1337/federation?type=name&q=bob%2Astellar.org'))
        .returns(Promise.resolve({
          data: {
            stellar_address: 'bob*stellar.org',
            account_id: 'GB5XVAABEQMY63WTHDQ5RXADGYF345VWMNPTN2GFUDZT57D57ZQTJ7PS',
            memo_type: 'text',
            memo: 'bob',
          }
        }));
      utils.resolveAddress('bob*stellar.org', this.server)
        .then((d) => {
          expect(d.destination).to.equal('GB5XVAABEQMY63WTHDQ5RXADGYF345VWMNPTN2GFUDZT57D57ZQTJ7PS');
          expect(d.memo.type).to.equal('text');
          expect(d.memo.value).to.equal('bob');
        })
        .finally(() => {
          done();
        });
    });

    it('should handle an invalid account_id from server', function() {
      const invalidAccount = 'Invalid account_id from federation response';
      this.axiosMock.expects('get')
        .withArgs(sinon.match('https://acme.com:1337/federation?type=name&q=bob%2Astellar.org'))
        .returns(Promise.resolve({
          data: {
            stellar_address: 'bob*stellar.org',
            account_id: 'GB5XVAABEQMY63WTHDQ5RXADGYF345VWMNPTN2GFUDZT57D57ZQTJ7P'
          }
        }));
      return utils.resolveAddress('bob*stellar.org', this.server)
        .should.be.rejectedWith(invalidAccount);
    });

    it('should handle an invalid address', function() {
      const invalidAddress = 'Invalid address';
      return Promise.all([
        utils.resolveAddress('').should.be.rejectedWith(invalidAddress),
        utils.resolveAddress('dolcalmi*papayabot').should.be.rejectedWith(invalidAddress),
        utils.resolveAddress('dolcalmi').should.be.rejectedWith(invalidAddress),
        utils.resolveAddress('dolcalmi*').should.be.rejectedWith(invalidAddress),
        utils.resolveAddress('*papayabot.com').should.be.rejectedWith(invalidAddress),
        utils.resolveAddress(undefined).should.be.rejectedWith(invalidAddress),
        utils.resolveAddress(null).should.be.rejectedWith(invalidAddress),
        utils.resolveAddress({ }).should.be.rejectedWith(invalidAddress)
      ]);
    });

  });

  describe('hasValidMemoTextSize', function() {

    it('should return true with valid memo size', function() {
      expect(utils.hasValidMemoTextSize('valid memo')).to.equal(true);
      expect(utils.hasValidMemoTextSize('esto es un memo de 28 bytes.')).to.equal(true);
      expect(utils.hasValidMemoTextSize('a')).to.equal(true);
      expect(utils.hasValidMemoTextSize(12354)).to.equal(true);
    });

    it('should return false with invalid memo size', function() {
      expect(utils.hasValidMemoTextSize('esto es un memo con mas de 28 bytes.')).to.equal(false);
      expect(utils.hasValidMemoTextSize('             ')).to.equal(false);
      expect(utils.hasValidMemoTextSize('')).to.equal(false);
      expect(utils.hasValidMemoTextSize(null)).to.equal(false);
    });
  });

  describe('isValidDestination', function() {

    it('should return true with valid destination', function() {
      const publicKey = 'GBDXI75OOWTBZL73QKNICVSDUZWBSW6HGA6OJMJMSXJ73TVGMNWNZDNG';
      expect(utils.isValidDestination(publicKey)).to.equal(true);
      expect(utils.isValidDestination('dolcalmi*papayabot.com')).to.equal(true);
      expect(utils.isValidDestination('dolcalmi*papayabot.co')).to.equal(true);
    });

    it('should return false with invalid destination', function() {
      expect(utils.isValidDestination('')).to.equal(false);
      expect(utils.isValidPublicKey('G')).to.equal(false);
      expect(utils.isValidDestination('dolcalmi*papayabot')).to.equal(false);
      expect(utils.isValidDestination('dolcalmi')).to.equal(false);
      expect(utils.isValidDestination('dolcalmi*')).to.equal(false);
      expect(utils.isValidDestination('*papayabot.com')).to.equal(false);
      expect(utils.isValidDestination(undefined)).to.equal(false);
      expect(utils.isValidDestination(null)).to.equal(false);
      expect(utils.isValidDestination({ })).to.equal(false);
    });
  });

  describe('isValidAddress', function() {

    it('should return true with valid federated address', function() {
      expect(utils.isValidAddress('dolcalmi*papayabot.com')).to.equal(true);
      expect(utils.isValidAddress('dolcalmi*papayabot.co')).to.equal(true);
    });

    it('should return false with invalid federated address', function() {
      expect(utils.isValidAddress('')).to.equal(false);
      expect(utils.isValidAddress('dolcalmi*papayabot')).to.equal(false);
      expect(utils.isValidAddress('dolcalmi')).to.equal(false);
      expect(utils.isValidAddress('dolcalmi*')).to.equal(false);
      expect(utils.isValidAddress('*papayabot.com')).to.equal(false);
      expect(utils.isValidAddress(undefined)).to.equal(false);
      expect(utils.isValidAddress(null)).to.equal(false);
      expect(utils.isValidAddress({ })).to.equal(false);
    });

  });

  describe('isValidPublicKey', function() {

    it('should return true with valid public key', function() {
      const publicKey = 'GBDXI75OOWTBZL73QKNICVSDUZWBSW6HGA6OJMJMSXJ73TVGMNWNZDNG';
      expect(utils.isValidPublicKey(publicKey)).to.equal(true);
    });

    it('should return false with invalid public key', function() {
      expect(utils.isValidPublicKey('')).to.equal(false);
      expect(utils.isValidPublicKey('G')).to.equal(false);
      expect(utils.isValidPublicKey(undefined)).to.equal(false);
      expect(utils.isValidPublicKey(null)).to.equal(false);
      expect(utils.isValidPublicKey({ })).to.equal(false);
    });

  });

  describe('isValidAmount', function() {

    it('should return true with valid amount', function() {
      expect(utils.isValidAmount('1')).to.equal(true);
      expect(utils.isValidAmount('1.0000001')).to.equal(true);
    });

    it('should return false with invalid amount', function() {
      expect(utils.isValidAmount('')).to.equal(false);
      expect(utils.isValidAmount('0')).to.equal(false);
      expect(utils.isValidAmount('-1')).to.equal(false);
      expect(utils.isValidAmount('1.00000001')).to.equal(false);
      expect(utils.isValidAmount(0)).to.equal(false);
      expect(utils.isValidAmount(2134)).to.equal(false);
      expect(utils.isValidAmount(-1)).to.equal(false);
    });

  });

  describe('parseSecret', function() {

    it('should parse a valid secret key', function() {
      const value = 'SDCTYCUMXRJ2MOU4TPEGYLMLWW2YAISFQIEMF4T5HXURZ5Y3GODI4TRE';
      const result = StellarSdk.Keypair.fromSecret(value);
      expect(utils.parseSecret(value)).to.deep.equal(result);
    });

    it('should handle an invalid secret key', function() {
      const value = 'SDC';
      expect(utils.parseSecret(value)).to.deep.equal(null);
    });

    it('should handle an empty secret', function() {
      expect(utils.parseSecret(null)).to.equal(null);
      expect(utils.parseSecret('')).to.equal(null);
      expect(utils.parseSecret(undefined)).to.equal(null);
      expect(utils.parseSecret({ })).to.equal(null);
    });

  });

  describe('parseAsset', function() {

    it('should parse a valid asset', function() {
      const code = 'MyAsset';
      const issuer = 'GBDXI75OOWTBZL73QKNICVSDUZWBSW6HGA6OJMJMSXJ73TVGMNWNZDNG';
      const native = new StellarSdk.Asset.native();
      const custom = new StellarSdk.Asset(code, issuer);

      expect(utils.parseAsset({ code: 'XLM', issuer: '' })).to.deep.equal(native);
      expect(utils.parseAsset({ code: 'xlm', issuer: '' })).to.deep.equal(native);

      expect(utils.parseAsset({ code, issuer })).to.deep.equal(custom);
    });

    it('should handle an invalid asset', function() {
      const invalidAsset = 'Invalid asset';
      const invalidIssuer = 'Issuer is invalid';
      expect(() => utils.parseAsset({ code: 'XLM1', issuer: '' })).to.throw(invalidAsset);
      expect(() => utils.parseAsset({ code: '', issuer: 'A' })).to.throw(invalidAsset);
      expect(() => utils.parseAsset({ code: 'X', issuer: 'A' })).to.throw(invalidIssuer);
    });

    it('should handle an empty asset', function() {
      const error = 'Invalid asset';
      expect(() => utils.parseAsset(null)).to.throw(error);
      expect(() => utils.parseAsset('')).to.throw(error);
      expect(() => utils.parseAsset(undefined)).to.throw(error);
      expect(() => utils.parseAsset({ code: '', issuer: '' })).to.throw(error);
      expect(() => utils.parseAsset({ code: '' })).to.throw(error);
      expect(() => utils.parseAsset({ issuer: '' })).to.throw(error);
      expect(() => utils.parseAsset({ })).to.throw(error);
    });

  });

  describe('parseMemo', function() {

    it('should parse a valid text memo', function() {
      const value = 'string memo';
      const result = StellarSdk.Memo.text(value);
      expect(utils.parseMemo(value)).to.deep.equal(result);
      expect(utils.parseMemo({ type: 'text', value })).to.deep.equal(result);
      expect(utils.parseMemo({ type: 'memo_text', value })).to.deep.equal(result);
      expect(utils.parseMemo({ type: '', value })).to.deep.equal(result);
      expect(utils.parseMemo({ value })).to.deep.equal(result);
    });

    it('should parse a valid id memo', function() {
      const value = '123456';
      const result = StellarSdk.Memo.id(value);
      expect(utils.parseMemo({ type: 'id', value })).to.deep.equal(result);
      expect(utils.parseMemo({ type: 'memo_id', value })).to.deep.equal(result);
    });

    it('should parse a valid hash memo', function() {
      const value = '0a9e255c621c638c1c69e6acf2c86e176d336437ade6b03edfe8710de83c2275';
      const result = StellarSdk.Memo.hash(value);
      expect(utils.parseMemo({ type: 'hash', value })).to.deep.equal(result);
      expect(utils.parseMemo({ type: 'memo_hash', value })).to.deep.equal(result);
    });

    it('should parse a valid return memo', function() {
      const value = '0a9e255c621c638c1c69e6acf2c86e176d336437ade6b03edfe8710de83c2275';
      const result = StellarSdk.Memo.return(value);
      expect(utils.parseMemo({ type: 'return', value })).to.deep.equal(result);
      expect(utils.parseMemo({ type: 'memo_return', value })).to.deep.equal(result);
    });

    it('should handle an empty memo', function() {
      expect(utils.parseMemo(null)).to.equal(null);
      expect(utils.parseMemo('')).to.equal(null);
      expect(utils.parseMemo(undefined)).to.equal(null);
      expect(utils.parseMemo({ type: '', value: ''})).to.equal(null);
      expect(utils.parseMemo({ })).to.equal(null);
    });

  });

  describe('protoExtend', function() {

    it('Provides an extension mechanism', function() {
      function A() {}
      A.extend = utils.protoExtend;
      var B = A.extend({
        constructor: function() {
          this.called = true;
        },
      });

      var C = A.extend({ });

      expect(new B()).to.be.an.instanceof(A);
      expect(new C()).to.be.an.instanceof(A);
      expect(new B()).to.be.an.instanceof(B);
      expect(new C()).to.be.an.instanceof(C);
      expect(new B().called).to.equal(true);
      expect(B.extend === utils.protoExtend).to.equal(true);
      expect(C.extend === utils.protoExtend).to.equal(true);
    });

  });

});
