import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.HTMLElement = class {};
globalThis.customElements = { define() {}, get() { return undefined; } };
globalThis.CustomEvent = class CustomEvent extends Event {
  constructor(type, init = {}) {
    super(type, init);
    this.detail = init.detail;
  }
};

globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return true; },
  openActionModal() {},
  closeUnitActionModal() {},
  handleRestartMatch() {},
  updateUI() {},
  inspectCard() {},
  activateAbility() {},
  executeNormalPlay() {},
  handleHandCardClick() {},
  _isDragging: false,
  _forceHoverCardId: null,
  _dragCardId: null,
  _dragTargets: [],
  _blockClick: false,
  innerWidth: 1200,
};

globalThis.document = {
  querySelector() { return null; },
  querySelectorAll() { return []; },
  getElementById() { return null; },
  createElement() { return { classList: { add() {}, remove() {}, toggle() {}, replace() {} }, setAttribute() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; }, closest() { return null; }, firstElementChild: null }; },
};

const { ClientState } = await import('../src/tabletop/client_state.js');
const { isPlayUnsafe, isDefaultPlayOptionUnsafe } = await import('../src/tabletop/interactions.js');

test('default play stays safe even when the optional on-play ability is unsafe', () => {
  ClientState.gameState = {
    status: 'active',
    activePlayerId: 'player1',
    players: {
      player1: {
        name: 'Player 1',
        resources: { Carnie: { current: 10 } },
        lines: { taunt: [], bodyguard: [], avatar: [], front: [], mid: [], back: [], sheltered: [], sideline: [] },
        hand: [],
        deck: [{ id: 'deck_card_1' }],
        discard: [],
        banish: [],
      },
      player2: {
        name: 'Player 2',
        resources: { Carnie: { current: 10 } },
        lines: { taunt: [], bodyguard: [], avatar: [], front: [], mid: [], back: [], sheltered: [], sideline: [] },
        hand: [],
        deck: [{ id: 'opp_deck_1' }],
        discard: [],
        banish: [],
      },
    },
  };

  const deckhand = {
    id: 'card_1787097372520',
    name: 'Deckhand',
    tribe: 'tribe_pirate',
    cost: 1,
    abilities: [
      {
        abilityId: 'ability_1787097456536',
        name: 'Power Wash',
        trigger: 'PLAY_OPTIONAL',
        passiveFlags: [],
        effects: [
          {
            targetMethod: 'AUTO_RANDOM',
            payloads: [{ type: 'DISCARD' }],
          },
        ],
        cost: { carnie: 3, tribeAmount: 0 },
      },
    ],
  };

  assert.equal(isDefaultPlayOptionUnsafe(deckhand), false);
  assert.equal(isPlayUnsafe(deckhand, null), false);
  assert.equal(isPlayUnsafe(deckhand, 'ability_1787097456536'), true);
});
