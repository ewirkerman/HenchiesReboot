import test from 'node:test';
import assert from 'node:assert/strict';
import { getValidAbilityTargets } from '../src/engine/targeting.js';
import { isPlayUnsafe, isDefaultPlayOptionUnsafe } from '../src/tabletop/play_safety.js';
import { normalizeActionType, getActionButtonTheme } from '../components/action_button_theme.js';

test('Deckhand default play is safe even when the optional on-play ability is unsafe', () => {
  const state = {
    status: 'active',
    activePlayerId: 'player1',
    players: {
      player1: { resources: { Carnie: { current: 10 } } },
      player2: { resources: { Carnie: { current: 10 } } },
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

  assert.equal(isDefaultPlayOptionUnsafe(state, deckhand), false);
  assert.equal(isPlayUnsafe(state, deckhand, null), false);
  assert.equal(isPlayUnsafe(state, deckhand, 'ability_1787097456536'), true);
});

test('Power Wash remains unsafe while Play Normally stays safe in the same Deckhand state', () => {
  const state = {
    status: 'active',
    activePlayerId: 'player1',
    players: {
      player1: { resources: { Carnie: { current: 10 } } },
      player2: { resources: { Carnie: { current: 10 } } },
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

  assert.equal(isPlayUnsafe(state, deckhand, 'ability_1787097456536'), true);
  assert.equal(isPlayUnsafe(state, deckhand, null), false);
  assert.equal(isDefaultPlayOptionUnsafe(state, deckhand), false);
});

test('Secondary play abilities are colored as violet instead of emerald', () => {
  assert.equal(normalizeActionType('PLAY_BOARD', 'ability_1'), 'ABILITY');
  assert.equal(normalizeActionType('PLAY_OPTIONAL', null), 'ABILITY');
  assert.equal(normalizeActionType('MANUAL', null), 'ABILITY');
  assert.equal(normalizeActionType('PLAY_TARGET', 'ability_2'), 'ABILITY');
  assert.equal(getActionButtonTheme('PLAY').baseClass.includes('emerald'), true);
  assert.equal(getActionButtonTheme('ABILITY').baseClass.includes('violet'), true);
});

test('Ability target filters must respect the payload-specific quick targeting, not a blanket avatar ban', () => {
  const state = {
    activePlayerId: 'player1',
    players: {
      player1: {
        lines: {
          avatar: [{ id: 'avatar_p1', instanceId: 'avatar_p1', type: 'avatar', name: 'Avatar', ownerId: 'player1' }],
          front: [{ id: 'unit_1', instanceId: 'unit_1', type: 'unit', name: 'Frontliner', ownerId: 'player1' }],
          mid: [],
          back: [],
          taunt: [],
          bodyguard: [],
          sheltered: [],
          sideline: []
        },
        hand: [],
        deck: [],
        discard: [],
        banish: [],
        resources: { Carnie: { current: 10 } }
      },
      player2: {
        lines: {
          avatar: [{ id: 'avatar_p2', instanceId: 'avatar_p2', type: 'avatar', name: 'Enemy Avatar', ownerId: 'player2' }],
          front: [],
          mid: [],
          back: [],
          taunt: [],
          bodyguard: [],
          sheltered: [],
          sideline: []
        },
        hand: [],
        deck: [],
        discard: [],
        banish: [],
        resources: { Carnie: { current: 10 } }
      }
    },
    equator: [],
    history_log: []
  };

  const card = {
    id: 'equip_card',
    instanceId: 'equip_card',
    name: 'Steel Armband',
    type: 'equipment',
    tribe: 'Carnie',
    abilities: [{
      abilityId: 'equip_to_unit',
      name: 'Equip',
      trigger: 'PLAY_OPTIONAL',
      activation: {
        method: 'PLAYER_CHOICE',
        quickTargeting: {
          zones: ['FIELD'],
          alignment: ['FRIENDLY'],
          entityType: ['UNIT', 'AVATAR'],
          ignoreBattlelines: false
        }
      },
      effects: [{
        targetMethod: 'SAME_AS_ACTIVATION',
        quickTargeting: {
          zones: ['FIELD'],
          alignment: ['FRIENDLY'],
          entityType: ['UNIT'],
          ignoreBattlelines: false
        },
        payloads: [{ type: 'ATTACH' }]
      }]
    }]
  };

  state.players.player1.hand = [card];

  const targets = getValidAbilityTargets(state, 'player1', card.instanceId, 'equip_to_unit');
  assert.deepEqual(targets.map(t => t.id).sort(), ['unit_1']);
});

