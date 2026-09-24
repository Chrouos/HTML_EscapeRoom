const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');

const app = require('../../app');
const testServer = require('../helpers/testServer');
const { CookieJar } = require('../helpers/cookieJar');
const { ensureNarrativeBehavior } = require('../../game/privateEventEngine');

let server;
test.before(async () => { server = await testServer(app); });
test.after(async () => { await server.close(); });

async function roomPair() {
  const a = new CookieJar();
  const created = await a.fetch(`${server.baseUrl}/rooms`, { method: 'POST' });
  const code = created.headers.get('location').split('/').pop();
  const b = new CookieJar();
  await b.fetch(`${server.baseUrl}/rooms/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomCode: code })
  });
  return { a, b, code, base: `${server.baseUrl}/api/rooms/${code}` };
}

async function read(jar, base, sinceCursor) {
  const suffix = sinceCursor === undefined ? '' : `?sinceCursor=${sinceCursor}`;
  const response = await jar.fetch(`${base}/state${suffix}`);
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

function nextFrame(socket, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket frame')), timeoutMs);
    socket.once('message', data => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

function enableIdleNarrative(code) {
  app.locals.roomStore.transact(code, draft => {
    draft.publicFacts ??= [];
    if (!draft.publicFacts.includes('main1Completed')) draft.publicFacts.push('main1Completed');
  }, { events: [] });
}

function makeIdleDue(code, role = 'A') {
  const now = Date.now();
  app.locals.roomStore.transact(code, draft => {
    const behavior = ensureNarrativeBehavior(draft, now);
    behavior.lastMeaningfulActionAt[role] = now - 61_000;
  }, { events: [] });
}

test('valid heartbeat emits one actor-private idle observation and strict frame shape rejects extras', async () => {
  const { a, b, code, base } = await roomPair();
  enableIdleNarrative(code);
  const beforeA = await read(a, base);
  const beforeB = await read(b, base);
  makeIdleDue(code, 'A');
  const socket = await connectLive(a, code);

  try {
    socket.send(JSON.stringify({ type: 'resume', cursor: beforeA.body.cursor }));
    socket.send(JSON.stringify({ type: 'heartbeat', cursor: beforeA.body.cursor, extra: true }));
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal((await read(b, base, beforeB.body.cursor)).body.unchanged, true);

    const framePromise = nextFrame(socket);
    socket.send(JSON.stringify({ type: 'heartbeat', cursor: beforeA.body.cursor }));
    const frame = await framePromise;
    assert.equal(frame.type, 'event');
    assert.equal(frame.cursor, beforeA.body.cursor + 1);
    assert.match(JSON.stringify(frame), /echo\.behavior\.idle\.1|沒有操作|停了一段時間/);

    const afterB = await read(b, base, beforeB.body.cursor);
    assert.equal(afterB.body.unchanged, true);
    assert.equal(afterB.body.cursor, beforeB.body.cursor);

    socket.send(JSON.stringify({ type: 'heartbeat', cursor: frame.cursor }));
    await new Promise(resolve => setTimeout(resolve, 50));
    const immediate = await read(a, base, frame.cursor);
    assert.equal(immediate.body.unchanged, true);
  } finally {
    socket.close();
  }
});

test('GET state acts as polling fallback for a due idle observation exactly once', async () => {
  const { a, b, code, base } = await roomPair();
  enableIdleNarrative(code);
  const beforeA = await read(a, base);
  const beforeB = await read(b, base);
  makeIdleDue(code, 'A');

  const first = await read(a, base, beforeA.body.cursor);
  assert.equal(first.body.unchanged, false);
  assert.equal(first.body.cursor, beforeA.body.cursor + 1);
  assert.match(JSON.stringify(first.body), /echo\.behavior\.idle\.1|沒有操作|停了一段時間/);

  const second = await read(a, base, first.body.cursor);
  assert.equal(second.body.unchanged, true);
  assert.equal(second.body.cursor, first.body.cursor);

  const partner = await read(b, base, beforeB.body.cursor);
  assert.equal(partner.body.unchanged, true);
  assert.equal(partner.body.cursor, beforeB.body.cursor);
});
