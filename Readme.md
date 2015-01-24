# m-oauth

  Minimal oauth2 lib for nodejs, framework agnostic.

## Installation

```
$ npm install m-oauth
```

  All async api of m-oauth return a promise, make sure you have a native `Promise` implementation.
  If no implementation is found, an error will be thrown.

  If you are using node < 0.11, you can achieve this by put this:

```js
if (!global.Promise) global.Promise = require('q').Promise
```

  before the execution of m-auth.

## Example

```js
var Oauth = require('m-oauth')
var wellKnown = require('m-oauth-wellknown')
var merge = require('util')._extend

var weibo = Oauth(merge(wellKnown.weibo, {
  client_id: 'your client id',
  client_secret: 'your client secret',
  redirect_uri: 'http://yourdomain.com/oauth/weibo/callback'
}))

app.get('/oauth/weibo', function (req, res, next) {
  res.redirect(weibo.getAuthorizeUrl())
})

app.get('/oauth/weibo/callback', function (req, res, next) {
  weibo.authorize(req.query.code)
  .then(function (uid) {
    return weibo.getProfile(uid)
  })
  .then(function (profile) {
    return User.createOrUpdate(profile)
  })
  .then(function (user) {
    // process some login code
    res.redirect('/')
  })
  .catch(next)
})
```

## License

  MIT
