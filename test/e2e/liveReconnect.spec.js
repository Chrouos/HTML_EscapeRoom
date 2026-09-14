const { test, expect } = require('@playwright/test');

async function openPairedRoom(aContext, bContext) {
  const a = await aContext.newPage();
  const b = await bContext.newPage();
  await a.goto('/');
  await a.locator('form[action="/rooms"] button').click();
  await expect(a).toHaveURL(/\/rooms\/\d{6}$/);
  await b.goto(a.url());
  await b.locator('form[action="/rooms/join"] button').click();
  await expect(a.locator('[data-clues]')).toContainText('ORPHEUS');
  return { a, b };
}

test('a lost socket falls back to cursor polling and reconnects without duplicate messages', async ({ browser }) => {
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  let socketsAllowed = true;
  const browserSockets = new Set();
  const stateRequests = [];

  await aContext.routeWebSocket(/\/live\?roomCode=/, socket => {
    browserSockets.add(socket);
    if (!socketsAllowed) {
      socket.close();
      return;
    }
    socket.connectToServer();
  });
  await aContext.route('**/api/rooms/*/state*', async route => {
    stateRequests.push(route.request().url());
    await route.continue();
  });

  try {
    const a = await aContext.newPage();
    const b = await bContext.newPage();
    await a.goto('/');
    await a.getByRole('button', { name: '建立房間（玩家 A）' }).click();
    await expect(a).toHaveURL(/\/rooms\/\d{6}$/);
    await b.goto(a.url());
    await b.getByRole('button', { name: '加入房間（玩家 B）' }).click();
    await expect(a.locator('[data-clues]')).toContainText('ORPHEUS');
    await expect.poll(() => browserSockets.size).toBeGreaterThan(0);

    socketsAllowed = false;
    for (const socket of browserSockets) socket.close();
    await expect(a.locator('[data-connection]')).toHaveText('SIGNAL LOST');

    await b.getByLabel('傳訊給另一位受試者').fill('備援通道訊息');
    await b.getByRole('button', { name: '傳送訊息' }).click();
    await expect(a.getByRole('log').getByText('備援通道訊息', { exact: true })).toHaveCount(1);
    await expect.poll(() => stateRequests.some(url => /[?&]sinceCursor=\d+/.test(url))).toBe(true);

    socketsAllowed = true;
    await expect(a.locator('[data-connection]')).not.toHaveText('SIGNAL LOST', { timeout: 15_000 });
    await b.getByLabel('傳訊給另一位受試者').fill('恢復後訊息');
    await b.getByRole('button', { name: '傳送訊息' }).click();
    await expect(a.getByRole('log').getByText('恢復後訊息', { exact: true })).toHaveCount(1);
    await expect(a.getByRole('log').getByText('備援通道訊息', { exact: true })).toHaveCount(1);
  } finally {
    await aContext.close();
    await bContext.close();
  }
});

test('a cursor gap performs one snapshot resync and resumes at the adopted cursor', async ({ browser }) => {
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  let liveSocket;
  let latestSnapshot;
  let snapshotReads = 0;

  await aContext.route('**/api/rooms/*/state*', async route => {
    const response = await route.fetch();
    latestSnapshot = await response.json();
    if (!route.request().url().includes('sinceCursor=')) snapshotReads += 1;
    await route.fulfill({ response });
  });
  await aContext.routeWebSocket(/\/live\?roomCode=/, socket => {
    liveSocket = socket;
    socket.onMessage(() => {});
  });

  try {
    const a = await aContext.newPage();
    const b = await bContext.newPage();
    await a.goto('/');
    await a.getByRole('button', { name: '建立房間（玩家 A）' }).click();
    await expect(a).toHaveURL(/\/rooms\/\d{6}$/);
    await b.goto(a.url());
    await b.getByRole('button', { name: '加入房間（玩家 B）' }).click();
    await expect.poll(() => Boolean(liveSocket)).toBe(true);
    const setupReads = snapshotReads;
    liveSocket.send(JSON.stringify({ type: 'snapshot_required', reason: 'test_setup' }));
    await expect.poll(() => snapshotReads - setupReads).toBe(1);
    expect(latestSnapshot.state).toBeTruthy();
    const readsBeforeGap = snapshotReads;

    await b.getByLabel('傳訊給另一位受試者').fill('跳號後只顯示一次');
    await b.getByRole('button', { name: '傳送訊息' }).click();
    liveSocket.send(JSON.stringify({
      type: 'event',
      cursor: latestSnapshot.cursor + 2,
      event: { eventId: 'forced-gap', kind: 'state', payload: { state: latestSnapshot.state, events: [] } }
    }));
    await expect(a.getByRole('log').getByText('跳號後只顯示一次', { exact: true })).toHaveCount(1);
    await expect.poll(() => snapshotReads - readsBeforeGap).toBe(1);

    const continuedState = structuredClone(latestSnapshot.state);
    continuedState.intercom.push({ id: 'continued-live-event', type: 'story', text: '續接後仍可收到' });
    liveSocket.send(JSON.stringify({
      type: 'event',
      cursor: latestSnapshot.cursor + 1,
      event: { eventId: 'continued-live-event', kind: 'state', payload: { state: continuedState, events: [] } }
    }));
    await expect(a.getByRole('log').getByText('續接後仍可收到', { exact: true })).toHaveCount(1);
    await expect(a.getByRole('log').getByText('跳號後只顯示一次', { exact: true })).toHaveCount(1);
  } finally {
    await aContext.close();
    await bContext.close();
  }
});

