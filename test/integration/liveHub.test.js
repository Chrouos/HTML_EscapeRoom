const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');

const app = require('../../app');
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
