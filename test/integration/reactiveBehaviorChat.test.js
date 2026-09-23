const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../../app');
const testServer = require('../helpers/testServer');
const { CookieJar } = require('../helpers/cookieJar');

let server;
test.before(async () => { server = await testServer(app); });
test.after(async () => { await server.close(); });

async function roomPair() {
  const a = new CookieJar();
  const created = await a.fetch(`${server.baseUrl}/rooms`, { method: 'POST' });
  const code = created.headers.get('location').split('/').pop();
  const b = new CookieJar();
  await b.fetch(`${server.baseUrl}/rooms/join`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomCode: code })
  });
  return { a, b, code, base: `${server.baseUrl}/api/rooms/${code}` };
}

test('authenticated chat is meaningful activity for the sender only', async () => {
  const { a, code, base } = await roomPair();
  app.locals.roomStore.updateRoom(code, draft => {
    draft.narrativeBehavior.lastMeaningfulActionAt.A = 0;
    draft.narrativeBehavior.lastMeaningfulActionAt.B = 1234;
  });

  const response = await a.fetch(`${base}/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId: 'reactive-chat-1', text: '我先把這段資訊告訴你。' })
  });
  assert.equal(response.status, 200);

  const stored = app.locals.roomStore.getRoom(code);
  assert.ok(stored.narrativeBehavior.lastMeaningfulActionAt.A > 0);
  assert.equal(stored.narrativeBehavior.lastMeaningfulActionAt.B, 1234);
});
