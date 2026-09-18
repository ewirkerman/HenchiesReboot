import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../src/engine/utils.js', () => ({
    findEntityLocation: jest.fn(() => null),
    isUndoable: jest.fn(() => true),
    moveEntity: jest.fn()
}));

const { HealAction } = await import('../../../src/engine/actions/heal.js');
const { revertEffect } = await import('../../../src/engine/actions/core.js');

function createEngine() {
    return {
        state: {
            activePlayerId: 'player1',
            history_log: [],
            players: { player1: { lines: {} }, player2: { lines: {} } }
        },
        processingDepth: 0
    };
}

describe('HealAction Overheal', () => {
    it('keeps normal healing capped at max health', () => {
        const engine = createEngine();
        const target = { name: 'Unit', health: 8, maxHealth: 10 };

        new HealAction({ type: 'HEAL', target, amount: 5 }).execute(engine);

        expect(target.health).toBe(10);
        expect(target.activeEffects).toBeUndefined();
    });

    it('registers only excess health as temporary and reverts it', () => {
        const engine = createEngine();
        const target = { name: 'Unit', health: 8, maxHealth: 10 };

        new HealAction({ type: 'HEAL', target, amount: 5, overheal: true }).execute(engine);

        expect(target.health).toBe(13);
        expect(target.activeEffects).toHaveLength(1);
        expect(target.activeEffects[0]).toMatchObject({ type: 'MODIFY_STAT', duration: 'TEMPORARY', stat: 'health', delta: 3 });

        revertEffect(engine, target, target.activeEffects[0]);

        expect(target.health).toBe(10);
    });
});