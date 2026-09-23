const test = require('node:test');
const assert = require('node:assert/strict');

const { content } = require('../../game/content/contentSchema');
const { story } = require('../../game/content/story');
const { createRoomState } = require('../../game/createRoomState');
const { refreshWorkstation, projectWorkstation } = require('../../game/terminalEngine');

function roomWithFacts(facts) {
  const room = createRoomState('ROOM42', 0);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  room.publicFacts = [...facts];
  refreshWorkstation(room);
  return room;
}

test('late history timeline is hidden until main5 completes', () => {
  const history = content.terminalEntries.find(item => item.id === 'archive.history_timeline');
  assert.ok(history);
  assert.deepEqual(history.unlockWhen, { publicFact: 'main5Completed' });

  const early = roomWithFacts(['roomCreated', 'hostJoined', 'guestJoined']);
  const earlyIds = projectWorkstation(early, { role: 'A', playerId: 'player-a' })
    .files.entries.map(item => item.id);
  assert.equal(earlyIds.includes('archive.history_timeline'), false);

  const late = roomWithFacts(['roomCreated', 'hostJoined', 'guestJoined', 'main5Completed']);
  const lateIds = projectWorkstation(late, { role: 'A', playerId: 'player-a' })
    .files.entries.map(item => item.id);
  assert.equal(lateIds.includes('archive.history_timeline'), true);
});

test('opening narrative matches canon instead of stale human-researcher or hacked-in framing', () => {
  const visibleCopy = JSON.stringify({ story, dialogue: content.dialogue });
  assert.doesNotMatch(visibleCopy, /事故發生後[^。]*偷偷|偷偷接進|林研究員[^。]*咖啡杯/);
  assert.match(story.main1.initial[0].text, /ECHO/);
  assert.match(story.main1.initial[0].text, /正式流程|研究團隊|存取/);
});
