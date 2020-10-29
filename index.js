const jwt = require('jsonwebtoken');
const Scripty = require('node-redis-scripty');
const uuid = require('uuid');

/**
 * This lua script simply checks if the key is set, if it is it returns the
 * key's value. If it's not set, it set's it to the given value and returns
 * that.
 */
const secretRetrievalScript = `
local key = KEYS[1]
local newVal = ARGV[1]
local ttl = ARGV[2]

if redis.call("EXISTS", key) == 1 then
   ttl = redis.call("TTL", key)
   local secret = redis.call("GET", key)
   return { ttl, secret }
end

redis.call("setex", key, ttl, newVal)
local secret = newVal
return { ttl, secret }
`;

/**
 * Rewt utility class for signing and verifying JWT tokens that uses redis as
 * the backing store for the source of the shared secret to use during JWT
 * signing and verification.
 */
class Rewt {
  /**
   * Creates a new Rewt. A redis connection, the namespace to keep the secret
   * key under and key TTL can be provided as options - only the redis
   * connection (URI) is required.
   *
   * @param {Object} options Options provided to the Rewt constructor.
   *   @param {String} options.redisConn (required) A connection to redis.
   *   @param {String} options.redisNamespace (optional) The namespace to use.
   *   @param {Number} options.ttl (optional) The key's TTL before being rotated.
   *   @param {Boolean} options.cacheSecret (optional) Whether or not to cache
   *     the secret locally.
   */
  constructor(options) {
    options = options || {};
    options.redisNamespace = options.redisNamespace || 'rewt';
    options.ttl = options.ttl || 60 * 60 * 24;

    this.options = options;
    this._redisConn = options.redisConn;
    this._scripty = new Scripty(this._redisConn);
    this._shouldCacheSecret = options.cacheSecret || false;
  }

  /**
   * Signs the given payload.
   *
   * @param {Object} payload The payload to sign.
   */
  async sign(payload) {
    const secret = await this._getSecret();
    return new Promise((resolve, reject) => {
      jwt.sign(payload, secret, {}, (err, val) => {
        if (err) {
          this._clearCachedSecret(secret);
          return void reject(err);
        }
        return void resolve(val);
      });
    });
  }

  /**
   * Verifies the given token and parses the payload from it.
   *
   * @param {String} token The token to verify and parse.
   */
  async verify(token) {
    const secret = await this._getSecret();
    return new Promise((resolve, reject) => {
      jwt.verify(token, secret, (err, val) => {
        if (err) {
          this._clearCachedSecret(secret);
          return void reject(err);
        }
        return void resolve(val);
      });
    });
  }

  /**
   * Returns the secret to sign and verify requests with.
   * @returns {String} The secret to use.
   * @throws {Error} If the secret can not be identified.
   */
  async _getSecret() {
    if (this._cachedSecret) {
      // Short circuit.
      return this._getCachedSecret();
    }

    return new Promise((resolve, reject) => {
      this._scripty.loadScript('secretRetrievalScript', secretRetrievalScript, (err, script) => {
        if (err) {
          return void reject(err);
        }

        script.run(
          1,
          this._generateKeyName(),
          uuid.v4(),
          this.options.ttl,
          (err, [ttl, secret]) => {
            if (err) {
              return void reject(err);
            }

            // Only cache the secret if we're supposed to AND the TTL on it is
            // more than 20 seconds.
            if (this._shouldCacheSecret && ttl > 20) {
              this._cacheSecret(
                secret,
                ttl - 5 /* Remove five seconds to give ourselves more buffer */
              );
            }
            return void resolve(secret);
          }
        );
      });
    });
  }

  /**
   * Generates the key name for the secret.
   * @return {String} The key that the secret is saved under.
   */
  _generateKeyName() {
    return `${this.options.redisNamespace}:rewt-secret`;
  }

  /**
   * Cache the secret for as long as the current TTL. While this may be the
   * incorrect time period, we'll clear the value on any verification errors.
   *
   * @param {String} secret The secret to hold on to.
   * @param {Number} ttl The time to retain the secret in seconds.
   */
  _cacheSecret(secret, ttl) {
    this._cachedSecret = secret;
    this._clearCachedSecretRef = setTimeout(() => {
      this._clearCachedSecret();
    }, ttl * 1000);
  }

  /**
   * Returns the cached secret.
   *
   * @returns {String} The cached secret.
   */
  _getCachedSecret() {
    return this._cachedSecret;
  }

  /**
   * Clears the cached secret and clearing timeout.
   */
  _clearCachedSecret(secret) {
    if (!!secret && secret === this._cachedSecret) return;

    this._cachedSecret = null;
    clearTimeout(this._clearCachedSecretRef);
    this._clearCachedSecretRef = null;
  }
}

module.exports = Rewt;
