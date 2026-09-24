const { test, expect } = require('@playwright/test');

const main = [
  ['main1', 'identity', 'ORPHEUS-17'], ['main1', 'startup', 'AUX CORE EMERGENCY'],
  ['main2', 'decode', 'POWER'], ['main2', 'route', 'AUX BATTERY CORE'], ['main2', 'restore', 'POWER ON'],
  ['main3', 'timeline', 'BETA ALPHA GAMMA'], ['main3', 'record', '2038-04-17'],
  ['main4', 'credential', 'LANTERN-042'], ['main4', 'authorization', 'VERIFY'],
  ['main5', 'fragments', '2 4 1 3'], ['main5', 'recovery', 'AI EDITED RECORD'], ['main5', 'proof', '2038-04-18'],
  ['main6', 'protocol', 'MANUAL OVERRIDE']
];

async function postOperation(page, operationId, value, actionId) {
  return page.evaluate(async ({ operationId, value, actionId }) => {
    const roomCode = document.querySelector('[data-game-room]').dataset.gameRoom;
    const response = await fetch(`/api/rooms/${roomCode}/actions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId, operationId, value })
    });
    return { status: response.status, body: await response.json() };
  }, { operationId, value, actionId });
}

async function submitAnswer(page, puzzleId, stepId, value, index) {
  const opened = await postOperation(page, 'open_entry', `answer.${puzzleId}`, `e2e-open-${puzzleId}-${index}`);
  expect(opened.status).toBe(200);
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

async function completeMainline(page, actionId) {
  return page.evaluate(async ({ actionId }) => {
    const roomCode = document.querySelector('[data-game-room]').dataset.gameRoom;
    const response = await fetch(`/api/rooms/${roomCode}/actions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId, operationId: 'complete_main6' })
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
    const roomUrl = a.url();
    const code = roomUrl.split('/').pop();
    await b.goto('/');
    await b.locator('input').first().fill(code);
    await b.locator('button').last().click();
    await a.goto(roomUrl);
    await expect(a.locator('[data-game-room]')).toBeVisible();

    for (const [index, [puzzleId, stepId, value]] of main.entries()) {
      await submitAnswer(index % 2 ? b : a, puzzleId, stepId, value, index);
    }
    await expect(a.locator('[data-game-room]')).toHaveAttribute('data-step', 'main6:ending');
    const mainline = await completeMainline(a, 'e2e-main6-complete');
    expect(mainline.stateChanged).toBe(true);

    const first = await commitFinale(a, 'e2e-final-a');
    expect(first.stateChanged).toBe(true);
    expect(first.publicResult.endingId).toBeUndefined();
    await expect(a.locator('[data-ending]')).toBeHidden();

    const duplicate = await commitFinale(a, 'e2e-final-a');
    expect(duplicate.stateChanged).toBe(false);

    const second = await commitFinale(b, 'e2e-final-b');
    expect(second.publicResult.endingId).toBe('ambiguous_containment');
    await expect(a.locator('[data-ending]')).toContainText('解釋權未移交');
    await b.reload();
    await expect(b.locator('[data-ending]')).toContainText('解釋權未移交');
    await expect(a.locator('[data-ending]')).not.toContainText('Recorded decision');
    await expect(a.locator('[data-ending]')).toContainText('最終狀態');
    await expect(a.locator('[data-ending]')).toContainText('ECHO');
  } finally {
    await aContext.close();
    await bContext.close();
  }
});
