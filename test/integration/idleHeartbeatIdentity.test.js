const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const WebSocket = require('ws');

const { createLiveHub } = require('../../realtime/liveHub');
const { createRoomState } = require('../../game/createRoomState');

function closed(socket, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for policy close')), timeoutMs);
    socket.once('close', code => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

test('heartbeat rejects a socket when its authenticated playerId no longer occupies that role', async () => {
  const server = http.createServer((_request, response) => response.end('ok'));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  const room = createRoomState('123456', 0);
  room.players.A = { playerId: 'replacement-player' };
  room.players.B = { playerId: 'player-b' };
  room.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined', 'main1Completed'];
  room.narrativeBehavior.lastMeaningfulActionAt.A = 0;
  room.streams.A.cursor = 0;

  let transacts = 0;
  const roomStore = {
    resolvePlayer() {
      return {
        role: 'A',
        playerId: 'original-player',
        room: {
          streams: { A: { cursor: 0, acknowledgedCursor: 0, events: [] } }
        }
      };
    },
    getRoom() { return structuredClone(room); },
    transact() { transacts += 1; },
    subscribe() { return () => {}; },
    acknowledge() { return 0; }
  };
  const hub = createLiveHub({ server, roomStore, allowedOrigins: [origin], now: () => 60_000 });
  const socket = new WebSocket(`ws://127.0.0.1:${port}/live?roomCode=123456`, {
    origin,
    headers: { cookie: 'room_token_123456=token' }
  });

  try {
    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    const closePromise = closed(socket);
    socket.send(JSON.stringify({ type: 'heartbeat', cursor: 0 }));
    assert.equal(await closePromise, 1008);
    assert.equal(transacts, 0);
  } finally {
    socket.terminate();
    await hub.close();
    await new Promise(resolve => server.close(resolve));
  }
});
