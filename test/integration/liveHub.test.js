const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const WebSocket = require('ws');

const app = require('../../app');
const { createLiveHub } = require('../../realtime/liveHub');
const testServer = require('../helpers/testServer');
const { CookieJar } = require('../helpers/cookieJar');

let runningServer;

test.before(async () => {
  runningServer = await testServer(app);
});

test.after(async () => {
  if (runningServer) await runningServer.close();
});

async function createRoom() {
  const jar = new CookieJar();
  const response = await jar.fetch(`${runningServer.baseUrl}/rooms`, { method: 'POST' });
  return {
    jar,
    roomCode: response.headers.get('location').split('/').pop()
  };
}

function liveUrl(roomCode, suffix = '') {
  return `${runningServer.baseUrl.replace(/^http/, 'ws')}/live?roomCode=${roomCode}${suffix}`;
}

function connect(room, options = {}) {
  const socket = new WebSocket(liveUrl(room.roomCode, options.suffix), {
    handshakeTimeout: 1000,
    origin: options.origin ?? runningServer.baseUrl,
    headers: options.cookie === null ? {} : {
      cookie: options.cookie ?? room.jar.header()
    }
  });

  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve(socket));
    socket.once('error', error => {
      socket.terminate();
      reject(error);
    });
  });
}

function rejectedStatus(room, options = {}) {
  const socket = new WebSocket(liveUrl(room.roomCode, options.suffix), {
    handshakeTimeout: 1000,
    origin: options.origin ?? runningServer.baseUrl,
    headers: options.cookie === null ? {} : {
      cookie: options.cookie ?? room.jar.header()
    }
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    socket.once('unexpected-response', (_request, response) => {
      settled = true;
      const { statusCode } = response;
      response.resume();
      socket.terminate();
      resolve(statusCode);
    });
    socket.once('open', () => {
      settled = true;
      socket.close();
      reject(new Error('Expected WebSocket upgrade to be rejected'));
    });
    socket.once('error', error => {
      socket.terminate();
      if (!settled) reject(error);
    });
  });
}

function messages(socket) {
  const queued = [];
  const waiting = [];

  socket.on('message', data => {
    const frame = JSON.parse(data.toString());
    const resolve = waiting.shift();
    if (resolve) resolve(frame);
    else queued.push(frame);
  });

  return {
    next(timeoutMs = 2000) {
      if (queued.length > 0) return Promise.resolve(queued.shift());
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket frame')), timeoutMs);
        waiting.push(frame => {
          clearTimeout(timer);
          resolve(frame);
        });
      });
    }
  };
}

function waitFor(check, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function inspect() {
      if (check()) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error('Timed out waiting for condition'));
        return;
      }
      setTimeout(inspect, 10);
    }
    inspect();
  });
}

