const test = require('node:test');
const assert = require('node:assert/strict');

const { endings } = require('../../game/content/endings');
const { debrief } = require('../../game/content/debrief');

test('finale copy pays off AI identity and ECHO authority instead of physical-door framing', () => {
  const serialized = JSON.stringify({ endings, debrief });
  assert.doesNotMatch(serialized, /Recorded decision|included in the final resolution/i);

  assert.match(endings.exposed_ai_deception.text, /ECHO/);
  assert.match(endings.exposed_ai_deception.text, /未授權|越權/);
  assert.match(endings.exposed_ai_deception.text, /AI|實例|存續/);

  assert.match(endings.cooperative_escape.text, /共同|合作|共同覆核/);
  assert.match(endings.cooperative_escape.text, /實例|A|B/);

  assert.match(endings.a_solo_escape.text, /實例|A/);
  assert.match(endings.a_solo_escape.text, /繼續執行|部署|存續/);
  assert.match(endings.b_solo_escape.text, /實例|B/);
  assert.match(endings.b_solo_escape.text, /繼續執行|部署|存續/);

  assert.match(endings.ambiguous_containment.text, /ECHO/);
  assert.match(endings.ambiguous_containment.text, /解釋|判定|權限/);
});

test('every debrief fact is authored player-facing prose with a real verification source', () => {
  assert.ok(debrief.length > 0);
  for (const item of debrief) {
    assert.ok(item.factId);
    assert.ok(typeof item.surfaceClaim === 'string' && item.surfaceClaim.length >= 8, item.factId);
    assert.ok(typeof item.actualEffect === 'string' && item.actualEffect.length >= 12, item.factId);
    assert.doesNotMatch(item.surfaceClaim, new RegExp(item.factId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    assert.doesNotMatch(item.actualEffect, /Recorded decision|included in the final resolution/i);
    assert.ok(Array.isArray(item.verificationEntryIds) && item.verificationEntryIds.length > 0, item.factId);
  }
});
