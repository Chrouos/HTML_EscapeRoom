const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createRoomStore } = require('../../game/roomStore');
const { createApiRoutes } = require('../../routes/apiRoutes');
const testServer = require('../helpers/testServer');
const { CookieJar } = require('../helpers/cookieJar');

test('zero countdown emits one event and still permits puzzle completion', async () => {
  let now = 0;
  const store = createRoomStore({ now: () => now });
  const created = store.createRoom();
  const code = created.room.roomCode;
  store.joinRoom(code);
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRoutes(store));
  const server = await testServer(app);
  const jar = new CookieJar().set(`room_token_${code}`, created.player.token);
  try {
    const url = `${server.baseUrl}/api/rooms/${code}`;
    const before = await (await jar.fetch(`${url}/state`)).json();
    now = 45 * 60 * 1000;
    const alarm = await (await jar.fetch(`${url}/state?sinceCursor=${before.cursor}`)).json();
    assert.equal(alarm.countdown.status, 'emergency');
    assert.equal(alarm.state.intercom.filter(message => message.contentId === 'containment-zero').length, 1);
    const again = await (await jar.fetch(`${url}/state?sinceCursor=${alarm.cursor}`)).json();
    assert.equal(again.unchanged, true);
    const solved = await (await jar.fetch(`${url}/actions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId: 'late', puzzleId: 'main1', stepId: 'identity', value: 'ORPHEUS-17' })
    })).json();
    assert.equal(solved.publicResult.correct, true);
    assert.equal(solved.countdown.remainingMs, 0);
  } finally { await server.close(); }
});
