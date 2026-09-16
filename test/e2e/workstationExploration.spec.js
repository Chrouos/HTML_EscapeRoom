const { test, expect } = require('@playwright/test');

test.setTimeout(60_000);

const workstationFixture = {
  activeApp: 'files',
  files: {
    rootId: 'root',
    entries: [
      { id: 'root', name: 'FILES', kind: 'folder', parentId: null },
      { id: 'briefs', name: 'BRIEFS', kind: 'folder', parentId: 'root' },
      { id: 'incident', name: 'incident.log', kind: 'file', parentId: 'briefs', content: '02:17 — signal loss' },
      { id: 'locked', name: 'blackbox.txt', kind: 'file', parentId: 'root', locked: true, content: 'never send this' }
    ]
  },
  terminal: {
    operations: [{ operationId: 'open_aux', label: 'OPEN AUX', description: 'Mount the auxiliary index.', value: 'OPEN AUX' }]
  },
  logs: [{ id: 'boot', title: 'BOOT RECORD', text: 'Console ready.' }]
};

const stateFixture = {
  occupancy: { A: true, B: true, count: 2, capacity: 2, ready: true },
  publicProgress: { chapter: 1, mainProgress: [], puzzleId: 'main1', stepId: 'identity', title: 'Identity', prompt: '', hints: [], sidePuzzles: [] },
  intercom: [],
  workstation: workstationFixture,
  privateMissions: [],
  discoveredEvidence: [],
  ending: null
};

async function mount(page, countdownRemainingMs = 60000) {
  await page.goto('/');
  await page.locator('form[action="/rooms"] button').click();
  const roomUrl = page.url();
  const partnerContext = await page.context().browser().newContext();
  const partner = await partnerContext.newPage();
  await partner.goto(roomUrl);
  await partner.locator('form[action="/rooms/join"] button').click();
  let operationRequest;
  await page.route('**/api/rooms/*/state*', async route => {
    const url = new URL(route.request().url());
    const sinceCursor = url.searchParams.get('sinceCursor');
    if (sinceCursor !== null) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true, unchanged: true, cursor: 1, countdown: { status: 'running', remainingMs: countdownRemainingMs }
      }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, unchanged: false, cursor: 1, state: stateFixture,
      countdown: { status: 'running', remainingMs: countdownRemainingMs }
    }) });
  });
  await page.route('**/api/rooms/*/actions', async route => {
    operationRequest = route.request().postDataJSON();
    const state = operationRequest.operationId === 'terminal_command' && /^HINT$/i.test(operationRequest.value || '')
      ? { ...stateFixture, intercom: [{ id: 'hint', type: 'story', text: 'Shared signal: compare the timestamps.' }], workstation: workstationFixture }
      : stateFixture;
    const publicResult = operationRequest.operationId === 'terminal_command'
      ? { command: String(operationRequest.value || '').split(/\s+/)[0].toUpperCase(), output: 'HELP\nSEARCH <node>\nSCAN <filename>\nUNZIP <filename>\nHINT\nSEND <text>' }
      : { operationId: operationRequest.operationId };
    const cursor = operationRequest.operationId === 'terminal_command' && /^HINT$/i.test(operationRequest.value || '') ? 2 : 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, stateChanged: false, publicResult,
      unchanged: false, cursor, state,
      countdown: { status: 'running', remainingMs: countdownRemainingMs }
    }) });
  });
  await page.goto(roomUrl);
  await page.locator('[data-workstation]').waitFor({ state: 'attached' });
  await page.waitForFunction(() => typeof document.querySelector('[data-game-room]')?.workstation?.render === 'function');
  return { partnerContext, getOperation: () => operationRequest };
}

