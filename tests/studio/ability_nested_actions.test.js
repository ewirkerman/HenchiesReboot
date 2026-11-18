import { ACTION_CATEGORIES, ACTION_MANIFEST, EFFECT_TYPES } from '../../src/engine/actions/action_index.js';
import { getValidEffectTypes, getValidTargetMethods } from '../../src/ability_validation.js';
import { generateEffectsHTML } from '../../src/studio/ability/ability_renderer.js';
import { getRoot } from '../../src/studio/ability/logic_tree.js';
import { addNestedPayloadAtPath, updatePayloadAtPath, addElsePayload, removeElsePayload } from '../../src/studio/ability/payloads.js';
import { StudioState } from '../../src/studio/ability/state.js';

describe('nested ability actions', () => {
    test('renders summon controls and follow-up actions inside a conditional', () => {
        const html = generateEffectsHTML({
            effectGroups: [{
                targetMethod: 'SELF',
                payloads: [{
                    type: 'CONDITIONAL',
                    nestedGroup: {
                        logicTree: { type: 'group', logicalOperator: 'AND', children: [] },
                        payloads: [{
                            type: 'SUMMON',
                            amount: 1,
                            cardId: 'dummy',
                            zone: 'FIELD',
                            nestedGroup: {
                                targetMethod: 'AUTO_ALL',
                                payloads: [
                                    { type: 'MODIFY_STAT', amount: 1, stat: 'strength' },
                                    { type: 'CUSTOM_SCRIPT', script: 'return true;' }
                                ]
                            }
                        }]
                    }
                }]
            }],
            baseTrigger: 'GAME_STARTING',
            scope: 'PERSONAL',
            actMethod: 'NONE',
            activationQuickTargeting: { zones: ['FIELD'] },
            getValidActionsForZones: () => EFFECT_TYPES,
            calculateEffectiveZones: () => ['FIELD'],
            EFFECT_TYPES,
            getValidEffectTypes,
            ACTION_MANIFEST,
            ACTION_CATEGORIES,
            allAbilities: [],
            allCards: [{ id: 'dummy', name: 'Target Dummy' }],
            customTribesList: [],
            getValidTargetMethods
        });

        expect(html).toContain('<option value="SUMMON" selected>');
        expect(html).toContain('Card to Summon');
        expect(html).toContain('updateSummonCardAtPath(0, 0, [0],');
        expect(html).toContain('addNestedPayloadAtPath(0, 0, [0])');
        expect(html).toContain('updatePayloadAtPath(0, 0, [0,0],');
        expect(html).toContain('prettifyPayloadScriptAtPath(0, 0, [0,1],');
    });

    test('updates fields on a nested payload and adds actions to its nested group', () => {
        window.updatePreview = () => {};
        StudioState.effectGroups = [{
            payloads: [{
                type: 'CONDITIONAL',
                nestedGroup: {
                    payloads: [{
                        type: 'SUMMON',
                        amount: 1,
                        cardId: 'dummy',
                        nestedGroup: {
                            targetMethod: 'AUTO_ALL',
                            payloads: [{ type: 'MODIFY_STAT', amount: 1, stat: 'strength' }]
                        }
                    }]
                }
            }]
        }];

        updatePayloadAtPath(0, 0, [0, 0], 'amount', 3);
        addNestedPayloadAtPath(0, 0, [0]);

        const summon = StudioState.effectGroups[0].payloads[0].nestedGroup.payloads[0];
        expect(summon.nestedGroup.payloads[0].amount).toBe(3);
        expect(summon.nestedGroup.payloads).toHaveLength(2);
    });

    test('resolves a nested conditional logic tree by its payload path', () => {
        const nestedLogicTree = { type: 'group', logicalOperator: 'OR', children: [] };
        StudioState.effectGroups = [{
            payloads: [{
                type: 'CONDITIONAL',
                nestedGroup: {
                    payloads: [{
                        type: 'CONDITIONAL',
                        nestedGroup: { logicTree: nestedLogicTree, payloads: [] }
                    }]
                }
            }]
        }];

        expect(getRoot('conditional_0_0_0')).toBe(nestedLogicTree);
    });

    test('renders and manages conditional else payloads', () => {
        window.updatePreview = () => {};
        StudioState.effectGroups = [{
            payloads: [{
                type: 'CONDITIONAL',
                nestedGroup: { logicTree: { type: 'group', children: [] }, payloads: [] },
                elsePayloads: [{ type: 'MODIFY_STAT', amount: 2, stat: 'strength' }]
            }]
        }];

        const html = generateEffectsHTML({
            effectGroups: StudioState.effectGroups,
            baseTrigger: 'GAME_STARTING',
            scope: 'PERSONAL',
            actMethod: 'NONE',
            activationQuickTargeting: { zones: ['FIELD'] },
            getValidActionsForZones: () => EFFECT_TYPES,
            calculateEffectiveZones: () => ['FIELD'],
            EFFECT_TYPES,
            getValidEffectTypes,
            ACTION_MANIFEST,
            ACTION_CATEGORIES,
            allAbilities: [],
            allCards: [],
            customTribesList: [],
            getValidTargetMethods
        });

        expect(html).toContain('ELSE ACTIONS');
        expect(html).toContain('removeElsePayload(0, 0, 0)');
        expect(html).toContain("window.updatePayloadAtPath(0, 0, ['else',0]");

        addElsePayload(0, 0);
        expect(StudioState.effectGroups[0].payloads[0].elsePayloads).toHaveLength(2);
        updatePayloadAtPath(0, 0, ['else', 0], 'amount', 7);
        expect(StudioState.effectGroups[0].payloads[0].elsePayloads[0].amount).toBe(7);
        removeElsePayload(0, 0, 1);
        expect(StudioState.effectGroups[0].payloads[0].elsePayloads).toHaveLength(1);
    });
});
