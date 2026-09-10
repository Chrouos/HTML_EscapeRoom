const { resolveRecipients } = require('./audience');

const SENSITIVE_KEYS = new Set([
  'acknowledgedcursor',
  'answer',
  'answers',
  'audience',
  'correctanswer',
  'correctanswers',
  'cursor',
  'privateclue',
  'privateclues',
  'revision',
  'sequence',
  'secret',
  'secrets',
  'streams',
  'token',
  'tokens',
  'uncoveredevidence',
  'uncoveredevidences',
  'unrevealedevidence',
  'unrevealedevidences',
  'playerid'
]);

function normalizedKey(key) {
  return String(key).replace(/[\s_-]/g, '').toLowerCase();
}

function cloneClientValue(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(cloneClientValue);
  }

  const result = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (!SENSITIVE_KEYS.has(normalizedKey(key))) {
      result[key] = cloneClientValue(nestedValue);
    }
  }
  return result;
}

function assertPlayerIdentity(room, player) {
  const role = player && player.role;
  const playerId = player && player.playerId;
  const occupant = (role === 'A' || role === 'B') && room.players && room.players[role];

  if (!occupant || typeof playerId !== 'string' || occupant.playerId !== playerId) {
    throw new TypeError('Player identity does not match room');
  }

  return role;
}

function occupancy(room) {
  const occupied = {
    A: Boolean(room.players && room.players.A),
    B: Boolean(room.players && room.players.B)
  };
  return {
    ...occupied,
    count: Number(occupied.A) + Number(occupied.B),
    capacity: 2,
    ready: occupied.A && occupied.B
  };
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
          summary[key] = cloneClientValue(item[key]);
        }
      }
      return summary;
    });
}

function publicProgress(room) {
  if (room.publicProgress !== undefined) {
    return cloneClientValue(room.publicProgress);
  }
  return {
    chapter: room.chapter,
    mainProgress: cloneClientValue(Array.isArray(room.mainProgress) ? room.mainProgress : [])
  };
}

function actorValue(source, role, fallback) {
  if (source === undefined) {
    return cloneClientValue(fallback);
  }
  if (source && !Array.isArray(source) && typeof source === 'object'
      && (Object.hasOwn(source, 'A') || Object.hasOwn(source, 'B'))) {
    return cloneClientValue(source[role] ?? fallback);
  }
  return cloneClientValue(source);
}

function visibleIntercom(room, role) {
  if (room.intercom !== undefined) {
    if (Array.isArray(room.intercom)) {
      return room.intercom
        .filter(message => resolveRecipients(room, message && message.audience).includes(role))
        .map(cloneClientValue);
    }
    return actorValue(room.intercom, role, []);
  }

  const messages = Array.isArray(room.messages) ? room.messages : [];
  return messages
    .filter(message => resolveRecipients(room, message && message.audience).includes(role))
    .map(cloneClientValue);
}

function workstation(room, role) {
  if (room.workstation !== undefined) {
    return actorValue(room.workstation, role, {});
  }
  const clues = room.privateClues && room.privateClues[role];
  return cloneClientValue(clues || {});
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

function projectForPlayer(room, player) {
  const role = assertPlayerIdentity(room, player);

  return {
    roomCode: room.roomCode,
    role,
    occupancy: occupancy(room),
    publicProgress: publicProgress(room),
    intercom: visibleIntercom(room, role),
    workstation: workstation(room, role),
    privateMissions: actorValue(room.privateMissions, role, []),
    discoveredEvidence: visibleEvidence(room),
    ending: cloneClientValue(room.ending ?? null),
    debrief: cloneClientValue(room.ending ? (room.debrief ?? null) : null)
  };
}

function stateResponse(room, player, sinceCursor) {
  const state = projectForPlayer(room, player);
  const cursor = room.streams[player.role].cursor;
  const unchanged = sinceCursor === cursor;
  const response = {
    success: true,
    unchanged,
    cursor
  };
  if (!unchanged) {
    response.state = state;
  }
  response.countdown = countdown(room);
  return response;
}

function forPlayer(room, player) {
  const projected = projectForPlayer(room, player);
  return {
    ...projected,
    messages: projected.intercom,
    clues: projected.workstation,
    countdown: countdown(room)
  };
}

module.exports = { projectForPlayer, stateResponse, forPlayer };
