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

function markIdle(code, role = 'A') {
  app.locals.roomStore.updateRoom(code, draft => {
    draft.publicFacts ??= [];
    for (const fact of ['roomCreated', 'hostJoined', 'guestJoined', 'main1Completed']) {
      if (!draft.publicFacts.includes(fact)) draft.publicFacts.push(fact);
    }
    draft.narrativeBehavior.lastMeaningfulActionAt[role] = Date.now() - 61_000;
  });
}

function connect(jar, code) {
  const socket = new WebSocket(
    `${server.baseUrl.replace(/^http/, 'ws')}/live?roomCode=${code}`,
    { origin: server.baseUrl, headers: { cookie: jar.header() } }
  );
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function waitFor(check, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function inspect() {
      if (check()) return resolve();
      if (Date.now() >= deadline) return reject(new Error('Timed out waiting for condition'));
      setTimeout(inspect, 10);
    }
    inspect();
  });
}

test('GET /state emits one due idle observation and an immediate second poll is a no-op', async () => {
  const { a, b, code, base } = await roomPair();
  markIdle(code, 'A');
  const before = app.locals.roomStore.getRoom(code);
  const aCursor = before.streams.A.cursor;
  const bCursor = before.streams.B.cursor;
  const aBeforeEvents = before.streams.A.events.length;

  const first = await a.fetch(`${base}/state?sinceCursor=${aCursor}`);
  const firstBody = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstBody.unchanged, false);
  assert.ok(firstBody.cursor > aCursor);
  assert.equal(firstBody.state.intercom.filter(item => /停了一段時間|沒有操作/.test(item.text)).length, 1);
  const afterFirst = app.locals.roomStore.getRoom(code);
  assert.equal(afterFirst.streams.A.events.length, aBeforeEvents + 1);

  const second = await a.fetch(`${base}/state?sinceCursor=${firstBody.cursor}`);
  const secondBody = await second.json();
  assert.equal(secondBody.unchanged, true);
  assert.equal(secondBody.cursor, firstBody.cursor);

  const partner = await b.fetch(`${base}/state?sinceCursor=${bCursor}`);
  const partnerBody = await partner.json();
  assert.equal(partnerBody.unchanged, true);
  assert.equal(partnerBody.cursor, bCursor);
});

test('authenticated WebSocket heartbeat triggers idle observation only for that actor', async () => {
  const { a, b, code } = await roomPair();
  markIdle(code, 'A');
  const before = app.locals.roomStore.getRoom(code);
  const aCursor = before.streams.A.cursor;
  const bCursor = before.streams.B.cursor;
  const aSocket = await connect(a, code);
  const bSocket = await connect(b, code);
  try {
    aSocket.send(JSON.stringify({ type: 'resume', cursor: aCursor }));
    bSocket.send(JSON.stringify({ type: 'resume', cursor: bCursor }));
    aSocket.send(JSON.stringify({ type: 'heartbeat', cursor: aCursor }));

    await waitFor(() => app.locals.roomStore.getRoom(code).streams.A.cursor === aCursor + 1);
    const after = app.locals.roomStore.getRoom(code);
    assert.equal(after.streams.B.cursor, bCursor);
    const idle = after.messages.filter(message => /停了一段時間|沒有操作/.test(message.text));
    assert.equal(idle.length, 1);
    assert.deepEqual(idle[0].audience, { kind: 'role', role: 'host' });

    aSocket.send(JSON.stringify({ type: 'heartbeat', cursor: aCursor + 1, contentId: 'forged' }));
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(app.locals.roomStore.getRoom(code).streams.A.cursor, aCursor + 1);
  } finally {
    aSocket.close();
    bSocket.close();
  }
});
