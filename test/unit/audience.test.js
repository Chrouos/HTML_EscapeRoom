const test = require('node:test');
const assert = require('node:assert/strict');

const { validateAudience, resolveRecipients } = require('../../game/audience');

function createRoom() {
  return {
    players: {
      A: { token: 'host-token', playerId: 'server-player-a' },
      B: { token: 'guest-token', playerId: 'server-player-b' }
    }
  };
}

test('accepts only the exact supported audience schemas', () => {
  const validAudiences = [
    { kind: 'both' },
    { kind: 'role', role: 'host' },
    { kind: 'role', role: 'guest' },
    { kind: 'player', playerId: 'server-player-a' }
  ];

  for (const audience of validAudiences) {
    assert.doesNotThrow(() => validateAudience(audience));
  }
});

test('rejects missing fields, extra fields, unknown values, and legacy strings', () => {
  const invalidAudiences = [
    undefined,
    null,
    'public',
    'A',
    {},
    { role: 'host' },
    { kind: 'both', role: 'host' },
    { kind: 'role' },
    { kind: 'role', role: 'admin' },
    { kind: 'role', role: 'host', playerId: 'server-player-a' },
    { kind: 'player' },
    { kind: 'player', playerId: 'server-player-a', role: 'host' },
    { kind: 'unknown' }
  ];

  for (const audience of invalidAudiences) {
    assert.throws(() => validateAudience(audience), TypeError);
  }
});

test('rejects empty or non-string player IDs', () => {
  for (const playerId of ['', '   ', null, undefined, 7]) {
    assert.throws(
      () => validateAudience({ kind: 'player', playerId }),
      TypeError
    );
  }
});

test('resolves both and role audiences to occupied room slots', () => {
  const room = createRoom();

  assert.deepEqual(resolveRecipients(room, { kind: 'both' }), ['A', 'B']);
  assert.deepEqual(resolveRecipients(room, { kind: 'role', role: 'host' }), ['A']);
  assert.deepEqual(resolveRecipients(room, { kind: 'role', role: 'guest' }), ['B']);

  room.players.B = null;
  assert.deepEqual(resolveRecipients(room, { kind: 'both' }), ['A']);
  assert.deepEqual(resolveRecipients(room, { kind: 'role', role: 'guest' }), []);
});

test('resolves a player audience only through server-owned room player IDs', () => {
  const room = createRoom();

  assert.deepEqual(
    resolveRecipients(room, { kind: 'player', playerId: 'server-player-a' }),
    ['A']
  );
  assert.deepEqual(
    resolveRecipients(room, { kind: 'player', playerId: 'server-player-b' }),
    ['B']
  );
  assert.deepEqual(
    resolveRecipients(room, { kind: 'player', playerId: 'host-token' }),
    []
  );
  assert.deepEqual(
    resolveRecipients(room, { kind: 'player', playerId: 'A' }),
    []
  );
  assert.deepEqual(
    resolveRecipients(room, { kind: 'player', playerId: 'unknown-player' }),
    []
  );
});

test('invalid audiences fail closed without mutating the room', () => {
  const room = createRoom();
  const before = structuredClone(room);

  assert.throws(() => resolveRecipients(room), TypeError);
  assert.throws(() => resolveRecipients(room, 'public'), TypeError);
  assert.throws(() => resolveRecipients(room, { kind: 'unknown' }), TypeError);
  assert.throws(
    () => resolveRecipients(room, { kind: 'player', playerId: '' }),
    TypeError
  );
  assert.deepEqual(room, before);
});
