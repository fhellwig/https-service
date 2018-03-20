'use strict';

const HttpsService = require('../https-service');
const assert = require('assert');

const service = new HttpsService('httpbin.org');

const DATA = {
  a: 1,
  b: 2,
  c: 3
};

describe('https-service', function() {
  describe('get', function() {
    it('should send a GET request to the server', function() {
      return service.get('/get').then(response => {
        assert.strictEqual(response.code, 200);
      });
    });
  });
  describe('head', function() {
    it('should send a HEAD request to the server', function() {
      return service.head('/get', {}).then(response => {
        assert.strictEqual(response.code, 200);
      });
    });
  });
  describe('post', function() {
    it('should send a POST request to the server', function() {
      return service.post('/post', DATA).then(response => {
        assert.strictEqual(response.code, 200);
        assert.deepStrictEqual(response.data.json, DATA);
      });
    });
  });
  describe('post', function() {
    it('should send a POST (text) request to the server', function() {
      return service.post('/post', 'hello').then(response => {
        assert.strictEqual(response.code, 200);
        assert.deepStrictEqual(response.data.data, 'hello');
      });
    });
  });
  describe('post', function() {
    it('should send a POST (Buffer) request to the server', function() {
      const buf = Buffer.from('hello');
      return service.post('/post', buf, 'text/plain').then(response => {
        assert.strictEqual(response.code, 200);
        assert.deepStrictEqual(response.data.data, 'hello');
      });
    });
  });
  describe('post', function() {
    it('should result in an error for a POST request without data', function() {
      assert.throws(_ => {
        service.post('/post', null, 'text/plain');
      });
    });
  });
  describe('post', function() {
    it('should result in an error for a POST request with invalid data', function() {
      assert.throws(_ => {
        service.post('/post', 1, 'text/plain');
      });
    });
  });
  describe('put', function() {
    it('should send a PUT request to the server', function() {
      return service.put('/put', DATA).then(response => {
        assert.strictEqual(response.code, 200);
        assert.deepStrictEqual(response.data.json, DATA);
      });
    });
  });
  describe('patch', function() {
    it('should send a PATCH request to the server', function() {
      return service.patch('/patch', DATA).then(response => {
        assert.strictEqual(response.code, 200);
        assert.deepStrictEqual(response.data.json, DATA);
      });
    });
  });
  describe('delete', function() {
    it('should send a DELETE request to the server', function() {
      return service.delete('/delete', {}).then(response => {
        assert.strictEqual(response.code, 200);
      });
    });
  });
});
