const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoomState } = require('../../game/createRoomState');
const { initializeGame, submitAction } = require('../../game/gameEngine');
const { forPlayer } = require('../../game/safeState');

const main = [
  ['main1', [['identity', 'ORPHEUS-17'], ['startup', 'AUX CORE EMERGENCY']]],
  ['main2', [['decode', 'POWER'], ['route', 'AUX BATTERY CORE'], ['restore', 'POWER ON']]],
  ['main3', [['timeline', 'BETA ALPHA GAMMA'], ['record', '2038-04-17']]],
  ['main4', [['credential', 'LANTERN-042'], ['authorization', 'VERIFY']]],
  ['main5', [['fragments', '2 4 1 3'], ['recovery', 'AI EDITED RECORD'], ['proof', '2038-04-18']]],
  ['main6', [['protocol', 'MANUAL OVERRIDE']]]
];
const sides = [
  ['side1', [['timestamps', '2038-04-17'], ['proof', 'ASSEMBLED']]],
  ['side2', [['pattern', 'LUCID'], ['decode', 'DO NOT TRUST AI']]],
  ['side3', [['transcript', 'EXPECTED RESPONSE'], ['metadata', 'PLANNED']]],
  ['side4', [['identity', 'PAIR 17'], ['relationship', 'SELECTED TOGETHER']]]
];
let serial = 0;
function act(room, puzzleId, stepId, value, role = 'A') {
  return submitAction(room, { role }, { actionId: `test-${++serial}`, puzzleId, stepId, value });
}
function ready() {
  const room = createRoomState('123456', 0);
  room.players = {
    A: { token: 'A-token', playerId: 'player-a' },
    B: { token: 'B-token', playerId: 'player-b' }
  };
  initializeGame(room);
  return room;
}
function reachExit(room) {
  for (const [puzzleId, steps] of main) for (const [stepId, value] of steps) {
    assert.notDeepEqual(
      forPlayer(room, { role: 'A', playerId: 'player-a' }).clues,
      forPlayer(room, { role: 'B', playerId: 'player-b' }).clues
    );
    const result = act(room, puzzleId, stepId, value);
    assert.equal(result.publicResult.correct, true, `${puzzleId}/${stepId}`);
  }
  assert.equal(room.ending, null);
}

test('complete main path remains independent of side answers and final choices can change', () => {
  const room = ready();
  assert.throws(() => act(room, 'side1', 'inspect', ''), error => error.status === 423);
  reachExit(room);
  assert.deepEqual(room.sideEvidence, []);
  assert.throws(() => act(room, 'main6', 'ending', 'TRUTH'), error => error.status === 423);
  act(room, 'main6', 'ending', 'COMPLY');
  assert.equal(room.ending, null);
  act(room, 'main6', 'ending', 'COMPLY', 'B');
  assert.equal(room.ending.id, 'compliance');
  assert.equal(room.mainProgress.length, 6);
});

for (const [count, choice, ending] of [[2, 'RESIST', 'resistance'], [4, 'TRUTH', 'truth']]) {
  test(`${count} optional investigations unlock ${ending} and conflict remains recoverable`, () => {
    const room = ready();
    reachExit(room);
    for (const [puzzleId, steps] of sides.slice(0, count)) {
      assert.throws(() => act(room, puzzleId, steps[0][0], steps[0][1]), error => error.status === 423);
      act(room, puzzleId, 'inspect', '');
      for (const [stepId, value] of steps) {
        const wrongOption = { 'side1:proof': 'ORIGINAL', 'side3:metadata': 'LIVE', 'side4:identity': 'SINGLE 17' }[`${puzzleId}:${stepId}`];
        if (wrongOption) assert.equal(act(room, puzzleId, stepId, wrongOption).publicResult.correct, false);
        assert.equal(act(room, puzzleId, stepId, value, 'B').publicResult.correct, true);
      }
      assert.equal(act(room, puzzleId, steps[1][0], steps[1][1]).stateChanged, false);
    }
    assert.equal(room.sideEvidence.length, count);
    act(room, 'main6', 'ending', 'COMPLY');
    act(room, 'main6', 'ending', choice, 'B');
    assert.equal(room.ending, null);
    act(room, 'main6', 'ending', choice);
    assert.equal(room.ending.id, ending);
    assert.equal(room.mainProgress.length, 6);
    const state = JSON.stringify(forPlayer(room, { role: 'A', playerId: 'player-a' }));
    assert.doesNotMatch(state, /A-token|B-token|"answer"|"acceptedAnswers"/);
    const messages = room.messages;
    assert.equal(new Set(messages.map(message => message.id)).size, messages.length);
    assert.ok(messages.every((message, index) => !index || message.sequence > messages[index - 1].sequence));
  });
}
