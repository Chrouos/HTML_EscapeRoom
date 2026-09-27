const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
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

function connectLive(jar, roomCode) {
  const socket = new WebSocket(
    `${server.baseUrl.replace(/^http/, 'ws')}/live?roomCode=${roomCode}`,
    { origin: server.baseUrl, headers: { cookie: jar.header() } }
  );
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function nextFrame(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket frame')), 2000);
    socket.once('message', data => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

test('player chat is authenticated, actor-scoped, deduplicated, and visible to both players', async () => {
  const { a, b, code, base } = await roomPair();
  const aBefore = await read(a, base);
  const bBefore = await read(b, base);
  const playerIds = ['A', 'B'].map(role => app.locals.roomStore
    .getRoom(code).players[role].playerId);
  const aSocket = await connectLive(a, code);
  const bSocket = await connectLive(b, code);
  const aFrame = nextFrame(aSocket);
  const bFrame = nextFrame(bSocket);
  aSocket.send(JSON.stringify({ type: 'resume', cursor: aBefore.body.cursor }));
  bSocket.send(JSON.stringify({ type: 'resume', cursor: bBefore.body.cursor }));
  const message = { actionId: 'chat-1', text: '<script>alert(1)</script>', role: 'B' };

  try {
    assert.equal((await postChat(new CookieJar(), base, message)).response.status, 409);
    const first = await postChat(a, base, message);
    assert.equal(first.body.success, true);
    assert.equal(first.body.state.intercom.at(-1).text, message.text);
    assert.equal(first.body.state.intercom.at(-1).payload.role, 'A');
    assert.doesNotMatch(JSON.stringify(first.body), /audience|revision/);

    const [liveA, liveB] = await Promise.all([aFrame, bFrame]);
    for (const serialized of [JSON.stringify(liveA), JSON.stringify(liveB)]) {
      for (const playerId of playerIds) assert.equal(serialized.includes(playerId), false);
    }

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
    for (const body of [aRecovered.body, bRecovered.body]) {
      const serialized = JSON.stringify(body);
      for (const playerId of playerIds) assert.equal(serialized.includes(playerId), false);
    }
    const storedStreams = JSON.stringify(app.locals.roomStore.getRoom(code).streams);
    for (const playerId of playerIds) assert.equal(storedStreams.includes(playerId), false);
    assert.equal((await postChat(a, base, { actionId: 'empty', text: '  ' })).response.status, 400);
  } finally {
    aSocket.close();
    bSocket.close();
  }
});

test('chat resets only the speaking actor narrative idle clock', async () => {
  const { a, code, base } = await roomPair();
  await read(a, base);
  app.locals.roomStore.updateRoom(code, draft => {
    draft.narrativeBehavior.lastMeaningfulActionAt.A = 0;
    draft.narrativeBehavior.lastMeaningfulActionAt.B = 0;
  });

  const result = await postChat(a, base, { actionId: 'activity-chat', text: 'still working' });
  assert.equal(result.response.status, 200);
  const stored = app.locals.roomStore.getRoom(code);
  assert.ok(stored.narrativeBehavior.lastMeaningfulActionAt.A > 0);
  assert.equal(stored.narrativeBehavior.lastMeaningfulActionAt.B, 0);
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
