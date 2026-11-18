import { getAbilityDescription } from '../../src/ability_descriptions.js';

describe('getAbilityDescription', () => {
    it('does not capitalize the first word after a leading battleline icon', () => {
        const ability = {
            trigger: 'ON_BE_PLAYED',
            triggerScope: 'PERSONAL',
            effects: [{
                targetMethod: 'SELF',
                payloads: [{
                    type: 'SET_STAT',
                    amount: 'front',
                    stat: 'line',
                    duration: 'TEMPORARY'
                }]
            }]
        };

        expect(getAbilityDescription(ability)).toBe('[BATTLELINE:front] this round.');
    });
});
