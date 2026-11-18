import { ACTION_CATEGORIES, ACTION_MANIFEST, EFFECT_TYPES } from '../../src/engine/actions/action_index.js';
import { getValidEffectTypes, getValidTargetMethods } from '../../src/ability_validation.js';
import { generateEffectsHTML } from '../../src/studio/ability/ability_renderer.js';
import { StudioState } from '../../src/studio/ability/state.js';
import { updateAbilitySelectionAtPath } from '../../src/studio/ability/payloads.js';

describe('UPDATE_ABILITY_LEVEL editor action', () => {
    test('is selectable and renders ability, amount, operation, and duration controls', () => {
        const html = generateEffectsHTML({
            effectGroups: [{
                targetMethod: 'SELF',
                payloads: [{
                    type: 'UPDATE_ABILITY_LEVEL',
                    abilityId: 'ab_1',
                    amount: 3,
                    modify: true,
                    duration: 'BRIEF'
                }]
            }],
            baseTrigger: 'MANUAL',
            scope: 'PERSONAL',
            actMethod: 'NONE',
            activationQuickTargeting: { zones: ['FIELD'] },
            getValidActionsForZones: () => EFFECT_TYPES,
            calculateEffectiveZones: () => ['FIELD'],
            EFFECT_TYPES,
            getValidEffectTypes,
            ACTION_MANIFEST,
            ACTION_CATEGORIES,
            allAbilities: [{ abilityId: 'ab_1', name: 'Power Strike' }],
            allCards: [],
            customTribesList: [],
            getValidTargetMethods
        });

        expect(html).toContain('<option value="UPDATE_ABILITY_LEVEL" selected>');
        expect(html).toContain('Ability to Update');
        expect(html).toContain('Power Strike [ab_1]');
        expect(html).toContain('Magnitude');
        expect(html).toContain('Add to current X');
        expect(html).toContain('Duration');
    });

    test('stores the selected ability ID for root and nested payloads', () => {
        StudioState.allAbilities = [{ abilityId: 'ab_1', name: 'Power Strike' }];
        StudioState.effectGroups = [{
            payloads: [{
                type: 'UPDATE_ABILITY_LEVEL',
                nestedGroup: {
                    payloads: [{ type: 'UPDATE_ABILITY_LEVEL' }]
                }
            }]
        }];
        window.updatePreview = () => {};

        updateAbilitySelectionAtPath(0, 0, [], 'Power Strike [ab_1]');
        updateAbilitySelectionAtPath(0, 0, [0], 'ab_1');

        expect(StudioState.effectGroups[0].payloads[0].abilityId).toBe('ab_1');
        expect(StudioState.effectGroups[0].payloads[0].nestedGroup.payloads[0].abilityId).toBe('ab_1');
    });
});
