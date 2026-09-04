const { randomBytes, randomInt } = require('node:crypto');

const { createRoomState } = require('./createRoomState');
const { RoomError, roomErrors } = require('./roomErrors');

const COUNTDOWN_MS = 45 * 60 * 1000;
const DEFAULT_ROOM_TTL_MS = 6 * 60 * 60 * 1000;

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
  const now = options.now || (() => Date.now());
  const roomTtlMs = options.roomTtlMs ?? DEFAULT_ROOM_TTL_MS;
  const generateRoomCode = options.generateRoomCode || (() => (
    String(randomInt(0, 1000000)).padStart(6, '0')
  ));
  const generateToken = options.generateToken || (() => (
    randomBytes(32).toString('base64url')
  ));

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
    const room = rooms.get(String(roomCode));
    if (!room) {
      throw new RoomError(roomErrors.ROOM_NOT_FOUND, 'Room not found');
    }
    if (currentTime - room.createdAt >= roomTtlMs) {
      throw new RoomError(roomErrors.ROOM_EXPIRED, 'Room has expired');
    }
    return room;
  }

  function createRoom() {
    const roomCode = generateUniqueValue(generateRoomCode, rooms);
    const token = generateUniqueValue(generateToken, playersByToken);

    const currentTime = now();
    const room = createRoomState(roomCode, currentTime);
    room.players.A = { token };
    rooms.set(roomCode, room);
    playersByToken.set(token, { roomCode, role: 'A' });

    return { room: roomView(room, currentTime), player: { role: 'A', token } };
  }

  function joinRoom(roomCode) {
    const currentTime = now();
    const room = getActiveRoom(roomCode, currentTime);
    if (room.players.B) {
      throw new RoomError(roomErrors.ROOM_FULL, 'Room is full');
    }

    const token = generateUniqueValue(generateToken, playersByToken);

    room.players.B = { token };
    room.countdownStartedAt = currentTime;
    room.revision += 1;
    playersByToken.set(token, { roomCode: room.roomCode, role: 'B' });

    return { room: roomView(room, currentTime), player: { role: 'B', token } };
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
    return { role: player.role, room: roomView(room, currentTime) };
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

    const draft = structuredClone(room);
    updater(draft);
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