test('explores Files folders and entries without leaking locked names', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await expect(workspace.locator('[data-workstation-tree]')).toBeVisible();
  await expect(workspace.locator('[data-workstation-directory]')).toBeVisible();
  await expect(workspace.getByRole('button', { name: 'Files', exact: true })).toBeVisible();
  await workspace.getByRole('button', { name: 'BRIEFS', exact: true }).click();
  await expect(workspace.getByRole('button', { name: 'incident.log', exact: true })).toBeVisible();
  await expect(workspace).not.toContainText('blackbox.txt');
  await workspace.getByRole('button', { name: 'incident.log', exact: true }).click();
  await expect(workspace.locator('[data-workstation-directory] [data-workstation-entry-content]')).toContainText('02:17');
  await expect.poll(room.getOperation).toMatchObject({ operationId: 'open_entry', value: 'incident' });
  await workspace.getByRole('button', { name: /back/i }).click();
  await expect(workspace.getByRole('button', { name: 'incident.log', exact: true })).toBeVisible();
  await room.partnerContext.close();
});

test('keeps folders and documents in one ordered tree and opens the request workspace separately', async ({ page }) => {
  const room = await mount(page);
  const fixture = structuredClone(workstationFixture);
  fixture.files.entries = [
    { id: 'root', name: 'FILES', kind: 'folder', parentId: null },
    { id: 'archives', name: 'archives', kind: 'folder', parentId: 'root' },
    { id: 'docs', name: 'docs', kind: 'folder', parentId: 'root' },
    { id: 'protocol', name: 'protocol.txt', kind: 'file', parentId: 'docs', content: 'ACCESS PROTOCOL' },
    { id: 'dockerfile', name: 'Dockerfile', kind: 'file', parentId: 'root', content: 'FROM orpheus:latest' },
    { id: 'readme', name: 'README.md', kind: 'file', parentId: 'root', content: 'ROOM README' },
    { id: 'answer', name: 'answer.lock', kind: 'file', parentId: 'root', locked: false, metadataVisible: true, content: '解鎖密碼已準備。' }
  ];
  fixture.answerGate = { entryId: 'answer', puzzleId: 'main1', open: true };
  await page.evaluate(f => document.querySelector('[data-game-room]').workstation.render(f), fixture);
  const workspace = page.locator('[data-workstation]');
  await expect.poll(async () => workspace.locator('[data-workstation-tree] [data-workstation-entry]').evaluateAll(nodes =>
    nodes.slice(0, 6).map(node => node.querySelector('.workstation-entry-name')?.textContent.trim()))).toEqual([
    'FILES', 'archives', 'docs', 'answer.lock', 'Dockerfile', 'README.md'
  ]);
  await workspace.getByRole('button', { name: 'docs', exact: true }).click();
  await expect(workspace.getByRole('button', { name: 'protocol.txt', exact: true })).toBeVisible();
  await workspace.getByRole('button', { name: 'answer.lock', exact: true }).click();
  await expect(workspace.locator('[data-workstation-document]')).toContainText('解鎖密碼已準備');
  await expect(workspace.locator('[data-workstation-app="request"]')).toBeEnabled();
  await workspace.locator('[data-workstation-app="request"]').click();
  await expect(workspace.locator('[data-workstation-answer-form]')).toBeVisible();
  await expect(workspace.locator('[data-workstation-answer-form] input[name="value"]')).toBeVisible();
  await room.partnerContext.close();
});

test('opens Terminal from its application tab and keeps the input available', async ({ page }) => {
  const room = await mount(page);
  const fixture = structuredClone(workstationFixture);
  fixture.files.entries.push({ id: 'terminal-app', name: 'Terminal', kind: 'application', parentId: 'root', launchApp: 'terminal' });
  await page.evaluate(f => document.querySelector('[data-game-room]').workstation.render(f), fixture);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'Terminal', exact: true }).click();
  await expect(workspace.locator('[data-terminal-input]')).toBeVisible();
  await expect(workspace.locator('[data-terminal-input]')).toBeFocused();
  await expect(workspace.locator('[data-workstation-app="terminal"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(workspace.locator('[data-workstation-entry]').filter({ hasText: /terminal/i })).toHaveCount(0);
  await room.partnerContext.close();
});