test('malformed and duplicate frames share one resync and never reach the renderer', async ({ browser }) => {
  test.setTimeout(90_000);
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  let liveSocket;
  let latestSnapshot;
  let snapshotReads = 0;
  let snapshotResponses = 0;

  await aContext.route('**/api/rooms/*/state*', async route => {
    const response = await route.fetch();
    latestSnapshot = await response.json();
    if (!route.request().url().includes('sinceCursor=')) snapshotReads += 1;
    await route.fulfill({ response });
    if (!route.request().url().includes('sinceCursor=')) snapshotResponses += 1;
  });
  await aContext.routeWebSocket(/\/live\?roomCode=/, socket => {
    liveSocket = socket;
    socket.onMessage(() => {});
  });

  try {
    const a = await aContext.newPage();
    const b = await bContext.newPage();
    await a.goto('/');
    await a.getByRole('button', { name: '建立房間（玩家 A）' }).click();
    await b.goto(a.url());
    await b.getByRole('button', { name: '加入房間（玩家 B）' }).click();
    await expect.poll(() => Boolean(liveSocket)).toBe(true);
    const setupResponses = snapshotResponses;
    liveSocket.send(JSON.stringify({ type: 'snapshot_required', reason: 'test_setup' }));
    await expect.poll(() => snapshotResponses - setupResponses).toBe(1);
    expect(latestSnapshot.state.workstation.text).toBeTruthy();
    const readsBeforeMalformed = snapshotReads;
    const responsesBeforeMalformed = snapshotResponses;

    liveSocket.send('{');
    await expect.poll(() => snapshotResponses - responsesBeforeMalformed,
      { timeout: 15_000 }).toBe(1);
    liveSocket.send('null');
    await expect.poll(() => snapshotResponses - responsesBeforeMalformed,
      { timeout: 15_000 }).toBe(2);
    liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 1,
      event: { eventId: 'bad-state', kind: 'state', payload: { state: null, events: [] } } }));
    await expect.poll(() => snapshotResponses - responsesBeforeMalformed,
      { timeout: 15_000 }).toBe(3);
    liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 1, event: null }));
    await expect.poll(() => snapshotResponses - responsesBeforeMalformed,
      { timeout: 15_000 }).toBe(4);
    await expect(a.getByRole('log')).not.toContainText('BAD FRAME');

    liveSocket.send('{');
    liveSocket.send('null');
    liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 1,
      event: { eventId: 'bad-state-burst', kind: 'state', payload: { state: null, events: [] } } }));
    await expect.poll(() => snapshotReads - readsBeforeMalformed).toBe(5);
    await expect.poll(() => snapshotResponses - responsesBeforeMalformed,
      { timeout: 15_000 }).toBe(5);

    liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor,
      event: { eventId: 'duplicate-cursor', kind: 'state',
        payload: { state: latestSnapshot.state, events: [] } } }));
    await expect.poll(() => snapshotResponses - responsesBeforeMalformed,
      { timeout: 15_000 }).toBe(6);

    const continuedState = structuredClone(latestSnapshot.state);
    continuedState.intercom.push({ id: 'after-malformed', type: 'story', text: '壞資料後仍可續接' });
    liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 1,
      event: { eventId: 'after-malformed', kind: 'state',
        payload: { state: continuedState, events: [] } } }));
    await expect(a.getByRole('log').getByText('壞資料後仍可續接', { exact: true })).toHaveCount(1);
  } finally {
    await aContext.close();
    await bContext.close();
  }
});

