import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../src/engine/utils.js', () => ({
    findEntityLocation: jest.fn(() => ({ playerId: 'player1' })),
    isUndoable: jest.fn(() => true),
    moveEntity: jest.fn(),
    resolveResourceKey: jest.fn((state, player, resource) => resource)
}));

const { HarvestAction } = await import('../../../src/engine/actions/harvest.js');

function createEngine() {
    return {
        state: {
            activePlayerId: 'player1',
            history_log: [],
            players: {
                player1: {
                    name: 'Player 1',
                    resources: {
                        Carnie: { current: 3, max: 5 },
                        Pirate: { current: 1, max: 4 }
                    }
                }
            }
        },
        processingDepth: 0
    };
}

describe('HarvestAction', () => {
    it('gives a token exactly 2 temporary Carnie resources regardless of payload parameters', () => {
        const engine = createEngine();
        const target = { id: 'summoned-card', name: 'Summoned Card', tribe: 'Pirate', isToken: true };

        new HarvestAction({
            source: { ownerId: 'player1' },
            target,
            amount: 8,
            resource: 'Pirate'
        }).execute(engine);

        expect(engine.state.players.player1.resources).toEqual({
            Carnie: { current: 5, max: 5 },
            Pirate: { current: 1, max: 4 }
        });
        expect(engine.state.history_log[0].text).toContain('+2 Carnie');
        expect(engine.state.history_log[0].text).not.toContain('Max');
    });

    it('preserves the regular harvest amount and resource behavior', () => {
        const engine = createEngine();
        const target = { id: 'card', name: 'Card', tribe: 'Pirate', isToken: false };

        new HarvestAction({
            source: { ownerId: 'player1' },
            target,
            amount: 3,
            resource: 'Pirate'
        }).execute(engine);

        expect(engine.state.players.player1.resources.Pirate).toEqual({ current: 4, max: 7 });
    });
});
