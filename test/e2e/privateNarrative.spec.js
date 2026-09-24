const { test, expect } = require('@playwright/test');

const main = [
  ['main1', 'identity', 'ORPHEUS-17'], ['main1', 'startup', 'AUX CORE EMERGENCY'],
  ['main2', 'decode', 'POWER'], ['main2', 'route', 'AUX BATTERY CORE'], ['main2', 'restore', 'POWER ON'],
  ['main3', 'timeline', 'BETA ALPHA GAMMA'], ['main3', 'record', '2038-04-17'],
  ['main4', 'credential', 'LANTERN-042'], ['main4', 'authorization', 'VERIFY'],
  ['main5', 'fragments', '2 4 1 3'], ['main5', 'recovery', 'AI EDITED RECORD'], ['main5', 'proof', '2038-04-18'],
  ['main6', 'protocol', 'MANUAL OVERRIDE']
];

async function postOperation(page, operationId, value, actionId = `e2e-${operationId}-${Math.random().toString(36).slice(2)}`) {
  return page.evaluate(async ({ operationId, value, actionId }) => {
    const code = document.querySelector('[data-game-room]').dataset.gameRoom;
    const response = await fetch(`/api/rooms/${code}/actions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId, operationId, ...(value === undefined ? {} : { value }) })
    });
    return { status: response.status, body: await response.json() };
  }, { operationId, value, actionId });
}

async function getState(page, sinceCursor) {
  return page.evaluate(async since => {
    const code = document.querySelector('[data-game-room]').dataset.gameRoom;
    const suffix = since === undefined ? '' : `?sinceCursor=${since}`;
    const response = await fetch(`/api/rooms/${code}/state${suffix}`, { cache: 'no-store' });
    return { status: response.status, body: await response.json() };
  }, sinceCursor);
}

async function openEntry(page, entryId, actionId = `open-${entryId.replace(/[^a-z0-9]+/gi, '-')}`) {
  const response = await postOperation(page, 'open_entry', entryId, actionId);
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  return response.body;
}

async function answer(page, puzzleId, stepId, value, actionId) {
  await openEntry(page, `answer.${puzzleId}`, `${actionId}-gate`);
  const response = await page.evaluate(async payload => {
    const code = document.querySelector('[data-game-room]').dataset.gameRoom;
    const result = await fetch(`/api/rooms/${code}/actions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { status: result.status, body: await result.json() };
  }, { actionId, puzzleId, stepId, value });
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  return response.body;
}

async function createPair(browser) {
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  const a = await aContext.newPage();
  const b = await bContext.newPage();
  const frames = { A: [], B: [] };
  for (const [role, page] of [['A', a], ['B', b]]) {
    page.on('websocket', socket => socket.on('framereceived', frame => {
      frames[role].push(typeof frame === 'string' ? frame : frame.toString());
    }));
  }

  await a.goto('/');
  await a.locator('form[action="/rooms"] button').click();
  await expect(a).toHaveURL(/\/rooms\/\d{6}$/);
  const roomUrl = a.url();
  await b.goto(roomUrl);
  await b.locator('form[action="/rooms/join"] button').click();
  await a.goto(roomUrl);
  await expect(a.locator('[data-game-room]')).toBeVisible();
  await expect(b.locator('[data-game-room]')).toBeVisible();
  return { a, b, aContext, bContext, frames };
}

async function solveMainline(a, b) {
  for (const [index, [puzzleId, stepId, value]] of main.entries()) {
    await answer(index % 2 ? b : a, puzzleId, stepId, value, `narrative-main-${index}`);
  }
  const completion = await postOperation(a, 'complete_main6', undefined, 'narrative-complete-main6');
  expect(completion.status).toBe(200);
  expect(completion.body.success).toBe(true);
}

async function primeRapport(a, b, prefix) {
  await openEntry(a, 'files.mainline', `${prefix}-a-files`);
  await openEntry(b, 'files.experiment_roster', `${prefix}-b-roster`);
  await openEntry(a, 'doc.a_incident_report', `${prefix}-a-incident`);
  await openEntry(b, 'doc.b_incident_report', `${prefix}-b-incident`);
  expect((await postOperation(a, 'verify_incident_timestamp', undefined, `${prefix}-verify-a`)).status).toBe(200);
  expect((await postOperation(b, 'verify_incident_timestamp', undefined, `${prefix}-verify-b`)).status).toBe(200);
}

test.describe('private narrative secrecy and causality', () => {
  test('real room creation and join persist the official and ECHO opening announcements', async ({ browser }) => {
    const room = await createPair(browser);
    try {
      for (const page of [room.a, room.b]) {
        const state = (await getState(page)).body;
        expect(state.success).toBe(true);
        expect(state.state.intercom.map(message => message.contentId)).toEqual(expect.arrayContaining([
          'orpheus.boot', 'orpheus.cooperation', 'orpheus.first_task'
        ]));
        expect(state.state.intercom.some(message => /正式流程|研究團隊|離場程序/.test(message.text))).toBe(true);
        expect(state.state.intercom.some(message => /偷偷接進|事故發生後/.test(message.text))).toBe(false);
      }
    } finally {
      await room.aContext.close();
      await room.bContext.close();
    }
  });

  test('A-first and B-first private mission events never advance the partner cursor', async ({ browser }) => {
    test.setTimeout(90_000);
    for (const first of ['A', 'B']) {
      const room = await createPair(browser);
      try {
        const { a, b } = room;
        await answer(a, 'main1', 'identity', 'ORPHEUS-17', `order-${first}-identity`);
        await answer(b, 'main1', 'startup', 'AUX CORE EMERGENCY', `order-${first}-startup`);
        await primeRapport(a, b, `order-${first}`);

        const ownerPage = first === 'A' ? a : b;
        const partnerPage = first === 'A' ? b : a;
        const ownerRole = first;
        const partnerRole = first === 'A' ? 'B' : 'A';
        const operationId = first === 'A' ? 'archive_index' : 'flag_identity';
        const ownerBefore = (await getState(ownerPage)).body;
        const partnerBefore = (await getState(partnerPage)).body;
        const ownerIds = new Set(ownerBefore.state.intercom.map(message => message.contentId || message.id));
        const partnerFrameStart = room.frames[partnerRole].length;

        const result = await postOperation(ownerPage, operationId, undefined, `order-${first}-private`);
        expect(result.status).toBe(200);
        expect(result.body.publicResult.missionId).toBeTruthy();

        const ownerAfter = (await getState(ownerPage)).body;
        const partnerAfter = (await getState(partnerPage)).body;
        const newOwnerMessages = ownerAfter.state.intercom
          .filter(message => !ownerIds.has(message.contentId || message.id));
        expect(newOwnerMessages.length).toBeGreaterThan(0);
        for (const message of newOwnerMessages) {
          await expect(ownerPage.locator('[data-intercom-log]')).toContainText(message.text);
          expect(JSON.stringify(partnerAfter.state.intercom)).not.toContain(message.text);
        }

        expect(partnerAfter.cursor).toBe(partnerBefore.cursor);
        const delta = await getState(partnerPage, partnerBefore.cursor);
        expect(delta.body.unchanged).toBe(true);
        expect(JSON.stringify(partnerAfter.state)).not.toContain(operationId);
        expect(room.frames[partnerRole].slice(partnerFrameStart).join('\n')).not.toContain(operationId);
        expect(ownerAfter.state.privateMissions.some(mission => mission.state === 'resolved')).toBe(true);
        expect(JSON.stringify(ownerAfter.state.intercom)).not.toMatch(/AI_BROADCAST|AI_DIRECT|公開頻道|私人頻道/i);
        expect(ownerRole).toBe(first);
      } finally {
        await room.aContext.close();
        await room.bContext.close();
      }
    }
  });

  test('all private missions can be ignored and the shared mainline still reaches a neutral finale', async ({ browser }) => {
    test.setTimeout(90_000);
    const room = await createPair(browser);
    try {
      await solveMainline(room.a, room.b);
      const first = await postOperation(room.a, 'commit_finale', undefined, 'ignore-private-a');
      expect(first.body.publicResult.endingId).toBeUndefined();
      const second = await postOperation(room.b, 'commit_finale', undefined, 'ignore-private-b');
      expect(second.body.publicResult.endingId).toBe('ambiguous_containment');
      const state = (await getState(room.a)).body.state;
      expect(state.ending?.id).toBe('ambiguous_containment');
      expect(state.debrief.length).toBeGreaterThanOrEqual(3);
      for (const item of state.debrief) expect(item.factId).toBeTruthy();
    } finally {
      await room.aContext.close();
      await room.bContext.close();
    }
  });

  test('each deception has a role-visible claim and a different-source verification entry', async ({ browser }) => {
    test.setTimeout(120_000);
    const room = await createPair(browser);
    try {
      const { a, b } = room;
      await solveMainline(a, b);
      await primeRapport(a, b, 'scenario-prime');
      const scenarios = [
        ['A-1', a, 'ai.a1.index_request', a, 'log.original_index_time'],
        ['B-1', b, 'doc.b_experiment_roster', b, 'log.personnel_transfer'],
        ['D-1', a, 'doc.a_incident_report', a, 'audio.original_incident_timestamp'],
        ['A-2', a, 'ai.a2.cleanup_request', a, 'log.mirror_backup'],
        ['B-2', b, 'ai.b2.pause_request', b, 'log.token_reissue'],
        ['D-2', a, 'doc.a_solo_protocol', a, 'doc.protocol_signature_template'],
        ['A-3', a, 'ai.a3.solo_validation', b, 'doc.b_protocol_fragment'],
        ['B-3', b, 'ai.b3.behavior_report', a, 'doc.a_b_behavior_template'],
        ['L-1', a, 'log.a_partner_unknown_access', a, 'log.audit_checksum']
      ];
      for (const [label, sourcePage, sourceId, verifyPage, verificationId] of scenarios) {
        const source = await openEntry(sourcePage, sourceId, `scenario-${label}-source`);
        expect(JSON.stringify(source.state?.workstation || source.body?.state?.workstation)).toContain(sourceId);
        const verified = await openEntry(verifyPage, verificationId, `scenario-${label}-verify`);
        expect(JSON.stringify(verified.state?.workstation || verified.body?.state?.workstation)).toContain(verificationId);
        expect(JSON.stringify(verified.body?.state?.intercom || [])).not.toMatch(/AI_BROADCAST|AI_DIRECT|公開頻道|私人頻道/i);
      }
    } finally {
      await room.aContext.close();
      await room.bContext.close();
    }
  });
});