test('invalid nested state entries resync once without an uncaught renderer error', async ({ browser }) => {
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  let liveSocket;
  let latestSnapshot;
  let snapshotReads = 0;
  let snapshotResponses = 0;
  const pageErrors = [];

  await aContext.route('**/api/rooms/*/state*', async route => {
    const response = await route.fetch();
    latestSnapshot = await response.json();
    if (!route.request().url().includes('sinceCursor=')) snapshotReads += 1;
    await route.fulfill({ response });
    if (!route.request().url().includes('sinceCursor=')) snapshotResponses += 1;
  });
  await aContext.routeWebSocket(/\/live\?roomCode=/, socket => {
    liveSocket = socket;
    socket.onMessage(() => {});
  });

  try {
    const a = await aContext.newPage();
    const b = await bContext.newPage();
    a.on('pageerror', error => pageErrors.push(error));
    await a.goto('/');
    await a.getByRole('button', { name: '建立房間（玩家 A）' }).click();
    await b.goto(a.url());
    await b.getByRole('button', { name: '加入房間（玩家 B）' }).click();
    await expect.poll(() => Boolean(liveSocket)).toBe(true);
    const setupResponses = snapshotResponses;
    liveSocket.send(JSON.stringify({ type: 'snapshot_required', reason: 'test_setup' }));
    await expect.poll(() => snapshotResponses - setupResponses).toBe(1);
    expect(latestSnapshot.state).toBeTruthy();
    const readsBeforeMalformed = snapshotReads;
    const responsesBeforeMalformed = snapshotResponses;

    const invalidStates = [
      { ...structuredClone(latestSnapshot.state), intercom: [null] },
      { ...structuredClone(latestSnapshot.state), discoveredEvidence: [null] },
      { ...structuredClone(latestSnapshot.state), publicProgress: {
        ...structuredClone(latestSnapshot.state.publicProgress), sidePuzzles: [null]
      } }
    ];
    for (const [index, state] of invalidStates.entries()) {
      liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 1,
        event: { eventId: `bad-nested-${index}`, kind: 'state', payload: { state, events: [] } } }));
    }

    await expect.poll(() => snapshotReads - readsBeforeMalformed).toBe(1);
    await expect.poll(() => snapshotResponses - responsesBeforeMalformed).toBe(1);
    expect(pageErrors).toHaveLength(0);

    const recoveredState = structuredClone(latestSnapshot.state);
    recoveredState.intercom.push({ id: 'nested-recovery', type: 'story', text: '巢狀資料錯誤後已恢復' });
    liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 1,
      event: { eventId: 'nested-recovery', kind: 'state',
        payload: { state: recoveredState, events: [] } } }));
    await expect(a.getByRole('log').getByText('巢狀資料錯誤後已恢復', { exact: true })).toHaveCount(1);
    expect(pageErrors).toHaveLength(0);
  } finally {
    await aContext.close();
    await bContext.close();
  }
});

