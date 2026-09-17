const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const errorHandler = require('../../middleware/errorHandler');
const testServer = require('../helpers/testServer');

let server;
test.before(async () => {
  const app = express();
  app.set('views', path.resolve(__dirname, '../../views'));
  app.set('view engine', 'ejs');
  app.get(['/failure', '/api/failure'], (request, response, next) => {
    next(new Error('private-database-connection-detail'));
  });
  app.use(errorHandler.notFoundHandler);
  app.use(errorHandler);
  server = await testServer(app);
});
test.after(async () => { if (server) await server.close(); });

test('unexpected page failure shows a server error, not a missing room', async () => {
  const response = await fetch(server.baseUrl + '/failure');
  const body = await response.text();
  assert.equal(response.status, 500);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(body, /500/);
  assert.doesNotMatch(body, /404|找不到這個頁面|private-database-connection-detail/);
  assert.match(body, /href="\/"/);
});

test('unexpected API failure keeps the JSON error contract and hides internals', async () => {
  const response = await fetch(server.baseUrl + '/api/failure');
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false, code: 'INTERNAL_ERROR', message: 'Internal server error'
  });
});

test('missing pages still show 404 instead of a server failure', async () => {
  const response = await fetch(server.baseUrl + '/missing');
  assert.equal(response.status, 404);
  assert.match(await response.text(), /找不到這個頁面/);
});
