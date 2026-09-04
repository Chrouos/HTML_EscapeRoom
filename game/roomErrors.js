const roomErrors = Object.freeze({
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_EXPIRED: 'ROOM_EXPIRED',
  ROOM_FULL: 'ROOM_FULL',
  INVALID_TOKEN: 'INVALID_TOKEN'
});

class RoomError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'RoomError';
    this.code = code;
  }
}

module.exports = {
  RoomError,
  roomErrors,
  ...roomErrors
};
