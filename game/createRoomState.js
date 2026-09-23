function createWorkstationState() {
  return {
    unlockedEntryIds: [],
    openedEntryIds: [],
    activeOperations: [],
    roleFacts: [],
    actionAttempts: [],
    completedOperations: [],
    completedNodes: []
  };
}

function createDialogueState() {
  return {
    publicDialogueState: { deliveredContentIds: [] },
    directDialogueState: {
      A: { rapportCount: 0, rapportSincePressure: 0, lastIntent: null, deliveredContentIds: [] },
      B: { rapportCount: 0, rapportSincePressure: 0, lastIntent: null, deliveredContentIds: [] }
    }
  };
}

function createNarrativeBehaviorState(createdAt = 0) {
  const baseline = Number.isFinite(createdAt) && createdAt >= 0 ? createdAt : 0;
  return {
    entryOpenCount: { A: {}, B: {} },
    lastMeaningfulActionAt: { A: baseline, B: baseline },
    pendingObservation: { A: null, B: null },
    sharedEvidenceIds: { A: [], B: [] },
    ignoredPromptIds: { A: [], B: [] },
    reactionFactIds: { A: [], B: [] },
    lastReactionAt: { A: {}, B: {} }
  };
}

function createRoomState(roomCode, createdAt) {
  if (roomCode && typeof roomCode === 'object') {
    ({ roomCode, createdAt } = roomCode);
  }

  return {
    roomCode,
    createdAt,
    players: { A: null, B: null },
    streams: {
      A: { cursor: 0, acknowledgedCursor: 0, events: [] },
      B: { cursor: 0, acknowledgedCursor: 0, events: [] }
    },
    chapter: 1,
    mainProgress: [],
    sideEvidence: [],
    attempts: {},
    hints: {},
    messages: [],
    pendingChoices: {},
    narrativeBehavior: createNarrativeBehaviorState(createdAt),
    countdownStartedAt: null,
    ending: null,
    processedActionIds: new Set(),
    revision: 0
  };
}

module.exports = {
  createRoomState,
  createWorkstationState,
  createDialogueState,
  createNarrativeBehaviorState
};
