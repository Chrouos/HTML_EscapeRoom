const { answersMatch } = require('./answerUtils');
const { mainPuzzles } = require('./content/mainPuzzles');
const { sidePuzzles } = require('./content/sidePuzzles');
const { story } = require('./content/story');
const { endings } = require('./content/endings');
const { appendStoryEvents } = require('./storyEngine');
const { evaluate, evidenceIds } = require('./endingEngine');
const { executeOperation, ensureRoom, refreshWorkstation } = require('./terminalEngine');
const {
  ensurePrivateMissions,
  refreshPrivateMissions,
  missionForOperation,
  resolvePrivateMission,
  triggerDialogue
} = require('./privateEventEngine');

function fail(code, status, message) {
  throw Object.assign(new Error(message), { code, status });
}

function prepare(room, puzzle) {
  room.completedSteps ??= {};
  room.completedSteps[puzzle.puzzleId] ??= [];
  room.attempts[puzzle.puzzleId] ??= {};
  room.hints[puzzle.puzzleId] ??= {};
  for (const id of Object.keys(puzzle.steps)) {
    room.attempts[puzzle.puzzleId][id] ??= 0;
    room.hints[puzzle.puzzleId][id] ??= [];
  }
}

function currentStep(room, puzzle) {
  return Object.keys(puzzle.steps).find(id => !room.completedSteps[puzzle.puzzleId].includes(id));
}

function progress(room, puzzle, stepId) {
  const step = puzzle.steps[stepId];
  let prompt = step.prompt;
  if (step.kind === 'ending') {
    const count = evidenceIds(room).size;
    prompt = '請各自確認出口協定：COMPLY（依 AI 指示完成程序）';
    if (count >= 2) prompt += '；RESIST（以證據執行手動脫離）';
    if (count >= 4) prompt += '；TRUTH（共同隔離 AI，公開未編輯檔案）';
    prompt += '。雙方必須選擇相同協定；仍可回頭調查紀錄。';
  }
  return { chapter: room.chapter, mainProgress: [...room.mainProgress], puzzleId: puzzle.puzzleId,
    stepId, title: step.title, prompt, hints: [...room.hints[puzzle.puzzleId][stepId]] };
}

function setClues(room, puzzle, stepId, force = false) {
  const clueStage = puzzle.puzzleId + ':' + stepId;
  const clues = puzzle.steps[stepId].privateClues || puzzle.privateClues;
  if (force || (room.clueStage && room.clueStage !== clueStage)) room.privateClues = {};
  room.privateClues ??= {};
  for (const role of ['A', 'B']) room.privateClues[role] ??= structuredClone(clues?.[role] || { text: '' });
  room.clueStage = clueStage;
}

const MAINLINE_FACTS = Object.freeze([
  ['main1', 'main1Completed'], ['main2', 'main2Completed'], ['main3', 'main3Completed'],
  ['main4', 'main4Completed'], ['main5', 'main5Completed'], ['main6', 'mainCompleted']
]);

// Legacy clients still read mainProgress/chapter. Keep those projections
// derived from the manifest facts so operation effects remain the only source
// of shared progression mutations.
function syncMainlineProjection(room) {
  const facts = new Set(room.publicFacts || []);
  // Backfill facts for snapshots written before manifest operations existed.
  for (const [id, fact] of MAINLINE_FACTS) if (room.mainProgress?.includes(id)) facts.add(fact);
  room.publicFacts = [...facts];
  room.mainProgress = MAINLINE_FACTS.filter(([, fact]) => facts.has(fact)).map(([id]) => id);
  room.chapter = Math.min(6, room.mainProgress.length + 1);
  return room.mainProgress;
}

function sideViews(room) {
  const available = Object.values(sidePuzzles).filter(puzzle => room.chapter >= puzzle.chapter);
  if (!available.length) return;
  room.publicProgress.sidePuzzles = available.map(puzzle => {
    const complete = evidenceIds(room).has(puzzle.evidence.id);
    const opened = room.openedSides?.includes(puzzle.puzzleId);
    const view = { puzzleId: puzzle.puzzleId, title: puzzle.title, hook: puzzle.hook, opened: Boolean(opened), complete };
    if (opened && !complete) {
      prepare(room, puzzle);
      const stepId = currentStep(room, puzzle);
      Object.assign(view, { stepId, prompt: puzzle.steps[stepId].prompt, hints: room.hints[puzzle.puzzleId][stepId] });
    }
    return view;
  });
  for (const role of ['A', 'B']) {
    room.privateClues[role].sideClues = available.filter(puzzle => room.openedSides?.includes(puzzle.puzzleId))
      .map(puzzle => {
        prepare(room, puzzle);
        const stepId = currentStep(room, puzzle);
        const clue = stepId ? (puzzle.steps[stepId].privateClues || puzzle.privateClues)?.[role] : null;
        return { puzzleId: puzzle.puzzleId, title: puzzle.title, text: clue?.text || '證據已歸檔。' };
      });
  }
}