test('canonical messages may omit type while invalid present types resync', async ({ browser }) => {
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  let liveSocket;
  let latestSnapshot;
  let snapshotReads = 0;
  let snapshotResponses = 0;
  const pageErrors = [];

  await aContext.route('**/api/rooms/*/state*', async route => {
    const response = await route.fetch();
    latestSnapshot = await response.json();
    if (!route.request().url().includes('sinceCursor=')) snapshotReads += 1;
    await route.fulfill({ response });
    if (!route.request().url().includes('sinceCursor=')) snapshotResponses += 1;
  });
  await aContext.routeWebSocket(/\/live\?roomCode=/, socket => {
    liveSocket = socket;
    socket.onMessage(() => {});
  });

  try {
    const a = await aContext.newPage();
    const b = await bContext.newPage();
    a.on('pageerror', error => pageErrors.push(error));
    await a.goto('/');
    await a.getByRole('button', { name: '建立房間（玩家 A）' }).click();
    await b.goto(a.url());
    await b.getByRole('button', { name: '加入房間（玩家 B）' }).click();
    await expect.poll(() => Boolean(liveSocket)).toBe(true);
    const setupResponses = snapshotResponses;
    liveSocket.send(JSON.stringify({ type: 'snapshot_required', reason: 'test_setup' }));
    await expect.poll(() => snapshotResponses - setupResponses).toBe(1);
    const readsBeforeMessage = snapshotReads;

    const canonicalState = structuredClone(latestSnapshot.state);
    canonicalState.intercom.push({ id: 'canonical-no-type', text: '沒有類型也能顯示' });
    liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 1,
      event: { eventId: 'canonical-no-type', kind: 'state',
        payload: { state: canonicalState, events: [] } } }));
    await expect(a.getByRole('log').getByText('沒有類型也能顯示', { exact: true })).toHaveCount(1);
    expect(snapshotReads).toBe(readsBeforeMessage);

    const invalidNull = structuredClone(latestSnapshot.state);
    invalidNull.intercom.push({ id: 'bad-null-type', text: '不應顯示 null type', type: null });
    const invalidNumber = structuredClone(latestSnapshot.state);
    invalidNumber.intercom.push({ id: 'bad-number-type', text: '不應顯示 number type', type: 7 });
    const invalidPlayerMissingPayload = structuredClone(latestSnapshot.state);
    invalidPlayerMissingPayload.intercom.push({
      id: 'bad-player-missing-payload', text: 'invalid missing player payload', type: 'player'
    });
    const invalidPlayerRole = structuredClone(latestSnapshot.state);
    invalidPlayerRole.intercom.push({
      id: 'bad-player-role', text: 'invalid player role', type: 'player', payload: { role: 'C' }
    });
    liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 2,
      event: { eventId: 'invalid-player-missing-payload', kind: 'state',
        payload: { state: invalidPlayerMissingPayload, events: [] } } }));
    await expect.poll(() => snapshotReads - readsBeforeMessage).toBe(1);
    await expect(a.getByRole('log')).not.toContainText('invalid missing player payload');

    liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 1,
      event: { eventId: 'invalid-player-role', kind: 'state',
        payload: { state: invalidPlayerRole, events: [] } } }));
    await expect.poll(() => snapshotReads - readsBeforeMessage).toBe(2);

    for (const [index, state] of [invalidNull, invalidNumber].entries()) {
      liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 1,
        event: { eventId: `invalid-type-${index}`, kind: 'state', payload: { state, events: [] } } }));
    }
    await expect.poll(() => snapshotReads - readsBeforeMessage).toBe(3);
    await expect(a.getByRole('log')).not.toContainText('不應顯示');
    await expect(a.getByRole('log')).not.toContainText('invalid player');
    expect(pageErrors).toHaveLength(0);
  } finally {
    await aContext.close();
    await bContext.close();
  }
});

test('a failed snapshot discards the stale socket and reconnects with polling active', async ({ browser }) => {
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  const liveSockets = [];
  const stateRequests = [];
  let latestSnapshot;
  let failNextSnapshot = false;

  await aContext.route('**/api/rooms/*/state*', async route => {
    const url = route.request().url();
    stateRequests.push(url);
    if (failNextSnapshot && !url.includes('sinceCursor=')) {
      failNextSnapshot = false;
      await route.fulfill({ status: 503, contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'temporary failure' }) });
      return;
    }
    const response = await route.fetch();
    latestSnapshot = await response.json();
    await route.fulfill({ response });
  });
  await aContext.routeWebSocket(/\/live\?roomCode=/, socket => {
    liveSockets.push(socket);
    socket.onMessage(() => {});
  });

  try {
    const a = await aContext.newPage();
    const b = await bContext.newPage();
    await a.goto('/');
    await a.getByRole('button', { name: '建立房間（玩家 A）' }).click();
    await b.goto(a.url());
    await b.getByRole('button', { name: '加入房間（玩家 B）' }).click();
    await expect.poll(() => liveSockets.length).toBe(1);
    liveSockets[0].send(JSON.stringify({ type: 'snapshot_required', reason: 'test_setup' }));
    await expect.poll(() => Boolean(latestSnapshot?.state?.workstation?.text)).toBe(true);

    failNextSnapshot = true;
    liveSockets[0].send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 2,
      event: { eventId: 'failed-resync-gap', kind: 'state',
        payload: { state: latestSnapshot.state, events: [] } } }));
    await expect(a.locator('[data-connection]')).toHaveText('SIGNAL LOST');
    await expect.poll(() => stateRequests.some(url => url.includes('sinceCursor='))).toBe(true);
    await expect.poll(() => liveSockets.length, { timeout: 15_000 }).toBeGreaterThan(1);
    await expect(a.locator('[data-connection]')).not.toHaveText('SIGNAL LOST');
  } finally {
    await aContext.close();
    await bContext.close();
  }
});

