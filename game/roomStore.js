const { randomBytes, randomInt } = require('node:crypto');

const { createRoomState } = require('./createRoomState');
const { dispatchProjectionChanges } = require('./eventDispatcher');
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
  const subscribersByRoom = new Map();
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
    subscribersByRoom.delete(roomCode);
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

  function actionKey(playerId, actionId) {
    return `${String(playerId)}:${String(actionId)}`;
  }

  function restoreStoreOwnedMetadata(draft, room, owned) {
    draft.roomCode = room.roomCode;
    draft.createdAt = room.createdAt;
    draft.players = owned.players;
    draft.streams = owned.streams;
    draft.countdownStartedAt = room.countdownStartedAt;
    draft.processedActionIds = owned.processedActionIds;
  }

  function notifySubscribers(roomCode, envelopes) {
    if (Object.keys(envelopes).length === 0) return;
    const listeners = subscribersByRoom.get(roomCode);
    if (!listeners) return;

    for (const listener of [...listeners]) {
      try {
        listener(structuredClone({ roomCode, envelopes }));
      } catch {
        // Subscriber failures are isolated from the already committed transaction.
      }
    }
  }

  function commitTransaction(roomCode, updater, options, dispatchChanges) {
    const code = String(roomCode);
    const currentTime = now();
    const room = getActiveRoom(code, currentTime);

    if (typeof updater !== 'function') {
      throw new TypeError('Room transaction updater must be a function');
    }
    const actionId = options.actionId;
    const playerId = options.playerId;
    if (actionId !== undefined && actionId !== null
      && (playerId === undefined || playerId === null || String(playerId).trim() === '')) {
      throw new TypeError('playerId is required when actionId is provided');
    }
    const key = actionId === undefined || actionId === null
      ? null
      : actionKey(playerId, actionId);
    if (key && room.processedActionIds.has(key)) {
      return roomView(room, currentTime);
    }

    const owned = structuredClone({
      players: room.players,
      streams: room.streams,
      processedActionIds: room.processedActionIds
    });
    const draft = structuredClone(room);
    updater(draft);
    restoreStoreOwnedMetadata(draft, room, owned);
    const envelopes = dispatchChanges
      ? dispatchProjectionChanges({ before: room, draft, events: options.events || [] })
      : {};
    if (key) draft.processedActionIds.add(key);
    draft.revision = room.revision + 1;
    rooms.set(code, draft);
    notifySubscribers(code, envelopes);
    return roomView(draft, currentTime);
  }

  function transact(roomCode, updater, options = {}) {
    return commitTransaction(roomCode, updater, options, true);
  }

  function updateRoom(roomCode, updater, options = {}) {
    return commitTransaction(roomCode, updater, {
      ...options,
      playerId: options.playerId ?? 'legacy'
    }, false);
  }

  function hasProcessedAction(roomCode, actionId, playerId) {
    const currentTime = now();
    const room = getActiveRoom(roomCode, currentTime);
    if (playerId !== undefined && playerId !== null) {
      return room.processedActionIds.has(actionKey(playerId, actionId));
    }
    const suffix = `:${String(actionId)}`;
    return room.processedActionIds.has(String(actionId))
      || [...room.processedActionIds].some(key => key.endsWith(suffix));
  }

  function subscribe(roomCode, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Room subscriber must be a function');
    }
    const code = String(roomCode);
    const listeners = subscribersByRoom.get(code) || new Set();
    listeners.add(listener);
    subscribersByRoom.set(code, listeners);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      listeners.delete(listener);
      if (listeners.size === 0) subscribersByRoom.delete(code);
    };
  }

  return {
    createRoom,
    joinRoom,
    getRoom,
    resolvePlayer,
    transact,
    updateRoom,
    hasProcessedAction,
    subscribe
  };
}

module.exports = { createRoomStore };
