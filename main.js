'use strict'

/**
 * @file Configure domain to E-Com Plus store with Cloudflare API
 * @copyright E-Com Club. All rights reserved. Since 2016
 * <br>E-COM CLUB SOFTWARES PARA E-COMMERCE LTDA / CNPJ: 24.356.660/0001-78
 * @license UNLICENSED
 * @author E-Com Club
 */

function error (err) {
  // fatal error
  // log to file before exit
  let msg = '\n[' + new Date().toString() + ']\n'
  if (err) {
    if (err.hasOwnProperty('stack')) {
      msg += err.stack
    } else if (err.hasOwnProperty('message')) {
      msg += err.message
    } else {
      msg += err.toString()
    }
    msg += '\n'
  }

  let fs = require('fs')
  fs.appendFile('/var/log/nodejs/_stderr', msg, () => {
    process.exit(1)
  })
}

process.on('uncaughtException', error)

// web application
// recieve requests from Nginx by reverse proxy
let web = require('./bin/web.js')

// yandexApiKey is an argument required passed by the command line
let yandexApiKey
if (typeof process.argv[2] === 'string') {
  yandexApiKey = process.argv[2]
} else {
  error(new Error('yandexApiKey argument is required and must be a string'))
}

// auth is an argument passed by the command line
let auth
if (typeof process.argv[3] === 'string') {
  auth = process.argv[3]
}

// port is an argument passed by the command line
let port
if (typeof process.argv[4] === 'number') {
  if (!isNaN(process.argv[4])) {
    port = process.argv[4]
  }
} else if (typeof process.argv[4] === 'string') {
  port = parseInt(process.argv[4])
  if (isNaN(port)) {
    port = null
  }
}

// start web app
web(auth, port, yandexApiKey)

// local application
// executable server side only
require('./bin/local.js')
