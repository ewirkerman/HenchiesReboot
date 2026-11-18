import { findAbilityByOptionValue, getAbilityOptionValue } from '../../src/studio/card/ability_options.js';

describe('card ability options', () => {
  test('resolves a selected duplicate-name suggestion by its ability ID', () => {
    const abilities = [
      { abilityId: 'ability-first', name: 'Shared Name' },
      { abilityId: 'ability-second', name: 'Shared Name' }
    ];

    const optionValues = abilities.map(getAbilityOptionValue);
    const selectedAbility = findAbilityByOptionValue(abilities, optionValues[1]);

    expect(optionValues[0]).not.toBe(optionValues[1]);
    expect(selectedAbility.abilityId).toBe('ability-second');
  });

  test('does not resolve an unselected name-only value', () => {
    const abilities = [{ abilityId: 'ability-first', name: 'Shared Name' }];

    expect(findAbilityByOptionValue(abilities, 'Shared Name')).toBeUndefined();
  });
});
