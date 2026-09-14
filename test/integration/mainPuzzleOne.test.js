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
  const response = await a.fetch(`${server.baseUrl}/rooms`, { method: 'POST' });
  const code = response.headers.get('location').split('/').pop();
  const b = new CookieJar();
  await b.fetch(`${server.baseUrl}/rooms/join`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomCode: code })
  });
  return { a, b, code };
}

async function action(jar, code, body) {
  const response = await jar.fetch(`${server.baseUrl}/api/rooms/${code}/actions`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

test('action API rejects missing identity and malformed actions without mutation', async () => {
  const { a, code } = await roomPair();
  const before = app.locals.roomStore.getRoom(code);
  const anonymous = await action(new CookieJar(), code, {});
  assert.equal(anonymous.status, 409);
  assert.equal(anonymous.body.code, 'INVALID_TOKEN');
  for (const body of [null, [], {}, { actionId: {}, puzzleId: 'main1', stepId: 'identity', value: 'x' }]) {
    const invalid = await action(a, code, body);
    assert.equal(invalid.status, 400);
  }
  assert.deepEqual(app.locals.roomStore.getRoom(code).attempts, before.attempts);
  assert.equal(app.locals.roomStore.getRoom(code).revision, before.revision);
});

test('operation actions are accepted through the production route with semantic IDs', async () => {
  const { a, code } = await roomPair();
  const result = await action(a, code, {
    actionId: 'operation-action-1', operationId: 'open_aux', value: 'OPEN AUX'
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.publicResult.operationId, 'open_aux');
  assert.equal(result.body.publicResult.duplicate, undefined);
  const duplicate = await action(a, code, {
    actionId: 'operation-action-1', operationId: 'open_aux', value: 'OPEN AUX'
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.publicResult.duplicate, true);
});

test('locked chapter does not consume action ID or change room progress', async () => {
  const { a, code } = await roomPair();
  const before = app.locals.roomStore.getRoom(code);
  const result = await action(a, code, {
    actionId: 'future', puzzleId: 'main2', stepId: 'decode', value: 'x'
  });
  assert.equal(result.status, 423);
  assert.equal(app.locals.roomStore.hasProcessedAction(code, 'future'), false);
  assert.equal(app.locals.roomStore.getRoom(code).revision, before.revision);
});

test('another room token cannot submit, and reading clues does not advance its cursor', async () => {
  const one = await roomPair();
  const two = await roomPair();
  const foreign = new CookieJar().set(`room_token_${one.code}`,
    two.a.cookies.get(`room_token_${two.code}`));
  const denied = await action(foreign, one.code, {
    actionId: 'foreign', puzzleId: 'main1', stepId: 'identity', value: 'x'
  });
  assert.equal(denied.status, 409);
  const before = await (await one.a.fetch(`${server.baseUrl}/api/rooms/${one.code}/state`)).json();
  const a = await (await one.a.fetch(`${server.baseUrl}/api/rooms/${one.code}/state`)).json();
  const b = await (await one.b.fetch(`${server.baseUrl}/api/rooms/${one.code}/state?role=A`)).json();
  assert.equal(a.state.role, 'A');
  assert.equal(b.state.role, 'B');
  assert.notDeepEqual(a.state.workstation, b.state.workstation);
  const after = await (await one.a.fetch(`${server.baseUrl}/api/rooms/${one.code}/state?sinceCursor=${before.cursor}`)).json();
  assert.equal(after.unchanged, true);
  assert.doesNotMatch(JSON.stringify(a.state), /"token"|"answers?"|"privateClues"/);
});

test('two roles solve Main 1; retries and completed steps cannot advance twice', async () => {
  const { a, b, code } = await roomPair();
  const request = { actionId: 'identity-1', puzzleId: 'main1', stepId: 'identity', value: ' orpheus-17 ' };
  const first = await action(a, code, { ...request, role: 'B' });
  assert.equal(first.status, 200);
  assert.equal(first.body.state.role, 'A');
  assert.equal(first.body.state.publicProgress.stepId, 'startup');
  const retry = await action(a, code, request);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.stateChanged, false);
  assert.equal(retry.body.cursor, first.body.cursor);
  assert.deepEqual(retry.body.state.intercom, first.body.state.intercom);
  const done = await action(b, code, {
    actionId: 'startup-1', puzzleId: 'main1', stepId: 'startup', value: ' aux   core emergency '
  });
  assert.equal(done.status, 200);
  assert.equal(done.body.state.publicProgress.chapter, 2);
  assert.deepEqual(done.body.state.publicProgress.mainProgress, ['main1']);
  const again = await action(b, code, {
    actionId: 'startup-2', puzzleId: 'main1', stepId: 'startup', value: 'AUX CORE EMERGENCY'
  });
  assert.equal(again.status, 200);
  assert.equal(again.body.stateChanged, false);
  assert.equal(again.body.cursor, done.body.cursor);
  assert.deepEqual(again.body.state.intercom, done.body.state.intercom);
});

test('a public action advances both actor cursors and returns no audience metadata', async () => {
  const { a, b, code } = await roomPair();
  const endpoint = `${server.baseUrl}/api/rooms/${code}/state`;
  const aBefore = await (await a.fetch(endpoint)).json();
  const bBefore = await (await b.fetch(endpoint)).json();
  const solved = await action(a, code, {
    actionId: 'shared-result', puzzleId: 'main1', stepId: 'identity', value: 'ORPHEUS-17'
  });
  assert.equal(solved.body.cursor, aBefore.cursor + 1);
  assert.doesNotMatch(JSON.stringify(solved.body), /audience|revision/);
  const bAfter = await (await b.fetch(`${endpoint}?sinceCursor=${bBefore.cursor}`)).json();
  assert.equal(bAfter.cursor, bBefore.cursor + 1);
  assert.equal(bAfter.unchanged, false);
});

test('a completed-step no-op does not consume its action ID before a later valid action', async () => {
  const { a, code } = await roomPair();
  await action(a, code, {
    actionId: 'finish-identity', puzzleId: 'main1', stepId: 'identity', value: 'ORPHEUS-17'
  });

  const noOp = await action(a, code, {
    actionId: 'reusable-action', puzzleId: 'main1', stepId: 'identity', value: 'ORPHEUS-17'
  });
  assert.equal(noOp.body.stateChanged, false);
  assert.equal(app.locals.roomStore.hasProcessedAction(code, 'reusable-action'), false);

  const valid = await action(a, code, {
    actionId: 'reusable-action', puzzleId: 'main1', stepId: 'startup', value: 'AUX CORE EMERGENCY'
  });
  assert.equal(valid.body.stateChanged, true);
  assert.equal(valid.body.state.publicProgress.chapter, 2);
  assert.equal(app.locals.roomStore.hasProcessedAction(code, 'reusable-action'), true);
});
