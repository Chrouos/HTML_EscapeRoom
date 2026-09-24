const { test, expect } = require('@playwright/test');

function answerInput(page) {
  return page.getByLabel('SECURE RESPONSE / 解鎖密碼');
}

function answerSubmit(page) {
  return page.getByRole('button', { name: 'VERIFY RESPONSE', exact: true });
}

async function showAnswerGate(page) {
  const requestApp = page.getByRole('button', { name: 'Request', exact: true });
  await expect(requestApp).toBeEnabled();
  await requestApp.click();
  await expect(answerInput(page)).toBeVisible();
  await expect(answerSubmit(page)).toBeEnabled();
}

async function openAnswerGate(page, puzzleId, actionId) {
  const result = await page.evaluate(async ({ puzzleId, actionId }) => {
    const roomCode = document.querySelector('[data-game-room]').dataset.gameRoom;
    const response = await fetch(`/api/rooms/${roomCode}/actions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId, operationId: 'open_entry', value: `answer.${puzzleId}` })
    });
    return { status: response.status, body: await response.json() };
  }, { puzzleId, actionId });
  expect(result.status).toBe(200);
  expect(result.body.success).toBe(true);
  await showAnswerGate(page);
}

test('two browsers exchange clues, solve initialization and recover on refresh', async ({ browser }) => {
  test.setTimeout(45_000);
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  try {
    const a = await aContext.newPage();
    const b = await bContext.newPage();
    await a.goto('/');
    await a.getByRole('button', { name: '建立房間（玩家 A）' }).click();
    await expect(a).toHaveURL(/\/rooms\/\d{6}$/);
    const roomUrl = a.url();
    const code = roomUrl.split('/').pop();
    await b.goto('/');
    await b.getByLabel('六位數房號').fill(code);
    await b.getByRole('button', { name: '加入房間（玩家 B）' }).click();
    await a.goto(roomUrl);
    await expect(a.locator('[data-intercom-log]')).toContainText('ORPHEUS');
    await expect(b.locator('[data-intercom-log]')).toContainText('ORPHEUS');
    await a.getByLabel('傳訊給另一位受試者').fill('我的卡片寫 ORPHEUS，你那邊呢？');
    await a.getByRole('button', { name: '傳送訊息' }).click();
    await expect(b.getByRole('log')).toContainText('我的卡片寫 ORPHEUS');
    await expect(b.getByRole('log').getByText('我的卡片寫 ORPHEUS，你那邊呢？', { exact: true })).toHaveCount(1);

    await openAnswerGate(a, 'main1', 'room-flow-open-a-main1');
    await openAnswerGate(b, 'main1', 'room-flow-open-b-main1');
    await showAnswerGate(b);
    await answerInput(b).fill('old identity draft');
    await showAnswerGate(a);
    await answerInput(a).fill('ORPHEUS-17');
    await answerSubmit(a).click();
    await expect(b.locator('[data-prompt]')).toContainText('啟動');
    await showAnswerGate(b);
    await expect(answerInput(b)).toHaveValue('');
    await answerInput(b).fill('AUX CORE EMERGENCY');
    await answerSubmit(b).click();
    await expect(b.getByRole('log')).toContainText('電力');
    await a.reload();
    await expect(a.getByRole('log')).toContainText('電力');
    await expect(a.locator('[data-game-room]')).toBeVisible();
    await expect(a.locator('audio')).toBeVisible();
    await expect(b.locator('audio')).toHaveCount(0);
    const recording = await aContext.request.get('/public/audio/emergency-morse.wav');
    expect(recording.ok()).toBeTruthy();
    expect((await recording.body()).subarray(0, 4).toString()).toBe('RIFF');
  } finally {
    await aContext.close().catch(() => {});
    await bContext.close().catch(() => {});
  }
});

test('responsive console panes preserve chat draft and restore both monitors after resize', async ({ browser }) => {
  const aContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const bContext = await browser.newContext();
  try {
    const page = await aContext.newPage();
    const b = await bContext.newPage();
    await page.goto('/');
    await page.locator('form[action="/rooms"] button').click();
    await expect(page).toHaveURL(/\/rooms\/\d{6}$/);
    const roomUrl = page.url();
    await b.goto(roomUrl);
    await b.locator('form[action="/rooms/join"] button').click();
    await page.goto(roomUrl);
    await expect(page.locator('[data-game-room]')).toBeVisible();

    const draft = 'draft survives a pane switch';
    const chat = page.locator('[data-chat-form] input[name="text"]');
    await chat.fill(draft);
    await chat.focus();
    await page.getByText('Operations', { exact: true }).click();
    await expect(page.locator('#monitor-operations')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.intercom-monitor')).toHaveAttribute('aria-hidden', 'true');
    await expect(chat).toHaveValue(draft);

    await page.getByText('Intercom', { exact: true }).click();
    await expect(page.locator('#monitor-intercom')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.operations-monitor')).toHaveAttribute('aria-hidden', 'true');
    await expect(chat).toHaveValue(draft);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('.intercom-monitor')).toBeVisible();
    await expect(page.locator('.operations-monitor')).toBeVisible();
    await expect(chat).toHaveValue(draft);
  } finally {
    await aContext.close().catch(() => {});
    await bContext.close().catch(() => {});
  }
});
