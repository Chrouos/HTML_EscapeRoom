const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../../app');
const testServer = require('../helpers/testServer');
const { CookieJar } = require('../helpers/cookieJar');
let server;
test.before(async () => { server = await testServer(app); });
test.after(async () => { await server.close(); });

test('chat is authenticated, escaped as data, ordered, deduplicated and recoverable', async () => {
  const jar = new CookieJar();
  const created = await jar.fetch(`${server.baseUrl}/rooms`, { method: 'POST' });
  const code = created.headers.get('location').split('/').pop();
  const base = `${server.baseUrl}/api/rooms/${code}`;
  const read = async suffix => (await (await jar.fetch(`${base}/state${suffix || ''}`)).json());
  const before = await read();
  const post = async (client, body) => client.fetch(`${base}/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  const body = { actionId: 'chat-1', text: '<script>alert(1)</script>', role: 'B' };
  assert.equal((await post(new CookieJar(), body)).status, 409);
  const result = await (await post(jar, body)).json();
  assert.equal(result.success, true);
  const message = result.state.messages.at(-1);
  assert.equal(message.type, 'player');
  assert.equal(message.role, 'A');
  assert.equal(message.text, body.text);
  const retry = await (await post(jar, body)).json();
  assert.equal(retry.state.revision, result.state.revision);
  assert.deepEqual(retry.state.messages, result.state.messages);
  assert.deepEqual(await read(`?sinceRevision=${result.state.revision}`), {
    success: true, unchanged: true, revision: result.state.revision,
    countdown: result.state.countdown
  });
  const recovered = await read(`?sinceRevision=${before.state.revision}`);
  assert.deepEqual(recovered.state.messages, result.state.messages);
  assert.equal((await post(jar, { actionId: 'empty', text: '  ' })).status, 400);
});
