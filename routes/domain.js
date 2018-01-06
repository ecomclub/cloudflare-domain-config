'use strict'

// log on files
const logger = require('./../lib/Logger.js')

// JSON Schema validation with AJV
// based on http://json-schema.org/
const Ajv = require('ajv') // version >= 2.0.0
const localize = require('ajv-i18n')
// option `i18n` is required for this package to work
const ajv = Ajv({ allErrors: true })
// https://github.com/epoberezkin/ajv-i18n

const createSchema = {
  '$schema': 'http://json-schema.org/draft-06/schema#',
  'type': 'object',
  'required': [ 'domain', 'subdomain', 'domain_redirect', 'credentials' ],
  'additionalProperties': false,
  'properties': {
    'domain': {
      'type': 'string',
      'maxLength': 70,
      'format': 'hostname'
    },
    'subdomain': {
      'type': 'string',
      'maxLength': 30,
      'pattern': '^[a-z0-9-]+$'
    },
    'domain_redirect': {
      'type': 'boolean'
    },
    'credentials': {
      'type': 'object',
      'required': [ 'api_key', 'email', 'zone_id' ],
      'additionalProperties': false,
      'properties': {
        'api_key': {
          'type': 'string',
          'minLength': 30,
          'maxLength': 90,
          'pattern': '^[a-f0-9]+$'
        },
        'email': {
          'type': 'string',
          'maxLength': 100,
          'format': 'email'
        },
        'zone_id': {
          'type': 'string',
          'pattern': '^[a-f0-9]{32}$'
        }
      }
    }
  }
}
const createValidate = ajv.compile(createSchema)

function ajvErrorHandling (errors, respond) {
  let moreInfo = '/domain/schema.json'
  let devMsg = 'Bad-formatted JSON body, details in user_message'
  let usrMsg = {
    'en_us': ajv.errorsText(errors, { separator: '\n' })
  }
  // translate
  localize['pt-BR'](errors)
  usrMsg.pt_br = ajv.errorsText(errors, { separator: '\n' })

  respond({}, null, 400, 'CF1001', devMsg, usrMsg, moreInfo)
}

function post (id, meta, body, respond) {
  if (id) {
    respond({}, null, 406, 'CF1002', 'Unexpected resource ID on request URL')
  } else {
    // ajv
    let valid = createValidate(body)
    if (!valid) {
      ajvErrorHandling(createValidate.errors, respond)
    } else {
      let https = require('https')
      let options = {
        hostname: 'api.cloudflare.com',
        path: '/client/v4/zones/' + body.credentials.zone_id + '/dns_records',
        method: 'POST',
        headers: {
          'X-Auth-Email': body.credentials.email,
          'X-Auth-Key': body.credentials.api_key,
          'Content-Type': 'application/json'
        }
      }

      // body to create a record on cloudflare
      let setupDomain = {
        'type': 'CNAME',
        'name': body.subdomain,
        'content': 'storefront.e-com.plus'
      }

      // function to send the request
      let send = function () {
        let req = https.request(options, function (res) {
          let rawData = ''
          res.setEncoding('utf8')
          res.on('data', function (chunk) { rawData += chunk })
          res.on('end', function () {
            try {
              let body = JSON.parse(rawData)
              if (res.statusCode === 200) {
                // done
                respond(null, null, 204)
              } else {
                // error
                // @TODO: error handling
                // we need to treat the errors
                // response must be more conclusive and with usrMsg too
                // at this moment we are reponding only with devMsg
                let msg
                if (body.hasOwnProperty('errors')) {
                  msg = body.errors
                } else {
                  msg = 'Unknown error, see response objet to more info'
                  // logger.error(body)
                }

                respond({}, null, res.statusCode, 'CF1005', msg)
              }
            } catch (e) {
              logger.error(e)
            }
          })
          // ERROR
          req.on('error', function (err) {
            // server error
            logger.error(err)
            respond({}, null, 500, 'CF1004')
          })

          // POST
          req.write(JSON.stringify(setupDomain))
          // end request
          req.end()

          // domain redirect
          if (body.domain_redirect === true) {
            setupDomain = {
              'type': 'A',
              'name': '@',
              'content': '174.138.108.73' // storefront.e-com.plus
            }
            // resend the POST with different body
            send()
          }
        })
      }
    }
  }
}

function get (id, meta, body, respond) {
  if (id && id === 'schema') {
    // return json schema
    respond(createSchema)
  } else {
    respond({}, null, 406, 'CF1003', 'GET request is acceptable only to JSON schema, at /domain/schema.json')
  }
}

module.exports = {
  'POST': post,
  'GET': get
}