function socketClosed(socket) {
  if (socket.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise(resolve => socket.once('close', resolve));
}

async function standaloneHub(roomStore, onConnection) {
  const server = http.createServer((_request, response) => response.end('not found'));
  if (onConnection) server.on('connection', onConnection);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const hub = createLiveHub({ server, roomStore, allowedOrigins: [origin] });
  return {
    server,
    hub,
    origin,
    wsUrl: `ws://127.0.0.1:${port}/live?roomCode=123456`,
    close: async () => {
      await hub.close();
      await new Promise((resolve, reject) => server.close(error => (
        error ? reject(error) : resolve()
      )));
    }
  };
}

function transact(room, index, audience = { kind: 'both' }) {
  const player = app.locals.roomStore.resolvePlayer(
    room.roomCode,
    room.jar.cookies.get(`room_token_${room.roomCode}`)
  );
  app.locals.roomStore.transact(room.roomCode, draft => {
    draft.mainProgress.push(`live-${index}`);
  }, {
    playerId: player.playerId,
    actionId: `live-${index}`,
    events: [{
      contentId: `live-${index}`,
      type: 'notice',
      text: `Update ${index}`,
      payload: { index },
      audience
    }]
  });
}

test('upgrade authenticates from the room cookie and rejects missing, invalid, or cross-origin credentials', async () => {
  const room = await createRoom();
  const socket = await connect(room);
  socket.close();

  assert.equal(await rejectedStatus(room, { cookie: null }), 401);
  assert.equal(await rejectedStatus(room, {
    cookie: `room_token_${room.roomCode}=not-a-room-token`
  }), 401);
  assert.equal(await rejectedStatus(room, { origin: 'https://attacker.example' }), 403);
  assert.equal(await rejectedStatus(room, { suffix: '&debug=true' }), 400);
});

test('query role and playerId spoofing is rejected before a stream is exposed', async () => {
  const room = await createRoom();
  assert.equal(await rejectedStatus(room, {
    suffix: '&role=B&playerId=forged'
  }), 400);
});

test('resume replays ordered actor envelopes and valid acknowledgements cannot forge the cursor', async () => {
  const room = await createRoom();
  transact(room, 1);
  transact(room, 2);

  const socket = await connect(room);
  const inbox = messages(socket);
  socket.send(JSON.stringify({ type: 'resume', cursor: 0 }));
  const first = await inbox.next();
  const second = await inbox.next();

  assert.deepEqual(Object.keys(first).sort(), ['cursor', 'event', 'type']);
  assert.deepEqual(Object.keys(first.event).sort(), ['eventId', 'kind', 'payload']);
  assert.equal(first.type, 'event');
  assert.equal(first.cursor, 1);
  assert.equal(second.cursor, 2);
  assert.equal(first.event.kind, 'state');
  assert.equal(first.event.payload.state.role, 'A');
  assert.deepEqual(first.event.payload.events.map(event => event.payload.index), [1]);
  assert.deepEqual(second.event.payload.events.map(event => event.payload.index), [2]);

  socket.send(JSON.stringify({ type: 'ack', cursor: 2 }));
  socket.send(JSON.stringify({ type: 'ack', cursor: 999 }));
  transact(room, 3);
  const third = await inbox.next();
  assert.equal(third.type, 'event');
  assert.equal(third.cursor, 3);
  socket.close();
});

test('ack persists only a sent actor cursor and reconnect skips confirmed events', async () => {
  const room = await createRoom();
  transact(room, 1);
  transact(room, 2);
  transact(room, 3);
  const acknowledged = () => app.locals.roomStore
    .getRoom(room.roomCode).streams.A.acknowledgedCursor;

  const socket = await connect(room);
  const inbox = messages(socket);
  const beforeAck = app.locals.roomStore.getRoom(room.roomCode);
  socket.send(JSON.stringify({ type: 'ack', cursor: 2 }));
  socket.send(JSON.stringify({ type: 'resume', cursor: 0 }));
  await inbox.next();
  assert.equal(acknowledged(), 0);
  await inbox.next();
  await inbox.next();

  socket.send(JSON.stringify({ type: 'ack', cursor: 2 }));
  await waitFor(() => acknowledged() === 2);
  const afterAck = app.locals.roomStore.getRoom(room.roomCode);
  assert.equal(afterAck.streams.A.cursor, beforeAck.streams.A.cursor);
  assert.equal(afterAck.streams.A.events.length, beforeAck.streams.A.events.length);
  assert.equal(afterAck.revision, beforeAck.revision);
  socket.send(JSON.stringify({ type: 'ack', cursor: 999 }));
  socket.send(JSON.stringify({ type: 'ack', cursor: 3 }));
  await waitFor(() => acknowledged() === 3);
  transact(room, 4);
  assert.equal((await inbox.next()).cursor, 4);
  assert.equal(acknowledged(), 3);
  socket.close();
  await socketClosed(socket);

  const reconnected = await connect(room);
  const replay = messages(reconnected);
  reconnected.send(JSON.stringify({ type: 'resume', cursor: 0 }));
  assert.equal((await replay.next()).cursor, 4);
  reconnected.close();
});

test('invalid and future resume cursors require a snapshot', async () => {
  const room = await createRoom();
  transact(room, 1);
  const socket = await connect(room);
  const inbox = messages(socket);

  for (const cursor of [-1, 1.5, '1', 2]) {
    socket.send(JSON.stringify({ type: 'resume', cursor }));
    assert.deepEqual(await inbox.next(), {
      type: 'snapshot_required',
      reason: 'invalid_cursor'
    });
  }
  socket.close();
});

test('resume reports a retention gap after more than 256 actor events', async () => {
  const room = await createRoom();
  const player = app.locals.roomStore.resolvePlayer(
    room.roomCode,
    room.jar.cookies.get(`room_token_${room.roomCode}`)
  );
  for (let index = 1; index <= 257; index += 1) {
    app.locals.roomStore.transact(room.roomCode, draft => {
      draft.publicProgress = { index };
    }, {
      playerId: player.playerId,
      actionId: `retention-${index}`,
      events: []
    });
  }

  const socket = await connect(room);
  const inbox = messages(socket);
  socket.send(JSON.stringify({ type: 'resume', cursor: 0 }));
  assert.deepEqual(await inbox.next(), {
    type: 'snapshot_required',
    reason: 'retention_gap'
  });
  socket.close();
});

test('rejected raw upgrades are destroyed after the response is flushed', async () => {
  let acceptedSocket;
  const fakeStore = {
    resolvePlayer() { throw new Error('must not authenticate a rejected origin'); },
    subscribe() { throw new Error('must not subscribe a rejected origin'); },
    acknowledge() { throw new Error('must not acknowledge a rejected origin'); }
  };
  const standalone = await standaloneHub(fakeStore, socket => { acceptedSocket = socket; });
  const client = net.createConnection({
    host: '127.0.0.1',
    port: standalone.server.address().port,
    allowHalfOpen: true
  });

  try {
    await new Promise((resolve, reject) => {
      client.once('connect', resolve);
      client.once('error', reject);
    });
    client.write([
      'GET /live?roomCode=123456 HTTP/1.1',
      `Host: 127.0.0.1:${standalone.server.address().port}`,
      'Connection: Upgrade',
      'Upgrade: websocket',
      'Sec-WebSocket-Version: 13',
      'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
      'Origin: https://attacker.example',
      '',
      ''
    ].join('\r\n'));
    const response = await new Promise((resolve, reject) => {
      client.once('data', data => resolve(data.toString()));
      client.once('error', reject);
    });
    assert.match(response, /^HTTP\/1\.1 403 Forbidden\r\n/);
    await waitFor(() => acceptedSocket && acceptedSocket.destroyed);
  } finally {
    client.destroy();
    await standalone.close();
  }
});

test('last disconnect drops actor buffers and creates a fresh same-code subscription', async () => {
  let subscribeCount = 0;
  let unsubscribeCount = 0;
  let listener = null;
  let generation = 1;
  const roomStore = {
    resolvePlayer() {
      return {
        role: 'A',
        playerId: 'reused-player-id',
        room: {
          streams: {
            A: { cursor: 0, acknowledgedCursor: 0, events: [] }
          }
        }
      };
    },
    subscribe(_roomCode, nextListener) {
      subscribeCount += 1;
      listener = nextListener;
      return () => {
        unsubscribeCount += 1;
        if (listener === nextListener) listener = null;
      };
    },
    acknowledge() {}
  };
  const standalone = await standaloneHub(roomStore);
  const connectStandalone = () => new Promise((resolve, reject) => {
    const socket = new WebSocket(standalone.wsUrl, {
      origin: standalone.origin,
      headers: { cookie: 'room_token_123456=token' }
    });
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });

  try {
    const first = await connectStandalone();
    first.close();
    await socketClosed(first);
    await waitFor(() => unsubscribeCount === 1);

    generation = 2;
    const second = await connectStandalone();
    assert.equal(subscribeCount, 2);
    const inbox = messages(second);
    second.send(JSON.stringify({ type: 'resume', cursor: 0 }));
    listener({
      roomCode: '123456',
      envelopes: {
        A: { cursor: 1, state: { role: 'A', generation }, events: [] }
      }
    });
    const frame = await inbox.next();
    assert.equal(frame.cursor, 1);
    assert.equal(frame.event.payload.state.generation, 2);
    second.close();
    await socketClosed(second);
  } finally {
    await standalone.close();
  }
});
