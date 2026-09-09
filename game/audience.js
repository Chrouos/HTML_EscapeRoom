const SUPPORTED_ROLES = new Set(['host', 'guest']);

function hasExactKeys(value, keys) {
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index]);
}

function validateAudience(audience) {
  if (!audience || typeof audience !== 'object' || Array.isArray(audience)) {
    throw new TypeError('Audience must be an object');
  }

  if (audience.kind === 'both' && hasExactKeys(audience, ['kind'])) {
    return audience;
  }

  if (audience.kind === 'role'
    && hasExactKeys(audience, ['kind', 'role'])
    && SUPPORTED_ROLES.has(audience.role)) {
    return audience;
  }

  if (audience.kind === 'player'
    && hasExactKeys(audience, ['kind', 'playerId'])
    && typeof audience.playerId === 'string'
    && audience.playerId.trim() !== '') {
    return audience;
  }

  throw new TypeError('Invalid audience');
}

function resolveRecipients(room, audience) {
  validateAudience(audience);

  const players = room.players;
  if (audience.kind === 'both') {
    return ['A', 'B'].filter(role => players[role] !== null);
  }

  if (audience.kind === 'role') {
    const role = audience.role === 'host' ? 'A' : 'B';
    return players[role] === null ? [] : [role];
  }

  return ['A', 'B'].filter(role => (
    players[role] !== null && players[role].playerId === audience.playerId
  ));
}

module.exports = { validateAudience, resolveRecipients };
