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
const url = require('url');
const util = require('util');
const querystring = require('querystring');
const strformat = require('strformat');

//------------------------------------------------------------------------------
// Initialization
//------------------------------------------------------------------------------

const JSON_MEDIA_TYPE = 'application/json';
const FORM_MEDIA_TYPE = 'application/x-www-form-urlencoded';
const CONTENT_TYPE_HEADER = 'content-type';
const slice = Array.prototype.slice;

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

class ServiceError extends Error {
    constructor(options, code /* , ...message */ ) {
        let req = strformat('{method} https://{host}:{port}{path}', options);
        let msg = strformat.apply(null, slice.call(arguments, 2));
        super(strformat('{0} {1} {2}', req, code, msg));
        this.code = code;
        this.name = 'ServiceError';
    }
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

function contentType(headers) {
    if (util.isObject(headers)) {
        let keys = Object.keys(headers);
        for (let i = 0, n = keys.length; i < n; i++) {
            let key = keys[i];
            if (key.toLowerCase() === CONTENT_TYPE_HEADER) {
                return headers[key].toLowerCase();
            }
        }
    }
    return null;
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
            if (util.isObject(data)) {
                let type = contentType(headers);
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
                        throw new Error('Unsuported media type: ' + type);
                }
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
                let body = Buffer.concat(chunks);
                let type = response.headers[CONTENT_TYPE_HEADER];
                if (type) {
                    let semi = type.indexOf(';');
                    if (semi > 0) {
                        type = type.substring(0, semi);
                    }
                }
                if (method === 'HEAD') {
                    body = null;
                } else if (type === 'application/json') {
                    body = body.toString();
                    if (!body) {
                        return callback(new ServiceError(options, 502, 'Empty Response'));
                    }
                    try {
                        body = JSON.parse(body);
                    } catch (e) {
                        return callback(new ServiceError(options, 502, e.message));
                    }
                    // Sometimes Microsoft returns an error description.
                    if (body.error_description) {
                        let message = body.error_description.split(/\r?\n/)[0];
                        return callback(new ServiceError(options, response.statusCode, message));
                    }
                    // Other times Microsoft returns an error object.
                    if (body.error && body.error.message) {
                        return callback(new ServiceError(options, response.statusCode, body.error.message));
                    }
                } else if (type.startsWith('text/') || type.endsWith('+xml')) {
                    body = body.toString();
                }
                if (response.statusCode !== 200) {
                    return callback(new ServiceError(options, response.statusCode, response.statusMessage));
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
                throw new Error('Invalid request data: ' + (typeof data));
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
