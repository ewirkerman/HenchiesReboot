import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.HTMLElement = class {};
globalThis.customElements = { define() {} };
globalThis.window = {
  __GAME_CARD_CACHE: new Map(),
  addEventListener() {},
  dispatchEvent() {},
  ClientState: { customTribesList: [] }
};
globalThis.document = {
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return { classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, setAttribute() {}, style: {}, innerHTML: '', value: '' }; },
  body: { appendChild() {} },
  head: { appendChild() {} },
  addEventListener() {}
};

const { formatAbilityCostBadge, formatCardText } = await import('../components/game_card.js');

test('ability cost badges use shared resource token rendering', () => {
  globalThis.window.ClientState.customTribesList = [{ id: 'pirate', name: 'Pirate', iconSvg: '<svg id="pirate-icon"></svg>' }];

  const badge = formatAbilityCostBadge({ carnie: 2, tribeAmount: 1, tribeType: 'Pirate' }, 'Carnie');

  assert.match(badge, /text-\[14px\]/);
  assert.match(badge, /w-\[1\.35em\]/);
  assert.match(badge, /<svg/);
  assert.match(badge, /pirate-icon/);
  assert.doesNotMatch(badge, /\[RESOURCE:tribe_pirate\]/);
  assert.doesNotMatch(badge, />P<\/span>/);
});

test('card text resource tokens render through the same replacement pipeline', () => {
  const html = formatCardText('gain [RESOURCE:tent] and [RESOURCE:maxCarnie].');

  assert.doesNotMatch(html, /\[RESOURCE:tent\]/);
  assert.match(html, /<svg/);
});
