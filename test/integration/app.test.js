const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../../app');
const testServer = require('../helpers/testServer');

let runningServer;

test.before(async () => {
  runningServer = await testServer(app);
});

test.after(async () => {
  if (runningServer) {
    await runningServer.close();
  }
});

test('GET / returns the lobby as UTF-8 HTML', async () => {
  const response = await fetch(`${runningServer.baseUrl}/`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html; charset=utf-8/);
  assert.match(body, /lobby/i);
});

test('an unknown page returns one HTML 404 response', async () => {
  const response = await fetch(`${runningServer.baseUrl}/does-not-exist`);
  const body = await response.text();

  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /^text\/html; charset=utf-8/);
  assert.match(body, /404/);
});

test('an unknown API endpoint returns the JSON 404 contract', async () => {
  const response = await fetch(`${runningServer.baseUrl}/api/does-not-exist`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /^application\/json; charset=utf-8/);
  assert.deepEqual(body, {
    success: false,
    code: 'NOT_FOUND',
    message: 'Resource not found'
  });
});
