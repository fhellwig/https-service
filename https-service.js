//==============================================================================
// Exports the HttpsService class that sends HTTPS requests to a server.
//==============================================================================
// Copyright (c) 2016 Frank Hellwig
//==============================================================================

'use strict';

//------------------------------------------------------------------------------
// Dependencies
//------------------------------------------------------------------------------

const https = require('https');
const httpsRequest = require('./https-request');
const HttpsError = require('https-error');
const url = require('url');
const util = require('util');
const querystring = require('querystring');

//------------------------------------------------------------------------------
// Initialization
//------------------------------------------------------------------------------

const JSON_MEDIA_TYPE = 'application/json';
const FORM_MEDIA_TYPE = 'application/x-www-form-urlencoded';

const CONTENT_TYPE_HEADER = 'content-type';
const CONTENT_LENGTH_HEADER = 'content-length';

const slice = Array.prototype.slice;

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

function httpsError(code, opt, msg) {
  msg = `[${opt.method} https://${opt.host}:${opt.port}${opt.path}] ${msg}`;
  return new HttpsError(code, msg);
}

function appendQuery(path, query) {
  if (util.isObject(query)) {
    query = querystring.stringify(query);
  }
  if (util.isString(query)) {
    let sep = path.indexOf('?') < 0 ? '?' : '&';
    return path + sep + query;
  }
  return path;
}

function headerValue(headers, name) {
  if (util.isObject(headers)) {
    let keys = Object.keys(headers);
    for (let i = 0, n = keys.length; i < n; i++) {
      let key = keys[i];
      if (key.toLowerCase() === name) {
        return headers[key];
      }
    }
  }
  return null;
}

function removeParams(value) {
  if (value) {
    let semi = value.indexOf(';');
    if (semi > 0) {
      return value.substring(0, semi);
    }
  }
  return value;
}

//------------------------------------------------------------------------------
// Public
//------------------------------------------------------------------------------

class HttpsService {
  /**
   * Accepts a hostname (example.com) or a URI (https://example.com:443).
   */
  constructor(uri) {
    let parsed = url.parse(uri);
    if (parsed.protocol === null) {
      parsed.hostname = parsed.pathname;
    } else if (parsed.protocol !== 'https:') {
      throw new URIError(uri + ': invalid protocol (expected https)');
    }
    this.host = parsed.hostname;
    this.port = parsed.port || 443;
  }

  get(path, query) {
    path = appendQuery(path, query);
    return this.request('GET', path, null, null);
  }

  head(path, query) {
    path = appendQuery(path, query);
    return this.request('HEAD', path, null, null);
  }

  post(path, data, callback) {
    return this.request('POST', path, null, data);
  }

  put(path, data, callback) {
    return this.request('PUT', path, null, data);
  }

  patch(path, data) {
    return this.request('PATCH', path, null, data);
  }

  delete(path) {
    return this.request('DELETE', path, null, null);
  }

  request(method, path, headers, data) {
    method = method.toUpperCase();
    headers = headers || {};
    if (data !== null) {
      if (util.isObject(data) && !Buffer.isBuffer(data)) {
        let type = headerValue(headers, CONTENT_TYPE_HEADER);
        switch (type) {
          case JSON_MEDIA_TYPE:
            data = JSON.stringify(data);
            break;
          case FORM_MEDIA_TYPE:
            data = querystring.stringify(data);
            break;
          case null:
            headers[CONTENT_TYPE_HEADER] = JSON_MEDIA_TYPE;
            data = JSON.stringify(data);
            break;
          default:
            throw new Error(`Unsuported content-type (${type}) - cannot serialize object.`);
        }
      }
      if (util.isString(data) && headerValue(headers, CONTENT_LENGTH_HEADER) === null) {
        headers[CONTENT_LENGTH_HEADER] = Buffer.byteLength(data);
      }
    }
    let options = {
      method: method,
      host: this.host,
      port: this.port,
      path: path,
      headers: headers
    };
    return httpsRequest.sendRequest(options, data);
  }
}

HttpsService.JSON_MEDIA_TYPE = JSON_MEDIA_TYPE;
HttpsService.FORM_MEDIA_TYPE = FORM_MEDIA_TYPE;

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = HttpsService;