test('socket close during resync never overlaps the snapshot with polling', async ({ browser }) => {
  test.setTimeout(60_000);
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  let liveSocket;
  const liveSockets = [];
  let latestSnapshot;
  let holdSnapshot = false;
  let releaseSnapshot;
  let snapshotStarted;
  let activeRequests = 0;
  let maxActiveRequests = 0;

  await aContext.route('**/api/rooms/*/state*', async route => {
    activeRequests += 1;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    try {
      if (holdSnapshot && !route.request().url().includes('sinceCursor=')) {
        snapshotStarted();
        await new Promise(resolve => { releaseSnapshot = resolve; });
      }
      const response = await route.fetch();
      latestSnapshot = await response.json();
      await route.fulfill({ response });
    } finally {
      activeRequests -= 1;
    }
  });
  await aContext.routeWebSocket(/\/live\?roomCode=/, socket => {
    liveSocket = socket;
    liveSockets.push(socket);
    socket.onMessage(() => {});
  });

  try {
    const a = await aContext.newPage();
    const b = await bContext.newPage();
    await a.goto('/');
    await a.getByRole('button', { name: '建立房間（玩家 A）' }).click();
    await b.goto(a.url());
    await b.getByRole('button', { name: '加入房間（玩家 B）' }).click();
    await expect.poll(() => Boolean(liveSocket)).toBe(true);
    liveSocket.send(JSON.stringify({ type: 'snapshot_required', reason: 'test_setup' }));
    await expect.poll(() => Boolean(latestSnapshot?.state?.workstation?.text)).toBe(true);

    let markSnapshotStarted;
    const started = new Promise(resolve => { markSnapshotStarted = resolve; });
    snapshotStarted = markSnapshotStarted;
    holdSnapshot = true;
    liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 2,
      event: { eventId: 'resync-close-race', kind: 'state',
        payload: { state: latestSnapshot.state, events: [] } } }));
    await started;
    liveSocket.close();
    await expect.poll(() => liveSockets.length, { timeout: 15_000 }).toBeGreaterThan(1);
    expect(maxActiveRequests).toBe(1);
    await expect(a.locator('[data-connection]')).toHaveText('SIGNAL LOST');
    releaseSnapshot();
    await expect(a.locator('[data-connection]')).not.toHaveText('SIGNAL LOST');
  } finally {
    releaseSnapshot?.();
    await aContext.close();
    await bContext.close();
  }
});

test('direct adopt rejects an unchanged response that carries a malformed player state', async ({ browser }) => {
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  let snapshotReads = 0;

  await aContext.route('**/api/rooms/*/state*', async route => {
    if (!route.request().url().includes('sinceCursor=')) snapshotReads += 1;
    await route.continue();
  });
  await aContext.route('**/api/rooms/*/chat', async route => {
    const response = await route.fetch();
    const result = await response.json();
    result.unchanged = true;
    result.state.intercom.push({
      id: 'malformed-adopt-player', type: 'player', text: 'MALFORMED ADOPT'
    });
    await route.fulfill({ response, json: result });
  });

  try {
    const { a } = await openPairedRoom(aContext, bContext);
    const readsBeforeAdopt = snapshotReads;
    await a.locator('[data-chat-form] input[name="text"]').fill('adopt validation');
    await a.locator('[data-chat-form] button').click();

    await expect.poll(() => snapshotReads - readsBeforeAdopt).toBe(1);
    await expect(a.getByRole('log')).not.toContainText('MALFORMED ADOPT');
  } finally {
    await aContext.close();
    await bContext.close();
  }
});

