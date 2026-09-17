const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('integration test runner executes from the integration directory', () => {
  assert.equal(path.basename(__dirname), 'integration');
});
