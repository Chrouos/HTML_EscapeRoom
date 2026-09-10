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

async function read(jar, base, sinceCursor) {
  const suffix = sinceCursor === undefined ? '' : `?sinceCursor=${sinceCursor}`;
  const response = await jar.fetch(`${base}/state${suffix}`);
  return { response, body: await response.json() };
}

async function postChat(jar, base, body) {
  const response = await jar.fetch(`${base}/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

test('player chat is authenticated, actor-scoped, deduplicated, and visible to both players', async () => {
  const { a, b, base } = await roomPair();
  const aBefore = await read(a, base);
  const bBefore = await read(b, base);
  const message = { actionId: 'chat-1', text: '<script>alert(1)</script>', role: 'B' };

  assert.equal((await postChat(new CookieJar(), base, message)).response.status, 409);
  const first = await postChat(a, base, message);
  assert.equal(first.body.success, true);
  assert.equal(first.body.state.intercom.at(-1).text, message.text);
  assert.equal(first.body.state.intercom.at(-1).payload.role, 'A');
  assert.doesNotMatch(JSON.stringify(first.body), /audience|revision/);

  const duplicate = await postChat(a, base, message);
  assert.equal(duplicate.body.cursor, first.body.cursor);
  assert.deepEqual(duplicate.body.state.intercom, first.body.state.intercom);

  const sameIdOtherActor = await postChat(b, base, { actionId: 'chat-1', text: 'B reply' });
  assert.equal(sameIdOtherActor.body.state.intercom.at(-1).text, 'B reply');
  assert.equal(sameIdOtherActor.body.state.intercom.at(-1).payload.role, 'B');

  const aRecovered = await read(a, base, aBefore.body.cursor);
  const bRecovered = await read(b, base, bBefore.body.cursor);
  assert.deepEqual(aRecovered.body.state.intercom.map(item => item.text).slice(-2), [message.text, 'B reply']);
  assert.deepEqual(bRecovered.body.state.intercom.map(item => item.text).slice(-2), [message.text, 'B reply']);
  assert.equal((await postChat(a, base, { actionId: 'empty', text: '  ' })).response.status, 400);
});

test('a hidden-only mutation leaves the unchanged recipient cursor untouched', async () => {
  const { a, b, code, base } = await roomPair();
  const aBefore = await read(a, base);
  const bBefore = await read(b, base);
  const playerA = app.locals.roomStore.resolvePlayer(code, a.cookies.get(`room_token_${code}`));

  app.locals.roomStore.transact(code, draft => {
    draft.privateMissions = { ...(draft.privateMissions || {}), A: [{ id: 'only-a' }] };
  }, {
    playerId: playerA.playerId,
    actionId: 'private-a',
    events: [{ contentId: 'private-a', type: 'clue', text: 'A only',
      audience: { kind: 'player', playerId: playerA.playerId } }]
  });

  const changed = await read(a, base, aBefore.body.cursor);
  const unchanged = await read(b, base, bBefore.body.cursor);
  assert.equal(changed.body.unchanged, false);
  assert.equal(changed.body.cursor, aBefore.body.cursor + 1);
  assert.equal(unchanged.body.success, true);
  assert.equal(unchanged.body.unchanged, true);
  assert.equal(unchanged.body.cursor, bBefore.body.cursor);
  assert.equal(unchanged.body.countdown.status, bBefore.body.countdown.status);
  assert.equal(Object.hasOwn(unchanged.body, 'state'), false);
});