test('shows command suggestions after slash input and fills the existing CLI command', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'Terminal', exact: true }).click();
  const input = workspace.locator('[data-terminal-input]');
  await input.fill('/');
  const suggestions = workspace.locator('[data-terminal-suggestions]');
  await expect(suggestions).toBeVisible();
  await expect(suggestions).toContainText('HELP');
  await suggestions.getByRole('button', { name: 'HELP', exact: true }).click();
  await expect(input).toHaveValue('HELP');
  await input.fill('/');
  await input.press('Escape');
  await expect(suggestions).toBeHidden();
  await room.partnerContext.close();
});

test('shows a timeout failure beat and returns to the lobby when the clock reaches zero', async ({ page }) => {
  const room = await mount(page, 0);
  const ending = page.locator('[data-ending][data-failure="timeout"]');
  await expect(ending).toBeVisible();
  await expect(ending).toContainText('隔離倒數結束');
  await expect(page.locator('[data-action-form] button')).toBeDisabled();
  await expect(page).toHaveURL(/\/$/, { timeout: 8_000 });
  await room.partnerContext.close();
});

test('keeps Terminal as a pure CLI without notes or authored operation buttons', async ({ page }) => {
  const room = await mount(page);
  const fixture = structuredClone(workstationFixture);
  fixture.terminal.operations.push(
    { operationId: 'terminal_command', label: 'terminal_command' },
    { operationId: 'open_entry', label: 'open_entry' },
    { operationId: 'commit_finale', label: 'commit_finale' }
  );
  await page.evaluate(f => document.querySelector('[data-game-room]').workstation.render(f), fixture);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'Terminal', exact: true }).click();
  await expect(workspace.locator('[data-terminal-operation]')).toHaveCount(0);
  await expect(workspace.getByText('CONTEXTUAL NOTES', { exact: true })).toHaveCount(0);
  await expect(workspace.getByText('SHORTCUTS // AUTHORED OPERATIONS', { exact: true })).toHaveCount(0);
  await expect(workspace.locator('[data-terminal-entry]')).toHaveCount(0);
  await room.partnerContext.close();
});

test('accepts a real Terminal command and renders echo plus safe output', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'Terminal', exact: true }).click();
  const input = workspace.locator('[data-terminal-input]');
  await expect(input).toBeVisible();
  await input.fill('HELP');
  await input.press('Enter');
  await expect.poll(room.getOperation).toMatchObject({ operationId: 'terminal_command', value: 'HELP' });
  await expect(workspace.locator('[data-terminal-history]')).toContainText('HELP');
  await expect(workspace.locator('[data-terminal-output]')).toContainText('SEARCH <node>');
  await expect(input).toBeFocused();
  await room.partnerContext.close();
});

test('behaves like a command prompt with role prompt and keyboard history', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'Terminal', exact: true }).click();
  await expect(workspace.locator('[data-terminal-prompt]')).toHaveText('a@orpheus:~$');
  const input = workspace.locator('[data-terminal-input]');
  await input.fill('HELP');
  await input.press('Enter');
  await expect.poll(room.getOperation).toMatchObject({ operationId: 'terminal_command', value: 'HELP' });
  await input.press('ArrowUp');
  await expect(input).toHaveValue('HELP');
  await input.press('ArrowDown');
  await expect(input).toHaveValue('');
  await expect(workspace.locator('[data-terminal-history] .terminal-echo')).toContainText('a@orpheus:~$ HELP');
  await room.partnerContext.close();
});

test('echoes rejected commands as terminal error lines', async ({ page }) => {
  const room = await mount(page);
  await page.route('**/api/rooms/*/actions', async route => {
    const request = route.request().postDataJSON();
    if (request?.operationId === 'terminal_command') {
      await route.fulfill({ status: 423, contentType: 'application/json', body: JSON.stringify({
        success: false, message: 'Command rejected by secure shell'
      }) });
      return;
    }
    await route.fallback();
  });
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'Terminal', exact: true }).click();
  const input = workspace.locator('[data-terminal-input]');
  await input.fill('SCAN secret.log');
  await input.press('Enter');
  await expect(workspace.locator('[data-terminal-history]')).toContainText('SCAN secret.log');
  await expect(workspace.locator('.terminal-output-error')).toContainText('Command rejected by secure shell');
  await expect(input).toBeFocused();
  await room.partnerContext.close();
});

