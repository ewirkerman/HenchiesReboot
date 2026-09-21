import { ModifyEventAction } from '../../../src/engine/actions/modify_event.js';

describe('MODIFY_DEAL_DAMAGE event modifiers', () => {
    it('applies a Fire-style amount modifier to incoming combat damage', () => {
        const incomingDamage = {
            amount: 2,
            isCombat: true
        };
        const engine = {
            state: { _actionDepth: 1, history_log: [] },
            processingDepth: 0
        };

        const modifyDamage = new ModifyEventAction({
            type: 'MODIFY_EVENT',
            amount: 1,
            stat: 'amount',
            eventContext: incomingDamage
        });

        modifyDamage.execute(engine);

        expect(incomingDamage.amount).toBe(3);
        expect(incomingDamage.isCombat).toBe(true);
    });
});