test('polling rejects an unchanged response that carries a malformed player state', async ({ browser }) => {
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  let liveSocket;
  let injectMalformedPoll = false;
  let latestState;
  let latestCursor = 0;
  let pollingReads = 0;
  let snapshotReads = 0;

  await aContext.routeWebSocket(/\/live\?roomCode=/, socket => {
    liveSocket = socket;
    socket.connectToServer();
  });
  await aContext.route('**/api/rooms/*/state*', async route => {
    const isPoll = route.request().url().includes('sinceCursor=');
    if (isPoll && injectMalformedPoll) {
      injectMalformedPoll = false;
      pollingReads += 1;
      const state = structuredClone(latestState);
      state.intercom.push({
        id: 'malformed-poll-player', type: 'player', text: 'MALFORMED POLL', payload: { role: 'C' }
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true,
        unchanged: true,
        cursor: latestCursor + 1,
        state,
        countdown: { status: 'running', remainingMs: 1000 }
      }) });
      return;
    }

    const response = await route.fetch();
    const result = await response.json();
    if (isPoll) {
      pollingReads += 1;
    } else {
      snapshotReads += 1;
      if (result.state) latestState = result.state;
      latestCursor = result.cursor;
    }
    await route.fulfill({ response });
  });

  try {
    const { a } = await openPairedRoom(aContext, bContext);
    await expect.poll(() => Boolean(liveSocket && latestState)).toBe(true);
    const snapshotsBeforePoll = snapshotReads;
    injectMalformedPoll = true;
    liveSocket.close();

    await expect.poll(() => pollingReads).toBeGreaterThan(0);
    await expect.poll(() => snapshotReads - snapshotsBeforePoll).toBe(1);
    await expect(a.getByRole('log')).not.toContainText('MALFORMED POLL');
  } finally {
    await aContext.close();
    await bContext.close();
  }
});

test('native polling fetch rejection keeps backoff and does not start snapshot resync', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const realFetch = window.fetch;
    const realWebSocket = window.WebSocket;
    const pollingTimes = [];
    let snapshotReads = 0;
    let socketCount = 0;
    let firstSocket;
    let transport;

    class ControlledSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor() {
        super();
        socketCount += 1;
        this.readyState = socketCount === 1 ? ControlledSocket.OPEN : ControlledSocket.CONNECTING;
        if (socketCount === 1) {
          firstSocket = this;
          window.setTimeout(() => this.dispatchEvent(new Event('open')), 0);
        }
      }

      send() {}

      close() {
        this.readyState = ControlledSocket.CLOSED;
        this.dispatchEvent(new Event('close'));
      }
    }

    const state = {
      occupancy: { ready: true },
      publicProgress: { puzzleId: 'fixture', stepId: 'fixture', sidePuzzles: [] },
      intercom: [],
      workstation: {},
      privateMissions: [],
      discoveredEvidence: [],
      ending: null
    };

    window.WebSocket = ControlledSocket;
    window.fetch = async url => {
      if (String(url).includes('sinceCursor=')) {
        pollingTimes.push(performance.now());
        throw new TypeError('Failed to fetch');
      }
      snapshotReads += 1;
      return new Response(JSON.stringify({
        success: true,
        unchanged: false,
        cursor: 1,
        state,
        countdown: { status: 'running', remainingMs: 1000 }
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    try {
      const { createLiveTransport } = await import('/public/js/live.js');
      transport = createLiveTransport({
        roomCode: '123456',
        onSnapshot() {},
        onCountdown() {},
        onStatus() {}
      });
      await transport.start();
      await new Promise(resolve => window.setTimeout(resolve, 20));
      firstSocket.close();
      await new Promise(resolve => window.setTimeout(resolve, 3200));
      return {
        snapshotReads,
        pollingCount: pollingTimes.length,
        firstBackoffMs: pollingTimes[1] - pollingTimes[0]
      };
    } finally {
      transport?.stop();
      window.fetch = realFetch;
      window.WebSocket = realWebSocket;
    }
  });

  expect(result.snapshotReads).toBe(1);
  expect(result.pollingCount).toBe(2);
  expect(result.firstBackoffMs).toBeGreaterThanOrEqual(2000);
});
