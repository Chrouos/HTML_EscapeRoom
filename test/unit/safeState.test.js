const test = require('node:test');
const assert = require('node:assert/strict');

const { projectForPlayer, stateResponse, forPlayer } = require('../../game/safeState');

function fixtureRoom() {
  return {
    roomCode: '123456',
    players: {
      A: { token: 'token-a', playerId: 'player-a' },
      B: { token: 'token-b', playerId: 'player-b' }
    },
    streams: {
      A: { cursor: 4, acknowledgedCursor: 3, events: [{ cursor: 4 }] },
      B: { cursor: 7, acknowledgedCursor: 6, events: [{ cursor: 7 }] }
    },
    publicProgress: { chapter: 2, mainProgress: ['facility-init'] },
    messages: [
      { id: 'public', sequence: 10, audience: { kind: 'both' }, text: 'Public message' },
      { id: 'a-only', sequence: 11, audience: { kind: 'player', playerId: 'player-a' }, text: 'A message' },
      { id: 'b-only', sequence: 12, audience: { kind: 'role', role: 'guest' }, text: 'B message' }
    ],
    workstation: {
      A: { unlockedEntryIds: ['shared', 'a-record'], roleFacts: ['A discovered fact'] },
      B: { unlockedEntryIds: ['shared', 'b-record'], roleFacts: ['B discovered fact'] }
    },
    privateMissions: {
      A: [{ id: 'mission-a', state: 'offered', audience: { kind: 'player', playerId: 'player-a' } }],
      B: [{ id: 'mission-b', state: 'locked', audience: { kind: 'player', playerId: 'player-b' } }]
    },
    sideEvidence: [
      { id: 'timestamp', title: 'Timestamp mismatch', summary: 'Two dates', discovered: true },
      { id: 'hidden', title: 'Hidden evidence', summary: 'do-not-leak', discovered: false }
    ],
    ending: null,
    debrief: null,
    countdownStatus: 'running',
    countdownRemainingMs: 1234,
    revision: 99
  };
}

test('projectForPlayer returns the exact canonical actor projection without transport or delivery metadata', () => {
  const state = projectForPlayer(fixtureRoom(), { role: 'A', playerId: 'player-a' });

  assert.deepEqual(Object.keys(state), [
    'roomCode',
    'role',
    'occupancy',
    'publicProgress',
    'intercom',
    'workstation',
    'privateMissions',
    'discoveredEvidence',
    'ending',
    'debrief'
  ]);
  assert.deepEqual(state.intercom, [
    { id: 'public', text: 'Public message' },
    { id: 'a-only', text: 'A message' }
  ]);
  assert.deepEqual(state.workstation, {
    unlockedEntryIds: ['shared', 'a-record'],
    roleFacts: ['A discovered fact']
  });
  assert.deepEqual(state.privateMissions, [{ id: 'mission-a', state: 'offered' }]);
  assert.deepEqual(state.discoveredEvidence, [
    { id: 'timestamp', title: 'Timestamp mismatch', summary: 'Two dates' }
  ]);

  const serialized = JSON.stringify(state);
  assert.doesNotMatch(serialized, /token|playerId|streams|audience|revision|sequence|cursor|do-not-leak|B discovered fact|mission-b/);
});

test('a hidden-only mutation leaves the non-recipient state response byte-identical except countdown', () => {
  const room = fixtureRoom();
  const playerB = { role: 'B', playerId: 'player-b' };
  const { countdown: beforeCountdown, ...before } = stateResponse(room, playerB, 6);

  room.workstation.A.roleFacts.push('A hidden mutation');
  room.privateMissions.A[0].state = 'completed';
  room.messages.push({
    id: 'a-hidden',
    sequence: 13,
    audience: { kind: 'player', playerId: 'player-a' },
    text: 'Only A receives this'
  });
  room.streams.A.cursor += 1;
  room.streams.A.events.push({ cursor: 5, audience: { kind: 'player', playerId: 'player-a' } });
  room.revision += 1;
  room.countdownRemainingMs = 987;

  const { countdown: afterCountdown, ...after } = stateResponse(room, playerB, 6);
  assert.equal(JSON.stringify(after), JSON.stringify(before));
  assert.equal(after.cursor, 7);
  assert.deepEqual(beforeCountdown, { status: 'running', remainingMs: 1234 });
  assert.deepEqual(afterCountdown, { status: 'running', remainingMs: 987 });
});

test('a shared authoritative intercom array requires explicit audiences and selects only the actor', () => {
  const room = fixtureRoom();
  room.intercom = [
    { id: 'both', audience: { kind: 'both' }, text: 'For both' },
    { id: 'a', audience: { kind: 'role', role: 'host' }, text: 'For A' },
    { id: 'b', audience: { kind: 'player', playerId: 'player-b' }, text: 'For B' }
  ];

  assert.deepEqual(
    projectForPlayer(room, { role: 'A', playerId: 'player-a' }).intercom,
    [
      { id: 'both', text: 'For both' },
      { id: 'a', text: 'For A' }
    ]
  );
});

test('projectForPlayer rejects a role or playerId that does not match an occupied room identity', () => {
  const room = fixtureRoom();

  assert.throws(
    () => projectForPlayer(room, { role: 'A', playerId: 'unknown' }),
    { name: 'TypeError', message: 'Player identity does not match room' }
  );
  assert.throws(
    () => projectForPlayer(room, { role: 'host', playerId: 'player-a' }),
    { name: 'TypeError', message: 'Player identity does not match room' }
  );
});

test('the transitional forPlayer adapter rejects role-only identity input', () => {
  assert.throws(
    () => forPlayer(fixtureRoom(), 'A'),
    { name: 'TypeError', message: 'Player identity does not match room' }
  );
});

test('missing or malformed message audiences fail closed', () => {
  const room = fixtureRoom();
  room.messages.push({ id: 'implicit-public', text: 'Must not become public' });

  assert.throws(
    () => projectForPlayer(room, { role: 'A', playerId: 'player-a' }),
    error => error instanceof TypeError && /Audience/.test(error.message)
  );
});

test('stateResponse keeps cursor outside canonical state and recalculates countdown when unchanged', () => {
  const room = fixtureRoom();
  const playerA = { role: 'A', playerId: 'player-a' };

  assert.deepEqual(stateResponse(room, playerA, 3), {
    success: true,
    unchanged: false,
    cursor: 4,
    state: projectForPlayer(room, playerA),
    countdown: { status: 'running', remainingMs: 1234 }
  });

  room.countdownRemainingMs = 987;
  assert.deepEqual(stateResponse(room, playerA, 4), {
    success: true,
    unchanged: true,
    cursor: 4,
    countdown: { status: 'running', remainingMs: 987 }
  });
});
