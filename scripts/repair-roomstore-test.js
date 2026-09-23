const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const path = 'test/unit/roomStore.test.js';
let source = execFileSync('git', ['show', `origin/new_open:${path}`], { encoding: 'utf8' });

source = source.replace(
  "    'pendingChoices',\n    'countdownStartedAt',",
  "    'pendingChoices',\n    'narrativeBehavior',\n    'countdownStartedAt',"
);
source = source.replace(
  "  assert.deepEqual(state.pendingChoices, {});\n  assert.equal(state.countdownStartedAt, null);",
  `  assert.deepEqual(state.pendingChoices, {});\n  assert.deepEqual(state.narrativeBehavior, {\n    entryOpenCount: { A: {}, B: {} },\n    lastMeaningfulActionAt: { A: 1000, B: 1000 },\n    pendingObservation: { A: null, B: null },\n    sharedEvidenceIds: { A: [], B: [] },\n    ignoredPromptIds: { A: [], B: [] },\n    reactionFactIds: { A: [], B: [] },\n    lastReactionAt: { A: {}, B: {} }\n  });\n  assert.equal(state.countdownStartedAt, null);`
);

if (!source.includes("'narrativeBehavior'")) throw new Error('Room schema patch did not apply');
fs.writeFileSync(path, source);
fs.unlinkSync(__filename);
