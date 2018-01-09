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

const translate = require('translate')
// https://www.npmjs.com/package/translate

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

function post (id, meta, body, respond, yandexApiKey) {
  if (id) {
    respond({}, null, 406, 'CF1002', 'Unexpected resource ID on request URL')
  } else {
    // ajv
    let valid = createValidate(body)
    if (!valid) {
      ajvErrorHandling(createValidate.errors, respond)
    } else {
      let https = require('https')
      // create dns record
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
      let setup
      setup = {
        'type': 'CNAME',
        'name': body.subdomain,
        'content': 'storefront.e-com.plus',
        'proxied': true
      }

      // count sent and finished requests
      let requests = 0
      let done = 0
      // response with error
      let errorRequest = false

      // function to send the request
      let send = function () {
        // more one request
        requests++

        let req = https.request(options, function (res) {
          let rawData = ''
          res.setEncoding('utf8')
          res.on('data', function (chunk) { rawData += chunk })
          res.on('end', function () {
            if (!errorRequest) {
              let response
              try {
                response = JSON.parse(rawData)
              } catch (e) {
                respond({}, null, res.statusCode, 'CF1007', 'Cloudflare sent a invalid JSON')
                return
              }

              if (res.statusCode === 200) {
                done++
                // check if all requests are done
                // DNS and page rules
                if (done === requests) {
                  respond(null, null, 204)
                }
              } else {
                // set error true to not treat other responses
                errorRequest = true

                if (typeof response === 'object' && response !== null && Array.isArray(response.errors)) {
                  // example of error response
                  // {
                  //   "result": null,
                  //   "success": false,
                  //   "errors": [{"code":1003,"message":"Invalid or missing zone id."}],
                  //   "messages": []
                  // }
                  let devMsg
                  let usrMsg = {}

                  for (let i = 0; i < response.errors.length; i++) {
                    if (typeof response.errors[i] === 'object' && response.errors[i] !== null) {
                      if (response.errors[i].hasOwnProperty('message')) {
                        usrMsg.en_us = response.errors[i].message
                        devMsg = 'Error code: ' + response.errors[i].code + ', more details on user_message'
                        break
                      }
                    }
                  }

                  if (devMsg === undefined) {
                    // no valid error object in Cloudflare response
                    respond({}, null, res.statusCode, 'CF1010')
                  } else {
                    // translate to portuguese
                    translate(usrMsg.en_us, {
                      to: 'pt',
                      engine: 'yandex',
                      key: yandexApiKey
                    }).then(text => {
                      if (text != null) {
                        usrMsg.pt_br = text
                      }
                      respond({}, null, res.statusCode, 'CF1005', devMsg, usrMsg)
                    }).catch(err => {
                      logger.error(err)
                      // respond without pt_br
                      respond({}, null, res.statusCode, 'CF1009', devMsg, usrMsg)
                    })
                  }
                } else {
                  // unknown error
                  respond({}, null, res.statusCode, 'CF1008')
                }
              }
            }
          })
        })

        req.on('error', function (err) {
          // server error
          logger.error(err)
          respond({}, null, 500, 'CF1004')
        })

        // POST body
        req.write(JSON.stringify(setup))
        // end request
        req.end()
      }
      // first request
      send()

      // domain redirect
      if (body.domain_redirect === true) {
        setup = {
          'type': 'A',
          'name': '@',
          // storefront.e-com.plus
          'content': '174.138.108.73',
          'proxied': true
        }
        // resend the POST with different body
        send()
      }

      // create page rules
      options.path = '/client/v4/zones/' + body.credentials.zone_id + '/pagerules'

      setup = {
        'targets': [{
          'target': 'url',
          'constraint': {
            'operator': 'matches',
            'value': 'http://' + body.subdomain + '.' + body.domain + '/*'
          }
        }],
        'actions': [{
          'id': 'always_use_https',
          'value': 'on'
        }],
        'priority': 2,
        'status': 'active'
      }
      send()

      setup = {
        'targets': [{
          'target': 'url',
          'constraint': {
            'operator': 'matches',
            'value': body.subdomain + '.' + body.domain + '/*'
          }
        }],
        'actions': [{
          'id': 'ssl',
          'value': 'flexible'
        }, {
          'id': 'always_online',
          'value': 'on'
        }, {
          'id': 'security_level',
          'value': 'medium'
        }, {
          'id': 'cache_level',
          'value': 'cache_everything'
        }, {
          'id': 'explicit_cache_control',
          'value': 'on'
        }],
        'priority': 1,
        'status': 'active'
      }
      send()
    }
  }
}

function get (id, meta, body, respond) {
  if (id === 'schema') {
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
