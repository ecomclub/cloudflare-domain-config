'use strict'

// log on files
const logger = require('./../lib/Logger.js')

// https://www.npmjs.com/package/rest-auto-router
const restAutoRouter = require('rest-auto-router')

// web server configuration
const conf = {
  // path to routes folder
  'path': process.cwd() + '/routes/',
  // listened tcp port
  // should be opened for localhost only
  'port': 31234,
  // part of the URL to be deleted in routing
  // like RewriteBase of Apache Httpd mod_rewrite
  'base_uri': '/cloudflare/v1/',
  // must be configured in common with proxy server
  'proxy': {
    // request timeout in ms
    'timeout': 30000,
    // X-Authentication header
    'auth': 'FnN3sT4'
  },
  // default error messages
  // used when messages are null
  'error_messages': {
    'dev': 'Unknow error',
    'usr': {
      'en_us': 'Unexpected error, report to support or responsible developer',
      'pt_br': 'Erro inesperado, reportar ao suporte ou desenvolvedor responsável'
    }
  },
  // allow clients to specify what fields to receive from resource
  // if true, response should vary by http param 'fields'
  'vary_fields': false
}

let yandexApiKey

function middleware (id, meta, body, respond, req, res, resource, verb, endpoint) {
  // function called before endpoints
  // authentications and other prerequisites when necessary
  // logger.log(resource)
  if (typeof req.headers['x-real-ip'] === 'string') {
    // pass to endpoint
    endpoint(id, meta, body, respond, yandexApiKey)
  } else {
    respond({}, null, 403, 100, 'Who are you? Unknown IP address')
  }
}

module.exports = function (auth, port, _yandexApiKey) {
  if (auth) {
    conf.proxy.auth = auth
  }
  if (port) {
    conf.port = port
  }
  yandexApiKey = _yandexApiKey

  // start web application
  // recieve requests from Nginx by reverse proxy
  restAutoRouter(conf, middleware, logger)

  // debug
  logger.log('Yandex Translate API key:' + yandexApiKey)
}
