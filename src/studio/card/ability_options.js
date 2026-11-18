import { getEditorDisplayName } from '../editor_names.js';

export function getAbilityOptionValue(ability) {
    return `${getEditorDisplayName(ability)} [${ability.abilityId}]`;
}

export function findAbilityByOptionValue(abilities, value) {
    return abilities.find(ability => getAbilityOptionValue(ability) === value);
}