test('renders public HINT result in the intercom without audience metadata', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'Terminal', exact: true }).click();
  await workspace.locator('[data-terminal-input]').fill('HINT');
  await workspace.locator('[data-terminal-input]').press('Enter');
  await expect(page.locator('[data-intercom-log]')).toContainText('Shared signal: compare the timestamps.');
  const serialized = await page.locator('[data-intercom-log]').evaluate(node => node.outerHTML);
  expect(serialized).not.toMatch(/audience|recipient|broadcast|direct/i);
  await room.partnerContext.close();
});

test('keeps the active puzzle shell hidden until the answer file gate opens', async ({ page }) => {
  const room = await mount(page);
  await expect(page.locator('[data-puzzle-gate]')).toBeHidden();
  const gated = structuredClone(workstationFixture);
  gated.answerGate = { entryId: 'gate', puzzleId: 'main1', open: true };
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), gated);
  await expect(page.locator('[data-puzzle-gate]')).toBeHidden();
  await expect(page.locator('[data-workstation-app="request"]')).toBeEnabled();
  await room.partnerContext.close();
});

test('opens the REQUEST workspace only when the answer gate is ready', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await expect(workspace.locator('[data-workstation-app="request"]')).toBeDisabled();
  const gated = structuredClone(workstationFixture);
  gated.answerGate = { entryId: 'gate', puzzleId: 'main1', open: true };
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), gated);
  await workspace.locator('[data-workstation-app="request"]').click();
  await expect(workspace.locator('[data-workstation-request]')).toBeVisible();
  const requestForm = workspace.locator('[data-workstation-answer-form]');
  await expect(requestForm).toBeVisible();
  await requestForm.locator('input[name="value"]').fill('A-01');
  await requestForm.getByRole('button', { name: 'VERIFY RESPONSE', exact: true }).click();
  await expect.poll(room.getOperation).toMatchObject({ puzzleId: 'main1', value: 'A-01' });
  await expect(page.locator('[data-puzzle-gate]')).toBeHidden();
  await room.partnerContext.close();
});

test('keeps an opened note visible when a live snapshot refreshes', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  const opened = structuredClone(workstationFixture);
  opened.files.entries.push({ id: 'note', name: 'field.note', kind: 'file', parentId: 'root', content: 'first observation' });
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), opened);
  await workspace.getByRole('button', { name: 'field.note', exact: true }).click();
  await expect(workspace.locator('[data-workstation-entry-content]')).toContainText('first observation');
  const refreshed = structuredClone(opened);
  refreshed.files.entries.find(entry => entry.id === 'note').content = 'updated observation';
  refreshed.openedEntryIds = ['note'];
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), refreshed);
  await expect(workspace.locator('[data-workstation-entry-content]')).toContainText('updated observation');
  await room.partnerContext.close();
});

test('keeps terminal records available to CLI commands without rendering contextual notes', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  const fixture = structuredClone(workstationFixture);
  fixture.terminal.entries = [{ id: 'ai.note', name: 'session.note', kind: 'document', text: 'Keep the signal open.' }];
  await page.evaluate(f => document.querySelector('[data-game-room]').workstation.render(f), fixture);
  await workspace.getByRole('button', { name: 'Terminal', exact: true }).click();
  await expect(workspace.getByRole('button', { name: 'session.note', exact: true })).toHaveCount(0);
  await expect(workspace.locator('[data-terminal-entry-content]')).toHaveCount(0);
  await room.partnerContext.close();
});

