const { answersMatch } = require('./answerUtils');
const { mainPuzzles } = require('./content/mainPuzzles');
const { sidePuzzles } = require('./content/sidePuzzles');
const { story } = require('./content/story');
const { endings } = require('./content/endings');
const { appendStoryEvents } = require('./storyEngine');
const { evaluate, evidenceIds } = require('./endingEngine');

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
  if (room.mainProgress.includes(action.puzzleId)
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
    const choice = action.value.trim().toUpperCase();
    const count = evidenceIds(room).size;
    if (!['COMPLY', 'RESIST', 'TRUTH'].includes(choice)) fail('INVALID_ACTION', 400, '請選擇一個出口協定');
    if ((choice === 'RESIST' && count < 2) || (choice === 'TRUTH' && count < 4)) fail('PUZZLE_LOCKED', 423, '目前證據不足以執行這個協定');
    if (room.pendingChoices[role] === choice) return noOp();
    room.pendingChoices[role] = choice;
    const endingId = evaluate(room);
    const event = { id: 'choice-' + action.actionId, type: 'system', text: '角色 ' + role + ' 已確認出口協定。等待雙方達成一致。',
      audience: { kind: 'both' } };
    if (endingId) {
      room.ending = structuredClone(endings[endingId]);
      room.mainProgress.push('main6');
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
      room.mainProgress.push(action.puzzleId);
      room.chapter += 1;
    }
  } else if (!isSide) setClues(room, puzzle, nextStep, true);
  initializeGame(room, pendingEvents);
  return { stateChanged: true, events, publicResult: { correct: true, nextStep,
    nextChapter: room.chapter, hints: [], message: nextStep ? '核對完成，下一步已解鎖' : '紀錄已完成' } };
}

module.exports = { initializeGame, submitAction };
