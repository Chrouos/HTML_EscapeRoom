const test = require('node:test');
const assert = require('node:assert/strict');

const { validateContent, assertValidContent } = require('../../game/content/validateContent');
const { content, evaluatePredicate } = require('../../game/content/contentSchema');

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

  const bogusGroup = content.terminalEntries.map(item => ({ ...item }));
  bogusGroup.find(item => item.id === 'doc.a_incident_report').verificationEntries = [
    { entryId: 'audio.original_incident_timestamp', sourceGroup: 'not_the_real_group' }
  ];
  assert.match(errorsFor({ terminalEntries: bogusGroup }).join('\n'), /sourceGroup|declared|actual/i);

  const unreachable = content.terminalEntries.map(item => ({ ...item }));
  unreachable.find(item => item.id === 'doc.a_incident_report').verificationEntries = [
    { entryId: 'files.experiment_roster', sourceGroup: 'experiment_roster' }
  ];
  unreachable.find(item => item.id === 'files.experiment_roster').unlockWhen = { publicFact: 'never_recorded' };
  assert.match(errorsFor({ terminalEntries: unreachable }).join('\n'), /reachable|verification/i);
});

test('rejects private facts used to unlock mainline operations', () => {
  const operations = content.operations.map(item => ({ ...item, unlockWhen: structuredClone(item.unlockWhen) }));
  const mainline = operations.find(item => item.operationId === 'continue_file_index');
  mainline.unlockWhen = { roleFact: 'aArchivedIndex' };
  assert.match(errorsFor({ operations }).join('\n'), /private.*fact|mainline/i);

  const viaEntry = content.operations.map(item => ({ ...item, unlockWhen: structuredClone(item.unlockWhen) }));
  viaEntry.find(item => item.operationId === 'continue_file_index').unlockWhen = { entryOpened: 'private-only' };
  const terminalEntries = content.terminalEntries.map(item => ({ ...item }));
  terminalEntries.push({ ...terminalEntries[0], id: 'private-only', requiresPrivateFacts: ['secretFact'] });
  assert.match(errorsFor({ operations: viaEntry, terminalEntries }).join('\n'), /private|mainline/i);
});

test('rejects unreachable private mission fallbacks', () => {
  const operations = content.operations.filter(item => item.operationId !== 'continue_file_index');
  assert.match(errorsFor({ operations }).join('\n'), /fallback|reachable/i);

  const privateFallback = content.operations.map(item => ({ ...item, effects: structuredClone(item.effects) }));
  privateFallback.find(item => item.operationId === 'continue_file_index').kind = 'private';
  assert.match(errorsFor({ operations: privateFallback }).join('\n'), /fallback|mainline|kind/i);

  const badReference = content.operations.map(item => ({ ...item, effects: structuredClone(item.effects) }));
  badReference.find(item => item.operationId === 'complete_main1').effects.unlockEntryIds.push('missing.entry');
  assert.match(errorsFor({ operations: badReference }).join('\n'), /reference|missing|entry/i);

  const badNode = content.operations.map(item => ({ ...item, effects: structuredClone(item.effects) }));
  badNode.find(item => item.operationId === 'complete_main1').effects.completeNodeIds.push('missing.node');
  assert.match(errorsFor({ operations: badNode }).join('\n'), /reference|missing|node/i);
  const badMissionNode = content.operations.map(item => ({ ...item, effects: structuredClone(item.effects) }));
  badMissionNode.find(item => item.operationId === 'archive_index').effects.completeNodeIds.push('mission.a1.not_real');
  assert.match(errorsFor({ operations: badMissionNode }).join('\n'), /reference|missing|node/i);
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

  const debrief = content.debrief.map(item => ({ ...item }));
  debrief[0].surfaceClaim = 'broadcast instruction';
  assert.match(errorsFor({ debrief }).join('\n'), /visible|delivery|broadcast/i);
});

test('rejects malformed empty or mixed predicates and requires all deception groups', () => {
  const operations = content.operations.map(item => ({ ...item, unlockWhen: structuredClone(item.unlockWhen) }));
  operations[0].unlockWhen = {};
  assert.match(errorsFor({ operations }).join('\n'), /predicate|empty/i);
  operations[0].unlockWhen = { all: [], publicFact: 'roomCreated' };
  assert.match(errorsFor({ operations }).join('\n'), /predicate|combination|mixed/i);
  operations[0].unlockWhen = { all: [], any: [] };
  assert.match(errorsFor({ operations }).join('\n'), /predicate|combination/i);

  const terminalEntries = content.terminalEntries.filter(item => item.id !== 'ai.a1.index_request');
  assert.match(errorsFor({ terminalEntries }).join('\n'), /deception|A-1|group/i);
});

