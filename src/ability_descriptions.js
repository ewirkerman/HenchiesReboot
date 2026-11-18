import { generateAbilityDescription } from './language_description.js';
import { capitalizeDescription, formatCardText } from '../components/card_text.js';

export function getAbilityDescription(ability, allAbilitiesRegistry = [], allCards = null, allTribes = null) {
    let description = ability.displayDescription || ability.description || '';
    if (!description) {
        try {
            description = generateAbilityDescription(ability, allAbilitiesRegistry, allCards, allTribes);
        } catch (error) {
            console.error('Failed to generate ability description', error);
        }
    }
    return capitalizeDescription(description);
}

export function formatAbilityDescription(ability, allAbilitiesRegistry = [], allCards = null, allTribes = null) {
    const description = getAbilityDescription(ability, allAbilitiesRegistry, allCards, allTribes);
    return formatCardText(description || 'No details.', allAbilitiesRegistry, ability.paramX ?? 'X');
}
