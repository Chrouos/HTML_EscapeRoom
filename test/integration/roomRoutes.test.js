const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../../app');
const testServer = require('../helpers/testServer');
const { CookieJar } = require('../helpers/cookieJar');

let runningServer;

test.before(async () => {
  runningServer = await testServer(app);
});

test.after(async () => {
  if (runningServer) {
    await runningServer.close();
  }
});

async function createRoom(jar = new CookieJar()) {
  const response = await jar.fetch(`${runningServer.baseUrl}/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: ''
  });
  assert.equal(response.status, 303);
  assert.equal(response.lastSetCookies.length, 1);
  assert.match(response.lastSetCookies[0], /;\s*Path=\//i);
  assert.match(response.lastSetCookies[0], /;\s*HttpOnly(?:;|$)/i);
  assert.match(response.lastSetCookies[0], /;\s*SameSite=Lax(?:;|$)/i);
  assert.doesNotMatch(response.lastSetCookies[0], /;\s*Secure(?:;|$)/i);
  const location = response.headers.get('location');
  assert.match(location, /^\/rooms\/\d{6}$/);
  return { jar, roomCode: location.split('/').pop(), response };
}

async function readState(jar, roomCode, suffix = '') {
  const response = await jar.fetch(`${runningServer.baseUrl}/api/rooms/${roomCode}/state${suffix}`);
  const body = await response.json();
  return { response, body };
}

test('creates, joins, refreshes, and keeps A/B roles bound to separate cookies', async () => {
  const a = await createRoom();
  const anonymous = await (new CookieJar()).fetch(`${runningServer.baseUrl}/rooms/${a.roomCode}`);
  const anonymousBody = await anonymous.text();
  assert.equal(anonymous.status, 200);
  assert.match(anonymousBody, /等待玩家加入|等待中/);
  assert.match(anonymousBody, /加入房間/);

  const b = new CookieJar();
  const joined = await b.fetch(`${runningServer.baseUrl}/rooms/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ roomCode: a.roomCode })
  });
  assert.equal(joined.status, 303);
  assert.equal(joined.lastSetCookies.length, 1);
  assert.match(joined.lastSetCookies[0], /;\s*Path=\//i);
  assert.match(joined.lastSetCookies[0], /;\s*HttpOnly(?:;|$)/i);
  assert.match(joined.lastSetCookies[0], /;\s*SameSite=Lax(?:;|$)/i);
  assert.doesNotMatch(joined.lastSetCookies[0], /;\s*Secure(?:;|$)/i);
  assert.equal(joined.headers.get('location'), `/rooms/${a.roomCode}`);
  assert.notEqual(a.jar.header(), b.header());
  assert.match(a.jar.header(), new RegExp(`room_token_${a.roomCode}=`));
  assert.match(b.header(), new RegExp(`room_token_${a.roomCode}=`));

  const aState = await readState(a.jar, a.roomCode, '?role=B');
  const bState = await readState(b, a.roomCode, '?role=A');
  assert.equal(aState.response.status, 200);
  assert.equal(bState.response.status, 200);
  assert.equal(aState.body.state.role, 'A');
  assert.equal(bState.body.state.role, 'B');
  assert.equal(aState.body.state.roomCode, a.roomCode);
  assert.equal(aState.body.state.occupancy.ready, true);

  const aRefresh = await a.jar.fetch(`${runningServer.baseUrl}/rooms/${a.roomCode}`);
  const bRefresh = await b.fetch(`${runningServer.baseUrl}/rooms/${a.roomCode}`);
  assert.equal(aRefresh.status, 200);
  assert.equal(bRefresh.status, 200);
  assert.match(await aRefresh.text(), /角色 A/);
  assert.match(await bRefresh.text(), /角色 B/);
});

