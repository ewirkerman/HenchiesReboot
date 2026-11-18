import { generateLogicTreeText, getTriggerWord } from '../../src/language/triggers.js';

describe('getTriggerWord', () => {
    it('prefixes modify events with Pre-', () => {
        expect(getTriggerWord('MODIFY_BE_PLAYED')).toBe('Pre-Play');
        expect(getTriggerWord('MODIFY_BE_DAMAGED')).toBe('Pre-Damaged');
        expect(getTriggerWord('ON_BE_PLAYED')).toBe('Play');
        expect(getTriggerWord('GAME_STARTING')).toBe('Game Start');
    });

    it('uses the duration form only when every attached-event payload persists while attached', () => {
        expect(getTriggerWord('ON_BE_ATTACHED', [{
            payloads: [{ type: 'GRANT_ABILITY', duration: 'WHILE_ATTACHED' }]
        }])).toBe('While Attached');

        expect(getTriggerWord('ON_BE_ATTACHED', [
            { payloads: [{ type: 'GRANT_ABILITY', duration: 'WHILE_ATTACHED' }] },
            { payloads: [{ type: 'MODIFY_STAT', duration: 'INSTANT' }] }
        ])).toBe('Attached');

        expect(getTriggerWord('ON_BE_ATTACHED')).toBe('Attached');
    });

    it('checks nested conditional payloads when choosing the attached-event wording', () => {
        expect(getTriggerWord('ON_BE_ATTACHED', [{
            payloads: [{
                type: 'CONDITIONAL',
                nestedGroup: {
                    payloads: [{ type: 'GRANT_ABILITY', duration: 'WHILE_ATTACHED' }]
                }
            }]
        }])).toBe('While Attached');
    });
});

describe('generateLogicTreeText', () => {
    it('describes whether the evaluated entity has attacked this turn', () => {
        expect(generateLogicTreeText({
            type: 'condition',
            attribute: 'hasAttackedThisTurn',
            operator: '==',
            value: 'true'
        })).toBe('it has attacked this turn');

        expect(generateLogicTreeText({
            type: 'condition',
            attribute: 'hasAttackedThisTurn',
            operator: '==',
            value: 'false'
        })).toBe('it has not attacked this turn');
    });

    it('uses the contextual subject and supports inequality', () => {
        expect(generateLogicTreeText({
            type: 'condition',
            attribute: 'hasAttackedThisTurn',
            operator: '!=',
            value: 'true',
            context: 'EVENT_SOURCE'
        }, 'ON_ATTACK')).toBe('the attacker has not attacked this turn');
    });

    it('describes event amount comparisons using the trigger event', () => {
        expect(generateLogicTreeText({
            type: 'condition',
            attribute: 'amount',
            operator: '>',
            value: '1',
            context: 'EVENT'
        }, 'MODIFY_BE_DAMAGED')).toBe('that damage is more than 1');

        expect(generateLogicTreeText({
            type: 'condition',
            attribute: 'amount',
            operator: '<=',
            value: '3',
            context: 'EVENT'
        }, 'ON_DRAW')).toBe('the number of cards drawn is at most 3');
    });

    it('describes event combat and event ability conditions', () => {
        expect(generateLogicTreeText({
            type: 'condition',
            attribute: 'isCombat',
            operator: '==',
            value: 'true',
            context: 'EVENT'
        }, 'MODIFY_BE_DAMAGED')).toBe('that damage is combat damage');

        expect(generateLogicTreeText({
            type: 'condition',
            attribute: 'isCombat',
            operator: '!=',
            value: 'true',
            context: 'EVENT'
        }, 'MODIFY_BE_DAMAGED')).toBe('that damage is not combat damage');

        expect(generateLogicTreeText({
            type: 'condition',
            attribute: 'eventAbility',
            operator: '==',
            value: 'ability_1',
            context: 'EVENT'
        }, 'ON_DEAL_DAMAGE', null, [{ abilityId: 'ability_1', name: 'Fireball' }])).toBe(
            'the event was caused by @[ability_1]'
        );

        expect(generateLogicTreeText({
            type: 'condition',
            attribute: 'eventAbility',
            operator: '!=',
            value: 'ability_1',
            context: 'EVENT'
        }, 'ON_DEAL_DAMAGE', null, [{ abilityId: 'ability_1', name: 'Fireball' }])).toBe(
            'the event was not caused by @[ability_1]'
        );
    });
});
