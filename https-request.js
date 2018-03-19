// Copyright (c) 2018 Frank Hellwig

'use strict';

const util = require('util');
const https = require('https');
const HttpsError = require('https-error');

function sendRequest(options, dataToSend = null) {
  const ok = dataToSend == null || util.isString(dataToSend) || Buffer.isBuffer(dataToSend);
  if (!ok) {
    throw new Error(`Invalid request data type (${typeof dataToSend}) - must be String or Buffer.`);
  }
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
        const contentType = headers['content-type'];
        if (contentType) {
          let semi = contentType.indexOf(';');
          if (semi > 0) {
            type = contentType.substring(0, semi);
          } else {
            type = contentType;
          }
        }
        if (options.method === 'HEAD') {
          return resolve({ code, headers, type, data });
        }
        const body = Buffer.concat(chunks);
        if (type === 'application/json') {
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
          data = data.toString();
        }
        if (code >= 400) {
          return reject(httpsError(code, response.statusMessage));
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

module.exports = { sendRequest };
