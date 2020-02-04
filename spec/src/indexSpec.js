'use strict';
/* globals describe, it, afterEach, beforeEach */
/* jshint -W030 */

const Rewt = require('../..');
const expect = require('chai').expect;
const redis = require('redis');

describe('rewt', () => {
  function buildRewt(url, namespace, ttl) {
    return new Rewt({
      redisConn: redis.createClient(url),
      redisNamespace: namespace,
      ttl,
    });
  }

  describe('_generateKeyName', () => {
    it('should generate the expected key name if provided', () => {
      const rewt = buildRewt('redis://localhost:6379', 'foobar');
      expect(rewt._generateKeyName()).to.equal('foobar:rewt-secret');
    });

    it('should generate the expected key name if no namespace is provided', () => {
      const rewt = buildRewt('redis://localhost:6379');
      expect(rewt._generateKeyName()).to.equal('rewt:rewt-secret');
    });
  });

  if (process.env.INTEGRATION_TEST) {
    describe('integration tests', () => {
      const redisConn = redis.createClient('redis://localhost:6379');
      const integrationKey = 'integration:rewt-secret';

      const cleanup = (done) => {
        redisConn.del(integrationKey, done);
      };

      beforeEach(cleanup);
      afterEach(cleanup);

      it('should be able to retrieve the secret when already set', (done) => {
        const rewt = buildRewt('redis://localhost:6379', 'integration');
        redisConn.set(integrationKey, 'yolo', (err) => {
          expect(err).to.be.null;
          rewt._getSecret((err, secret) => {
            expect(err).to.be.null;
            expect(secret).to.equal('yolo');

            done();
          });
        });
      });

      it('should be able to generate the secret when none set', (done) => {
        const rewt = buildRewt('redis://localhost:6379', 'integration');
        redisConn.del(integrationKey, (err) => {
          expect(err).to.be.null;
          rewt._getSecret((err, secret) => {
            expect(err).to.be.null;
            expect(secret).to.not.be.null;
            expect(secret.length).to.equal(36); // 32 bytes as hex plus four dashes

            done();
          });
        });
      });

      it('should be able to sign and verify payloads properly', (done) => {
        const rewt = buildRewt('redis://localhost:6379', 'integration');
        const payload = { _id: 'world', iat: Math.floor(Date.now() / 1000) - 30 };
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
  }
});
