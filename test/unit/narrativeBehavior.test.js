const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomState } = require('../../game/createRoomState');
const { content, evaluatePredicate } = require('../../game/content/contentSchema');
const { validateContent } = require('../../game/content/validateContent');
const { projectForPlayer } = require('../../game/safeState');
const { ensureNarrativeBehavior } = require('../../game/privateEventEngine');

function cloneContent(overrides = {}) {
  return { ...structuredClone(content), ...overrides };
}

function behaviorDialogue(unlockWhen) {
  const source = content.dialogue.find(item => item.id === 'orpheus.observation.a');
  return {
    ...structuredClone(source),
    id: 'echo.behavior.contract',
    sourceEntryId: source.id,
    verificationEntries: [],
    unlockWhen
  };
}

test('room state owns actor-local narrative behavior without exposing it to clients', () => {
  const room = createRoomState('123456', 10_000);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  assert.deepEqual(room.narrativeBehavior, {
    entryOpenCount: { A: {}, B: {} },
    lastMeaningfulActionAt: { A: 10_000, B: 10_000 },
    pendingObservation: { A: null, B: null },
    sharedEvidenceIds: { A: [], B: [] },
    ignoredPromptIds: { A: [], B: [] },
    reactionFactIds: { A: [], B: [] },
    lastReactionAt: { A: {}, B: {} }
  });

  const projected = projectForPlayer(room, { role: 'A', playerId: 'player-a' });
  assert.doesNotMatch(JSON.stringify(projected), /narrativeBehavior|entryOpenCount|lastMeaningfulActionAt|reactionFactIds|lastReactionAt/);
});

test('legacy snapshots backfill narrative behavior deterministically and sanitize malformed fields', () => {
  const room = { createdAt: 5_000, narrativeBehavior: {
    entryOpenCount: { A: { 'files.mainline': 2 }, B: 'bad' },
    lastMeaningfulActionAt: { A: 6_000, B: -1 },
    reactionFactIds: { A: ['echo.one', 'echo.one', 7], B: null },
    lastReactionAt: { A: { idle: 9_000 }, B: [] }
  } };
  const behavior = ensureNarrativeBehavior(room, 20_000);
  assert.deepEqual(behavior.entryOpenCount.A, { 'files.mainline': 2 });
  assert.deepEqual(behavior.entryOpenCount.B, {});
  assert.equal(behavior.lastMeaningfulActionAt.A, 6_000);
  assert.equal(behavior.lastMeaningfulActionAt.B, 5_000);
  assert.deepEqual(behavior.reactionFactIds.A, ['echo.one']);
  assert.deepEqual(behavior.reactionFactIds.B, []);
  assert.deepEqual(behavior.lastReactionAt.A, { idle: 9_000 });
  assert.deepEqual(behavior.lastReactionAt.B, {});
});

test('behavior predicates evaluate against actor-local observation state', () => {
  assert.equal(evaluatePredicate(
    { entryOpenedTimes: { entryId: 'archive.protocol_versions', atLeast: 3 } },
    { entryOpenCount: { 'archive.protocol_versions': 3 } }
  ), true);
  assert.equal(evaluatePredicate(
    { entryOpenedTimes: { entryId: 'archive.protocol_versions', atLeast: 4 } },
    { entryOpenCount: { 'archive.protocol_versions': 3 } }
  ), false);
  assert.equal(evaluatePredicate(
    { elapsedSinceMeaningfulAction: 60_000 },
    { now: 70_000, lastMeaningfulActionAt: 10_000 }
  ), true);
  assert.equal(evaluatePredicate(
    { reactionFactMissing: 'echo.behavior.recheck' },
    { reactionFactIds: [] }
  ), true);
  assert.equal(evaluatePredicate(
    { reactionFactMissing: 'echo.behavior.recheck' },
    { reactionFactIds: ['echo.behavior.recheck'] }
  ), false);
});

test('content validation accepts well-formed behavior dialogue predicates and rejects malformed shapes', () => {
  const validDialogue = [...content.dialogue, behaviorDialogue({ all: [
    { publicFact: 'main1Completed' },
    { entryOpenedTimes: { entryId: 'archive.protocol_versions', atLeast: 3 } },
    { reactionFactMissing: 'echo.behavior.recheck' }
  ] })];
  assert.deepEqual(validateContent(cloneContent({ dialogue: validDialogue })), []);

  const malformed = [...content.dialogue, behaviorDialogue({ entryOpenedTimes: {
    entryId: '', atLeast: 0
  } })];
  assert.match(validateContent(cloneContent({ dialogue: malformed })).join('\n'), /entryOpenedTimes.*(entryId|atLeast|invalid)/i);
});

test('mainline operations cannot depend on behavior-only predicates', () => {
  const operations = structuredClone(content.operations);
  const operation = operations.find(item => item.operationId === 'continue_file_index');
  operation.unlockWhen = { elapsedSinceMeaningfulAction: 60_000 };
  assert.match(validateContent(cloneContent({ operations })).join('\n'), /mainline.*behavior/i);
});