function initializeGame(room, pendingEvents = []) {
  if (!room || typeof room !== 'object') fail('INVALID_ROOM', 400, '無法初始化房間');
  if (!room.players?.A || !room.players?.B) return room;
  room.mainProgress ??= [];
  room.sideEvidence ??= [];
  room.attempts ??= {};
  room.hints ??= {};
  ensureRoom(room);
  syncMainlineProjection(room);
  const puzzle = mainPuzzles['main' + room.chapter];
  if (puzzle && !room.ending) {
    prepare(room, puzzle);
    const stepId = currentStep(room, puzzle);
    if (stepId) {
      setClues(room, puzzle, stepId);
      room.publicProgress = progress(room, puzzle, stepId);
    }
    appendStoryEvents(room, story[puzzle.puzzleId]?.initial || [], pendingEvents);
  } else {
    room.publicProgress = { chapter: room.chapter, mainProgress: [...room.mainProgress] };
    room.privateClues ??= { A: { text: '' }, B: { text: '' } };
  }
  sideViews(room);
  return room;
}

function noOp() { return { stateChanged: false, events: [], publicResult: { completed: true } }; }

const OPERATION_OUTCOMES = Object.freeze({
  archive_index: 'completed', flag_identity: 'completed', share_roster: 'completed',
  delete_local_mirror: 'completed', share_mirror_first: 'completed',
  pause_local_mirror: 'completed', keep_local_mirror: 'completed', warn_partner_first: 'completed',
  request_solo_validation: 'completed', publish_fragment: 'completed', request_pair_validation: 'completed',
  file_full_report: 'completed', file_anonymous_summary: 'completed', disclose_report: 'completed',
  decline_index_repair: 'declined', decline_identity_check: 'declined', decline_mirror_cleanup: 'declined',
  skip_a1: 'skipped', skip_b1: 'skipped', skip_a2: 'skipped', skip_b2: 'skipped', skip_a3: 'skipped', skip_b3: 'skipped'
});

function operationActionKey(player, actionId) {
  return `${player.playerId || player.role}:${actionId}`;
}