test('places discovered evidence in Files notes and hides the bottom report panels', async ({ page }) => {
  const room = await mount(page);
  const fixture = structuredClone(stateFixture);
  fixture.discoveredEvidence = [{ id: 'timestamp', title: 'Timestamp mismatch', summary: 'Two dates' }];
  fixture.workstation = structuredClone(workstationFixture);
  fixture.workstation.files.entries.push({ id: 'folder.notes', name: 'NOTES', kind: 'folder', parentId: 'root' });
  fixture.workstation.files.entries.push({ id: 'evidence.timestamp', name: 'timestamp.note', kind: 'file', parentId: 'folder.notes', content: 'Two dates' });
  await page.evaluate(f => document.querySelector('[data-game-room]').workstation.render(f), fixture.workstation);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'NOTES', exact: true }).click();
  await expect(workspace.getByRole('button', { name: 'timestamp.note', exact: true })).toBeVisible();
  await expect(page.locator('[data-evidence]')).toHaveCount(0);
  await expect(page.locator('[data-sides]')).toHaveCount(0);
  await room.partnerContext.close();
});

test('launches an available side investigation from Files/NOTES', async ({ page }) => {
  const room = await mount(page);
  const fixture = structuredClone(workstationFixture);
  fixture.sidePuzzles = [{ puzzleId: 'side2', title: 'ANOMALY', hook: 'Inspect the anomaly.', opened: false, complete: false }];
  await page.evaluate(f => document.querySelector('[data-game-room]').workstation.render(f), fixture);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'NOTES', exact: true }).click();
  await expect(workspace.getByRole('button', { name: /side2/i })).toBeVisible();
  await workspace.getByRole('button', { name: /side2/i }).click();
  await expect.poll(room.getOperation).toMatchObject({ puzzleId: 'side2', stepId: 'inspect' });
  await room.partnerContext.close();
});

test('submits the current side-investigation step from its opened Files note', async ({ page }) => {
  const room = await mount(page);
  const fixture = structuredClone(workstationFixture);
  fixture.sidePuzzles = [{ puzzleId: 'side2', title: 'ANOMALY', hook: 'Inspect the anomaly.', opened: true, complete: false,
    stepId: 'pattern', prompt: 'Enter the pattern.' }];
  await page.evaluate(f => document.querySelector('[data-game-room]').workstation.render(f), fixture);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'NOTES', exact: true }).click();
  await workspace.getByRole('button', { name: /side2/i }).click();
  const form = workspace.locator('[data-investigation-form="side2"]');
  await expect(form).toBeVisible();
  await form.locator('input[name="value"]').fill('LUCID');
  await form.locator('button').click();
  await expect.poll(room.getOperation).toMatchObject({ puzzleId: 'side2', stepId: 'pattern', value: 'LUCID' });
  await room.partnerContext.close();
});

test('shows the safe startup note inside Files without a clue report heading', async ({ page }) => {
  const room = await mount(page);
  const fixture = structuredClone(workstationFixture);
  fixture.text = 'Check the shared index before touching the archive.';
  await page.evaluate(f => document.querySelector('[data-game-room]').workstation.render(f), fixture);
  const workspace = page.locator('[data-workstation]');
  await expect(workspace.locator('[data-startup-note]')).toContainText('Check the shared index');
  await expect(workspace).not.toContainText('你的線索');
  await room.partnerContext.close();
});

test('keeps Files diegetic while REQUEST explains its own format', async ({ page }) => {
  const room = await mount(page);
  const fixture = structuredClone(stateFixture);
  fixture.workstation = structuredClone(workstationFixture);
  fixture.workstation.answerGate = { entryId: 'gate', puzzleId: 'main1', open: true };
  await page.evaluate(fixtureValue => {
    const root = document.querySelector('[data-game-room]');
    root.workstation.render(fixtureValue.workstation);
    root.querySelector('[data-stage]').textContent = '設施初始化｜身份核對';
    root.querySelector('[data-puzzle-format]').textContent = '格式提示：名稱與編號之間保留連字號。';
  }, fixture);

  await expect(page.locator('[data-workstation-guide]')).toHaveCount(0);
  await expect(page.locator('[data-puzzle-gate]')).toBeHidden();
  await page.locator('[data-workstation-app="request"]').click();
  await expect(page.locator('[data-workstation-request]')).toBeVisible();
  await expect(page.locator('[data-puzzle-format]')).toContainText('保留連字號');
  await room.partnerContext.close();
});

