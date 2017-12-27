'use strict'

// function to substitute console.log
function log (out, desc) {
  logger.log(header())
  if (desc) {
    logger.log(desc)
  }
  logger.log(out)
  logger.log()
}

// function to substitute console.error
function error (out, desc) {
  logger.error(header())
  if (desc) {
    logger.error(desc)
  }
  logger.error(out)
  logger.error()
}

function header () {
  // return default header to write in log file
  // have to be function to use correct date and time
  const d = new Date()
  const host = require('os').hostname()
  return host + ' [' + d.toString() + '] '
}

// log calls between callbacks
function middleware (out, desc, conn, _obj, callback) {
  const err = new Error(out)
  if (typeof callback === 'function') callback(err, _obj, conn)
  else {
    logger.error(err, desc)
    if (typeof conn === 'object') conn.end()
  }
}

const fs = require('fs')
// log files
const output = fs.createWriteStream('/var/log/nodejs/cloudflare.out')
const outputErrors = fs.createWriteStream('/var/log/nodejs/cloudflare.error')
// declares logger with Console class of global console
const logger = new console.Console(output, outputErrors)

// return object with main properties of console
module.exports = {
  'log': log,
  'error': error,
  'middleware': middleware
}
