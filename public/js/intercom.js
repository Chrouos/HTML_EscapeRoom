const BOTTOM_THRESHOLD = 48;
const ANNOUNCEMENT_DELAY = 250;

function messageSender(message) {
  if (message.type !== 'player') return 'ORPHEUS';
  if (!message.payload || typeof message.payload !== 'object' || Array.isArray(message.payload)
    || (message.payload.role !== 'A' && message.payload.role !== 'B')) {
    throw new TypeError('Invalid player message');
  }
  return message.payload.role;
}

export function createIntercom(root) {
  const log = root.querySelector('[data-intercom-log]');
  const announcer = root.querySelector('[data-intercom-announcer]');
  if (!log || !announcer) throw new TypeError('Intercom root is incomplete');

  const renderedIds = new Set();
  const announcementQueue = [];
  let announcementTimer;
  let hydrated = false;

  function announce(sender, message) {
    announcementQueue.push(`${sender}: ${message.text}`);
    if (announcementTimer) return;
    announcementTimer = window.setTimeout(() => {
      announcer.textContent = announcementQueue.splice(0).join(' ');
      announcementTimer = undefined;
    }, ANNOUNCEMENT_DELAY);
  }

  function insert(message, shouldAnnounce) {
    if (!message || typeof message.id !== 'string' || typeof message.text !== 'string'
      || renderedIds.has(message.id)) return false;

    const followLatest = log.scrollHeight - log.scrollTop - log.clientHeight < BOTTOM_THRESHOLD;
    const senderText = messageSender(message);
    const entry = document.createElement('article');
    entry.className = message.type === 'player' ? 'message message-player' : 'message message-orpheus';
    const sender = document.createElement('span');
    sender.className = 'message-sender';
    sender.textContent = senderText;
    const body = document.createElement('p');
    body.textContent = message.text;
    entry.append(sender, body);
    log.append(entry);
    renderedIds.add(message.id);
    if (followLatest) log.scrollTop = log.scrollHeight;
    if (shouldAnnounce) announce(senderText, message);
    return true;
  }

  function append(message) {
    return insert(message, true);
  }

  function render(messages) {
    const shouldAnnounce = hydrated;
    for (const message of messages || []) insert(message, shouldAnnounce);
    hydrated = true;
  }

  return { render, append };
}
