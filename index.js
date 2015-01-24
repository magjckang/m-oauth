/**
 * Module dependencies.
 */

var debug = require('debug')('oauth')
var request = require('superagent')
var merge = require('util')._extend
var qs = require('querystring')

/**
 * Expose `Oauth`.
 */

module.exports = Oauth

/**
 * Initialize a new `Oauth`.
 *
 * @api public
 */

function Oauth(options) {
  if (!(this instanceof Oauth)) return new Oauth(options)
  if (!options) options = {}

  merge(this, merge({
    idKey: 'client_id',
    secretKey: 'client_secret',
    uidKey: 'uid',
    storage: {
      set: function (k, v) {
        if (!this.tokens) this.tokens = {}

        this.tokens[k] = v
        return Promise.resolve()
      },
      get: function (k) {
        return Promise.resolve(this.tokens[k])
      }
    }
  }, options))
}

/**
 * Generate a url for user authorization redirection.
 *
 * @return {String}
 * @api public
 */

Oauth.prototype.getAuthorizeUrl = function (params) {
  params = params || {}
  params.response_type = 'code'
  params.redirect_uri = this.redirect_uri
  params[this.idKey] = this.client_id

  return this.authorizeUrl + '?' + qs.stringify(params)
}

/**
 * Authorize a user by a authorization code, store tokens and return user's id.
 *
 * @param {String} code
 * @return {Promise}
 * @api public
 */

Oauth.prototype.authorize =
Oauth.prototype.getAccessToken = function (code) {
  var params = {
    code: code,
    grant_type: 'authorization_code',
    redirect_uri: this.redirect_uri
  }
  params[this.idKey] = this.client_id
  params[this.secretKey] = this.client_secret

  debug('authorize params', params)

  return request.post(this.tokenUrl)
    .type('form').send(params).promise()
    .then(this.handleRes)
    .then(function (doc) {
      this.saveToken(doc)
      return doc[this.uidKey]
    }.bind(this))
}

/**
 * Refresh access token.
 *
 * @return {Promise}
 * @api private
 */

Oauth.prototype.refreshAccessToken = function (token) {
  var params = {
    grant_type: 'refresh_token',
    refresh_token: token
  }
  params[this.idKey] = this.client_id

  return request.post(this.refreshUrl)
    .type('form').send(params).promise()
    .then(this.handleRes)
    .then(function (doc) {
      this.saveToken(doc)
      return doc.access_token
    }.bind(this))
}

/**
 * Get user profile.
 *
 * @param {String} uid
 * @return {Promise}
 * @api public
 */

Oauth.prototype.getProfile = function (uid) {
  return this.getToken(uid)
  .then(function (token) {
    var params = { access_token: token }
    params[this.uidKey] = uid

    return request(this.profileUrl)
      .query(params).promise()
      .then(this.handleRes)
  }.bind(this))
}

/**
 * Utility func for parsing response properly,
 * this should run in a promise chain.
 *
 * @return {Object}
 * @api private
 */

Oauth.prototype.handleRes = function (res) {
  if (!res.ok) throw new Error(res.text)

  try {
    var body = JSON.parse(res.text)
  } catch (err) {
    body = qs.parse(res.text)
  }

  // f*ck the non-standard api
  if (body.errcode) throw new Error(body.errmsg)

  debug('parsed %o', body)
  return body
}

/**
 * Save a token by accepting a single argument.
 *
 * @param {Object}
 * @return {Promise}
 * @api private
 */

Oauth.prototype.saveToken = function (doc) {
  return this.storage.set(doc[this.uidKey], Token(doc))
}

/**
 * Return a promise which will be resolved with a valid token.
 *
 * @param {String} id
 * @return {Promise}
 * @api private
 */

Oauth.prototype.getToken = function (id) {
  return this.storage.get(id)
  .then(function (token) {
    if (!token) throw new Error('no token store was found.')

    if (!token.isValid()) {
      return this.refreshAccessToken(token.refresh_token)
    }
    return token.access_token
  })
}

/**
 * Initialize a new `Token`.
 *
 * @api private
 */

function Token(doc) {
  if (!(this instanceof Token)) return new Token(doc)

  this.access_token = doc.access_token
  this.refresh_token = doc.refresh_token
  this.expires_in = (doc.expires_in - 10) * 1000
  this.timestamp = Date.now()
}

Token.prototype.isValid = function () {
  return Date.now() < this.timestamp + this.expires_in
}

/**
 * Add `promise` method to `superagent.Request.prototype`.
 */

request.Request.prototype.promise = function () {
  return new Promise(function (resolve, reject) {
    this.end(function (err, res) {
      if (err) return reject(err)
      resolve(res)
    })
  }.bind(this))
}
