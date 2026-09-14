const BOTTOM_THRESHOLD = 48;
const ANNOUNCEMENT_DELAY = 250;

function messageSender(message) {
  if (message.type !== 'player') return 'ORPHEUS';
  return message.payload?.role === 'B' ? 'B' : 'A';
}

export function createIntercom(root) {
  const log = root.querySelector('[data-intercom-log]');
  const announcer = root.querySelector('[data-intercom-announcer]');
  if (!log || !announcer) throw new TypeError('Intercom root is incomplete');

  const renderedIds = new Set();
  const announcementQueue = [];
  let announcementTimer;

  function announce(sender, message) {
    announcementQueue.push(`${sender}: ${message.text}`);
    if (announcementTimer) return;
    announcementTimer = window.setTimeout(() => {
      announcer.textContent = announcementQueue.splice(0).join(' ');
      announcementTimer = undefined;
    }, ANNOUNCEMENT_DELAY);
  }

  function append(message) {
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
    announce(senderText, message);
    return true;
  }

  function render(messages) {
    for (const message of messages || []) append(message);
  }

  return { render, append };
}