test('Backspace and keyboard navigation stay inside the workstation', async ({ page }) => {
  const room = await mount(page);
  const before = page.url();
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'BRIEFS', exact: true }).click();
  await workspace.focus();
  await page.keyboard.press('Backspace');
  expect(page.url()).toBe(before);
  await expect(workspace.getByRole('button', { name: 'BRIEFS', exact: true })).toBeVisible();
  await room.partnerContext.close();
});

test('Logs is explorable and live renders preserve the current folder', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'Files', exact: true }).focus();
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), workstationFixture);
  await expect(workspace.getByRole('button', { name: 'Files', exact: true })).toBeFocused();
  await workspace.getByRole('button', { name: 'BRIEFS', exact: true }).click();
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), workstationFixture);
  await expect(workspace.getByRole('button', { name: 'incident.log', exact: true })).toBeVisible();
  await workspace.getByRole('button', { name: 'Logs', exact: true }).click();
  await expect(workspace.locator('[data-workstation-log]')).toContainText('Console ready.');
  await room.partnerContext.close();
});

test('accepts type-only folder roots and returns to the parent', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await expect(workspace.getByRole('button', { name: 'Files', exact: true })).toBeVisible();
  const typeOnly = structuredClone(workstationFixture);
  delete typeOnly.files.rootId;
  typeOnly.files.entries = typeOnly.files.entries.map(entry => {
    const copy = { ...entry };
    delete copy.kind;
    if (entry.kind === 'folder') copy.type = 'folder';
    return copy;
  });
  await page.evaluate(() => {
    const workstation = document.querySelector('[data-game-room]').workstation;
    workstation.openApp('terminal');
  });
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), typeOnly);
  await page.evaluate(() => document.querySelector('[data-game-room]').workstation.openApp('files'));
  await workspace.getByRole('button', { name: 'BRIEFS', exact: true }).click();
  await expect(workspace.getByRole('button', { name: 'incident.log', exact: true })).toBeVisible();
  await workspace.getByRole('button', { name: /back/i }).click();
  await expect(workspace.getByRole('button', { name: 'BRIEFS', exact: true })).toBeVisible();
  await room.partnerContext.close();
});

test('keeps locked metadata visible and gates the answer form behind the opened file', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await expect(workspace.getByRole('button', { name: 'Files', exact: true })).toBeVisible();
  const gated = structuredClone(workstationFixture);
  gated.answerGate = { entryId: 'gate', puzzleId: 'main1', open: false };
  gated.files.entries.push({ id: 'gate', name: 'answer_main1.lock', kind: 'file', parentId: 'root', locked: false, metadataVisible: true, content: 'sealed' });
  gated.files.entries.push({ id: 'sealed', name: 'sealed.notes', kind: 'file', parentId: 'root', locked: true, metadataVisible: true });
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), gated);
  await expect(workspace.getByRole('button', { name: /sealed\.notes/i })).toBeDisabled();
  await expect(page.locator('[data-action-form]')).toBeHidden();
  gated.answerGate.open = true;
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), gated);
  await expect(page.locator('[data-action-form]')).toBeHidden();
  await workspace.locator('[data-workstation-app="request"]').click();
  await expect(workspace.locator('[data-workstation-answer-form]')).toBeVisible();
  await room.partnerContext.close();
});

