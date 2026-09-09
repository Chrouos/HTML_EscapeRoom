const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomStore } = require('../../game/roomStore');
const { projectForPlayer } = require('../../game/safeState');

function occupiedStore(overrides = {}) {
  const store = createRoomStore({
    generateRoomCode: () => overrides.roomCode || '123456',
    generateToken: (() => {
      const tokens = ['token-a', 'token-b'];
      return () => tokens.shift();
    })(),
    generatePlayerId: (() => {
      const ids = ['player-a', 'player-b'];
      return () => ids.shift();
    })(),
    now: () => 1000
  });
  const created = store.createRoom();
  store.joinRoom(created.room.roomCode);
  return { store, roomCode: created.room.roomCode };
}

function identities(room) {
  return {
    A: { role: 'A', playerId: room.players.A.playerId },
    B: { role: 'B', playerId: room.players.B.playerId }
  };
}

function streamSnapshot(room) {
  return structuredClone(room);
}

test('broadcast content resolves once and advances each actor stream exactly once', () => {
  const { store, roomCode } = occupiedStore();
  store.transact(roomCode, () => {}, {
    playerId: 'player-a',
    actionId: 'broadcast-1',
    events: [{
      contentId: 'orpheus-shared-1',
      type: 'story',
      text: '同一則公開訊息',
      payload: { emphasis: 'high' },
      audience: { kind: 'both' }
    }]
  });

  const room = store.getRoom(roomCode);
  assert.equal(room.streams.A.cursor, 1);
  assert.equal(room.streams.B.cursor, 1);
  assert.equal(room.streams.A.events.length, 1);
  assert.equal(room.streams.B.events.length, 1);
  const aItem = room.streams.A.events[0].events[0];
  const bItem = room.streams.B.events[0].events[0];
  assert.deepEqual(aItem, bItem);
  assert.match(aItem.eventId, /^[0-9a-f-]{36}$/i);
  assert.deepEqual(aItem, {
    eventId: aItem.eventId,
    contentId: 'orpheus-shared-1',
    type: 'story',
    text: '同一則公開訊息',
    payload: { emphasis: 'high' }
  });
});

test('direct content advances only its recipient without a placeholder or cursor gap', () => {
  const { store, roomCode } = occupiedStore();
  store.transact(roomCode, () => {}, {
    playerId: 'player-a',
    actionId: 'direct-1',
    events: [{
      contentId: 'orpheus-private-a',
      type: 'system',
      text: '只給 A',
      payload: { mission: 'a-1' },
      audience: { kind: 'player', playerId: 'player-a' }
    }]
  });

  const room = store.getRoom(roomCode);
  assert.equal(room.streams.A.cursor, 1);
  assert.equal(room.streams.A.events.length, 1);
  assert.equal(room.streams.B.cursor, 0);
  assert.deepEqual(room.streams.B.events, []);
  assert.equal(room.messages.some(message => message.text === '只給 A'), true);
});

test('mixed public and private content is composed into one actor envelope per changed projection', () => {
  const { store, roomCode } = occupiedStore();
  store.transact(roomCode, draft => {
    draft.chapter = 2;
  }, {
    playerId: 'player-a',
    actionId: 'mixed-1',
    events: [
      {
        contentId: 'shared-transition',
        type: 'story',
        text: '共同進入第二章',
        payload: { chapter: 2 },
        audience: { kind: 'both' }
      },
      {
        contentId: 'private-followup-a',
        type: 'system',
        text: 'A 的額外指示',
        payload: { target: 'A' },
        audience: { kind: 'role', role: 'host' }
      }
    ]
  });

  const room = store.getRoom(roomCode);
  assert.equal(room.streams.A.events.length, 1);
  assert.equal(room.streams.B.events.length, 1);
  const aEnvelope = room.streams.A.events[0];
  const bEnvelope = room.streams.B.events[0];
  assert.equal(aEnvelope.events.length, 2);
  assert.equal(bEnvelope.events.length, 1);
  assert.equal(aEnvelope.state.publicProgress.chapter, 2);
  assert.equal(bEnvelope.state.publicProgress.chapter, 2);
  assert.deepEqual(aEnvelope.events[0], bEnvelope.events[0]);
  assert.equal(bEnvelope.events.some(item => item.contentId === 'private-followup-a'), false);
});

