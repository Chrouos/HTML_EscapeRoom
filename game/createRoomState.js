function createWorkstationState() {
  return {
    unlockedEntryIds: [],
    openedEntryIds: [],
    activeOperations: [],
    roleFacts: [],
    actionAttempts: [],
    completedOperations: [],
    completedNodes: [],
    deletedEntryIds: [],
    addedEntryIds: [],
    permissions: []
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
    hintsByRole: { A: {}, B: {} },
    messages: [],
    pendingChoices: {},
    countdownStartedAt: null,
    ending: null,
    processedActionIds: new Set(),
    revision: 0
  };
}

module.exports = { createRoomState, createWorkstationState, createDialogueState };