test('fills the desktop viewport and preserves workstation scroll on live renders', async ({ page }) => {
  const room = await mount(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const workspace = page.locator('[data-workstation]');
  const longFixture = structuredClone(workstationFixture);
  longFixture.files.entries.push(...Array.from({ length: 30 }, (_, index) => ({
    id: `log-${index}`,
    name: `record-${index}.log`,
    kind: 'file',
    parentId: 'root',
    content: `record ${index}`
  })));
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), longFixture);
  const shell = page.locator('.game-room-shell');
  const shellWidth = await shell.evaluate(node => node.getBoundingClientRect().width);
  expect(shellWidth).toBeGreaterThan(1300);
  const scroll = workspace.locator('[data-workstation-tree]');
  const monitorScreen = page.locator('.operations-screen');
  await expect.poll(async () => monitorScreen.evaluate(node => {
    const overflowWidth = node.scrollWidth - node.clientWidth;
    const overflowHeight = node.scrollHeight - node.clientHeight;
    return overflowWidth <= 1 && overflowHeight <= 1;
  })).toBeTruthy();
  await expect.poll(async () => scroll.evaluate(node => node.scrollHeight - node.clientHeight)).toBeGreaterThan(0);
  await scroll.evaluate(node => { node.scrollTop = node.scrollHeight; });
  const before = await scroll.evaluate(node => node.scrollTop);
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), longFixture);
  const after = await scroll.evaluate(node => node.scrollTop);
  expect(after).toBeGreaterThanOrEqual(Math.max(0, before - 2));
  await room.partnerContext.close();
});

test('lets the workstation fill Monitor 2 while the request bridge is hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1143, height: 778 });
  const room = await mount(page);
  const geometry = await page.locator('[data-operations-workspace]').evaluate(workspace => {
    const workstation = workspace.querySelector('[data-workstation]');
    const workspaceRect = workspace.getBoundingClientRect();
    const workstationRect = workstation.getBoundingClientRect();
    return {
      workspaceRight: workspaceRect.right,
      workstationRight: workstationRect.right,
      requestHidden: workspace.querySelector('[data-puzzle-gate]')?.hidden === true
    };
  });

  expect(geometry.requestHidden).toBe(true);
  expect(geometry.workspaceRight - geometry.workstationRight).toBeLessThanOrEqual(2);
  await room.partnerContext.close();
});

test('keeps long Files labels inside the tree at medium desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1143, height: 778 });
  const room = await mount(page);
  const fixture = structuredClone(workstationFixture);
  fixture.files.entries = [
    { id: 'root', name: 'FILES', kind: 'folder', parentId: null },
    { id: 'private', name: 'B / PRIVATE', kind: 'folder', parentId: 'root' },
    { id: 'roster', name: 'doc.b_experiment_roster', kind: 'file', parentId: 'private', content: 'Roster' },
    { id: 'checksum', name: 'doc.b_checksum_verification', kind: 'file', parentId: 'private', content: 'Checksum' }
  ];
  await page.evaluate(fixtureValue => document.querySelector('[data-game-room]').workstation.render(fixtureValue), fixture);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'B / PRIVATE', exact: true }).click();
  const metrics = await workspace.locator('[data-workstation-tree]').evaluate(tree => ({
    clientWidth: tree.clientWidth,
    scrollWidth: tree.scrollWidth,
    labels: [...tree.querySelectorAll('.workstation-entry-name')].map(node => ({
      text: node.textContent,
      clientWidth: node.clientWidth,
      overflow: getComputedStyle(node).overflow,
      textOverflow: getComputedStyle(node).textOverflow,
      whiteSpace: getComputedStyle(node).whiteSpace
    }))
  }));

  expect(metrics.scrollWidth - metrics.clientWidth).toBeLessThanOrEqual(1);
  expect(metrics.labels.every(label => label.clientWidth > 0
    && label.overflow === 'hidden'
    && label.textOverflow === 'ellipsis'
    && label.whiteSpace === 'nowrap')).toBe(true);
  await room.partnerContext.close();
});

test('does not render a full-width divider beneath workstation tabs at medium desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1126, height: 778 });
  const room = await mount(page);
  const tabs = page.locator('[data-workstation] .workstation-apps');
  await expect(tabs).toBeVisible();

  const divider = await tabs.evaluate(node => ({
    borderBottomStyle: getComputedStyle(node).borderBottomStyle,
    borderBottomWidth: getComputedStyle(node).borderBottomWidth
  }));

  expect(divider.borderBottomStyle).toBe('none');
  expect(divider.borderBottomWidth).toBe('0px');
  await room.partnerContext.close();
});
