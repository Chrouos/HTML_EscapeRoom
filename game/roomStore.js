const { randomBytes, randomInt } = require('node:crypto');

const { createRoomState } = require('./createRoomState');
const { RoomError, roomErrors } = require('./roomErrors');

const COUNTDOWN_MS = 45 * 60 * 1000;
const DEFAULT_ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const EXPIRED_TOMBSTONE_TTL_MS = 60 * 60 * 1000;
const MAX_EXPIRED_TOMBSTONES = 1000;

function generateUniqueValue(generator, usedValues) {
  let value;
  do {
    value = String(generator());
  } while (usedValues.has(value));
  return value;
}

function createRoomStore(options = {}) {
  const rooms = new Map();
  const playersByToken = new Map();
  const playerIds = new Set();
  const expiredRoomTombstones = new Map();
  const now = options.now || (() => Date.now());
  const roomTtlMs = options.roomTtlMs ?? DEFAULT_ROOM_TTL_MS;
  const generateRoomCode = options.generateRoomCode || (() => (
    String(randomInt(0, 1000000)).padStart(6, '0')
  ));
  const generateToken = options.generateToken || (() => (
    randomBytes(32).toString('base64url')
  ));
  const generatePlayerId = options.generatePlayerId || (() => (
    randomBytes(32).toString('base64url')
  ));

  function pruneExpiredTombstones(currentTime) {
    for (const [roomCode, expiredAt] of expiredRoomTombstones) {
      if (currentTime - expiredAt >= EXPIRED_TOMBSTONE_TTL_MS) {
        expiredRoomTombstones.delete(roomCode);
      }
    }
    while (expiredRoomTombstones.size > MAX_EXPIRED_TOMBSTONES) {
      const oldestRoomCode = expiredRoomTombstones.keys().next().value;
      expiredRoomTombstones.delete(oldestRoomCode);
    }
  }

  function expireRoom(roomCode, room, currentTime) {
    rooms.delete(roomCode);
    for (const player of Object.values(room.players)) {
      if (player && playersByToken.get(player.token)?.roomCode === roomCode) {
        playersByToken.delete(player.token);
        playerIds.delete(player.playerId);
      }
    }
    expiredRoomTombstones.delete(roomCode);
    expiredRoomTombstones.set(roomCode, currentTime);
    pruneExpiredTombstones(currentTime);
  }

  function cleanupExpiredRooms(currentTime) {
    pruneExpiredTombstones(currentTime);
    for (const [roomCode, room] of rooms) {
      if (currentTime - room.createdAt >= roomTtlMs) {
        expireRoom(roomCode, room, currentTime);
      }
    }
  }

  function roomView(room, currentTime = now()) {
    const view = structuredClone(room);
    if (room.countdownStartedAt === null) {
      view.countdownStatus = 'waiting';
      view.countdownRemainingMs = null;
      return view;
    }

    view.countdownRemainingMs = Math.max(
      0,
      COUNTDOWN_MS - (currentTime - room.countdownStartedAt)
    );
    view.countdownStatus = view.countdownRemainingMs === 0
      ? 'emergency'
      : 'running';
    return view;
  }

  function getActiveRoom(roomCode, currentTime = now()) {
    const code = String(roomCode);
    pruneExpiredTombstones(currentTime);
    const room = rooms.get(code);
    if (!room) {
      if (expiredRoomTombstones.has(code)) {
        throw new RoomError(roomErrors.ROOM_EXPIRED, 'Room has expired');
      }
      throw new RoomError(roomErrors.ROOM_NOT_FOUND, 'Room not found');
    }
    if (currentTime - room.createdAt >= roomTtlMs) {
      expireRoom(code, room, currentTime);
      throw new RoomError(roomErrors.ROOM_EXPIRED, 'Room has expired');
    }
    return room;
  }

  function createRoom() {
    const currentTime = now();
    cleanupExpiredRooms(currentTime);
    const roomCode = generateUniqueValue(generateRoomCode, {
      has: code => rooms.has(code) || expiredRoomTombstones.has(code)
    });
    const token = generateUniqueValue(generateToken, playersByToken);
    const playerId = generateUniqueValue(generatePlayerId, playerIds);

    const room = createRoomState(roomCode, currentTime);
    room.players.A = { token, playerId };
    rooms.set(roomCode, room);
    playerIds.add(playerId);
    playersByToken.set(token, { roomCode, role: 'A', playerId });

    return {
      room: roomView(room, currentTime),
      player: { role: 'A', token, playerId }
    };
  }

  function joinRoom(roomCode) {
    const currentTime = now();
    const room = getActiveRoom(roomCode, currentTime);
    if (room.players.B) {
      throw new RoomError(roomErrors.ROOM_FULL, 'Room is full');
    }

    const token = generateUniqueValue(generateToken, playersByToken);
    const playerId = generateUniqueValue(generatePlayerId, playerIds);

    room.players.B = { token, playerId };
    room.countdownStartedAt = currentTime;
    room.revision += 1;
    playerIds.add(playerId);
    playersByToken.set(token, {
      roomCode: room.roomCode,
      role: 'B',
      playerId
    });

    return {
      room: roomView(room, currentTime),
      player: { role: 'B', token, playerId }
    };
  }

  function getRoom(roomCode) {
    const currentTime = now();
    const room = getActiveRoom(roomCode, currentTime);
    return roomView(room, currentTime);
  }

  function resolvePlayer(roomCode, token) {
    const currentTime = now();
    const room = getActiveRoom(roomCode, currentTime);
    const player = playersByToken.get(String(token));
    if (!player || player.roomCode !== room.roomCode) {
      throw new RoomError(roomErrors.INVALID_TOKEN, 'Invalid join token');
    }
    return {
      role: player.role,
      playerId: player.playerId,
      room: roomView(room, currentTime)
    };
  }

  function updateRoom(roomCode, updater, options = {}) {
    const code = String(roomCode);
    const currentTime = now();
    const room = getActiveRoom(code, currentTime);

    const actionId = options && options.actionId;
    if (actionId !== undefined && actionId !== null
      && room.processedActionIds.has(String(actionId))) {
      return roomView(room, currentTime);
    }

    const storeOwnedMetadata = {
      roomCode: room.roomCode,
      createdAt: room.createdAt,
      players: structuredClone(room.players),
      streams: structuredClone(room.streams),
      countdownStartedAt: room.countdownStartedAt,
      processedActionIds: new Set(room.processedActionIds)
    };
    const draft = structuredClone(room);
    updater(draft);
    draft.roomCode = storeOwnedMetadata.roomCode;
    draft.createdAt = storeOwnedMetadata.createdAt;
    draft.players = storeOwnedMetadata.players;
    draft.streams = storeOwnedMetadata.streams;
    draft.countdownStartedAt = storeOwnedMetadata.countdownStartedAt;
    draft.processedActionIds = storeOwnedMetadata.processedActionIds;
    if (actionId !== undefined && actionId !== null) {
      draft.processedActionIds.add(String(actionId));
    }
    draft.revision = room.revision + 1;
    rooms.set(code, draft);
    return roomView(draft, currentTime);
  }

  function hasProcessedAction(roomCode, actionId) {
    const currentTime = now();
    const room = getActiveRoom(roomCode, currentTime);
    return room.processedActionIds.has(String(actionId));
  }

  return {
    createRoom,
    joinRoom,
    getRoom,
    resolvePlayer,
    updateRoom,
    hasProcessedAction
  };
}

module.exports = { createRoomStore };
