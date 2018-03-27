/**
 * @module https-service.js
 *
 * Exports the ServerError class that extends Error by adding a code property.
 *
 * @author Frank Hellwig <frank@hellwig.org>
 * @copyright 2018 Frank Hellwig
 */

class ServerError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

module.exports = ServerError;
