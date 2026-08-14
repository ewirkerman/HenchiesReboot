// filepath: src/studio/importer.js

import { saveCardToCatalog, saveAbilityToCatalog, fetchCustomAbilities } from '../firebase.js';
import { generateAbilityDescription } from '../language_description.js';

export async function processBulkImport(data, allCards, allAbilities, customTribesList) {
    const items = Array.isArray(data) ? data : [data];
    const results = { cardsAdded: 0, abilitiesAdded: 0, errors: [] };
    
    // We fetch a fresh list of abilities to ensure we have the absolute latest IDs for deduplication
    const latestAbilities = await fetchCustomAbilities();
    const liveAbilityRegistry = [...latestAbilities, ...allAbilities];

    for (const item of items) {
        try {
            if (typeof item !== 'object' || item === null) continue;

            if (item.trigger || item.abilityId || item.triggerScope) {
                // 🦆 It's an Ability
                await importSingleAbility(item, liveAbilityRegistry, allCards, customTribesList, results);
            } else if (item.type || item.tribe || item.cost !== undefined) {
                // 🦆 It's a Card
                await importSingleCard(item, liveAbilityRegistry, allCards, customTribesList, results);
            } else {
                results.errors.push(`Unrecognized object format skipped. Missing 'trigger' (Ability) or 'type' (Card).`);
            }
        } catch (e) {
            results.errors.push(`Failed to import item: ${e.message}`);
        }
    }
    
    return results;
}

async function importSingleAbility(abilityData, liveAbilityRegistry, allCards, customTribesList, results) {
    if (!abilityData.name) throw new Error("Ability missing 'name' field.");
    if (!abilityData.trigger) throw new Error(`Ability '${abilityData.name}' missing 'trigger' field.`);

    // If ID is missing or duplicate by name, branch a new ID
    const isNameDuplicate = liveAbilityRegistry.some(a => a.name.toLowerCase() === abilityData.name.toLowerCase() && a.abilityId !== abilityData.abilityId);
    if (!abilityData.abilityId || isNameDuplicate) {
        abilityData.abilityId = 'ability_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        if (isNameDuplicate) abilityData.name += ' (Imported)';
    }

    try {
        abilityData.displayDescription = generateAbilityDescription(abilityData, liveAbilityRegistry, allCards, customTribesList);
    } catch(err) {
        abilityData.displayDescription = 'Auto-description failed.';
    }

    await saveAbilityToCatalog(abilityData);
    
    // Push to the live registry so subsequent imported cards in the same batch can find it
    liveAbilityRegistry.push(abilityData);
    results.abilitiesAdded++;
}

async function importSingleCard(cardData, liveAbilityRegistry, allCards, customTribesList, results) {
    if (!cardData.name) throw new Error("Card missing 'name' field.");
    
    // If ID is missing or duplicate by name, branch a new ID
    const isNameDuplicate = allCards.some(c => c.name.toLowerCase() === cardData.name.toLowerCase() && c.id !== cardData.id);
    if (!cardData.id || isNameDuplicate) {
        cardData.id = 'card_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        if (isNameDuplicate) cardData.name += ' (Imported)';
    }

    // Recursively extract and save nested abilities
    if (cardData.abilities && Array.isArray(cardData.abilities)) {
        for (let i = 0; i < cardData.abilities.length; i++) {
            const ab = cardData.abilities[i];
            if (typeof ab === 'object' && (ab.trigger || ab.abilityId)) {
                // Only save it to the global catalog if it doesn't already exist
                const exists = liveAbilityRegistry.some(a => a.abilityId === ab.abilityId || a.name === ab.name);
                if (!exists) {
                    await importSingleAbility(ab, liveAbilityRegistry, allCards, customTribesList, results);
                }
            }
        }
    }

    await saveCardToCatalog(cardData);
    allCards.unshift(cardData); // Add to local array reference immediately
    results.cardsAdded++;
}