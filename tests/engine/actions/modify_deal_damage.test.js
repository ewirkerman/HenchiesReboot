import { ModifyStatAction } from '../../../src/engine/actions/modify_stat.js';
import { SetStatAction } from '../../../src/engine/actions/set_stat.js';

describe('MODIFY_STAT and SET_STAT event amount', () => {
    let engine;

    beforeEach(() => {
        engine = {
            state: { _actionDepth: 1, history_log: [] },
            processingDepth: 0
        };
    });

    it('modifies incoming damage through the event amount stat', () => {
        const incomingDamage = {
            amount: 2,
            isCombat: true
        };

        new ModifyStatAction({
            type: 'MODIFY_STAT',
            amount: 1,
            stat: 'amount',
            eventContext: incomingDamage
        }).execute(engine);

        expect(incomingDamage.amount).toBe(3);
        expect(incomingDamage.isCombat).toBe(true);
    });

    it('sets incoming damage through the event amount stat', () => {
        const incomingDamage = {
            amount: 2,
            isCombat: true
        };

        new SetStatAction({
            type: 'SET_STAT',
            amount: 0,
            stat: 'amount',
            eventContext: incomingDamage
        }).execute(engine);

        expect(incomingDamage.amount).toBe(0);
        expect(incomingDamage.isCombat).toBe(true);
    });
});
