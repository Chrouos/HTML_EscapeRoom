function createWorkstationState() {
  return {
    unlockedEntryIds: [],
    openedEntryIds: [],
    activeOperations: [],
    roleFacts: [],
    actionAttempts: [],
    completedOperations: []
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
    countdownStartedAt: null,
    ending: null,
    processedActionIds: new Set(),
    revision: 0
  };
}

module.exports = { createRoomState, createWorkstationState };
