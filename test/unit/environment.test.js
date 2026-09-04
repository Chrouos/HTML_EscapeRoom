const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('unit test runner exposes required Node APIs', () => {
  assert.equal(typeof fetch, 'function');
  assert.equal(typeof crypto.randomUUID, 'function');
});
