const { test, expect } = require('@playwright/test');

for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
  test(`${name}: usable layout, keyboard and reduced motion`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const other = await browser.newContext();
    try {
      const page = await context.newPage();
      const partner = await other.newPage();
      await page.goto('/');
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('lobby.png'), fullPage: true });
      const create = page.getByRole('button', { name: '建立房間（玩家 A）' });
      await create.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/rooms\/\d{6}$/);
      await partner.goto(page.url());
      await partner.getByRole('button', { name: '加入房間（玩家 B）' }).click();
      await expect(page.locator('[data-clues]')).toContainText('ORPHEUS');
      for (const name of ['設施通訊', '你的線索', '證據檔案', '異常紀錄']) {
        await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
      }
      const input = page.getByLabel('提交答案', { exact: true });
      await input.focus();
      expect(await input.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
      await input.fill('ORPHEUS-17');
      await input.press('Enter');
      await expect(page.locator('[data-game-room]')).toHaveAttribute('data-step', 'main1:startup');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('game.png'), fullPage: true });
      await page.locator('[data-game-room]').evaluate(node => node.classList.add('emergency'));
      expect(await page.locator('[data-countdown]').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
    } finally { await context.close(); await other.close(); }
  });
}

test('lost chat acknowledgement preserves text and retry does not duplicate', async ({ browser }) => {
  const context = await browser.newContext();
  const other = await browser.newContext();
  try {
    const a = await context.newPage();
    const b = await other.newPage();
    await a.goto('/');
    await a.getByRole('button', { name: '建立房間（玩家 A）' }).click();
    await expect(a).toHaveURL(/\/rooms\/\d{6}$/);
    await b.goto(a.url());
    await b.getByRole('button', { name: '加入房間（玩家 B）' }).click();
    await expect(a.locator('[data-clues]')).toContainText('ORPHEUS');
    await a.route('**/chat', async route => { await route.fetch(); await route.abort(); });
    const input = a.getByLabel('傳訊給另一位受試者');
    await input.fill('回覆遺失測試');
    await a.getByRole('button', { name: '傳送訊息' }).click();
    await expect(a.locator('[data-chat-feedback]')).toContainText('未確認送達');
    await expect(input).toHaveValue('回覆遺失測試');
    await a.unroute('**/chat');
    await a.getByRole('button', { name: '傳送訊息' }).click();
    await expect(input).toHaveValue('');
    await expect(b.getByRole('log').getByText('回覆遺失測試', { exact: true })).toHaveCount(1);
  } finally { await context.close(); await other.close(); }
});