test('applies the same independent source and reachability checks to dialogue verification', () => {
  const dialogue = content.dialogue.map(item => ({ ...item, verificationEntries: [...(item.verificationEntries || [])] }));
  const observation = dialogue.find(item => item.id === 'orpheus.observation.a');
  observation.verificationEntries = [{ entryId: 'audio.original_incident_timestamp', sourceGroup: 'wrong_group' }];
  assert.match(errorsFor({ dialogue }).join('\n'), /sourceGroup|verification/i);

  const terminalEntries = content.terminalEntries.map(item => ({ ...item }));
  terminalEntries.find(item => item.id === 'audio.original_incident_timestamp').sourceGroup = 'tampered_group';
  assert.match(errorsFor({ dialogue, terminalEntries }).join('\n'), /sourceGroup|target/i);

  const sameSourceDialogue = content.dialogue.map(item => ({ ...item, verificationEntries: [...(item.verificationEntries || [])] }));
  const sameSourceObservation = sameSourceDialogue.find(item => item.id === 'orpheus.observation.a');
  sameSourceObservation.sourceGroup = 'raw_audio';
  sameSourceObservation.verificationEntries = [{ entryId: 'audio.original_incident_timestamp', sourceGroup: 'raw_audio' }];
  assert.match(errorsFor({ dialogue: sameSourceDialogue }).join('\n'), /sourceGroup|independent/i);

  const unreachableDialogue = content.dialogue.map(item => ({ ...item, verificationEntries: [...(item.verificationEntries || [])] }));
  const unreachableObservation = unreachableDialogue.find(item => item.id === 'orpheus.observation.a');
  unreachableObservation.verificationEntries = [{ entryId: 'audio.original_incident_timestamp', sourceGroup: 'raw_audio' }];
  const unreachableEntries = content.terminalEntries.map(item => ({ ...item }));
  unreachableEntries.find(item => item.id === 'audio.original_incident_timestamp').unlockWhen = { publicFact: 'never_recorded' };
  assert.match(errorsFor({ dialogue: unreachableDialogue, terminalEntries: unreachableEntries }).join('\n'), /reachable|verification/i);
});

test('rejects mainline action prerequisites that point at private operations', () => {
  const operations = content.operations.map(item => ({ ...item, unlockWhen: structuredClone(item.unlockWhen) }));
  operations.find(item => item.operationId === 'continue_file_index').unlockWhen = { actionAttempted: 'archive_index' };
  assert.match(errorsFor({ operations }).join('\n'), /private|mainline|action/i);
});

test('rejects mainline progress that depends on private facts or private fallback prerequisites', () => {
  const operations = content.operations.map(item => ({ ...item, unlockWhen: structuredClone(item.unlockWhen), effects: structuredClone(item.effects) }));
  operations.find(item => item.operationId === 'complete_main5').unlockWhen = { roleFact: 'aPublishedFragment' };
  assert.match(errorsFor({ operations }).join('\n'), /mainline.*private|private.*mainline/i);

  const missions = content.privateMissions.map(item => ({ ...item, mainlineFallbackOperationIds: [...item.mainlineFallbackOperationIds] }));
  missions[0].mainlineFallbackOperationIds = ['archive_index'];
  assert.match(errorsFor({ privateMissions: missions }).join('\n'), /fallback.*mainline|kind/i);
});

test('predicate evaluation fails closed for malformed runtime values and keeps empty all/any semantics', () => {
  assert.equal(evaluatePredicate(null), false);
  assert.equal(evaluatePredicate(undefined), false);
  assert.equal(evaluatePredicate({ unknown: true }), false);
  assert.equal(evaluatePredicate({ all: [] }), true);
  assert.equal(evaluatePredicate({ any: [] }), false);
  assert.equal(evaluatePredicate({ all: [], publicFact: 'roomCreated' }), false);
});

test('rejects missing or duplicate debrief facts and broken content references', () => {
  const debrief = [...content.debrief, { ...content.debrief[0] }];
  assert.match(errorsFor({ debrief }).join('\n'), /duplicate.*(id|fact)/i);
  const terminalEntries = content.terminalEntries.map(item => ({ ...item, debriefFactIds: [...item.debriefFactIds] }));
  terminalEntries[0].debriefFactIds.push('missing-fact');
  assert.match(errorsFor({ terminalEntries }).join('\n'), /debrief|fact/i);
  const missions = content.privateMissions.map(item => ({ ...item, sourceEntryId: 'missing-source' }));
  assert.match(errorsFor({ privateMissions: missions }).join('\n'), /source|entry|missing/i);
});

test('exports a throwing assertion for CI and authoring scripts', () => {
  assert.doesNotThrow(() => assertValidContent(content));
  assert.throws(() => assertValidContent({ ...content, operations: [] }), /content/i);
});
