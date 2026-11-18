import { generateAbilityDescription } from '../../src/language_description.js';

describe('generateAbilityDescription', () => {
    it('includes conditional else actions and omits an empty else branch', () => {
        const conditional = {
            trigger: 'MANUAL',
            activation: { method: 'NONE', quickTargeting: { zones: ['FIELD'], alignment: ['FRIENDLY'], entityType: ['UNIT'], ignoreBattlelines: false } },
            effects: [{
                targetMethod: 'SELF',
                payloads: [{
                    type: 'CONDITIONAL',
                    nestedGroup: {
                        logicTree: { type: 'group', logicalOperator: 'AND', children: [{ type: 'condition', attribute: 'readiness', operator: '>', value: 0 }] },
                        payloads: [{ type: 'DRAW_CARD', amount: 1 }]
                    },
                    elsePayloads: [{ type: 'HEAL', amount: 2 }]
                }]
            }]
        };

        const description = generateAbilityDescription(conditional);
        expect(description).toMatch(/otherwise/i);

        conditional.effects[0].payloads[0].elsePayloads = [];
        expect(generateAbilityDescription(conditional)).not.toMatch(/otherwise/i);
    });

    it('describes the IGNORE_BATTLELINES passive flag', () => {
        expect(generateAbilityDescription({
            passiveFlags: ['IGNORE_BATTLELINES'],
            trigger: 'UNTRIGGERABLE',
            effects: []
        })).toBe('Ignores battlelines.');
    });

    it('includes a global activation filter when the effect targets itself', () => {
        const ability = {
            trigger: 'ON_BE_PLAYED',
            triggerScope: 'GLOBAL',
            activation: {
                method: 'NONE',
                quickTargeting: {
                    zones: ['FIELD'],
                    alignment: ['FRIENDLY'],
                    entityType: ['BOON'],
                    ignoreBattlelines: true
                },
                logicTree: {
                    type: 'group',
                    logicalOperator: 'AND',
                    children: [{
                        type: 'condition',
                        attribute: 'genus',
                        operator: '==',
                        value: 'Banner'
                    }]
                }
            },
            effects: [{
                targetMethod: 'SELF',
                payloads: [{ type: 'RETURN', duration: 'INSTANT' }]
            }]
        };

        expect(generateAbilityDescription(ability)).toBe(
            'If it is a Banner ally boon, <span class="action-verb">return</span> this.'
        );
    });

    it('uses the trigger event, not the effect payload, to omit global trigger zones', () => {
        const ability = {
            trigger: 'MODIFY_BE_PLAYED',
            triggerScope: 'GLOBAL',
            activation: {
                method: 'NONE',
                quickTargeting: {
                    zones: ['FIELD'],
                    alignment: ['FRIENDLY'],
                    entityType: [],
                    ignoreBattlelines: true
                },
                logicTree: {
                    type: 'group',
                    logicalOperator: 'AND',
                    children: [{
                        type: 'condition',
                        attribute: 'genus',
                        operator: '==',
                        value: 'Air'
                    }]
                }
            },
            effects: [{
                targetMethod: 'SELF',
                payloads: [{
                    type: 'MODIFY_RESOURCE',
                    resource: 'Carnie',
                    amount: 1,
                    duration: 'INSTANT'
                }]
            }]
        };

        const description = generateAbilityDescription(ability);

        expect(description).toContain('allied Air card');
        expect(description).not.toContain('on the field');
    });

    it('omits the default field zone for resource effects targeting allies', () => {
        const ability = {
            trigger: 'TURN_ENDING',
            triggerScope: 'PERSONAL',
            effects: [{
                logicTree: {
                    type: 'group',
                    children: [{
                        type: 'condition',
                        attribute: 'tribe',
                        operator: '==',
                        value: 'Undead'
                    }],
                    logicalOperator: 'AND'
                },
                quickTargeting: {
                    entityType: ['UNIT'],
                    ignoreBattlelines: false,
                    zones: ['FIELD'],
                    alignment: ['FRIENDLY']
                },
                targetMethod: 'AUTO_ALL',
                payloads: [{
                    duration: 'TEMPORARY',
                    type: 'MODIFY_RESOURCE',
                    resource: 'Carnie',
                    amount: 1
                }]
            }]
        };

        const description = generateAbilityDescription(ability);

        expect(description).toContain('for each Undead ally this round');
        expect(description).not.toContain('on the field');
    });

    it('phrases negated genus filters as adjectives', () => {
        const ability = {
            trigger: 'ON_BE_PLAYED',
            triggerScope: 'PERSONAL',
            activation: { method: 'NONE' },
            effects: [{
                logicTree: {
                    type: 'group',
                    logicalOperator: 'AND',
                    children: [{
                        type: 'condition',
                        attribute: 'genus',
                        operator: '!=',
                        value: 'Skeleton'
                    }]
                },
                quickTargeting: {
                    zones: ['FIELD'],
                    alignment: ['FRIENDLY'],
                    entityType: ['UNIT'],
                    ignoreBattlelines: true
                },
                targetMethod: 'AUTO_ALL',
                payloads: [{
                    type: 'GRANT_ABILITY',
                    grantedAbilityId: 'ability_1787107364701',
                    duration: 'INSTANT'
                }]
            }]
        };

        expect(generateAbilityDescription(ability)).toBe(
            '<Span class="action-verb">apply</span> @[ability_1787107364701] to all non-Skeleton allies.'
        );
    });

    it('separates global event filters from ability-source conditions and ignores cached wording', () => {
        const ability = {
            trigger: 'ON_BE_PLAYED',
            triggerScope: 'GLOBAL',
            activation: {
                method: 'NONE',
                quickTargeting: {
                    zones: ['FIELD'],
                    alignment: ['FRIENDLY'],
                    entityType: [],
                    ignoreBattlelines: true
                },
                logicTree: {
                    type: 'group',
                    logicalOperator: 'AND',
                    children: [
                        {
                            type: 'condition',
                            attribute: 'genus',
                            operator: '==',
                            value: 'Earth',
                            context: 'EVAL_TARGET'
                        },
                        {
                            type: 'condition',
                            attribute: 'armor',
                            operator: '==',
                            value: '0',
                            context: 'ABILITY_SOURCE'
                        }
                    ]
                }
            },
            effects: [{
                targetMethod: 'HOST',
                _globalFilterCondition: 'the triggering card is an Earth ally where its host [STAT:armor] is 0',
                quickTargeting: {
                    zones: ['FIELD'],
                    alignment: ['ENEMY'],
                    entityType: ['UNIT', 'AVATAR'],
                    ignoreBattlelines: true
                },
                payloads: [{
                    type: 'MODIFY_STAT',
                    duration: 'INSTANT',
                    amount: 1,
                    stat: 'armor',
                    maxStacks: 0
                }]
            }]
        };

        const description = generateAbilityDescription(ability);

        expect(description).toContain(
            'If the played card is an allied Earth card and this unit has no [STAT:armor],'
        );
        expect(description).toContain('<span class="action-verb">give</span> this unit 1 [STAT:armor].');
        expect(description).not.toContain('enemy unit or avatar');
        expect(description).not.toContain('triggering card');
        expect(description).not.toContain('its host');
    });

    it('describes the ability source when it is added to a manual target pool', () => {
        const ability = {
            trigger: 'MANUAL',
            activation: {
                method: 'PLAYER_CHOICE',
                quickTargeting: {
                    zones: ['FIELD'],
                    alignment: ['ENEMY'],
                    entityType: ['UNIT'],
                    includeSelf: true
                }
            },
            effects: [{
                targetMethod: 'SAME_AS_ACTIVATION',
                payloads: [{ type: 'HEAL', amount: 1, duration: 'INSTANT' }]
            }]
        };

        expect(generateAbilityDescription(ability)).toContain('enemy or this card');
    });

    it('includes event amount conditions on damage-modifying abilities', () => {
        const ability = {
            trigger: 'MODIFY_BE_DAMAGED',
            triggerScope: 'PERSONAL',
            activation: {
                method: 'NONE',
                logicTree: {
                    type: 'group',
                    logicalOperator: 'AND',
                    children: [{
                        type: 'condition',
                        attribute: 'amount',
                        operator: '>',
                        value: '1',
                        context: 'EVENT'
                    }]
                }
            },
            effects: [{
                targetMethod: 'SAME_AS_ACTIVATION',
                payloads: [{
                    type: 'MODIFY_STAT',
                    stat: 'amount',
                    amount: -1,
                    duration: 'INSTANT'
                }]
            }]
        };

        expect(generateAbilityDescription(ability)).toBe(
            'If that damage is more than 1, <span class="action-verb">decrease</span> that damage by 1.'
        );
    });

    it('names the action for ACTION-duration effects when the trigger identifies one', () => {
        const ability = {
            trigger: 'MODIFY_ATTACK',
            triggerScope: 'PERSONAL',
            effects: [{
                targetMethod: 'SELF',
                payloads: [{
                    type: 'MODIFY_STAT',
                    stat: 'strength',
                    amount: 1,
                    duration: 'ACTION'
                }]
            }]
        };

        expect(generateAbilityDescription(ability)).toContain('for the attack');
    });

    it('keeps the generic ACTION-duration wording for triggers without a named action', () => {
        const ability = {
            trigger: 'ON_FIELD',
            triggerScope: 'PERSONAL',
            effects: [{
                targetMethod: 'SELF',
                payloads: [{
                    type: 'MODIFY_STAT',
                    stat: 'strength',
                    amount: 1,
                    duration: 'ACTION'
                }]
            }]
        };

        expect(generateAbilityDescription(ability)).toContain('for the current action');
    });
});