test('canonical projection changes if and only if that actor gets one cursor increment and envelope', () => {
  const cases = [
    {
      name: 'public',
      mutate(draft) { draft.chapter = 2; },
      changed: { A: true, B: true }
    },
    {
      name: 'A-only',
      mutate(draft) { draft.privateClues = { A: { text: 'A secret' } }; },
      changed: { A: true, B: false }
    },
    {
      name: 'B-only',
      mutate(draft) { draft.privateClues = { B: { text: 'B secret' } }; },
      changed: { A: false, B: true }
    },
    {
      name: 'no-op',
      mutate() {},
      changed: { A: false, B: false }
    }
  ];

  for (const scenario of cases) {
    const { store, roomCode } = occupiedStore({ roomCode: `case-${scenario.name}` });
    const before = store.getRoom(roomCode);
    const players = identities(before);
    const beforeProjection = {
      A: projectForPlayer(before, players.A),
      B: projectForPlayer(before, players.B)
    };
    store.transact(roomCode, scenario.mutate, {
      playerId: 'player-a',
      actionId: scenario.name,
      events: []
    });
    const after = store.getRoom(roomCode);

    for (const role of ['A', 'B']) {
      const projectionChanged = JSON.stringify(beforeProjection[role])
        !== JSON.stringify(projectForPlayer(after, players[role]));
      assert.equal(projectionChanged, scenario.changed[role], `${scenario.name}:${role} projection`);
      assert.equal(after.streams[role].cursor, scenario.changed[role] ? 1 : 0, `${scenario.name}:${role} cursor`);
      assert.equal(after.streams[role].events.length, scenario.changed[role] ? 1 : 0, `${scenario.name}:${role} envelopes`);
    }
  }
});

test('updater, projection, audience, and dispatch failures roll back all transaction state', () => {
  const failures = [
    {
      name: 'updater',
      updater(draft) { draft.mainProgress.push('bad'); throw new Error('updater failed'); },
      events: [],
      pattern: /updater failed/
    },
    {
      name: 'projection',
      updater(draft) { draft.messages.push({ id: 'bad', text: 'bad' }); },
      events: [],
      pattern: /Audience/
    },
    {
      name: 'audience',
      updater(draft) { draft.mainProgress.push('bad'); },
      events: [{ contentId: 'bad-audience', text: 'bad', audience: 'public' }],
      pattern: /Audience|audience/
    },
    {
      name: 'dispatch',
      updater(draft) { draft.mainProgress.push('bad'); },
      events: [{ contentId: 'bad-payload', text: 'bad', payload: () => {}, audience: { kind: 'both' } }],
      pattern: /clone|function/i
    }
  ];

  for (const failure of failures) {
    const { store, roomCode } = occupiedStore({ roomCode: `fail-${failure.name}` });
    const before = streamSnapshot(store.getRoom(roomCode));
    assert.throws(() => store.transact(roomCode, failure.updater, {
      playerId: 'player-a',
      actionId: `failed-${failure.name}`,
      events: failure.events
    }), failure.pattern);
    assert.deepEqual(streamSnapshot(store.getRoom(roomCode)), before, failure.name);
    assert.equal(store.hasProcessedAction(roomCode, `failed-${failure.name}`, 'player-a'), false);
  }
});

test('duplicate action IDs are scoped by player identity', () => {
  const { store, roomCode } = occupiedStore();
  let calls = 0;
  for (const playerId of ['player-a', 'player-a', 'player-b']) {
    store.transact(roomCode, draft => {
      calls += 1;
      draft.mainProgress.push(playerId);
    }, { playerId, actionId: 'same-action', events: [] });
  }
  assert.equal(calls, 2);
  assert.deepEqual(store.getRoom(roomCode).mainProgress, ['player-a', 'player-b']);
});

