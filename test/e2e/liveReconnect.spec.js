const { test, expect } = require('@playwright/test');

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
    await b.goto(a.url());
    await b.getByRole('button', { name: '加入房間（玩家 B）' }).click();
    await expect.poll(() => Boolean(liveSocket)).toBe(true);
    liveSocket.send(JSON.stringify({ type: 'snapshot_required', reason: 'test_setup' }));
    await expect.poll(() => Boolean(latestSnapshot?.state?.workstation?.text)).toBe(true);
    const readsBeforeMalformed = snapshotReads;

    liveSocket.send('{');
    await expect.poll(() => snapshotReads - readsBeforeMalformed).toBe(1);
    liveSocket.send('null');
    await expect.poll(() => snapshotReads - readsBeforeMalformed).toBe(2);
    liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 1,
      event: { eventId: 'bad-state', kind: 'state', payload: { state: null, events: [] } } }));
    await expect.poll(() => snapshotReads - readsBeforeMalformed).toBe(3);
    liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 1, event: null }));
    await expect.poll(() => snapshotReads - readsBeforeMalformed).toBe(4);
    await expect(a.getByRole('log')).not.toContainText('BAD FRAME');

    liveSocket.send('{');
    liveSocket.send('null');
    liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor + 1,
      event: { eventId: 'bad-state-burst', kind: 'state', payload: { state: null, events: [] } } }));
    await expect.poll(() => snapshotReads - readsBeforeMalformed).toBe(5);

    liveSocket.send(JSON.stringify({ type: 'event', cursor: latestSnapshot.cursor,
      event: { eventId: 'duplicate-cursor', kind: 'state',
        payload: { state: latestSnapshot.state, events: [] } } }));
    await expect.poll(() => snapshotReads - readsBeforeMalformed).toBe(6);

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
