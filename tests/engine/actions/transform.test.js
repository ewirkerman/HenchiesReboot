import { jest } from '@jest/globals';
import { GameEngine } from '../../../src/engine/index.js';
import { TransformAction } from '../../../src/engine/actions/transform.js';

describe('TransformAction', () => {
    it('does not emit lifecycle events when the target already has the target card type', () => {
        const card = { id: 'target_card', name: 'Target Unit', type: 'unit', maxHealth: 4 };
        const target = {
            id: card.id,
            instanceId: 'target_instance',
            name: card.name,
            type: 'unit',
            health: 2,
            ownerId: 'player1'
        };
        const engine = new GameEngine({
            activePlayerId: 'player1',
            history_log: [],
            catalog: [card],
            players: {
                player1: { lines: { mid: [target] } },
                player2: { lines: { mid: [] } }
            },
            equator: []
        });
        const emitSpy = jest.spyOn(engine, 'emit');

        const result = new TransformAction({ target, cardId: card.id }).run(engine);

        expect(result).toBe(false);
        expect(emitSpy).not.toHaveBeenCalled();
        expect(target.health).toBe(2);
        expect(engine.state.history_log).toEqual([]);
    });
});
