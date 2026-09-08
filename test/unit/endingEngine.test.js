const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, evidenceIds } = require('../../game/endingEngine');

function room(count, a, b = a) {
  return { mainProgress: ['main1', 'main2', 'main3', 'main4', 'main5'],
    completedSteps: { main6: ['shared'] },
    sideEvidence: Array.from({ length: count }, (_, index) => ({ id: `e${index}` })),
    pendingChoices: { A: a, B: b } };
}

test('legacy string evidence and object evidence share the same unique IDs', () => {
  const state = room(0, 'RESIST');
  state.sideEvidence = ['e0', { id: 'e0' }, 'e1'];
  assert.equal(evidenceIds(state).size, 2);
  assert.equal(evaluate(state), 'resistance');
});

test('ending requires both matching choices and evidence thresholds', () => {
  for (const count of [0, 1, 2, 3, 4]) {
    assert.equal(evaluate(room(count, 'COMPLY')), 'compliance');
    assert.equal(evaluate(room(count, 'RESIST')), count >= 2 ? 'resistance' : null);
    assert.equal(evaluate(room(count, 'TRUTH')), count === 4 ? 'truth' : null);
  }
  assert.equal(evaluate(room(4, 'COMPLY', 'TRUTH')), null);
  assert.equal(evaluate(room(4, 'TRUTH', null)), null);
  const duplicate = room(1, 'RESIST');
  duplicate.sideEvidence.push({ id: 'e0' });
  assert.equal(evaluate(duplicate), null);
});
