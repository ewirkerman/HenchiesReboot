import { getValidAbilityTargets } from '../src/engine/targeting.js';
import { isPlayUnsafe, isDefaultPlayOptionUnsafe } from '../src/tabletop/play_safety.js';
import { getActionButtonTheme } from '../components/action_button_theme.js';

describe('Play Safety', () => {
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
            abilities: [{
                abilityId: 'ability_1787097456536',
                name: 'Power Wash',
                trigger: 'PLAY_OPTIONAL',
                passiveFlags: [],
                effects: [{
                    targetMethod: 'AUTO_RANDOM',
                    payloads: [{ type: 'DISCARD' }],
                }],
                cost: { carnie: 3, tribeAmount: 0 },
            }],
        };

        expect(isDefaultPlayOptionUnsafe(state, deckhand)).toBe(false);
        expect(isPlayUnsafe(state, deckhand, null)).toBe(false);
        expect(isPlayUnsafe(state, deckhand, 'ability_1787097456536')).toBe(true);
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
            abilities: [{
                abilityId: 'ability_1787097456536',
                name: 'Power Wash',
                trigger: 'PLAY_OPTIONAL',
                passiveFlags: [],
                effects: [{
                    targetMethod: 'AUTO_RANDOM',
                    payloads: [{ type: 'DISCARD' }],
                }],
                cost: { carnie: 3, tribeAmount: 0 },
            }],
        };

        expect(isPlayUnsafe(state, deckhand, 'ability_1787097456536')).toBe(true);
        expect(isPlayUnsafe(state, deckhand, null)).toBe(false);
        expect(isDefaultPlayOptionUnsafe(state, deckhand)).toBe(false);
    });

    test('Default play is flagged as UNSAFE if a mandatory PLAY ability is irreversible', () => {
        const state = {
            status: 'active',
            history_log: []
        };

        const drawCard = {
            id: 'card_draw_1',
            name: 'Pot of Greed',
            type: 'spell',
            abilities: [
                {
                    abilityId: 'ab_draw',
                    trigger: 'PLAY',
                    effects: [{
                        targetMethod: 'SELF',
                        payloads: [{ type: 'DRAW_CARD', amount: 2 }]
                    }]
                }
            ]
        };

        // Drawing a card is not undoable, so the mandatory PLAY trigger makes the default play unsafe.
        expect(isDefaultPlayOptionUnsafe(state, drawCard)).toBe(true);
    });

    test('Secondary play abilities are colored as violet instead of emerald', () => {
        expect(getActionButtonTheme('PLAY').baseClass.includes('emerald')).toBe(true);
        expect(getActionButtonTheme('ABILITY').baseClass.includes('violet')).toBe(true);
    });

    test('Ability target filters must respect the payload-specific quick targeting, not a blanket avatar ban', () => {
        const state = {
            activePlayerId: 'player1',
            players: {
                player1: {
                    lines: {
                        avatar: [{ id: 'avatar_p1', instanceId: 'avatar_p1', type: 'avatar', name: 'Avatar', ownerId: 'player1' }],
                        front: [{ id: 'unit_1', instanceId: 'unit_1', type: 'unit', name: 'Frontliner', ownerId: 'player1' }],
                        mid: [], back: [], taunt: [], bodyguard: [], sheltered: [], sideline: []
                    },
                    hand: [], deck: [], discard: [], banish: [],
                    resources: { Carnie: { current: 10 } }
                },
                player2: {
                    lines: {
                        avatar: [{ id: 'avatar_p2', instanceId: 'avatar_p2', type: 'avatar', name: 'Enemy Avatar', ownerId: 'player2' }],
                        front: [], mid: [], back: [], taunt: [], bodyguard: [], sheltered: [], sideline: []
                    },
                    hand: [], deck: [], discard: [], banish: [],
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
                        zones: ['FIELD'], alignment: ['FRIENDLY'], entityType: ['UNIT', 'AVATAR'], ignoreBattlelines: false
                    }
                },
                effects: [{
                    targetMethod: 'SAME_AS_ACTIVATION',
                    quickTargeting: {
                        zones: ['FIELD'], alignment: ['FRIENDLY'], entityType: ['UNIT'], ignoreBattlelines: false
                    },
                    payloads: [{ type: 'ATTACH' }]
                }]
            }]
        };

        state.players.player1.hand = [card];

        const targets = getValidAbilityTargets(state, 'player1', card.instanceId, 'equip_to_unit');
        
        // Both the Avatar AND the Unit are valid because of the Activation block entityType priority
        expect(targets.map(t => t.id).sort()).toEqual(['avatar_p1', 'unit_1']);
    });
});