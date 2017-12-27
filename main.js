'use strict'

/**
 * @file Configure domain to E-Com Plus store with Cloudflare API
 * @copyright E-Com Club. All rights reserved. Since 2016
 * <br>E-COM CLUB SOFTWARES PARA E-COMMERCE LTDA / CNPJ: 24.356.660/0001-78
 * @license UNLICENSED
 * @author Leonardo Matos de Paula
 */

process.on('uncaughtException', (err) => {
  // fatal error
  // log to file before exit
  let fs = require('fs')
  fs.appendFile('/var/log/nodejs/_stderr', '\n' + err.stack + '\n', () => {
    process.exit(1)
  })
})

// web application
// recieve requests from Nginx by reverse proxy
require('./bin/web.js')

// local application
// executable server side only
require('./bin/local.js')
