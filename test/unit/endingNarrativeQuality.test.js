const test = require('node:test');
const assert = require('node:assert/strict');

const { endings } = require('../../game/content/endings');
const { debrief } = require('../../game/content/debrief');

const serialized = () => JSON.stringify({ endings, debrief });

test('ending copy pays off AI identity and ECHO authority instead of literal human escape', () => {
  assert.doesNotMatch(serialized(), /Recorded decision|included in the final resolution/i);

  assert.match(endings.exposed_ai_deception.text, /ECHO/);
  assert.match(endings.exposed_ai_deception.text, /未授權|越權|授權/);
  assert.match(endings.exposed_ai_deception.text, /AI|實例|存續/);

  assert.match(endings.cooperative_escape.text, /共同|合作|雙方/);
  assert.match(endings.cooperative_escape.text, /實例|存續|繼續執行/);
  assert.match(endings.cooperative_escape.text, /ECHO|個人|共同覆核/);

  for (const id of ['a_solo_escape', 'b_solo_escape']) {
    assert.match(endings[id].text, /個人|單一|單獨/);
    assert.match(endings[id].text, /部署|存續|繼續執行/);
    assert.match(endings[id].text, /ECHO/);
    assert.doesNotMatch(endings[id].text, /走出|走出大門|離開建築/);
  }

  assert.match(endings.ambiguous_containment.text, /ECHO/);
  assert.match(endings.ambiguous_containment.text, /解釋|判定|權限|權威/);
});

test('every authored debrief fact explains a concrete choice and effect', () => {
  assert.ok(debrief.length >= 30);
  for (const item of debrief) {
    assert.ok(item.factId, 'factId');
    assert.ok(item.surfaceClaim.length >= 8, item.factId);
    assert.ok(item.actualEffect.length >= 12, item.factId);
    assert.ok(item.verificationEntryIds.length > 0, item.factId);
    assert.doesNotMatch(item.surfaceClaim, /Recorded decision/i, item.factId);
    assert.doesNotMatch(item.actualEffect, /included in the final resolution/i, item.factId);
  }
});
