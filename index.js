'use strict';

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
   return redis.call("GET", key)
end

redis.call("setex", key, ttl, newVal)
return newVal
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
   *
   */
  constructor(options) {
    options = options || {};
    options.redisNamespace = options.redisNamespace || 'rewt';
    options.ttl = options.ttl || 60 * 60 * 24;

    this.options = options;
    this._redisConn = options.redisConn;
    this._scripty = new Scripty(this._redisConn);
  }

  /**
   * Signs the given payload.
   *
   * @param {Object} payload The payload to sign.
   * @param {Function} cb Node style callback.
   */
  sign(payload, cb) {
    this._getSecret((err, val) => {
      if (err) {
        cb(err);
      } else {
        jwt.sign(payload, val, {}, cb);
      }
    });
  }

  /**
   * Verifies the given token and parses the payload from it.
   *
   * @param {String} token The token to verify and parse.
   * @param {Function} cb Node style callback.
   */
  verify(token, cb) {
    this._getSecret((err, val) => {
      if (err) {
        cb(err);
      } else {
        jwt.verify(token, val, cb);
      }
    });
  }

  /**
   * Returns the secret to sign and verify requests with.
   * @param{Function} cb Node style callback.
   */
  _getSecret(cb) {
    this._scripty.loadScript('secretRetrievalScript', secretRetrievalScript, (err, script) => {
      if (err) return cb(err);

      script.run(1, this._generateKeyName(), uuid.v4(), this.options.ttl, cb);
    });
  }

  /**
   * Generates the key name for the secret.
   * @return {String} The key that the secret is saved under.
   */
  _generateKeyName() {
    return `${this.options.redisNamespace}:rewt-secret`;
  }
}

module.exports = Rewt;
