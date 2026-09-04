function createRoomState(roomCode, createdAt) {
  if (roomCode && typeof roomCode === 'object') {
    ({ roomCode, createdAt } = roomCode);
  }

  return {
    roomCode,
    createdAt,
    players: { A: null, B: null },
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

module.exports = { createRoomState };
