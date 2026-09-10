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
    liveSocket.send(JSON.stringify({ type: 'snapshot_required', reason: 'test_setup' }));
    await expect(a.locator('[data-clues]')).toContainText('ORPHEUS');
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
