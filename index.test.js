const redis = require('redis');

const Rewt = require('./');

describe('rewt', () => {
  describe('_generateKeyName', () => {
    it('should generate the expected key name if provided', () => {
      const rewt = new Rewt({
        redisNamespace: 'foobar',
        ttl: 10,
        cacheSecret: false,
      });
      expect(rewt._generateKeyName()).toEqual('foobar:rewt-secret');
    });

    it('should generate the expected key name if no namespace is provided', () => {
      const rewt = new Rewt({});
      expect(rewt._generateKeyName()).toEqual('rewt:rewt-secret');
    });
  });
  if (process.env.INTEGRATION_TEST) {
    describe('integration tests', () => {
      let rewt;
      let redisConn;
      const integrationKey = 'integration:rewt-secret';

      const buildRewt = async (url, namespace, ttl, cacheSecret) => {
        const conn = redis.createClient(url);
        return new Rewt({
          redisConn: conn,
          redisNamespace: namespace,
          ttl,
          cacheSecret,
        });
      };

      beforeEach(async () => {
        redisConn = redis.createClient('redis://localhost:6379');

        rewt = await buildRewt('redis://localhost:6379', 'integration', 30, false);
      });

      afterEach(async () => {
        await redisConn.del(integrationKey);
        if (rewt?._redisConn) await rewt._redisConn.quit();
        await redisConn.quit();
      });

      const setKey = async (key, value) => {
        await redisConn.set(key, value);
      };

      it('should be able to retrieve the secret when already set', async () => {
        await setKey(integrationKey, 'yolo');
        const secret = await rewt._getSecret();
        expect(secret).toEqual('yolo');
      });

      it('should be able to generate the secret when none set', async () => {
        const secret = await rewt._getSecret();
        expect(secret).not.toBeNull();
        expect(secret.length).toEqual(36);
      });

      it('should be able to sign and verify payloads properly', async () => {
        jest.spyOn(rewt, '_getCachedSecret');

        const payload = { _id: 'world', iat: Math.floor(Date.now() / 1000) - 30 };
        const signed = await rewt.sign(payload);

        const verified = await rewt.verify(signed);
        expect(verified).toEqual(payload);

        expect(rewt._getCachedSecret).not.toHaveBeenCalled();
      });
      if (process.env.RESET_TEST) {
        it('should be able to sign and verify payloads properly with cached secrets', async () => {
          jest.setTimeout(35 * 1000);
          rewt = await buildRewt('redis://localhost:6379', 'integration', 30, true);

          jest.resetAllMocks();
          jest.spyOn(rewt, '_cacheSecret');
          jest.spyOn(rewt, '_getCachedSecret');

          // Test initial signing and verification
          const payload = { _id: 'world', iat: Math.floor(Date.now() / 1000) - 30 };
          const signed = await rewt.sign(payload);
          const verified = await rewt.verify(signed);

          expect(verified).toEqual(payload);
          expect(rewt._getCachedSecret).toHaveBeenCalledTimes(1);
          expect(rewt._cacheSecret).toHaveBeenCalledTimes(1);

          const secret = await rewt._getSecret();

          // Simplified wait using Promise
          await new Promise((resolve) => setTimeout(resolve, 31 * 1000));

          // Test signing and verification after TTL expiry
          const payload2 = { _id: 'world', iat: Math.floor(Date.now() / 1000) - 30 };
          const signed2 = await rewt.sign(payload2);
          const verified2 = await rewt.verify(signed2);

          expect(verified2).toEqual(payload2);
          const newSecret = await rewt._getSecret();
          expect(secret).not.toEqual(newSecret);
        });
      }
    });
  }
});
