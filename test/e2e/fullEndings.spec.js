const { test, expect } = require('@playwright/test');

const main = [
  ['main1', 'identity', 'ORPHEUS-17'], ['main1', 'startup', 'AUX CORE EMERGENCY'],
  ['main2', 'decode', 'POWER'], ['main2', 'route', 'AUX BATTERY CORE'], ['main2', 'restore', 'POWER ON'],
  ['main3', 'timeline', 'BETA ALPHA GAMMA'], ['main3', 'record', '2038-04-17'],
  ['main4', 'credential', 'LANTERN-042'], ['main4', 'authorization', 'VERIFY'],
  ['main5', 'fragments', '2 4 1 3'], ['main5', 'recovery', 'AI EDITED RECORD'], ['main5', 'proof', '2038-04-18'],
  ['main6', 'protocol', 'MANUAL OVERRIDE']
];

async function submitAnswer(page, puzzleId, stepId, value) {
  await expect(page.locator('[data-game-room]')).toHaveAttribute('data-step', `${puzzleId}:${stepId}`);
  const form = page.locator('[data-action-form]');
  await form.locator('input[name="value"]').fill(value);
  await form.locator('button[type="submit"]').click();
  await expect(form.locator('input[name="value"]')).toHaveValue('');
}

async function commitFinale(page, actionId) {
  return page.evaluate(async ({ actionId }) => {
    const roomCode = document.querySelector('[data-game-room]').dataset.gameRoom;
    const response = await fetch(`/api/rooms/${roomCode}/actions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId, operationId: 'commit_finale' })
    });
    return response.json();
  }, { actionId });
}

test('both players commit neutrally and the server resolves one immutable ending', async ({ browser }) => {
  test.setTimeout(90000);
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  try {
    const a = await aContext.newPage();
    const b = await bContext.newPage();
    await a.goto('/');
    await a.locator('button').first().click();
    await expect(a).toHaveURL(/\/rooms\/\d{6}$/);
    const code = a.url().split('/').pop();
    await b.goto('/');
    await b.locator('input').first().fill(code);
    await b.locator('button').last().click();

    for (const [index, [puzzleId, stepId, value]] of main.entries()) {
      await submitAnswer(index % 2 ? b : a, puzzleId, stepId, value);
    }
    await expect(a.locator('[data-game-room]')).toHaveAttribute('data-step', 'main6:ending');

    const first = await commitFinale(a, 'e2e-final-a');
    expect(first.stateChanged).toBe(true);
    expect(first.publicResult.endingId).toBeUndefined();
    await expect(a.locator('[data-ending]')).toBeHidden();

    const duplicate = await commitFinale(a, 'e2e-final-a');
    expect(duplicate.stateChanged).toBe(false);

    const second = await commitFinale(b, 'e2e-final-b');
    expect(second.publicResult.endingId).toBe('ambiguous_containment');
    await expect(a.locator('[data-ending]')).toContainText('不明收容');
    await b.reload();
    await expect(b.locator('[data-ending]')).toContainText('不明收容');
    await expect(a.locator('[data-ending]')).toContainText('Recorded decision');
  } finally {
    await aContext.close();
    await bContext.close();
  }
});