test('subscriptions observe committed room envelopes, can unsubscribe, and isolate callback throws', () => {
  const { store, roomCode } = occupiedStore();
  const other = occupiedStore({ roomCode: '654321' });
  const received = [];
  let throwingCalls = 0;
  let callbackSawCommittedState = false;
  store.subscribe(roomCode, notification => {
    throwingCalls += 1;
    callbackSawCommittedState ||= store.getRoom(roomCode).chapter === 2;
    notification.envelopes.A.state.publicProgress.chapter = 99;
    throw new Error('listener failure must not escape');
  });
  const unsubscribe = store.subscribe(roomCode, notification => received.push(notification));

  assert.doesNotThrow(() => store.transact(roomCode, draft => {
    draft.chapter = 2;
  }, { playerId: 'player-a', actionId: 'notify-1', events: [] }));
  other.store.transact(other.roomCode, draft => {
    draft.chapter = 3;
  }, { playerId: 'player-a', actionId: 'other-room', events: [] });
  unsubscribe();
  store.transact(roomCode, draft => {
    draft.chapter = 3;
  }, { playerId: 'player-a', actionId: 'notify-2', events: [] });

  assert.equal(callbackSawCommittedState, true);
  assert.equal(throwingCalls, 2);
  assert.equal(received.length, 1);
  assert.equal(received.every(item => item.roomCode === roomCode), true);
  assert.deepEqual(Object.keys(received[0].envelopes).sort(), ['A', 'B']);
  assert.equal(received[0].envelopes.A.cursor, 1);
  assert.equal(received[0].envelopes.B.cursor, 1);
  assert.equal(received[0].envelopes.A.state.publicProgress.chapter, 2);
  assert.equal(store.getRoom(roomCode).chapter, 3);
});

test('failed transactions and no-op projections never notify subscribers', () => {
  const { store, roomCode } = occupiedStore();
  const received = [];
  store.subscribe(roomCode, notification => received.push(notification));

  store.transact(roomCode, () => {}, {
    playerId: 'player-a', actionId: 'no-op', events: []
  });
  assert.throws(() => store.transact(roomCode, draft => {
    draft.chapter = 2;
    throw new Error('rollback');
  }, { playerId: 'player-a', actionId: 'rollback', events: [] }), /rollback/);

  assert.deepEqual(received, []);
});

test('a post-dispatch return snapshot failure rolls back the room and action ID', () => {
  const { store, roomCode } = occupiedStore();
  const before = store.getRoom(roomCode);

  assert.throws(() => store.transact(roomCode, draft => {
    draft.chapter = 2;
    draft.uncloneable = () => 'not cloneable';
  }, {
    playerId: 'player-a',
    actionId: 'uncloneable-result',
    events: []
  }), /clone|function/i);

  assert.deepEqual(store.getRoom(roomCode), before);
  assert.equal(store.hasProcessedAction(roomCode, 'uncloneable-result', 'player-a'), false);
});

test('a content text resolver cannot tamper with store-owned transaction metadata', () => {
  const { store, roomCode } = occupiedStore();
  store.transact(roomCode, draft => {
    draft.chapter = 2;
  }, {
    playerId: 'player-a',
    actionId: 'existing-action',
    events: []
  });
  const before = store.getRoom(roomCode);

  store.transact(roomCode, () => {}, {
    playerId: 'player-a',
    actionId: 'malicious-resolver',
    events: [{
      contentId: 'resolver-isolation',
      audience: { kind: 'both' },
      text(view) {
        const attempts = [
          () => { view.players.A.playerId = 'forged-player'; },
          () => { view.streams.A.cursor = 98; },
          () => { view.streams.A.events.length = 0; },
          () => { view.processedActionIds.clear(); }
        ];
        for (const attempt of attempts) {
          try { attempt(); } catch { /* Expected from a read-only resolver view. */ }
        }
        return 'resolver output';
      }
    }]
  });

  const after = store.getRoom(roomCode);
  assert.deepEqual(after.players, before.players);
  assert.equal(after.streams.A.cursor, before.streams.A.cursor + 1);
  assert.equal(after.streams.B.cursor, before.streams.B.cursor + 1);
  assert.equal(after.streams.A.events.length, before.streams.A.events.length + 1);
  assert.equal(after.streams.B.events.length, before.streams.B.events.length + 1);
  assert.equal(store.hasProcessedAction(roomCode, 'existing-action', 'player-a'), true);
  assert.equal(store.hasProcessedAction(roomCode, 'malicious-resolver', 'player-a'), true);
});

