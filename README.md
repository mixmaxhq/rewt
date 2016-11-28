## rewt
This module provides a simplified wrapper for signing and verify JWT tokens while
sourcing a shared secret from Redis. This has the advantage of also being able to
set a TTL on the key to allow for automated secret rotation.

## Install
```
$ npm install rewt --save
```

## Usage

### Initialization
To use rewt, we first need to tell it where our Redis connection is:
```js
const redis = require('redis');
const Rewt = require('rewt');

let rewt = new Rewt({
  redisConn: redis.createClient('redis://localhost:6379')
});
```

### Constructor options
We can also provide a custom namespace and key TTL. If we don't provide these,
rewt defaults to using `rewt` as the default namespace and one day as the default
TTL.
```js
let rewt = new Rewt({
  redisConn: redis.createClient('redis://localhost:6379'),
  redisNamespace: 'foobar',
  ttl: 60 * 60 // One hour in seconds
});
```

### Signing payloads
To sign a payload, we simply give it the object to sign and a callback. Note
that we can also pass either a buffer or string to `sign` instead of an object.
```js
rewt.sign({username: 'hello@hello.com'}, (err, signed) => {
  console.log(`signed payload: ${signed}`);
});
```

### Verifying a payload
Verifying a payload is equally as simple, just provide the token to verify and
a callback.
```js
rewt.verify(token, (err, payload) => {
  console.log(`verifyed payload: ${JSON.stringify(payload, null, '  ')}`;
});
```

## Use-case
Why use this module? When signing a JWT you need some sort of secret that can be
used by both send and receiver to verify that a token was signed by someone that
we trust. Our use case was to use JWTs to verify internal server-to-server
communication.

By using Redis as the source of storage for the shared secret, we can have it
automatically rotated by setting a TTL on the key (rewt handles recreating a new
psuedo-random one if the old key has expired). It also allows us to quickly
invalidate a currently shared secret if it becomes compromised by simply
updating the key in Redis as all new signing and verification requests will use
the new secret. This does mean that requests in flight will fail verification,
but this is an acceptable trade-off as the window for signing a payload before
a secret invalidation is incredibly small.


## Changelog
* 1.1.0 Provide a redis connection instead of a redis URI to the constructor.
* 1.0.1 Use async versions of jsonwebtoken
* 1.0.0 Initial release
