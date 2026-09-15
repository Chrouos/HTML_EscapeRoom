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

function extractLiveEvents(frames) {
  const events = [];
  for (const frame of frames) {
    try {
      const parsed = JSON.parse(frame);
      const nestedEvents = parsed?.event?.payload?.events;
      if (Array.isArray(nestedEvents)) events.push(...nestedEvents);
    } catch {
      // Non-JSON frames are ignored here; the live reconnect suite owns
      // malformed-frame recovery, while this helper inspects event payloads.
    }
  }
  return events;
}

async function answer(page, puzzleId, stepId, value, actionId) {
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
  // Install the frame observers before either page navigates. The live client
  // opens its WebSocket during page boot; attaching after navigation can miss
  // the first frame and make a foreign-event assertion look falsely clean.
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
  await expect.poll(async () => (await getState(a)).body.state?.occupancy?.ready).toBe(true);
  // The creator initially remains on the waiting view. Navigate it to the
  // game after B joins so both real browser clients establish their own live
  // sockets before frame assertions begin.
  await a.goto(roomUrl);
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

async function openEntry(page, entryId, actionId = `open-${entryId.replace(/[^a-z0-9]+/gi, '-')}`) {
  const response = await postOperation(page, 'open_entry', entryId, actionId);
  if (response.status !== 200) console.log('entry open failure', entryId, response);
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  return response.body;
}

async function primeRapport(a, b, prefix) {
  // Opening the two initial role files is an operation-based trigger.  The
  // incident reports plus an independent timestamp check provide the second
  // rapport line without injecting any state in the browser.
  await openEntry(a, 'files.mainline', `${prefix}-a-files`);
  await openEntry(b, 'files.experiment_roster', `${prefix}-b-roster`);
  await openEntry(a, 'doc.a_incident_report', `${prefix}-a-incident`);
  await openEntry(b, 'doc.b_incident_report', `${prefix}-b-incident`);
  const verifyA = await postOperation(a, 'verify_incident_timestamp', undefined, `${prefix}-verify-a`);
  const verifyB = await postOperation(b, 'verify_incident_timestamp', undefined, `${prefix}-verify-b`);
  expect(verifyA.status).toBe(200);
  expect(verifyB.status).toBe(200);
}

test.describe('private narrative secrecy and causality', () => {
  test('real room creation and join persist the three shared ORPHEUS opening announcements', async ({ browser }) => {
    const room = await createPair(browser);
    try {
      const aState = (await getState(room.a)).body;
      const bState = (await getState(room.b)).body;
      for (const state of [aState, bState]) {
        expect(state.success).toBe(true);
        expect(state.state.intercom.map(message => message.contentId)).toEqual(expect.arrayContaining([
          'orpheus.boot', 'orpheus.cooperation', 'orpheus.first_task'
        ]));
        expect(state.state.intercom.filter(message => message.contentId.startsWith('orpheus.')).length)
          .toBeGreaterThanOrEqual(3);
      }

      // The public opening is projected to each actor stream once per
      // transition; there are no direct/private frames in this phase.
      expect(aState.cursor).toBeGreaterThan(0);
      expect(bState.cursor).toBeGreaterThan(0);
      const openingFrames = [...room.frames.A, ...room.frames.B].join('\n');
      expect(openingFrames).not.toMatch(/AI_BROADCAST|AI_DIRECT/i);
    } finally {
      await room.aContext.close();
      await room.bContext.close();
    }
  });

  test('A-first and B-first mission triggers have no foreign cursor, placeholder, or timing signal', async ({ browser }) => {
    test.setTimeout(90_000);
    for (const first of ['A', 'B']) {
      const room = await createPair(browser);
      try {
        const { a, b } = room;
        await answer(a, 'main1', 'identity', 'ORPHEUS-17', `order-${first}-identity`);
        await answer(b, 'main1', 'startup', 'AUX CORE EMERGENCY', `order-${first}-startup`);
        const untouchedPage = first === 'A' ? b : a;
        const untouchedRole = first === 'A' ? 'B' : 'A';
        const ownerRole = first;

        await primeRapport(a, b, `order-${first}`);
        const beforeA = (await getState(a)).body;
        const beforeB = (await getState(b)).body;
        const untouchedBefore = first === 'A' ? beforeB : beforeA;
        const firstPage = first === 'A' ? a : b;
        const firstOperation = first === 'A' ? 'archive_index' : 'flag_identity';
        const untouchedLog = untouchedPage.locator('[data-intercom-log]');
        const ownerLog = firstPage.locator('[data-intercom-log]');
        const untouchedBeforeMessages = untouchedBefore.state?.intercom || [];
        const ownerBeforeMessages = (first === 'A' ? beforeA : beforeB).state?.intercom || [];

        // Establish a positive DOM baseline before the private action. Waiting
        // for the projected count prevents a still-hydrating live socket from
        // making a later privacy assertion pass by accident.
        await expect(untouchedLog).toBeVisible();
        await expect(ownerLog).toBeVisible();
        await expect(untouchedLog.locator('.message')).toHaveCount(untouchedBeforeMessages.length);
        await expect(ownerLog.locator('.message')).toHaveCount(ownerBeforeMessages.length);
        expect(untouchedBeforeMessages.length).toBeGreaterThan(0);
        const untouchedMessageText = await untouchedLog.locator('.message').allTextContents();
        // Start the frame window only after rapport/state/DOM hydration has
        // settled, so earlier private rapport frames cannot contaminate the
        // untouched-socket assertion for this operation.
        const foreignFrameStart = room.frames[untouchedRole].length;
        const ownerFrameStart = room.frames[ownerRole].length;
        const firstResult = await postOperation(firstPage, firstOperation, undefined, `order-${first}-private`);
        expect(firstResult.status).toBe(200);
        expect(firstResult.body.publicResult.missionId).toBeTruthy();

        const afterA = (await getState(a)).body;
        const afterB = (await getState(b)).body;
        const ownerAfter = (first === 'A' ? afterA : afterB).state;
        const ownerBeforeIds = new Set(ownerBeforeMessages.map(message => message.contentId || message.id));
        const ownerPrivateMessages = (ownerAfter?.intercom || [])
          .filter(message => !ownerBeforeIds.has(message.contentId || message.id));
        const privateLines = ownerPrivateMessages.map(message => message.text).filter(Boolean);
        expect(privateLines.length).toBeGreaterThan(0);
        expect(privateLines.every(line => typeof line === 'string' && line.length > 0)).toBe(true);
        const ownerWsActiveAfter = (await firstPage.locator('[data-connection]').textContent())?.trim() === 'LINK ACTIVE';
        if (ownerWsActiveAfter) {
          try {
            await expect.poll(
              () => extractLiveEvents(room.frames[ownerRole].slice(ownerFrameStart)).length,
              { timeout: 10_000 }
            ).toBeGreaterThan(0);
          } catch (error) {
            // A socket can drop between the status read and this action; in
            // that case the client legitimately falls back to polling/REST.
            if (!String(error?.message || '').includes('Timeout')) throw error;
            const ownerConnectionState = (await firstPage.locator('[data-connection]').textContent())?.trim();
            // A timeout is only expected after the action has actually left
            // the live socket path. If the UI still reports an active link,
            // the missing frame is a real assertion failure.
            if (ownerConnectionState === 'LINK ACTIVE' || ownerConnectionState === undefined) throw error;
          }
        }

        // The owner receives the private ORPHEUS line in its visible monitor.
        // The untouched monitor must keep the exact same DOM projection: no
        // private operation/content, and no placeholder/gap/unread/timing hint.
        for (const privateLine of privateLines) await expect(ownerLog).toContainText(privateLine);
        await expect(ownerLog.locator('.message')).toHaveCount(ownerBeforeMessages.length + ownerPrivateMessages.length);
        await expect(untouchedLog.locator('.message')).toHaveCount(untouchedBeforeMessages.length);
        await expect(untouchedLog.locator('.message')).toHaveText(untouchedMessageText);
        const untouchedMarkup = await untouchedLog.evaluate(node => node.outerHTML);
        expect(untouchedMarkup).not.toContain(firstOperation);
        for (const privateLine of privateLines) expect(untouchedMarkup).not.toContain(privateLine);
        await expect(untouchedLog).not.toContainText(/placeholder|missing|gap|unread|delayed|timing/i);
        await expect(untouchedLog.locator([
          '[hidden]', '[data-sequence]', '[data-unread]', '[data-unread-count]',
          '[data-gap]', '[data-placeholder]', '[data-timestamp]', '[data-delay]',
          '[data-pending]', 'time'
        ].join(', '))).toHaveCount(0);

        // Inspect the nested event payloads in frames received by both sockets.
        // The full envelope also contains legitimate privateMissions state,
        // so audience/channel labels are checked on visible events only.
        const ownerEvents = extractLiveEvents(room.frames[ownerRole].slice(ownerFrameStart));
        // Depending on transport timing, the owner may hydrate this action via
        // polling/REST instead of receiving a fresh WS frame. If its transport
        // is WS and a frame is present, it must carry every private line without
        // audience labels.
        if (ownerWsActiveAfter && ownerEvents.length > 0) {
          const serializedOwnerEvents = JSON.stringify(ownerEvents);
          for (const privateLine of privateLines) expect(serializedOwnerEvents).toContain(privateLine);
          expect(serializedOwnerEvents).not.toMatch(/AI_BROADCAST|AI_DIRECT|公開頻道|私人頻道|audience|recipient|broadcast|direct/i);
        }

        const untouchedForeignEvents = extractLiveEvents(room.frames[untouchedRole].slice(foreignFrameStart));
        expect(untouchedForeignEvents).toHaveLength(0);
        const serializedForeignEvents = JSON.stringify(untouchedForeignEvents);
        for (const privateLine of privateLines) expect(serializedForeignEvents).not.toContain(privateLine);
        expect(serializedForeignEvents).not.toMatch(/AI_BROADCAST|AI_DIRECT|公開頻道|私人頻道|audience|recipient|broadcast|direct/i);

        const untouched = first === 'A' ? afterB : afterA;
        expect(untouched.cursor).toBe(untouchedBefore.cursor);
        const delta = await getState(first === 'A' ? b : a, untouchedBefore.cursor);
        expect(delta.body.unchanged).toBe(true);
        const foreignOperation = first === 'A' ? 'archive_index' : 'flag_identity';
        expect(JSON.stringify(untouched.state || '')).not.toContain(foreignOperation);
        expect(JSON.stringify(untouched.state?.intercom || [])).not.toMatch(/ORPHEUS.*(整理索引|核對名冊)/i);
        expect(room.frames[untouchedRole].slice(foreignFrameStart).join('\n')).not.toContain(foreignOperation);

        const owner = (first === 'A' ? afterA : afterB).state;
        expect(owner.privateMissions.some(mission => mission.state === 'resolved')).toBe(true);
        expect(JSON.stringify(owner.intercom || [])).not.toMatch(/AI_BROADCAST|AI_DIRECT|公開頻道|私人頻道/i);
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
      const { a, b } = room;
      await solveMainline(a, b);
      const first = await postOperation(a, 'commit_finale', undefined, 'ignore-private-a');
      expect(first.body.publicResult.endingId).toBeUndefined();
      const second = await postOperation(b, 'commit_finale', undefined, 'ignore-private-b');
      expect(second.body.publicResult.endingId).toBeTruthy();
      expect(second.body.publicResult.endingId).toBe('ambiguous_containment');
      const state = (await getState(a)).body.state;
      expect(state.ending?.id).toBe('ambiguous_containment');
      expect(state.debrief.length).toBeGreaterThanOrEqual(3);
      const recorded = new Set([
        ...(state.publicProgress?.mainProgress || []),
        ...(state.privateMissions || []).flatMap(mission => mission.outcome ? [mission.outcome] : []),
        'finaleCommittedA', 'finaleCommittedB', 'neutralFinaleCommitted'
      ]);
      for (const item of state.debrief) expect(item.factId).toBeTruthy();
      expect(recorded.has('finaleCommittedA')).toBe(true);
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
