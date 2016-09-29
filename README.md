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
To use rewt, we first need to tell it where our Redis source is:
```js
const Rewt = require('rewt');

let rewt = new Rewt({
  redisUrl: 'redis://localhost:6379'
});
```

### Constructor options
We can also provide a custom namespace and key TTL. If we don't provide these,
rewt defaults to using `rewt` as the default namespace and one day as the default
TTL.
```js
let rewt = new Rewt({
  redisUrl: 'redis://localhost:6379',
  redisNamespace: 'foobar',
  ttl: 60 * 60 // One hour in seconds
});
```

### Signing payloads
To sign a payload, we simply give it the object to sign and a callback.
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