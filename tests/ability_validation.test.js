import { getValidEffectTypes, getValidScopes, getValidTargetMethods, validateAbilityLogic } from '../src/ability_validation.js';

describe('GAME_STARTING ability validation', () => {
    it('is a personal-only, non-cancellable system trigger', () => {
        expect(getValidScopes('GAME_STARTING')).toEqual(['PERSONAL']);
        expect(getValidTargetMethods('GAME_STARTING', 'PERSONAL', 'NONE')).not.toContain('EVENT_SOURCE');
        expect(getValidEffectTypes('GAME_STARTING', ['DRAW_CARD', 'CANCEL_EVENT'])).toEqual(['DRAW_CARD']);
        expect(validateAbilityLogic({
            trigger: 'GAME_STARTING',
            triggerScope: 'PERSONAL',
            effects: [{ targetMethod: 'SELF', payloads: [{ type: 'CANCEL_EVENT' }] }]
        })).toContain('CANCEL_EVENT cannot be used with the GAME_STARTING trigger.');
    });
});
