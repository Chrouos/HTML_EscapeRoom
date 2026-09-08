function evidenceIds(room) {
  return new Set((room.sideEvidence || []).map(item => typeof item === 'string' ? item : item.id));
}

function evaluate(room) {
  const evidence = evidenceIds(room);
  const choices = room.pendingChoices || {};
  if (!room.mainProgress.includes('main5') || !room.completedSteps?.main6?.length) return null;
  if (!choices.A || choices.A !== choices.B) return null;
  if (choices.A === 'COMPLY') return 'compliance';
  if (choices.A === 'RESIST' && evidence.size >= 2) return 'resistance';
  if (choices.A === 'TRUTH' && evidence.size >= 4) return 'truth';
  return null;
}

module.exports = { evaluate, evidenceIds };