test('resolver context blocks property-descriptor escape and preventExtensions metadata tampering', () => {
  const { store, roomCode } = occupiedStore();
  store.transact(roomCode, draft => {
    draft.chapter = 2;
  }, { playerId: 'player-a', actionId: 'existing-action', events: [] });
  const before = store.getRoom(roomCode);

  store.transact(roomCode, () => {}, {
    playerId: 'player-a',
    actionId: 'descriptor-escape',
    events: [{
      contentId: 'descriptor-escape',
      audience: { kind: 'both' },
      text(context) {
        const players = Object.getOwnPropertyDescriptor(context, 'players')?.value;
        const streams = Object.getOwnPropertyDescriptor(context, 'streams')?.value;
        const processed = Object.getOwnPropertyDescriptor(context, 'processedActionIds')?.value;
        if (players) players.A.playerId = 'descriptor-forged';
        if (streams) streams.A.cursor = 500;
        if (processed) processed.clear();
        Object.preventExtensions(context);
        return `${context.roomCode}:safe resolver context`;
      }
    }]
  });

  const after = store.getRoom(roomCode);
  assert.deepEqual(after.players, before.players);
  assert.equal(after.streams.A.cursor, before.streams.A.cursor + 1);
  assert.equal(after.streams.B.cursor, before.streams.B.cursor + 1);
  assert.equal(
    after.streams.A.events.at(-1).events[0].text,
    `${roomCode}:safe resolver context`
  );
  assert.equal(store.hasProcessedAction(roomCode, 'existing-action', 'player-a'), true);
  assert.equal(store.hasProcessedAction(roomCode, 'descriptor-escape', 'player-a'), true);
});

test('a failed resolver transaction cannot mutate nested fields in existing stored envelopes', () => {
  const { store, roomCode } = occupiedStore();
  store.transact(roomCode, draft => {
    draft.chapter = 2;
  }, {
    playerId: 'player-a',
    actionId: 'seed-envelope',
    events: [{
      contentId: 'seed-content',
      audience: { kind: 'both' },
      text: 'immutable history',
      payload: { nested: { status: 'original' } }
    }]
  });
  const before = store.getRoom(roomCode);
  let retainedDraft;

  assert.throws(() => store.transact(roomCode, draft => {
    retainedDraft = draft;
  }, {
    playerId: 'player-a',
    actionId: 'failed-retained-draft',
    events: [{
      contentId: 'failed-content',
      audience: { kind: 'both' },
      text() {
        try {
          retainedDraft.streams.A.events[0].state.publicProgress.chapter = 999;
          retainedDraft.streams.A.events[0].events[0].payload.nested.status = 'polluted';
        } catch { /* Frozen transaction history rejects nested writes. */ }
        retainedDraft.uncloneable = () => 'force snapshot failure';
        return 'must roll back';
      }
    }]
  }), /clone|function/i);

  const after = store.getRoom(roomCode);
  assert.equal(JSON.stringify(after.streams), JSON.stringify(before.streams));
  assert.deepEqual(after, before);
  assert.equal(store.hasProcessedAction(roomCode, 'failed-retained-draft', 'player-a'), false);
});
