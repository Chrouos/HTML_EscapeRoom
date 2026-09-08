const { test, expect } = require('@playwright/test');
const main = [
  ['main1', 'identity', 'ORPHEUS-17'], ['main1', 'startup', 'AUX CORE EMERGENCY'],
  ['main2', 'decode', 'POWER'], ['main2', 'route', 'AUX BATTERY CORE'], ['main2', 'restore', 'POWER ON'],
  ['main3', 'timeline', 'BETA ALPHA GAMMA'], ['main3', 'record', '2038-04-17'],
  ['main4', 'credential', 'LANTERN-042'], ['main4', 'authorization', 'VERIFY'],
  ['main5', 'fragments', '2 4 1 3'], ['main5', 'recovery', 'AI EDITED RECORD'], ['main5', 'proof', '2038-04-18'],
  ['main6', 'protocol', 'MANUAL OVERRIDE']
];
const sides = [
  ['監控時間差', [['timestamps', '2038-04-17'], ['proof', 'ASSEMBLED']]],
  ['研究員的警告', [['pattern', 'LUCID'], ['decode', 'DO NOT TRUST AI']]],
  ['刪除的 AI 訊息', [['transcript', 'EXPECTED RESPONSE'], ['metadata', 'PLANNED']]],
  ['受試者關係', [['identity', 'PAIR 17'], ['relationship', 'SELECTED TOGETHER']]]
];

for (const [count, choice, title] of [[0, 'COMPLY', '程序完成'], [2, 'RESIST', '手動脫離'], [4, 'TRUTH', '未編輯檔案']]) {
  test(`two-player browser ending: ${choice}`, async ({ browser }) => {
    test.setTimeout(90000);
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
      for (const [index, [puzzle, step, value]] of main.entries()) {
        const page = index % 2 ? b : a;
        await expect(page.locator('[data-game-room]')).toHaveAttribute('data-step', `${puzzle}:${step}`);
        await page.getByLabel('提交答案', { exact: true }).fill(value);
        await page.getByRole('button', { name: '送出', exact: true }).click();
        await expect(page.getByLabel('提交答案', { exact: true })).toHaveValue('');
      }
      await expect(a.locator('[data-game-room]')).toHaveAttribute('data-step', 'main6:ending');
      for (const [name, steps] of sides.slice(0, count)) {
        const section = a.locator('.investigation').filter({ has: a.getByRole('heading', { name, exact: true }) });
        await section.getByRole('button', { name: '查看異常紀錄' }).click();
        const partnerSection = b.locator('.investigation').filter({ has: b.getByRole('heading', { name, exact: true }) });
        for (const [step, value] of steps) {
          await expect(section).toHaveAttribute('data-step', step);
          await expect(partnerSection).toHaveAttribute('data-step', step);
          await partnerSection.getByLabel('調查答案').fill('previous step draft');
          await section.getByLabel('調查答案').fill(value);
          await section.getByRole('button', { name: '核對紀錄' }).click();
          await expect(section.getByLabel('調查答案')).toHaveValue('');
          await expect(partnerSection.getByLabel('調查答案')).toHaveValue('');
        }
        await expect(section.getByRole('button', { name: '已歸檔' })).toBeDisabled();
      }
      await a.getByLabel('提交答案', { exact: true }).fill('COMPLY');
      await a.getByRole('button', { name: '送出', exact: true }).click();
      await expect(a.getByLabel('提交答案', { exact: true })).toHaveValue('');
      await expect(b.locator('[data-game-room]')).toHaveAttribute('data-step', 'main6:ending');
      await b.getByLabel('提交答案', { exact: true }).fill(choice);
      await b.getByRole('button', { name: '送出', exact: true }).click();
      if (count) {
        await expect(a.getByRole('log')).toContainText('雙方選擇不一致');
        await a.getByLabel('提交答案', { exact: true }).fill(choice);
        await a.getByRole('button', { name: '送出', exact: true }).click();
      }
      await expect(a.locator('[data-ending]')).toContainText(title);
      await b.reload();
      await expect(b.locator('[data-ending]')).toContainText(title);
    } finally {
      await aContext.close();
      await bContext.close();
    }
  });
}
