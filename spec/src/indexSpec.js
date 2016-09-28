'use strict';
/* globals describe, it, spyOn */
/* jshint -W030 */

const Rewt = require('../..');
const expect = require('chai').expect;

describe('rewt', () => {

  function buildRewt(url, namespace, ttl) {
    return new Rewt({
      redisUrl: url,
      redisNamespace: namespace,
      ttl: ttl
    });
  }

  describe('_generateKeyName', () => {
    it('should generate the expected key name if provided', () => {
      let rewt = buildRewt('redis://localhost:6379', 'foobar');
      expect(rewt._generateKeyName()).to.equal('foobar:rewt-secret');
    });

    it('should generate the expected key name if no namespace is provided', () => {
      let rewt = buildRewt('redis://localhost:6379');
      expect(rewt._generateKeyName()).to.equal('rewt:rewt-secret');
    });
  });

  describe('_getSecret', () => {
    it('should be able to retrieve the correct token', (done) => {
      let rewt = buildRewt('redis://localhost:6379', 'hello');
      spyOn(rewt._redisConn, 'get').and.callFake((key, cb) => { cb(null, 'supersecret'); });
      rewt._getSecret((err, val) => {
        expect(err).to.be.null;
        expect(val).to.equal('supersecret');
        done();
      });
    });
  });

  describe('sign', () => {
    it('should be able to sign and verify payloads properly', (done) => {
      let rewt = buildRewt('redis://localhost:6379', 'hello');
      spyOn(rewt._redisConn, 'get').and.callFake((key, cb) => { cb(null, 'supersecret'); });

      let payload = {_id:'world', iat: Math.floor(Date.now() / 1000) - 30 };

      rewt.sign(payload, (err, val) => {
        expect(err).to.be.null;

        rewt.verify(val, (err, verified) => {
          expect(err).to.be.null;
          expect(verified).to.deep.equal(payload);
        });
        done();
      });
    });
  });
});
