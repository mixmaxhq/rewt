'use strict';

const redis = require('./redis');
const assert = require('assert');
const jwt = require('jsonwebtoken');

/**
 * Rewt utility class for signing and verifying JWT tokens that uses redis as
 * the backing store for the source of the shared secret to use during JWT
 * signing and verification.
 */
class Rewt {

  /**
   * Creates a new Rewt. The location of redis, the namespace to keep the secret
   * key under and key TTL can be provided as options - only the redis location
   * (URI) is required.
   *
   * @param {Object} options Options provided to the Rewt constructor.
   *   @param {String} options.redisUrl (required) The location of redis.
   *   @param {String} options.redisNamespace (optional) The namespace to use.
   *   @param {Number} options.ttl (optional) The key's TTL before being rotated.
   *
   */
  constructor(options) {
    options = options || {};
    assert(options.redisUrl, 'You must provide a redis URL');
    options.redisNamespace = options.redisNamespace || 'rewt';
    options.ttl = options.ttl || 60 * 60 * 24;

    this.options = options;
    this._redisConn = redis.createClient(options.redisUrl);
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
        cb(null, jwt.sign(payload, val));
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
        cb(null, jwt.verify(token, val));
      }
    });
  }

  /**
   * Returns the secret to sign and verify requests with.
   * @param{Function} cb Node style callback.
   */
  _getSecret(cb) {
    this._redisConn.get(this._generateKeyName(), cb);
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
