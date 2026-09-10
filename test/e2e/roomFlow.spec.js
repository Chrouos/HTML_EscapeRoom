const { test, expect } = require('@playwright/test');

test('two browsers exchange clues, solve initialization and recover on refresh', async ({ browser }) => {
  test.setTimeout(60_000);
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  try {
    const a = await aContext.newPage();
    const b = await bContext.newPage();
    await a.goto('/');
    await a.getByRole('button', { name: '建立房間（玩家 A）' }).click();
    await expect(a).toHaveURL(/\/rooms\/\d{6}$/);
    const code = a.url().split('/').pop();
    await b.goto('/');
    await b.getByLabel('六位數房號').fill(code);
    await b.getByRole('button', { name: '加入房間（玩家 B）' }).click();
    await expect(a.locator('[data-clues]')).toContainText('ORPHEUS');
    await expect(b.locator('[data-clues]')).toContainText('17');
    await a.getByLabel('傳訊給另一位受試者').fill('我的卡片寫 ORPHEUS，你那邊呢？');
    await a.getByRole('button', { name: '傳送訊息' }).click();
    await expect(b.getByRole('log')).toContainText('我的卡片寫 ORPHEUS');
    await expect(b.getByRole('log').getByText('我的卡片寫 ORPHEUS，你那邊呢？', { exact: true })).toHaveCount(1);
    await b.getByLabel('提交答案').fill('old identity draft');
    await a.getByLabel('提交答案').fill('ORPHEUS-17');
    await a.getByRole('button', { name: '送出', exact: true }).click();
    await expect(b.locator('[data-prompt]')).toContainText('啟動');
    await expect(b.getByLabel('提交答案')).toHaveValue('');
    await b.getByLabel('提交答案').fill('AUX CORE EMERGENCY');
    await b.getByRole('button', { name: '送出', exact: true }).click();
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
    await aContext.close();
    await bContext.close();
  }
});
