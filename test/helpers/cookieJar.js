function decodeCookieValue(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
    this.lastSetCookies = [];
  }

  capture(response) {
    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);
    this.lastSetCookies = [...setCookies];
    response.lastSetCookies = [...setCookies];

    for (const setCookie of setCookies) {
      const separator = setCookie.indexOf(';');
      const pair = separator === -1 ? setCookie : setCookie.slice(0, separator);
      const equals = pair.indexOf('=');
      if (equals <= 0) {
        continue;
      }

      const name = pair.slice(0, equals).trim();
      const value = pair.slice(equals + 1).trim();
      if (value === '') {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, decodeCookieValue(value));
      }
    }
    return response;
  }

  set(name, value) {
    this.cookies.set(name, value);
    return this;
  }

  header() {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
      .join('; ');
  }

  async fetch(url, options = {}) {
    const headers = new Headers(options.headers);
    if (this.cookies.size > 0 && !headers.has('cookie')) {
      headers.set('cookie', this.header());
    }

    const response = await fetch(url, {
      ...options,
      headers,
      redirect: options.redirect || 'manual'
    });
    return this.capture(response);
  }
}

module.exports = { CookieJar };