function submitOperation(room, player, action, pendingEvents = []) {
  if (!action || Array.isArray(action)
    || typeof action.actionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(action.actionId)
    || typeof action.operationId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(action.operationId)
    || (action.value !== undefined && (typeof action.value !== 'string' || action.value.length > 1000))) {
    fail('INVALID_ACTION', 400, 'Invalid workstation operation');
  }
  const role = typeof player === 'string' ? player : player?.role;
  if (!['A', 'B'].includes(role)) fail('INVALID_PLAYER', 400, 'Invalid player role');
  if (!room?.players?.A || !room?.players?.B) fail('ROOM_NOT_READY', 423, 'Room is not ready');
  if (room.ending) return noOp();

  ensureRoom(room);
  ensurePrivateMissions(room);
  refreshPrivateMissions(room);
  room.operationActionResults ??= {};
  const key = operationActionKey(typeof player === 'object' ? player : { role }, action.actionId);
  if (room.operationActionResults[key]) {
    const duplicate = structuredClone(room.operationActionResults[key]);
    duplicate.stateChanged = false;
    duplicate.publicResult = { ...(duplicate.publicResult || {}), duplicate: true };
    duplicate.events = [];
    return duplicate;
  }

  const mission = missionForOperation(action.operationId);
  if (mission && mission.role !== role) fail('OPERATION_LOCKED', 423, 'Operation is not assigned to this player');
  if (mission) {
    const current = room.privateMissions[role].find(item => item.id === mission.id);
    if (!current || current.state !== 'available') fail(current?.state === 'resolved' ? 'MISSION_RESOLVED' : 'MISSION_LOCKED', 423, 'Mission is locked or already resolved');
  }

  const failedAttempt = mission && typeof action.value === 'string'
    && /^(failed|invalid|error)$/i.test(action.value.trim());
  const result = executeOperation(room, typeof player === 'object' ? player : { role }, action.operationId, action.value,
    { skipEffects: Boolean(failedAttempt) });
  if (!result.stateChanged) return result;

  let outcome = OPERATION_OUTCOMES[action.operationId];
  if (failedAttempt) outcome = 'failed';
  if (mission && outcome) {
    resolvePrivateMission(room, role, mission.id, outcome, action.operationId);
  }

  if (action.operationId === 'commit_finale') {
    // Role commit lifecycle bookkeeping only; shared progress remains owned
    // by the manifest effect applier in executeOperation.
    room.finaleCommittedByRole ??= {};
    room.finaleCommittedByRole[role] = true;
    // An unresolved private offer is an explicit omission, never a blocker.
    for (const item of room.privateMissions[role]) {
      if (item.state !== 'available') continue;
      resolvePrivateMission(room, role, item.id, 'skipped', null);
    }
  }

  triggerDialogue(room, {
    operationId: action.operationId,
    role,
    ...(action.operationId === 'open_entry' ? { entryOpened: action.value } : {})
  }, pendingEvents);
  syncMainlineProjection(room);
  room.publicProgress = { ...(room.publicProgress || {}), chapter: room.chapter, mainProgress: [...room.mainProgress] };
  refreshPrivateMissions(room);
  const response = {
    stateChanged: true,
    events: pendingEvents,
    publicResult: {
      operationId: action.operationId,
      ...(mission ? { missionId: mission.id, outcome } : {})
    }
  };
  room.operationActionResults[key] = structuredClone(response);
  return response;
}

