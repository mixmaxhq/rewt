const { deferred } = require('promise-callbacks');

const Rewt = require('./');
const redis = require('redis');

describe('rewt', () => {
  function buildRewt(url, namespace, ttl, cacheSecret) {
    return new Rewt({
      redisConn: redis.createClient(url),
      redisNamespace: namespace,
      ttl,
      cacheSecret,
    });
  }

  let rewt;
  afterEach(() => {
    if (rewt && rewt._redisConn) rewt._redisConn.quit();
  });

  describe('_generateKeyName', () => {
    it('should generate the expected key name if provided', () => {
      rewt = buildRewt('redis://localhost:6379', 'foobar');
      expect(rewt._generateKeyName()).toEqual('foobar:rewt-secret');
    });

    it('should generate the expected key name if no namespace is provided', () => {
      rewt = buildRewt('redis://localhost:6379');
      expect(rewt._generateKeyName()).toEqual('rewt:rewt-secret');
    });
  });

  if (process.env.INTEGRATION_TEST) {
    describe('integration tests', () => {
      let rewt;
      const redisConn = redis.createClient('redis://localhost:6379');
      const integrationKey = 'integration:rewt-secret';

      const cleanup = (done) => {
        redisConn.del(integrationKey, done);
        if (rewt && rewt._redisConn) rewt._redisConn.quit();
      };

      beforeEach(cleanup);
      afterEach(cleanup);
      afterAll(() => {
        redisConn.quit();
      });

      it('should be able to retrieve the secret when already set', async () => {
        rewt = buildRewt('redis://localhost:6379', 'integration');

        const connProm = deferred();
        redisConn.set(integrationKey, 'yolo', connProm.defer());
        await connProm;

        const secret = await rewt._getSecret();
        expect(secret).toEqual('yolo');
      });

      it('should be able to generate the secret when none set', async () => {
        rewt = buildRewt('redis://localhost:6379', 'integration');

        const connProm = deferred();
        redisConn.del(integrationKey, connProm.defer());
        await connProm;

        const secret = await rewt._getSecret();
        expect(secret).not.toBeNull();
        expect(secret.length).toEqual(36); // 32 bytes as hex plus four dashes
      });

      it('should be able to sign and verify payloads properly', async () => {
        rewt = buildRewt('redis://localhost:6379', 'integration');

        jest.spyOn(rewt, '_getCachedSecret');

        const payload = { _id: 'world', iat: Math.floor(Date.now() / 1000) - 30 };
        const signed = await rewt.sign(payload);

        const verified = await rewt.verify(signed);
        expect(verified).toEqual(payload);

        expect(rewt._getCachedSecret).not.toHaveBeenCalled();
      });

      it('should be able to sign and verify payloads properly with cached secrets', async () => {
        rewt = buildRewt('redis://localhost:6379', 'integration', 60 * 60 * 24, true);

        jest.spyOn(rewt, '_cacheSecret');
        jest.spyOn(rewt, '_getCachedSecret');

        const payload = { _id: 'world', iat: Math.floor(Date.now() / 1000) - 30 };
        const signed = await rewt.sign(payload);
        expect(rewt._getCachedSecret).not.toHaveBeenCalled();
        expect(rewt._cacheSecret).toHaveBeenCalledTimes(1);

        const verified = await rewt.verify(signed);
        expect(verified).toEqual(payload);

        expect(rewt._getCachedSecret).toHaveBeenCalled();
        expect(rewt._cacheSecret).toHaveBeenCalledTimes(1);
      });
    });
  }
});
