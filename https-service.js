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
        let sep = (path.indexOf('?') < 0) ? '?' : '&';
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
                return headers[key].toLowerCase();
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

    // get(path, [query,] callback)
    // callback(err, body, type);
    get(path, query, callback) {
        if (typeof query === 'function') {
            callback = query;
            query = null;
        } else {
            path = appendQuery(path, query);
        }
        this.request('GET', path, null, null, callback);
    }

    head(path, query, callback) {
        if (typeof query === 'function') {
            callback = query;
            query = null;
        } else {
            path = appendQuery(path, query);
        }
        this.request('HEAD', path, null, null, callback);
    }

    post(path, data, callback) {
        this.request('POST', path, null, data, callback);
    }

    put(path, data, callback) {
        this.request('PUT', path, null, data, callback);
    }

    patch(path, data, callback) {
        this.request('PATCH', path, null, data, callback);
    }

    delete(path, callback) {
        this.request('DELETE', path, null, null, callback);
    }

    request(method, path, headers, data, callback) {
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
                        throw new Error('Unsuported media type (cannot serialize object): ' + type);
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
        let chunks = [];
        let request = https.request(options, response => {
            response.on('data', chunk => {
                chunks.push(chunk);
            });
            response.on('end', _ => {
                if (response.statusCode === 204) {
                    return callback(null, null, null, response.headers);
                }
                let code = response.statusCode;
                let type = removeParams(headerValue(response.headers, CONTENT_TYPE_HEADER));
                let body = Buffer.concat(chunks);
                if (method === 'HEAD') {
                    body = null;
                } else if (type === 'application/json') {
                    body = body.toString();
                    if (!body) {
                        return callback(httpsError(502, options, 'Empty Response'));
                    }
                    try {
                        body = JSON.parse(body);
                    } catch (e) {
                        return callback(httpsError(502, options, e.message));
                    }
                    // Sometimes Microsoft returns an error description.
                    if (body.error_description) {
                        let message = body.error_description.split(/\r?\n/)[0];
                        return callback(httpsError(code, options, message));
                    }
                    // Other times Microsoft returns an error object.
                    if (body.error && body.error.message) {
                        return callback(httpsError(code, options, body.error.message));
                    }
                    // It could be an odata error.
                    if (body['odata.error'] && body['odata.error'].message) {
                        return callback(httpsError(code, options, body['odata.error'].message.value));
                    }
                } else if (type.startsWith('text/') || type.endsWith('+xml')) {
                    body = body.toString();
                }
                let success = code === 200 || code === 204;
                if (!success) {
                    return callback(httpsError(response.statusCode, options,
                        'The request was not successfully completed.'));
                }
                callback(null, body, type, response.headers);
            });
        });
        request.on('error', err => {
            callback(err);
        });
        if (data !== null) {
            if (util.isString(data) || Buffer.isBuffer(data)) {
                request.write(data);
            } else {
                throw new Error('Invalid request data (must be string or Buffer): ' + (typeof data));
            }
        }
        request.end();
    }
}

HttpsService.JSON_MEDIA_TYPE = JSON_MEDIA_TYPE;
HttpsService.FORM_MEDIA_TYPE = FORM_MEDIA_TYPE;

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = HttpsService;
