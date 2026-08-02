/**
 * Ability Language Generator
 * Converts a structured Ability JSON payload into human-readable text.
 */

import { SINGLE_ZONE_ACTIONS } from './abilities.js';

// --- UTILITY METHODS ---
function formatResourceAmount(amount) {
    if (!amount || amount <= 0) return '';
    return `${amount} Resource${amount > 1 ? 's' : ''}`;
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

function formatArrayToString(arr, fallback = 'any') {
    if (!arr || arr.length === 0) return fallback;
    // Format arrays like ['ENEMY', 'FRIENDLY'] into "enemy or friendly"
    return arr.map(s => s.toLowerCase().replace(/_/g, ' ')).join(' or ');
}

function buildTargetDesc(qt, logicTree, trigger, allHaveSameImpliedZone, impliedZone, isPlural) {
    if (!qt) return isPlural ? 'targets' : 'target';
    
    let adjectives = [];
    let suffixes = [];

    const parseNode = (node) => {
        if (!node) return;
        if (node.type === 'group' && node.children) {
            node.children.forEach(parseNode);
        } else if (node.type === 'condition') {
            const opMap = { '==': '', '!=': 'not', '>': 'more than', '<': 'less than' };
            let opText = opMap[node.operator] !== undefined ? opMap[node.operator] : node.operator;
            
            if (['tribe', 'family', 'genus'].includes(node.attribute)) {
                if (node.operator === '==') {
                    adjectives.push(node.value);
                } else {
                    suffixes.push(`that is ${opText} ${node.value}`.trim());
                }
            } else if (['health', 'strength', 'readiness', 'maxHealth'].includes(node.attribute)) {
                let statName = node.attribute === 'maxHealth' ? 'max health' : node.attribute;
                suffixes.push(`with ${opText} ${node.value} ${statName}`.trim());
            } else if (node.attribute === 'hasAbility') {
                if (node.operator === '==') suffixes.push(`with ability '${node.value}'`);
                else suffixes.push(`without ability '${node.value}'`);
            }
        }
    };

    if (logicTree) parseNode(logicTree);

    let validAlignments = (qt.alignment || []).filter(a => a !== 'ANY' && a !== 'ALL');
    if (validAlignments.length === 0) validAlignments = ['FRIENDLY', 'ENEMY'];
    
    let scopeAlignments = formatArrayToString(validAlignments, 'any');
    if (scopeAlignments === 'friendly') scopeAlignments = isPlural ? 'allies' : 'ally';
    else if (scopeAlignments === 'enemy') scopeAlignments = isPlural ? 'enemies' : 'enemy';
    else if (scopeAlignments === 'enemy or friendly' || scopeAlignments === 'friendly or enemy') scopeAlignments = isPlural ? 'characters' : 'character';
    
    let validTypes = (qt.entityType || []).filter(e => e !== 'ANY' && e !== 'ALL');
    let scopeTypes = formatArrayToString(validTypes, 'entity');
    if (isPlural) {
        scopeTypes = validTypes.map(s => {
            let l = s.toLowerCase();
            return l === 'entity' ? 'entities' : l + 's';
        }).join(' or ');
    } else {
        scopeTypes = validTypes.map(s => s.toLowerCase()).join(' or ');
    }
    if (scopeTypes === '') scopeTypes = isPlural ? 'entities' : 'entity';
    
    let noun = scopeTypes;
    if (['ally', 'allies', 'enemy', 'enemies', 'character', 'characters'].includes(scopeAlignments)) {
        let adjAlign = validAlignments.length === 1 ? validAlignments[0].toLowerCase() : 'character';
        if (adjAlign === 'friendly') adjAlign = 'ally';
        
        if (validTypes.length === 0) noun = scopeAlignments;
        else noun = `${adjAlign} ${scopeTypes}`;
    } else if (scopeAlignments !== 'any') {
        noun = `${scopeAlignments} ${scopeTypes}`;
    }

    let baseDesc = `${adjectives.join(' ')} ${noun}`.trim();

    if (!(allHaveSameImpliedZone && qt.zones && qt.zones.length === 1 && qt.zones[0] === impliedZone)) {
        let scopeZones = formatArrayToString(qt.zones, 'any zone');
        baseDesc += ` in ${scopeZones}`;
    }

    if (suffixes.length > 0) {
        baseDesc += ` ${suffixes.join(' and ')}`;
    }
    
    const isPlay = trigger === 'PLAY' || trigger === 'PLAY_OPTIONAL';
    const isManual = trigger === 'MANUAL';
    
    if (isPlay && qt.ignoreBattlelines === false) {
         baseDesc += ` (respecting battlelines)`;
    } else if (isManual && qt.ignoreBattlelines === true) {
         baseDesc += ` (ignoring battlelines)`;
    }

    return baseDesc.replace(/\s+/g, ' ').trim();
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
        'MANUAL': '',
        'UNTRIGGERABLE': 'Cannot be triggered. (Passive/Status)',
        'TURN_STARTING': 'At the start of the turn',
        'TURN_STARTED': 'After the turn starts',
        'PLAY': '',
        'PLAY_OPTIONAL': '',
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

    triggerText = triggerDict[trigger];
    if (!triggerText) {
        if (trigger.startsWith('ON_BE_')) triggerText = `After being ${trigger.replace('ON_BE_', '').toLowerCase().replace(/_/g, ' ')}`;
        else if (trigger.startsWith('ON_')) triggerText = `After performing ${trigger.replace('ON_', '').toLowerCase().replace(/_/g, ' ')}`;
        else if (trigger.startsWith('WOULD_BE_')) triggerText = `When it would be ${trigger.replace('WOULD_BE_', '').toLowerCase().replace(/_/g, ' ')}`;
        else if (trigger.startsWith('WOULD_')) triggerText = `When it would perform ${trigger.replace('WOULD_', '').toLowerCase().replace(/_/g, ' ')}`;
        else if (trigger.startsWith('MODIFY_BE_')) triggerText = `When modifying it being ${trigger.replace('MODIFY_BE_', '').toLowerCase().replace(/_/g, ' ')}`;
        else if (trigger.startsWith('MODIFY_')) triggerText = `When modifying its ${trigger.replace('MODIFY_', '').toLowerCase().replace(/_/g, ' ')}`;
        else triggerText = `On ${trigger.toLowerCase().replace(/_/g, ' ')}`;
    }
    
    // 1b. Symbol String Prefix Cost Block
    const cost = ability.cost || {};
    let costSymbols = [];

    if (cost.tribeAmount && cost.tribeAmount > 0) {
        costSymbols.push(`{Resource ${cost.tribeAmount}}`);
    }
    if (cost.tent && cost.tent > 0) {
        costSymbols.push(`{Tent ${cost.tent}}`);
    }
    if (cost.power && cost.power > 0) {
        costSymbols.push(`{Power ${cost.power}}`);
    }
    if (cost.readinessCost === 'UNREADIES') {
        costSymbols.push(`{Unready}`);
    } else if (cost.readinessCost === 'EXHAUSTS') {
        costSymbols.push(`{Exhaust}`);
    }

    let symbolPrefix = costSymbols.join(' ');
    
    if (trigger === 'UNTRIGGERABLE') {
        descriptionParts.push(triggerText);
    } else {
        let triggerAndCostStr = "";
        
        if (symbolPrefix) {
             triggerAndCostStr += symbolPrefix + " ";
             if (cost.reuseIgnoresReadiness && cost.readinessCost !== 'NONE') {
                  triggerAndCostStr += `(Subsequent uses this round ignore readiness cost) `;
             }
        }
        
        if (triggerText) {
             triggerAndCostStr += triggerText + (trigger !== 'MANUAL' ? ", " : " ");
        }

        if (triggerAndCostStr.trim() !== '') {
            descriptionParts.push(triggerAndCostStr.trim());
        }
    }

    // 3. LIMITS
    if (ability.triggerLimit === 'ONCE_PER_ROUND') {
        descriptionParts.push("(Once per round)");
    } else if (ability.triggerLimit === 'TWICE_PER_ROUND') {
         descriptionParts.push("(Twice per round)");
    }

    // 4. EFFECTS (Parsed by Target Groups)
    const targetGroups = ability.effects || [];
    if (targetGroups.length === 0) {
        if (trigger !== 'UNTRIGGERABLE') descriptionParts.push("do nothing.");
    } else {
        let allCostSentences = [];
        let allEffectSentences = [];

        targetGroups.forEach(group => {
            if (!group.payloads || group.payloads.length === 0) return;

            let allHaveSameImpliedZone = group.payloads.length > 0;
            let impliedZone = null;
            for (const p of group.payloads) {
                const z = SINGLE_ZONE_ACTIONS[p.type];
                if (!z) { allHaveSameImpliedZone = false; break; }
                if (!impliedZone) impliedZone = z;
                else if (impliedZone !== z) { allHaveSameImpliedZone = false; break; }
            }

            let targetStr = 'them';
            let possessiveStr = 'their';

            if (group.targetMethod === 'SELF') {
                targetStr = 'self';
                possessiveStr = 'own';
            } else if (group.targetMethod === 'AVATAR') {
                targetStr = 'your avatar';
                possessiveStr = "your avatar's";
            } else if (group.targetMethod === 'ENEMY_AVATAR') {
                targetStr = 'the enemy avatar';
                possessiveStr = "the enemy avatar's";
            } else if (group.targetMethod === 'SAME_AS_ACTIVATION') {
                const actMethod = ability.activation?.method || 'NONE';
                if (actMethod === 'PLAYER_CHOICE') {
                    let actDesc = buildTargetDesc(ability.activation?.quickTargeting, ability.activation?.logicTree, trigger, true, 'FIELD', false);
                    targetStr = `a chosen ${actDesc}`;
                    possessiveStr = `${targetStr}'s`;
                } else {
                    targetStr = `the triggered entity`;
                    possessiveStr = `the triggered entity's`;
                }
            } else {
                let isPlural = group.targetMethod === 'AUTO_ALL' || group.targetCount > 1;
                let baseDesc = buildTargetDesc(group.quickTargeting || {}, group.logicTree, trigger, allHaveSameImpliedZone, impliedZone, isPlural);
                
                if (group.targetMethod === 'AUTO_ALL') targetStr = `all ${baseDesc}`;
                else if (group.targetMethod === 'AUTO_RANDOM') targetStr = `${group.targetCount || 1} random ${baseDesc}`;
                else if (group.targetMethod === 'AUTO_FIRST') targetStr = `the first ${group.targetCount || 1} ${baseDesc}`;
                else if (group.targetMethod === 'AUTO_LAST') targetStr = `the last ${group.targetCount || 1} ${baseDesc}`;
                
                if (targetStr.endsWith('s')) possessiveStr = `${targetStr}'`;
                else possessiveStr = `${targetStr}'s`;
            }

            const formatPayload = (eff) => {
                let effText = '';
                
                switch(eff.type) {
                    case 'DEAL_DAMAGE': effText = `deal ${eff.amount || 1} damage to {TARGET}`; break;
                    case 'HEAL': effText = `heal ${eff.amount || 1} health to {TARGET}`; break;
                    case 'DRAW_CARD': effText = `draw ${eff.amount || 1} card(s) for {TARGET}`; break;
                    case 'DISCARD': effText = `discard ${eff.amount || 1} card(s) from {POSS} hand`; break;
                    case 'TRASH': effText = `trash ${eff.amount || 1} card(s) from {POSS} hand or deck`; break;
                    case 'RECOVER': effText = `recover ${eff.amount || 1} card(s) for {TARGET}`; break;
                    case 'MODIFY_STAT': 
                        let modStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                        if (eff.amount < 0) effText = `decrease {POSS} ${modStat} by ${Math.abs(eff.amount)}`;
                        else effText = `increase {POSS} ${modStat} by ${eff.amount || 1}`;
                        break;
                    case 'SET_STAT': 
                        let setStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                        effText = `set {POSS} ${setStat} to ${eff.amount || 1}`; break;
                    case 'BLOCK_ACT': effText = `block {TARGET} from acting`; break;
                    case 'BLOCK_ATTACK': effText = `block {TARGET} from attacking`; break;
                    case 'BLOCK_RETALIATE': effText = `block {TARGET} from retaliating`; break;
                    case 'SHUFFLE': effText = `shuffle {TARGET} into deck`; break;
                    case 'RETURN': effText = `return {TARGET} to hand`; break;
                    case 'ATTACH': effText = `attach {TARGET}`; break;
                    case 'UNATTACH': effText = `unattach {TARGET}`; break;
                    case 'FIELD': effText = `field {TARGET} (play for free)`; break;
                    case 'UNFIELD': effText = `unfield {TARGET}`; break;
                    case 'BANISH': effText = `banish {TARGET}`; break;
                    case 'KILL': effText = `kill {TARGET}`; break;
                    case 'ATTACK': effText = `attack {TARGET}`; break;
                    case 'CUSTOM_SCRIPT': effText = `execute custom script on {TARGET}`; break;
                    case 'GRANT_ABILITY':
                        let abilityName = eff.grantedAbilityId;
                        if (allAbilities && Array.isArray(allAbilities)) {
                            const match = allAbilities.find(a => a.abilityId === eff.grantedAbilityId || a.name === eff.grantedAbilityId);
                            if (match) abilityName = match.name;
                        } else if (typeof window !== 'undefined' && typeof getAbility === 'function') {
                             const grantedAb = getAbility(eff.grantedAbilityId);
                             if(grantedAb) abilityName = grantedAb.name;
                        }
                        effText = `grant ability @[${abilityName}] to {TARGET}`;
                        break;
                    case 'SUMMON':
                        let cardName = eff.cardId;
                        if (allCards && Array.isArray(allCards)) {
                            const match = allCards.find(c => c.id === eff.cardId);
                            if (match) cardName = match.name;
                        } else if (typeof window !== 'undefined' && typeof getCard === 'function') {
                            const foundCard = getCard(eff.cardId);
                            if (foundCard) cardName = foundCard.name;
                        }
                        const summonAmt = eff.amount || 1;
                        const pluralSuffix = (summonAmt > 1 && !cardName.endsWith('s')) ? 's' : '';
                        
                        let destZone = (eff.zone || 'FIELD').toLowerCase();
                        let isCasterZone = (!eff.zoneOwner || eff.zoneOwner === 'CASTER');

                        effText = `summon ${summonAmt} ${cardName}${pluralSuffix}`;
                        
                        if (isCasterZone) {
                            if (destZone !== 'field') effText += ` to ${destZone}`;
                        } else {
                            effText += ` to {POSS} ${destZone}`;
                        }
                        
                        if (eff.nestedGroup && eff.nestedGroup.payloads && eff.nestedGroup.payloads.length > 0) {
                            let nestedPayloadsText = eff.nestedGroup.payloads.map(np => {
                                let npText = formatPayload(np);
                                npText = npText.replace(/\{TARGET\}/g, 'them').replace(/\{POSS\}/g, 'their');
                                return npText;
                            });
                            let combinedNested = joinWithAnd(nestedPayloadsText);
                            
                            let targetMethod = eff.nestedGroup.targetMethod || 'AUTO_ALL';
                            let targetCount = eff.nestedGroup.targetCount || 1;
                            let subTargetText = 'them';
                            
                            if (targetMethod === 'AUTO_RANDOM') subTargetText = `${targetCount} random of them`;
                            else if (targetMethod === 'AUTO_FIRST') subTargetText = `the first ${targetCount} of them`;
                            else if (targetMethod === 'AUTO_ALL') subTargetText = `all of them`;
                            
                            effText += ` and ${combinedNested} on ${subTargetText}`;
                        }
                        break;
                    default:
                        effText = `perform ${eff.type} on {TARGET}`;
                }

                if (eff.duration && eff.duration !== 'INSTANT') {
                    let durText = eff.duration.toLowerCase();
                    if (eff.duration === 'WHILE_ATTACHED') durText = 'while attached';
                    effText += ` (${durText})`;
                }

                return effText;
            };

            const finalizeString = (arr) => {
                if(arr.length === 0) return null;
                let combined = joinWithAnd(arr);
                if (targetStr === 'self') {
                    combined = combined.replace(/\{POSS\}/g, 'own').replace(/\{TARGET\}/g, 'self');
                } else {
                    combined = combined.replace(/\{POSS\}/g, possessiveStr).replace(/\{TARGET\}/g, targetStr);
                }
                
                if (!combined.includes(targetStr) && !combined.includes('own') && !combined.includes('self') && !combined.includes(possessiveStr)) {
                    combined += ` to ${targetStr}`;
                }
                return combined;
            };
            
            let costs = group.payloads.filter(p => p.isCost).map(formatPayload);
            let effects = group.payloads.filter(p => !p.isCost).map(formatPayload);
            
            let cStr = finalizeString(costs);
            if (cStr) allCostSentences.push(cStr);
            
            let eStr = finalizeString(effects);
            if (eStr) allEffectSentences.push(eStr);
        });

        if (allCostSentences.length > 0 && allEffectSentences.length > 0) {
             let combinedCosts = allCostSentences.join(' and ');
             combinedCosts = combinedCosts.charAt(0).toUpperCase() + combinedCosts.slice(1);
             let combinedEffects = allEffectSentences.join(' and ');
             descriptionParts.push(`${combinedCosts} to ${combinedEffects}.`);
        } else if (allCostSentences.length > 0) {
             let combinedCosts = allCostSentences.join(' and ');
             descriptionParts.push(combinedCosts + '.');
        } else if (allEffectSentences.length > 0) {
             descriptionParts.push(allEffectSentences.join('. ') + '.');
        }
    }

    let finalStr = descriptionParts.join(' ').trim();
    if (finalStr.length > 0) {
        // Find the first alphabetical character after any symbols/brackets and capitalize it
        finalStr = finalStr.replace(/^([^a-zA-Z]*)([a-zA-Z])/i, (match, p1, p2) => p1 + p2.toUpperCase());
    }

    return finalStr;
}