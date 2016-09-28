'use strict';

const parseRedisUrl = require('parse-redis-url');
const redis = require('redis');

/**
 * A factory for Redis clients.
 */
var RedisClient = {
  /**
   * Connects to the Redis server at the specified URL.
   *
   * @param {string} url - The URL of a Redis server. This should include any necessary authentication
   *    parameter.
   *
   * @return {RedisClient} A connection to the server ready to send commands.
   */
  createClient: function(url) {
    let parsedUrl = parseRedisUrl(redis).parse(url);
    let connection = redis.createClient(parsedUrl.port, parsedUrl.host, {
      auth_pass: parsedUrl.password
    });
    return connection;
  }
};

module.exports = RedisClient;
