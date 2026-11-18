import { generateAbilityDescription } from '../../src/language_description.js';

describe('UPDATE_ABILITY_LEVEL descriptions', () => {
    const makeAbility = payload => ({
        trigger: 'MANUAL',
        effects: [{
            targetMethod: 'SELF',
            payloads: [payload]
        }]
    });

    test('describes setting the selected ability X', () => {
        const description = generateAbilityDescription(makeAbility({
            type: 'UPDATE_ABILITY_LEVEL',
            abilityId: 'ab_1',
            amount: 4,
            duration: 'INSTANT'
        }), [{ abilityId: 'ab_1', name: 'Power Strike' }]);

        expect(description).toMatch(/set/i);
        expect(description).toContain('@[ab_1]');
        expect(description).toContain('4');
    });

    test('describes modifying the selected ability X', () => {
        const description = generateAbilityDescription(makeAbility({
            type: 'UPDATE_ABILITY_LEVEL',
            abilityId: 'ab_1',
            amount: 2,
            modify: true,
            duration: 'INSTANT'
        }), [{ abilityId: 'ab_1', name: 'Power Strike' }]);

        expect(description).toMatch(/increase/i);
        expect(description).toContain('@[ab_1]');
        expect(description).toContain('2');
    });
});