function submitAction(room, player, action, pendingEvents = []) {
  if (!action || Array.isArray(action) || !['actionId', 'puzzleId', 'stepId'].every(key =>
    typeof action[key] === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(action[key]))
    || typeof action.value !== 'string' || action.value.length > 1000) fail('INVALID_ACTION', 400, '操作格式不正確');
  const role = typeof player === 'string' ? player : player?.role;
  if (!['A', 'B'].includes(role)) fail('INVALID_PLAYER', 400, '無法確認玩家身分');
  if (!room?.players?.A || !room?.players?.B) fail('ROOM_NOT_READY', 423, '等待另一位玩家加入後才能開始');
  if (room.ending) return noOp();
  const isSide = Object.hasOwn(sidePuzzles, action.puzzleId);
  const puzzle = isSide ? sidePuzzles[action.puzzleId] : mainPuzzles[action.puzzleId];
  if (!puzzle || room.chapter < puzzle.chapter) fail('PUZZLE_LOCKED', 423, '這個謎題尚未解鎖');
  const finaleProtocolStillOpen = action.puzzleId === 'main6' && !room.ending
    && room.completedSteps?.main6?.includes('protocol');
  if ((room.mainProgress.includes(action.puzzleId) && !finaleProtocolStillOpen)
    || (isSide && evidenceIds(room).has(puzzle.evidence.id))) return noOp();
  if (!isSide && room.chapter !== puzzle.chapter) fail('PUZZLE_LOCKED', 423, '這個謎題尚未解鎖');
  initializeGame(room, pendingEvents);
  prepare(room, puzzle);
  if (isSide && action.stepId === 'inspect') {
    room.openedSides ??= [];
    if (room.openedSides.includes(action.puzzleId)) return noOp();
    room.openedSides.push(action.puzzleId);
    const events = appendStoryEvents(room, [{ id: action.puzzleId + '-opened', type: 'clue', text: puzzle.hook,
      audience: { kind: 'both' } }], pendingEvents);
    initializeGame(room, pendingEvents);
    return { stateChanged: true, events, publicResult: { message: '紀錄已開啟，請比對兩人的資料' } };
  }
  if (isSide && !room.openedSides?.includes(action.puzzleId)) fail('PUZZLE_LOCKED', 423, '請先打開異常紀錄');
  if (room.completedSteps[action.puzzleId].includes(action.stepId)) return noOp();
  const stepId = currentStep(room, puzzle);
  if (action.stepId !== stepId) fail('PUZZLE_LOCKED', 423, '請先完成目前的步驟');
  const step = puzzle.steps[stepId];
  if (step.kind === 'ending') {
    if (!room.publicFacts?.includes('mainCompleted')
      && room.workstation?.[role]?.activeOperations?.includes('complete_main6')) {
      executeOperation(room, { role, playerId: room.players[role]?.playerId }, 'complete_main6');
      syncMainlineProjection(room);
    }
    const choice = action.value.trim().toUpperCase();
    const count = evidenceIds(room).size;
    if (!['COMPLY', 'RESIST', 'TRUTH'].includes(choice)) fail('INVALID_ACTION', 400, '請選擇一個出口協定');
    if ((choice === 'RESIST' && count < 2) || (choice === 'TRUTH' && count < 4)) fail('PUZZLE_LOCKED', 423, '目前證據不足以執行這個協定');
    if (room.pendingChoices[role] === choice) return noOp();
    room.pendingChoices[role] = choice;
    const endingId = evaluate(room);
    const event = { id: 'choice-' + role + '-' + action.actionId, type: 'system', text: '角色 ' + role + ' 已確認出口協定。等待雙方達成一致。',
      audience: { kind: 'both' } };
    if (endingId) {
      room.ending = structuredClone(endings[endingId]);
      room.completedSteps.main6.push(stepId);
      event.text = room.ending.text;
      event.type = 'story';
    } else if (room.pendingChoices.A && room.pendingChoices.B && room.pendingChoices.A !== room.pendingChoices.B) {
      event.text = '雙方選擇不一致。請討論後重新確認，系統不會替你們決定。';
    }
    const events = appendStoryEvents(room, [event], pendingEvents);
    initializeGame(room, pendingEvents);
    return { stateChanged: true, events, publicResult: { message: event.text } };
  }
  const authorization = action.puzzleId === 'main4' && stepId === 'authorization';
  const correct = (authorization ? step.acceptedAnswers : [step.answer]).some(answer => answersMatch(action.value, answer));
  if (!correct) {
    const attempt = ++room.attempts[action.puzzleId][stepId];
    const hints = (step.hints || []).filter((_, index) => attempt >= step.hintThresholds[index]);
    room.hints[action.puzzleId][stepId] = hints;
    const events = appendStoryEvents(room, [{ id: action.puzzleId + '-' + stepId + '-error-' + attempt, type: 'error',
      text: hints.length ? 'AI：資料不符。' + hints.at(-1) : 'AI：資料不符。請再次比對兩人的紀錄。',
      audience: { kind: 'both' } }], pendingEvents);
    initializeGame(room, pendingEvents);
    return { stateChanged: true, events, publicResult: { correct: false, attempt, hints } };
  }
  room.completedSteps[action.puzzleId].push(stepId);
  if (authorization) room.authorizationChoice = action.value.trim().toUpperCase();
  const events = appendStoryEvents(room, [story[action.puzzleId]?.[stepId + 'Complete'] || {
    id: action.puzzleId + '-' + stepId + '-complete', type: 'story', text: 'AI：' + step.title + '已完成。',
    audience: { kind: 'both' } }], pendingEvents);
  const nextStep = currentStep(room, puzzle);
  if (!nextStep) {
    if (isSide) {
      room.sideEvidence.push(structuredClone(puzzle.evidence));
      events.push(...appendStoryEvents(room, [{ id: action.puzzleId + '-evidence', type: 'clue',
        text: puzzle.evidence.summary, audience: { kind: 'both' } }], pendingEvents));
    } else {
      const operationId = {
        main1: 'complete_main1', main2: 'complete_main2', main3: 'complete_main3',
        main4: 'complete_main4', main5: 'complete_main5', main6: 'complete_main6'
      }[action.puzzleId];
      refreshWorkstation(room);
      if (operationId && room.workstation?.[role]?.activeOperations?.includes(operationId)) {
        executeOperation(room, { role, playerId: room.players[role]?.playerId }, operationId, undefined, { skipEffects: false });
      }
      syncMainlineProjection(room);
    }
  } else if (!isSide) setClues(room, puzzle, nextStep, true);
  initializeGame(room, pendingEvents);
  return { stateChanged: true, events, publicResult: { correct: true, nextStep,
    nextChapter: room.chapter, hints: [], message: nextStep ? '核對完成，下一步已解鎖' : '紀錄已完成' } };
}

module.exports = { initializeGame, submitAction, submitOperation };
