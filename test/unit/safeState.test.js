const test = require('node:test');
const assert = require('node:assert/strict');

const { forPlayer } = require('../../game/safeState');

function fixtureRoom() {
  return {
    roomCode: '123456',
    createdAt: 1000,
    players: {
      A: { token: 'token-a', privateClues: { identity: 'A-only' } },
      B: { token: 'token-b', privateClues: { identity: 'B-only' }
      }
    },
    chapter: 2,
    mainProgress: ['facility-init'],
    sideEvidence: [
      { id: 'timestamp', title: '監控時間戳', summary: '兩段記錄不在同一天', discovered: true },
      { id: 'hidden', title: '未公開證據', summary: 'do-not-leak', discovered: false }
    ],
    privateClues: {
      A: { identity: 'A-only', answer: 'secret-a' },
      B: { identity: 'B-only', answer: 'secret-b' }
    },
    answers: { facilityInit: 'never-send-this' },
    messages: [
      { id: 'public', text: '公開訊息' },
      { id: 'a-only', audience: 'A', text: 'A 的訊息' },
      { id: 'b-only', audience: 'B', text: 'B 的訊息' }
    ],
    countdownStatus: 'running',
    countdownRemainingMs: 1234,
    ending: null,
    revision: 7
  };
}

test('forPlayer returns only the current role safe state', () => {
  const state = forPlayer(fixtureRoom(), { role: 'A' });

  assert.deepEqual(state.roomCode, '123456');
  assert.equal(state.role, 'A');
  assert.deepEqual(state.occupancy, {
    A: true,
    B: true,
    count: 2,
    capacity: 2,
    ready: true
  });
  assert.deepEqual(state.publicProgress, {
    chapter: 2,
    mainProgress: ['facility-init']
  });
  assert.deepEqual(state.messages.map(message => message.id), ['public', 'a-only']);
  assert.deepEqual(state.discoveredEvidence, [
    { id: 'timestamp', title: '監控時間戳', summary: '兩段記錄不在同一天' }
  ]);
  assert.deepEqual(state.countdown, { status: 'running', remainingMs: 1234 });
  assert.deepEqual(state.clues, { identity: 'A-only' });
  assert.equal(state.revision, 7);
  assert.equal(state.ending, null);

  const serialized = JSON.stringify(state);
  assert.doesNotMatch(serialized, /token-a|token-b|never-send-this|secret-a|secret-b|do-not-leak|B-only/);
});

test('forPlayer changes visible clues and audience messages by token-resolved role', () => {
  const state = forPlayer(fixtureRoom(), { role: 'B' });

  assert.equal(state.role, 'B');
  assert.deepEqual(state.clues, { identity: 'B-only' });
  assert.deepEqual(state.messages.map(message => message.id), ['public', 'b-only']);
  assert.doesNotMatch(JSON.stringify(state), /A-only|secret-a/);
});
