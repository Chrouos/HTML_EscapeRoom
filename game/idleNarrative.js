const {
  ensureDialogueState,
  ensureNarrativeBehavior
} = require('./privateEventEngine');

const IDLE_THRESHOLD_MS = 60_000;
const IDLE_COOLDOWN_MS = 120_000;
const IDLE_REACTIONS = Object.freeze([
  {
    id: 'echo.behavior.idle.1',
    text: 'ECHO：你停了一段時間。沒有操作也是一種選擇；我不會替你填上答案。'
  },
  {
    id: 'echo.behavior.idle.2',
    text: 'ECHO：你又停下來了。這次我仍然只記錄，不替你決定下一步。'
  }
]);

function roleName(role) {
  return role === 'A' ? 'host' : 'guest';
}

function idleReactionCount(behavior, role) {
  const facts = behavior.reactionFactIds?.[role] || [];
  return IDLE_REACTIONS.filter(item => facts.includes(item.id)).length;
}

function lastIdleReactionAt(behavior, role) {
  const timestamps = IDLE_REACTIONS
    .map(item => behavior.lastReactionAt?.[role]?.[item.id])
    .filter(value => Number.isFinite(value) && value >= 0);
  return timestamps.length ? Math.max(...timestamps) : null;
}

function shouldTriggerIdleObservation(room, role, now = Date.now()) {
  if (!room || typeof room !== 'object') return false;
  if (role !== 'A' && role !== 'B') return false;
  if (!room.players?.A || !room.players?.B) return false;
  if (!room.publicFacts?.includes('main1Completed')) return false;
  if (room.ending) return false;
  if (!Number.isFinite(now) || now < 0) return false;

  const behavior = ensureNarrativeBehavior(room, now);
  const count = idleReactionCount(behavior, role);
  if (count >= IDLE_REACTIONS.length) return false;

  const lastMeaningful = behavior.lastMeaningfulActionAt?.[role];
  if (!Number.isFinite(lastMeaningful) || now - lastMeaningful < IDLE_THRESHOLD_MS) return false;

  const lastReaction = lastIdleReactionAt(behavior, role);
  if (lastReaction !== null && now - lastReaction < IDLE_COOLDOWN_MS) return false;
  return true;
}

function triggerIdleObservation(room, role, now = Date.now(), pendingEvents = []) {
  if (!shouldTriggerIdleObservation(room, role, now)) return false;
  ensureDialogueState(room);
  const behavior = ensureNarrativeBehavior(room, now);
  const reaction = IDLE_REACTIONS[idleReactionCount(behavior, role)];
  if (!reaction) return false;

  const audience = { kind: 'role', role: roleName(role) };
  pendingEvents.push({
    contentId: reaction.id,
    type: 'system',
    text: reaction.text,
    audience
  });

  const state = room.directDialogueState[role];
  if (!state.deliveredContentIds.includes(reaction.id)) state.deliveredContentIds.push(reaction.id);
  state.lastIntent = 'observation';
  if (!behavior.reactionFactIds[role].includes(reaction.id)) behavior.reactionFactIds[role].push(reaction.id);
  behavior.lastReactionAt[role][reaction.id] = now;
  return true;
}

module.exports = {
  IDLE_THRESHOLD_MS,
  IDLE_COOLDOWN_MS,
  shouldTriggerIdleObservation,
  triggerIdleObservation
};
