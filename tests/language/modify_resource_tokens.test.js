import { formatCombinedPayloads, formatPayload } from '../../src/language/format_payload.js';
import { ReferenceTracker } from '../../src/language/utils.js';

describe('MODIFY_RESOURCE language formatting', () => {
    const formatCtx = {
        tracker: new ReferenceTracker(),
        groupId: 'self',
        targetStr: 'this',
        isPlural: false,
        allTribes: [{ id: 'tribe_elemental', name: 'Elemental' }]
    };

    it('preserves tribe resource IDs for individual payloads', () => {
        const text = formatPayload({
            type: 'MODIFY_RESOURCE',
            resource: 'tribe_elemental',
            amount: 1
        }, formatCtx);

        expect(text).toContain('[RESOURCE:tribe_elemental]');
        expect(text).not.toContain('[RESOURCE:elemental]');
    });

    it('preserves tribe resource IDs for grouped payloads', () => {
        const text = formatCombinedPayloads([
            { type: 'MODIFY_RESOURCE', resource: 'tribe_elemental', amount: 1 },
            { type: 'MODIFY_RESOURCE', resource: 'tribe_elemental', amount: 2 }
        ], { ...formatCtx, tracker: new ReferenceTracker() });

        expect(text).toContain('[RESOURCE:tribe_elemental]');
        expect(text).not.toContain('[RESOURCE:elemental]');
    });
});
