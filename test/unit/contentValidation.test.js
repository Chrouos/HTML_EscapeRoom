const test = require('node:test');
const assert = require('node:assert/strict');

const { validateContent, assertValidContent } = require('../../game/content/validateContent');
const { content } = require('../../game/content/contentSchema');

function cloneBundle(overrides = {}) {
  return {
    ...structuredClone(content),
    ...overrides
  };
}

function errorsFor(overrides) {
  return validateContent(cloneBundle(overrides));
}

test('default narrative manifests satisfy the content contract', () => {
  assert.deepEqual(validateContent(content), []);
});

test('rejects duplicate content IDs', () => {
  const terminalEntries = [...content.terminalEntries, { ...content.terminalEntries[0] }];
  assert.match(errorsFor({ terminalEntries }).join('\n'), /duplicate.*id/i);
});

test('rejects invalid channel, intent, and audience combinations', () => {
  const dialogue = content.dialogue.map(item => ({ ...item }));
  dialogue[0] = { ...dialogue[0], channel: 'direct', intent: 'system', audience: { kind: 'both' } };
  assert.match(errorsFor({ dialogue }).join('\n'), /channel|audience|intent/i);
});

test('rejects deception without an independently sourced reachable verification entry', () => {
  const terminalEntries = content.terminalEntries.map(item => ({ ...item }));
  terminalEntries.find(item => item.id === 'doc.a_incident_report').verificationEntries = [];
  assert.match(errorsFor({ terminalEntries }).join('\n'), /verification/i);

  const sameSource = content.terminalEntries.map(item => ({ ...item }));
  sameSource.find(item => item.id === 'doc.a_incident_report').verificationEntries = [
    { entryId: 'doc.b_incident_report', sourceGroup: 'edited_reports' }
  ];
  assert.match(errorsFor({ terminalEntries: sameSource }).join('\n'), /sourceGroup|different|independent/i);
});

test('rejects private facts used to unlock mainline operations', () => {
  const operations = content.operations.map(item => ({ ...item, unlockWhen: structuredClone(item.unlockWhen) }));
  const mainline = operations.find(item => item.operationId === 'continue_file_index');
  mainline.unlockWhen = { roleFact: 'aArchivedIndex' };
  assert.match(errorsFor({ operations }).join('\n'), /private.*fact|mainline/i);
});

test('rejects unreachable private mission fallbacks', () => {
  const operations = content.operations.filter(item => item.operationId !== 'continue_file_index');
  assert.match(errorsFor({ operations }).join('\n'), /fallback|reachable/i);
});

test('rejects missing debrief outcome facts', () => {
  const debrief = content.debrief.filter(item => item.factId !== 'a1Skipped');
  const privateMissions = content.privateMissions.map(item => ({ ...item, debriefFactIds: [...item.debriefFactIds] }));
  privateMissions.find(item => item.id === 'mission.a1.index_repair').debriefFactIds.push('a1Skipped');
  assert.match(errorsFor({ debrief, privateMissions }).join('\n'), /debrief|fact/i);
});

test('rejects visible copy containing delivery labels', () => {
  const dialogue = content.dialogue.map(item => ({ ...item, variants: [...item.variants] }));
  dialogue[0].variants[0] = `${dialogue[0].variants[0]} AI_DIRECT`;
  assert.match(errorsFor({ dialogue }).join('\n'), /visible|delivery|AI_DIRECT/i);
});

test('exports a throwing assertion for CI and authoring scripts', () => {
  assert.doesNotThrow(() => assertValidContent(content));
  assert.throws(() => assertValidContent({ ...content, operations: [] }), /content/i);
});