test('filters safe state and ignores role spoofing in query and body', async () => {
  const a = await createRoom();
  const b = new CookieJar();
  await b.fetch(`${runningServer.baseUrl}/rooms/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ roomCode: a.roomCode, role: 'A' })
  });

  app.locals.roomStore.updateRoom(a.roomCode, room => {
    room.privateClues = {
      A: { clue: 'A 看得到', answer: 'A-secret' },
      B: { clue: 'B 看得到', answer: 'B-secret' }
    };
    room.sideEvidence = [
      { id: 'found', title: '已發現', summary: '公開摘要', discovered: true },
      { id: 'hidden', title: '未發現', summary: 'hidden-evidence', discovered: false }
    ];
    room.answers = { main: 'do-not-leak' };
    room.messages = [
      { id: 'public', audience: { kind: 'both' }, text: '公開' },
      { id: 'a', audience: 'A', text: 'A 私訊' },
      { id: 'b', audience: 'B', text: 'B 私訊' }
    ];
  });

  const aState = await readState(a.jar, a.roomCode, '?role=B');
  const bState = await readState(b, a.roomCode, '?role=A');
  assert.equal(aState.body.state.role, 'A');
  assert.equal(bState.body.state.role, 'B');
  assert.deepEqual(aState.body.state.clues, { clue: 'A 看得到' });
  assert.deepEqual(bState.body.state.clues, { clue: 'B 看得到' });
  const fixtureMessages = state => state.messages.filter(message => ['public', 'a', 'b'].includes(message.id)).map(message => message.id);
  assert.deepEqual(fixtureMessages(aState.body.state), ['public', 'a']);
  assert.deepEqual(fixtureMessages(bState.body.state), ['public', 'b']);

  const serialized = JSON.stringify(aState.body);
  assert.doesNotMatch(serialized, /A-secret|B-secret|do-not-leak|hidden-evidence|B 私訊/);
});

test('returns stable errors for missing cookies, invalid tokens, full rooms, and invalid codes', async () => {
  const a = await createRoom();
  const b = new CookieJar();
  await b.fetch(`${runningServer.baseUrl}/rooms/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ roomCode: a.roomCode })
  });

  const conflict = await a.jar.fetch(`${runningServer.baseUrl}/rooms/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ roomCode: a.roomCode })
  });
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), {
    success: false,
    code: 'TOKEN_CONFLICT',
    message: '這個瀏覽器已連線到此房間'
  });

  const full = await (new CookieJar()).fetch(`${runningServer.baseUrl}/rooms/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ roomCode: a.roomCode })
  });
  assert.equal(full.status, 409);
  assert.deepEqual(await full.json(), {
    success: false,
    code: 'ROOM_FULL',
    message: '這個房間已經額滿'
  });

  const missingCookie = await readState(new CookieJar(), a.roomCode);
  assert.equal(missingCookie.response.status, 409);
  assert.equal(missingCookie.body.code, 'INVALID_TOKEN');
  assert.equal(missingCookie.body.message, '無法驗證你的房間身分');

  const wrongCookie = new CookieJar().set(`room_token_${a.roomCode}`, 'wrong-token');
  const invalidToken = await readState(wrongCookie, a.roomCode);
  assert.equal(invalidToken.response.status, 409);
  assert.equal(invalidToken.body.code, 'INVALID_TOKEN');
  assert.equal(invalidToken.body.message, '無法驗證你的房間身分');

  const missing = await readState(new CookieJar(), '999999');
  assert.equal(missing.response.status, 404);
  assert.equal(missing.body.code, 'ROOM_NOT_FOUND');
  assert.equal(missing.body.message, '找不到這個房間');

  const invalidCode = await (new CookieJar()).fetch(`${runningServer.baseUrl}/rooms/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ roomCode: 'not-a-code' })
  });
  assert.equal(invalidCode.status, 400);
  assert.deepEqual(await invalidCode.json(), {
    success: false,
    code: 'INVALID_ROOM_CODE',
    message: '房號必須是六位數字'
  });
});

test('legacy room URLs redirect without allowing a URL-selected role', async () => {
  const a = await createRoom();
  for (const legacyPath of ['/createRoom', '/inputRoomNo', `/v2/${a.roomCode}`, `/v2/${a.roomCode}/A`, `/v2/${a.roomCode}/B`]) {
    const response = await fetch(`${runningServer.baseUrl}${legacyPath}`, { redirect: 'manual' });
    assert.equal(response.status, 303, legacyPath);
    assert.equal(response.headers.get('location'), legacyPath.startsWith('/v2/')
      ? `/rooms/${a.roomCode}`
      : '/');
  }

  const selectedB = await a.jar.fetch(`${runningServer.baseUrl}/v2/${a.roomCode}/B`);
  assert.equal(selectedB.status, 303);
  assert.equal(selectedB.headers.get('location'), `/rooms/${a.roomCode}`);
  const actualRole = await a.jar.fetch(`${runningServer.baseUrl}/rooms/${a.roomCode}`);
  assert.match(await actualRole.text(), /角色 A/);
});
