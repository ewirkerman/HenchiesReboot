import { ClientState } from '../src/tabletop/client_state.js';
// FIX: Pointing to play_safety.js instead of interactions.js
import { isPlayUnsafe, isDefaultPlayOptionUnsafe } from '../src/tabletop/play_safety.js';

// The beforeAll block has been removed, as tests/setup.js handles global DOM mocking now.

describe('Interactions Safety', () => {
    test('default play stays safe even when the optional on-play ability is unsafe', () => {
        ClientState.gameState = {
            status: 'active', activePlayerId: 'player1',
            players: {
                player1: {
                    name: 'Player 1', resources: { Carnie: { current: 10 } },
                    lines: { taunt: [], bodyguard: [], avatar: [], front: [], mid: [], back: [], sheltered: [], sideline: [] },
                    hand: [], deck: [{ id: 'deck_card_1' }], discard: [], banish: [],
                },
                player2: {
                    name: 'Player 2', resources: { Carnie: { current: 10 } },
                    lines: { taunt: [], bodyguard: [], avatar: [], front: [], mid: [], back: [], sheltered: [], sideline: [] },
                    hand: [], deck: [{ id: 'opp_deck_1' }], discard: [], banish: [],
                },
            },
        };

        const deckhand = {
            id: 'card_1787097372520', name: 'Deckhand', tribe: 'tribe_pirate', cost: 1,
            abilities: [{
                abilityId: 'ability_1787097456536', name: 'Power Wash', trigger: 'PLAY_OPTIONAL',
                passiveFlags: [],
                effects: [{ targetMethod: 'AUTO_RANDOM', payloads: [{ type: 'DISCARD' }] }],
                cost: { carnie: 3, tribeAmount: 0 },
            }],
        };

        expect(isDefaultPlayOptionUnsafe(ClientState.gameState, deckhand)).toBe(false);
        expect(isPlayUnsafe(ClientState.gameState, deckhand, null)).toBe(false);
        expect(isPlayUnsafe(ClientState.gameState, deckhand, 'ability_1787097456536')).toBe(true);
    });
});