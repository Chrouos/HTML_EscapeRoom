const SENSITIVE_KEYS = new Set([
  'answer',
  'answers',
  'correctanswer',
  'correctanswers',
  'privateclue',
  'privateclues',
  'secret',
  'secrets',
  'token',
  'tokens',
  'uncoveredevidence',
  'uncoveredevidences',
  'unrevealedevidence',
  'unrevealedevidences'
]);

function isSensitiveKey(key) {
  return SENSITIVE_KEYS.has(String(key).replace(/[\s_-]/g, '').toLowerCase());
}

function cloneSafeValue(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(cloneSafeValue);
  }

  const result = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (!isSensitiveKey(key)) {
      result[key] = cloneSafeValue(nestedValue);
    }
  }
  return result;
}

function getRole(player) {
  const role = typeof player === 'string' ? player : player && player.role;
  if (role !== 'A' && role !== 'B') {
    throw new TypeError('Player role must be A or B');
  }
  return role;
}

function canSeeAudience(audience, role) {
  if (audience === undefined || audience === null || audience === 'public' || audience === 'all') {
    return true;
  }
  if (Array.isArray(audience)) {
    return audience.includes(role) || audience.includes('public') || audience.includes('all');
  }
  return audience === role;
}

function visibleEvidence(room) {
  const evidence = Array.isArray(room.sideEvidence) ? room.sideEvidence : [];
  return evidence
    .filter(item => typeof item === 'string'
      || (item && item.discovered !== false && item.found !== false && item.isDiscovered !== false))
    .map(item => {
      if (typeof item === 'string') {
        return { id: item };
      }

      const summary = {};
      for (const key of ['id', 'title', 'summary']) {
        if (item[key] !== undefined) {
          summary[key] = cloneSafeValue(item[key]);
        }
      }
      return summary;
    });
}

function visibleClues(room, role) {
  const sources = [
    room.privateClues && room.privateClues[role],
    room.roleClues && room.roleClues[role],
    room.clues && room.clues[role],
    room.players && room.players[role] && room.players[role].privateClues,
    room.players && room.players[role] && room.players[role].clues
  ];
  const source = sources.find(candidate => candidate !== undefined) || {};
  return cloneSafeValue(source);
}

function visibleMessages(room, role) {
  const messages = Array.isArray(room.messages) ? room.messages : [];
  return messages
    .filter(message => canSeeAudience(message && message.audience, role))
    .map(cloneSafeValue);
}

function publicProgress(room) {
  if (room.publicProgress !== undefined) {
    return cloneSafeValue(room.publicProgress);
  }
  return {
    chapter: room.chapter,
    mainProgress: cloneSafeValue(Array.isArray(room.mainProgress) ? room.mainProgress : [])
  };
}

function countdown(room) {
  if (room.countdown && typeof room.countdown === 'object') {
    return {
      status: room.countdown.status,
      remainingMs: room.countdown.remainingMs
    };
  }
  return {
    status: room.countdownStatus || 'waiting',
    remainingMs: room.countdownRemainingMs ?? null
  };
}

function forPlayer(room, player) {
  const role = getRole(player);
  const players = room.players || {};
  const occupied = {
    A: Boolean(players.A),
    B: Boolean(players.B)
  };

  return {
    roomCode: room.roomCode,
    role,
    occupancy: {
      ...occupied,
      count: Number(occupied.A) + Number(occupied.B),
      capacity: 2,
      ready: occupied.A && occupied.B
    },
    publicProgress: publicProgress(room),
    messages: visibleMessages(room, role),
    discoveredEvidence: visibleEvidence(room),
    countdown: countdown(room),
    revision: room.revision,
    ending: cloneSafeValue(room.ending),
    clues: visibleClues(room, role)
  };
}

module.exports = { forPlayer };
