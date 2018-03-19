//==============================================================================
// Exports the HttpsService class that sends HTTPS requests to a server.
//==============================================================================
// Copyright (c) 2018 Frank Hellwig
//==============================================================================

'use strict';

//------------------------------------------------------------------------------
// Dependencies
//------------------------------------------------------------------------------

const https = require('https');
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
  if (headers === null) return null;
  name = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name) {
      return value;
    }
  }
  return null;
}

function removeHeader(headers, name) {
  if (headers === null) return null;
  name = name.toLowerCase();
  const retval = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== name) {
      retval[key] = value;
    }
  }
  return retval;
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

function sendRequest(options, dataToSend = null) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const request = https.request(options, response => {
      response.on('data', chunk => {
        chunks.push(chunk);
      });
      response.on('end', _ => {
        const code = response.statusCode;
        const headers = response.headers;
        let type = null;
        let data = null;
        if (code === 204) {
          return resolve({ code, headers, type, data });
        }
        type = removeParams(headerValue(headers, CONTENT_TYPE_HEADER));
        if (options.method === 'HEAD') {
          return resolve({ code, headers, type, data });
        }
        const body = Buffer.concat(chunks);
        if (type === JSON_MEDIA_TYPE) {
          const json = body.toString();
          if (!json) {
            return reject(HttpsError.internalServerError('Server returned an empty response.'));
          }
          try {
            data = JSON.parse(json);
          } catch (e) {
            return reject(HttpsError.internalServerError(`Cannot parse response (${e.message}).`));
          }
          // Sometimes Microsoft returns an error description.
          if (data.error_description) {
            let message = data.error_description.split(/\r?\n/)[0];
            return reject(new HttpsError(code, message));
          }
          // Other times Microsoft returns an error object.
          if (data.error && data.error.message) {
            return reject(new HttpsError(code, body.error.message));
          }
          // It could be an odata error.
          if (data['odata.error'] && data['odata.error'].message) {
            return reject(new HttpsError(code, data['odata.error'].message.value));
          }
        } else if (type.startsWith('text/') || type.endsWith('+xml')) {
          data = body.toString();
        }
        if (code >= 400) {
          return reject(new HttpsError(code, response.statusMessage));
        }
        resolve({ code, headers, type, data });
      });
    });
    request.on('error', err => {
      reject(err);
    });
    if (dataToSend !== null) {
      request.write(dataToSend);
    }
    request.end();
  });
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

  post(path, data, type = null) {
    return this.request('POST', path, { 'content-type': type }, data);
  }

  put(path, data, type = null) {
    return this.request('PUT', path, { 'content-type': type }, data);
  }

  patch(path, data, type = null) {
    return this.request('PATCH', path, { 'content-type': type }, data);
  }

  delete(path) {
    return this.request('DELETE', path, null, null);
  }

  request(method, path, headers, data) {
    method = method.toUpperCase();
    headers = headers || {};
    if (data === null) {
      headers = removeHeader(headers, CONTENT_TYPE_HEADER);
      headers = removeHeader(headers, CONTENT_LENGTH_HEADER);
    } else if (Buffer.isBuffer(data)) {
      const type = headerValue(headers, CONTENT_TYPE_HEADER);
      if (!type) {
        throw new Error('The content-type must be specified for binary data.');
      }
      headers[CONTENT_LENGTH_HEADER] = data.length;
    } else if (typeof data === 'string') {
      if (!headerValue(headers, CONTENT_TYPE_HEADER)) {
        headers[CONTENT_TYPE_HEADER] = 'text/plain';
      }
      headers[CONTENT_LENGTH_HEADER] = Buffer.byteLength(data);
    } else {
      const type = removeParams(headerValue(headers, CONTENT_TYPE_HEADER));
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
      headers[CONTENT_LENGTH_HEADER] = Buffer.byteLength(data);
    }
    let options = {
      method: method,
      host: this.host,
      port: this.port,
      path: path,
      headers: headers
    };
    return sendRequest(options, data);
  }
}

HttpsService.JSON_MEDIA_TYPE = JSON_MEDIA_TYPE;
HttpsService.FORM_MEDIA_TYPE = FORM_MEDIA_TYPE;

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = HttpsService;
