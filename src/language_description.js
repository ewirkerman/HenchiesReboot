/**
 * Ability Language Generator
 * Converts a structured Ability JSON payload into human-readable text.
 */

// --- UTILITY METHODS ---
function formatTribe(tribeType, tribeAmount) {
    if (!tribeType || tribeType === 'NONE') return '';
    return `${tribeAmount} ${tribeType}`;
}

function formatResource(amount, resourceName) {
    if (!amount || amount <= 0) return '';
    return `${amount} ${resourceName}`;
}

function joinWithAnd(arr) {
    if (!arr || arr.length === 0) return '';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
    return arr.slice(0, -1).join(', ') + ', and ' + arr[arr.length - 1];
}

// --- CORE GENERATOR ---
export function generateAbilityDescription(ability, allAbilities = null, allCards = null) {
    // If the user provided a custom description, always prioritize it.
    if (ability.description && ability.description.trim() !== '') {
        return ability.description;
    }

    let descriptionParts = [];

    // 1. TRIGGER
    const trigger = ability.trigger || 'MANUAL';
    let triggerText = '';
    
    const triggerDict = {
        // Core / Active
        'MANUAL': '',
        'UNTRIGGERABLE': 'Cannot be triggered. (Passive/Status)',
        'TURN_STARTING': 'At the start of the turn',
        'TURN_STARTED': 'After the turn starts',
        'PLAY': 'When played',
        'PLAY_OPTIONAL': 'When played (optional)',
        'SUMMON': 'When summoned',
        'KILL': 'When it kills an enemy',
        'UNFIELD': 'When unfielded',
        'TRASH': 'When trashed',
        'RETURN': 'When returned to hand',
        'SHUFFLE': 'When shuffled into deck',
        'ATTACK': 'When attacking',
        'DAMAGE': 'When dealing damage',
        'FIELD': 'When entering the field',
        'ATTACH': 'When attaching',
        'UNATTACH': 'When unattaching',
        'DISCARDED': 'When discarded',
        'HARVESTED': 'When harvested',

        // Passive (Reactions to being acted upon)
        'PLAYED': 'After being played',
        'SUMMONED': 'After being summoned',
        'KILLED': 'When killed',
        'UNFIELDED': 'When unfielded',
        'TRASHED': 'When trashed',
        'RETURNED': 'When returned to hand',
        'SHUFFLED': 'When shuffled into deck',
        'ATTACKED': 'When attacked',
        'DAMAGED': 'When taking damage',
        'FIELDED': 'After entering the field',
        'ATTACHED': 'After being attached',
        'UNATTACHED': 'After being unattached',

        // Active Interruptions
        'WOULD_PLAY': 'When it would play a card',
        'WOULD_SUMMON': 'When it would summon',
        'WOULD_KILL': 'When it would kill an enemy',
        'WOULD_UNFIELD': 'When it would unfield a unit',
        'WOULD_TRASH': 'When it would trash a card',
        'WOULD_RETURN': 'When it would return a card',
        'WOULD_SHUFFLE': 'When it would shuffle a card',
        'WOULD_ATTACK': 'When it would attack',
        'WOULD_DAMAGE': 'When it would deal damage',
        'WOULD_FIELD': 'When it would enter the field',
        'WOULD_ATTACH': 'When it would attach',
        'WOULD_UNATTACH': 'When it would unattach',

        // Passive Interruptions
        'WOULD_BE_PLAYED': 'When it would be played',
        'WOULD_BE_SUMMONED': 'When it would be summoned',
        'WOULD_BE_KILLED': 'When it would be killed',
        'WOULD_BE_UNFIELDED': 'When it would be unfielded',
        'WOULD_BE_TRASHED': 'When it would be trashed',
        'WOULD_BE_RETURNED': 'When it would be returned to hand',
        'WOULD_BE_SHUFFLED': 'When it would be shuffled into deck',
        'WOULD_BE_ATTACKED': 'When it would be attacked',
        'WOULD_BE_DAMAGED': 'When it would take damage',
        'WOULD_BE_FIELDED': 'When it would enter the field',
        'WOULD_BE_ATTACHED': 'When it would be attached',
        'WOULD_BE_UNATTACHED': 'When it would be unattached',
        'WOULD_BE_DISCARDED': 'When it would be discarded',
        'WOULD_BE_HARVESTED': 'When it would be harvested'
    };

    triggerText = triggerDict[trigger] || `On ${trigger.toLowerCase().replace(/_/g, ' ')}`;
    
    if (trigger === 'UNTRIGGERABLE') {
        descriptionParts.push(triggerText);
        // We can likely skip the rest or format it specially if it's untriggerable
    } else {
        if (triggerText) {
            descriptionParts.push(triggerText + ",");
        }

        // 2. COST
        const cost = ability.cost || {};
        let costArr = [];

        const tribeCost = formatTribe(cost.tribeType, cost.tribeAmount);
        if (tribeCost) costArr.push(`spend ${tribeCost}`);

        const tentCost = formatResource(cost.tent, 'Tents');
        if (tentCost) costArr.push(`spend ${tentCost}`);

        const powerCost = formatResource(cost.power, 'Power');
        if (powerCost) costArr.push(`spend ${powerCost}`);

        if (cost.readinessCost === 'UNREADIES') {
            costArr.push('unready');
        } else if (cost.readinessCost === 'EXHAUSTS') {
            costArr.push('exhaust');
        }

        if (costArr.length > 0) {
            let costString = joinWithAnd(costArr);
            
            // Format reuse exemption
            if (cost.reuseIgnoresReadiness && cost.readinessCost !== 'NONE') {
               costString += ` (Subsequent uses this round ignore readiness cost)`;
            }

            // If it's a manual trigger, we usually say "Unready to..."
            if (trigger === 'MANUAL') {
                 // Capitalize first letter of cost if it's the start of the sentence
                 descriptionParts.push(costString.charAt(0).toUpperCase() + costString.slice(1) + " to");
            } else {
                 descriptionParts.push(costString + " to");
            }
        }
    }

    // 3. LIMITS
    if (ability.triggerLimit === 'ONCE_PER_ROUND') {
        descriptionParts.push("(Once per round)");
    } else if (ability.triggerLimit === 'TWICE_PER_ROUND') {
         descriptionParts.push("(Twice per round)");
    }

    // 4. EFFECTS
    const effects = ability.effects || [];
    if (effects.length === 0) {
        if (trigger !== 'UNTRIGGERABLE') descriptionParts.push("do nothing.");
    } else {
        let effectStrings = effects.map(eff => {
            let effText = '';
            
            // 4a. Effect Action
            switch(eff.type) {
                case 'DEAL_DAMAGE':
                    effText = `deal ${eff.amount} damage`;
                    break;
                case 'HEAL':
                    effText = `heal ${eff.amount} health`;
                    break;
                case 'GRANT_ABILITY':
                    let abilityName = eff.grantedAbilityId;
                    // Attempt to resolve ID to Name
                    if (allAbilities && Array.isArray(allAbilities)) {
                        const match = allAbilities.find(a => a.abilityId === eff.grantedAbilityId);
                        if (match) abilityName = match.name;
                    } else if (typeof window !== 'undefined' && typeof getAbility === 'function') {
                         // Fallback to registry if allAbilities isn't provided but registry is available globally
                         const grantedAb = getAbility(eff.grantedAbilityId);
                         if(grantedAb) abilityName = grantedAb.name;
                    }
                    effText = `grant ability '${abilityName}'`;
                    break;
                case 'MODIFY_STAT':
                    effText = `modify ${eff.stat} by ${eff.amount}`;
                    break;
                case 'SET_STAT':
                    effText = `set ${eff.stat} to ${eff.amount}`;
                    break;
                case 'DRAW_CARD':
                    effText = `draw ${eff.amount} card(s)`;
                    break;
                case 'SUMMON':
                    let cardName = eff.cardId;
                    // Attempt to resolve ID to Card Name
                    if (allCards && Array.isArray(allCards)) {
                        const match = allCards.find(c => c.id === eff.cardId);
                        if (match) cardName = match.name;
                    } else if (typeof window !== 'undefined' && typeof getCard === 'function') {
                        // Fallback to registry if allCards isn't provided
                        const foundCard = getCard(eff.cardId);
                        if (foundCard) cardName = foundCard.name;
                    }
                    
                    const summonAmt = eff.amount || 1;
                    // Auto-pluralize if needed (basic check)
                    const pluralSuffix = (summonAmt > 1 && !cardName.endsWith('s')) ? 's' : '';
                    effText = `summon ${summonAmt} ${cardName}${pluralSuffix}`;
                    break;
                case 'BLOCK_ACT':
                    effText = `block target from acting`;
                    break;
                case 'BLOCK_ATTACK':
                    effText = `block target from attacking`;
                    break;
                case 'BLOCK_RETALIATE':
                    effText = `block target from retaliating`;
                    break;
                case 'CUSTOM_SCRIPT':
                    effText = `execute custom script`;
                    break;
                default:
                    effText = `perform ${eff.type}`;
            }

            // 4b. Effect Targeting
            if (eff.targetMethod === 'SAME_AS_ACTIVATION') {
                // Determine what the activation target was
                const actMethod = ability.activation?.method || 'NONE';
                if (actMethod === 'PLAYER_CHOICE') {
                    effText += ` to a chosen target`;
                } else {
                     // Usually implies it's hitting whoever triggered the event
                     effText += ` to the triggered entity`;
                }
            } else if (eff.targetMethod === 'SELF') {
                // Minor grammar adjustment depending on effect
                if (eff.type === 'HEAL' || eff.type === 'MODIFY_STAT' || eff.type === 'SET_STAT' || eff.type === 'GRANT_ABILITY') {
                   // e.g. "heal 2 health to self" -> better as "gain 2 health" but this works for now
                   effText += ` to self`; 
                } else if (eff.type === 'DEAL_DAMAGE') {
                   effText += ` to self`;
                }
            } else if (eff.targetMethod === 'AUTO_ALL') {
                 effText += ` to all matching ${eff.targetAffiliation.toLowerCase()} units`;
            } else if (eff.targetMethod === 'AUTO_RANDOM') {
                 effText += ` to ${eff.targetCount} random matching ${eff.targetAffiliation.toLowerCase()} units`;
            }

            // 4c. Duration
            if (eff.duration && eff.duration !== 'INSTANT') {
                effText += ` (${eff.duration.toLowerCase()})`;
            }

            return effText;
        });

        descriptionParts.push(joinWithAnd(effectStrings) + ".");
    }

    // Capitalize the very first letter of the final string if we haven't already
    let finalStr = descriptionParts.join(' ').trim();
    if (finalStr.length > 0) {
        finalStr = finalStr.charAt(0).toUpperCase() + finalStr.slice(1);
    }

    return finalStr;
}