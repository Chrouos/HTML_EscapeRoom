function roomTokenCookieName(roomCode) {
  return `room_token_${String(roomCode)}`;
}

function parseCookieHeader(header) {
  const cookies = {};
  if (typeof header !== 'string' || header.trim() === '') {
    return cookies;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    const encodedValue = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(encodedValue);
    } catch {
      cookies[name] = encodedValue;
    }
  }
  return cookies;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(String(value))}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (options.secure === true) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

module.exports = {
  parseCookieHeader,
  roomTokenCookieName,
  serializeCookie
};
