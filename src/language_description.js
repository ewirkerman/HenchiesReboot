/**
 * Ability Language Generator
 * Converts a structured Ability JSON payload into human-readable text.
 */

import { ACTION_MANIFEST } from './actions.js';

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
    
    let isCardZone = qt && qt.zones && qt.zones.length > 0 && qt.zones.every(z => ['HAND', 'DECK', 'DISCARD', 'BANISH', 'ORIGINAL_DECK'].includes(z));

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
            } else if (['health', 'strength', 'readiness', 'maxHealth', 'acts', 'maxActs', 'power', 'fast', 'slow'].includes(node.attribute)) {
                let statName = node.attribute === 'maxHealth' ? 'max health' : (node.attribute === 'acts' ? 'available acts' : (node.attribute === 'maxActs' ? 'max acts' : node.attribute));
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
    else if (scopeAlignments === 'enemy or friendly' || scopeAlignments === 'friendly or enemy') {
         if (isCardZone) scopeAlignments = isPlural ? 'cards' : 'card';
         else scopeAlignments = isPlural ? 'characters' : 'character';
    }
    
    let validTypes = (qt.entityType || []).filter(e => e !== 'ANY' && e !== 'ALL');
    let scopeTypes = formatArrayToString(validTypes, 'entity');
    if (isPlural) {
        scopeTypes = validTypes.map(s => {
            let l = s.toLowerCase();
            if (isCardZone) return l === 'entity' ? 'cards' : l + ' cards';
            return l === 'entity' ? 'entities' : l + 's';
        }).join(' or ');
    } else {
        scopeTypes = validTypes.map(s => {
            let l = s.toLowerCase();
            if (isCardZone) return l === 'entity' ? 'card' : l + ' card';
            return l;
        }).join(' or ');
    }
    if (scopeTypes === '') {
         if (isCardZone) scopeTypes = isPlural ? 'cards' : 'card';
         else scopeTypes = isPlural ? 'entities' : 'entity';
    }
    
    let noun = scopeTypes;
    if (['ally', 'allies', 'enemy', 'enemies', 'character', 'characters', 'card', 'cards'].includes(scopeAlignments)) {
        let adjAlign = '';
        if (validAlignments.length === 1) {
            adjAlign = validAlignments[0].toLowerCase();
            if (adjAlign === 'friendly') adjAlign = 'ally';
        }
        
        let canDropUnit = validTypes.length === 1 && validTypes[0] === 'UNIT' && !isCardZone;
        
        if (validTypes.length === 0 || canDropUnit) {
            if (adjAlign) {
                 noun = isCardZone ? `${adjAlign} ${isPlural ? 'cards' : 'card'}` : scopeAlignments;
            } else {
                 noun = scopeAlignments;
            }
        } else {
            noun = adjAlign ? `${adjAlign} ${scopeTypes}` : scopeTypes;
        }
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
    const allTriggers = [ability.trigger || 'MANUAL', ...(ability.additionalTriggers || [])].filter(Boolean);
    const trigger = allTriggers[0] || 'MANUAL'; // Added back fallback for subsequent checks
    let triggerText = '';
    
    const triggerDict = {
        'MANUAL': '',
        'UNTRIGGERABLE': 'Cannot be triggered. (Passive/Status)',
        'TURN_STARTING': 'At the start of the turn',
        'TURN_STARTED': 'After the turn starts',
        'PLAY': 'When played',
        'PLAY_OPTIONAL': 'When played (Optional)',
        'SUMMON': 'When summoned',
        'KILL': 'When it kills an enemy',
        'UNFIELD': 'When unfielded',
        'WOULD_BE_PLAYED': 'When it would be played',
        'ON_SUMMON': 'When it summons',
        'ON_BE_SUMMONED': 'When summoned',
        'WOULD_SUMMON': 'When it would summon',
        'WOULD_BE_SUMMONED': 'When it would be summoned',
        'ON_KILL': 'When it kills an enemy',
        'ON_BE_KILLED': 'When killed',
        'WOULD_KILL': 'When it would kill an enemy',
        'WOULD_BE_KILLED': 'When it would be killed',
        'ON_ATTACK': 'When attacking',
        'ON_BE_ATTACKED': 'When attacked',
        'WOULD_ATTACK': 'When it would attack',
        'WOULD_BE_ATTACKED': 'When it would be attacked',
        'ON_DEAL_DAMAGE': 'When it deals damage',
        'ON_BE_DAMAGED': 'When it takes damage',
        'WOULD_DEAL_DAMAGE': 'When it would deal damage',
        'WOULD_BE_DAMAGED': 'When it would take damage',
        'ON_HEAL': 'When it heals',
        'ON_BE_HEALED': 'When healed',
        'WOULD_HEAL': 'When it would heal',
        'WOULD_BE_HEALED': 'When it would be healed',
        'ON_REBEL': 'When it takes control of an enemy',
        'ON_BE_REBELLED': 'When it changes sides',
        'WOULD_REBEL': 'When it would take control',
        'WOULD_BE_REBELLED': 'When it would change sides',
        'ON_DRAW_CARD': 'When it draws a card',
        'ON_BE_DRAWN': 'When drawn',
        'WOULD_DRAW_CARD': 'When it would draw a card',
        'WOULD_BE_DRAWN': 'When it would be drawn',
        'ON_DISCARD': 'When it discards',
        'ON_BE_DISCARDED': 'When discarded',
        'WOULD_DISCARD': 'When it would discard',
        'WOULD_BE_DISCARDED': 'When it would be discarded',
        'WOULD_BE_HARVESTED': 'When it would be harvested',
        'ON_RECOVER': 'When it recovers a card',
        'ON_BE_RECOVERED': 'When recovered',
        'WOULD_RECOVER': 'When it would recover a card',
        'WOULD_BE_RECOVERED': 'When it would be recovered'
    };

    let processedTriggers = allTriggers.map(t => {
        let txt = triggerDict[t];
        if (txt === undefined) {
            let readable = t.toLowerCase().replace(/_/g, ' ');
            if (readable.startsWith('on be ')) txt = `When ${readable.substring(6)}`;
            else if (readable.startsWith('on ')) txt = `When it ${readable.substring(3)}`;
            else if (readable.startsWith('would be ')) txt = `When it would be ${readable.substring(9)}`;
            else if (readable.startsWith('would ')) txt = `When it would ${readable.substring(6)}`;
            else txt = `On ${readable}`;
        }
        
        if (ability.triggerScope === 'GLOBAL') {
            let lowerTxt = txt.toLowerCase();
            const qt = ability.activation?.quickTargeting;
            const lt = ability.activation?.logicTree;
            const targetDesc = buildTargetDesc(qt, lt, t, true, 'FIELD', false);

            if (lowerTxt.startsWith('when it would be ')) lowerTxt = lowerTxt.replace('when it would be ', `whenever ${targetDesc} would be `);
            else if (lowerTxt.startsWith('when it would ')) lowerTxt = lowerTxt.replace('when it would ', `whenever ${targetDesc} would `);
            else if (lowerTxt.startsWith('when it ')) lowerTxt = lowerTxt.replace('when it ', `whenever ${targetDesc} `);
            else if (lowerTxt.startsWith('after being ')) lowerTxt = lowerTxt.replace('after being ', `after ${targetDesc} is `);
            else if (lowerTxt.startsWith('when ')) lowerTxt = lowerTxt.replace('when ', `whenever ${targetDesc} is `);
            
            return lowerTxt.charAt(0).toUpperCase() + lowerTxt.slice(1);
        }
        return txt;
    });

    if (processedTriggers.length === 1) {
        triggerText = processedTriggers[0];
    } else {
        let first = processedTriggers[0];
        let rest = processedTriggers.slice(1).map(s => s.charAt(0).toLowerCase() + s.slice(1));
        
        if (rest.length === 1) {
            triggerText = `${first} or ${rest[0]}`;
        } else {
            triggerText = `${first}, ${rest.slice(0, -1).join(', ')}, or ${rest[rest.length - 1]}`;
        }
    }
    
    const cost = ability.cost || {};
    
    if (trigger === 'UNTRIGGERABLE') {
        descriptionParts.push(triggerText);
    } else {
        let triggerAndCostStr = "";
        
        if (cost.reuseIgnoresReadiness && cost.readinessCost !== 'NONE') {
             triggerAndCostStr += `(Subsequent uses this round ignore readiness cost) `;
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
                const man = ACTION_MANIFEST[p.type];
                const z = (man && man.validZones && man.validZones.length === 1 && man.validZones[0] !== 'ALL') ? man.validZones[0] : null;
                
                if (!z) { allHaveSameImpliedZone = false; break; }
                if (!impliedZone) impliedZone = z;
                else if (impliedZone !== z) { allHaveSameImpliedZone = false; break; }
            }

            let targetStr = 'them';
            let possessiveStr = 'their';

            if (group.targetMethod === 'SELF') {
                targetStr = 'itself';
                possessiveStr = 'its';
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
                else if (group.targetMethod === 'AUTO_RANDOM') targetStr = group.targetCount === 1 ? `a random ${baseDesc}` : `${group.targetCount || 1} random ${baseDesc}`;
                else if (group.targetMethod === 'AUTO_FIRST') targetStr = group.targetCount === 1 ? `the first ${baseDesc}` : `the first ${group.targetCount || 1} ${baseDesc}`;
                else if (group.targetMethod === 'AUTO_LAST') targetStr = group.targetCount === 1 ? `the last ${baseDesc}` : `the last ${group.targetCount || 1} ${baseDesc}`;
                
                if (targetStr.endsWith('s')) possessiveStr = `${targetStr}'`;
                else possessiveStr = `${targetStr}'s`;
            }

            const formatPayload = (eff) => {
                let effText = '';
                
                switch(eff.type) {
                    case 'DEAL_DAMAGE': effText = `deal ${eff.amount || 1} damage to {TARGET}`; break;
                    case 'HEAL': effText = `heal ${eff.amount || 1} health on {TARGET}`; break;
                    case 'DRAW_CARD': 
                        let isNormalDraw = group.targetMethod === 'AUTO_FIRST' && (!group.quickTargeting || !group.quickTargeting.alignment || group.quickTargeting.alignment.length === 0 || (group.quickTargeting.alignment.length === 1 && group.quickTargeting.alignment[0] === 'FRIENDLY'));
                        if (isNormalDraw) {
                            let drawAmt = group.targetCount || eff.amount || 1;
                            effText = `draw ${drawAmt === 1 ? 'a card' : drawAmt + ' cards'}{OMIT_TARGET}`;
                        } else {
                            effText = `draw {TARGET}`;
                        }
                        break;
                    case 'DISCARD':
                    case 'DISCARD_CARD':
                        effText = `discard {TARGET}`; 
                        break;
                    case 'TRASH':
                        effText = `trash {TARGET}`; 
                        break;
                    case 'RECOVER': effText = `recover {TARGET}`; break;
                    case 'MODIFY_STAT': 
                        let modStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                        if (eff.amount < 0) {
                            effText = `decrease {POSS} ${modStat} by ${Math.abs(eff.amount)}`;
                        } else {
                            effText = `increase {POSS} ${modStat} by ${eff.amount || 1}`;
                            if (eff.maxStacks > 0) effText += ` (max ${eff.maxStacks})`;
                        }
                        break;
                    case 'SET_STAT': 
                        let setStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                        effText = `set {POSS} ${setStat} to ${eff.amount || 1}`; break;
                    case 'BLOCK_ACT': effText = `block {TARGET} from acting`; break;
                    case 'BLOCK_ATTACK': effText = `block {TARGET} from attacking`; break;
                    case 'BLOCK_RETALIATE': effText = `block {TARGET} from retaliating`; break;
                    case 'SHUFFLE': effText = `shuffle {TARGET} into deck`; break;
                    case 'RETURN': effText = `return {TARGET} to hand`; break;
                    case 'ATTACH': 
                    case 'ATTACH_TO': 
                        if (eff.invertRoles) effText = `attach to {TARGET}`;
                        else effText = `attach {TARGET} to self`;
                        break;
                    case 'UNATTACH': effText = `unattach {TARGET}`; break;
                    case 'FIELD': effText = `field {TARGET} (play for free)`; break;
                    case 'BANISH': effText = `banish {TARGET}`; break;
                    case 'KILL': effText = `kill {TARGET}`; break;
                    case 'ATTACK': effText = `attack {TARGET}`; break;
                    case 'CANCEL_EVENT': effText = `cancel the triggering event`; break;
                    case 'CLEANSE': effText = `cleanse temporary effects from {TARGET}`; break;
                    case 'CHANGE_DESTINATION': effText = `change destination to ${eff.zone || 'DECK'}`; break;
                    case 'CUSTOM_SCRIPT': effText = `execute custom script on {TARGET}`; break;
                case 'GRANT_ABILITY':
                    let abilityName = eff.grantedAbilityId;
                    if (allAbilities && Array.isArray(allAbilities)) {
                        const match = allAbilities.find(a => a.abilityId === eff.grantedAbilityId || a.id === eff.grantedAbilityId);
                        if (match) abilityName = match.name;
                    } else if (typeof window !== 'undefined' && typeof getAbility === 'function') {
                         const grantedAb = getAbility(eff.grantedAbilityId);
                         if(grantedAb) abilityName = grantedAb.name;
                    }
                    effText = `grant ability '${abilityName}' to {TARGET}`;
                    break;
                case 'REMOVE_ABILITY':
                    let rmAbilityName = eff.grantedAbilityId;
                    if (allAbilities && Array.isArray(allAbilities)) {
                        const match = allAbilities.find(a => a.abilityId === eff.grantedAbilityId || a.id === eff.grantedAbilityId);
                        if (match) rmAbilityName = match.name;
                    } else if (typeof window !== 'undefined' && typeof getAbility === 'function') {
                         const grantedAb = getAbility(eff.grantedAbilityId);
                         if(grantedAb) rmAbilityName = grantedAb.name;
                    }
                    effText = `remove ability '${rmAbilityName}' from {TARGET}`;
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
                                npText = npText.replace(/\{TARGET\}/g, 'them').replace(/\{POSS\}/g, 'their').replace(/\{OMIT_TARGET\}/g, '');
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
                        let readableType = eff.type.toLowerCase().replace(/_/g, ' ');
                        effText = `${readableType} {TARGET}`;
                }

                if (eff.invertRoles && eff.type !== 'ATTACH' && eff.type !== 'ATTACH_TO') {
                    effText = `force {TARGET} to ${effText}`;
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
                
                let mentioned = false;
                let processedArr = arr.map(str => {
                    let t, p;
                    if (targetStr === 'itself') {
                        t = 'itself';
                        p = 'its';
                    } else if (targetStr === 'your avatar' || targetStr === 'the enemy avatar') {
                        t = mentioned ? 'it' : targetStr;
                        p = mentioned ? 'its' : possessiveStr;
                    } else {
                        let isPlural = group.targetMethod === 'AUTO_ALL' || group.targetCount > 1 || group.targetMethod === 'AUTO_RANDOM' || group.targetMethod === 'AUTO_FIRST' || group.targetMethod === 'AUTO_LAST' || targetStr.endsWith('s');
                        t = mentioned ? (isPlural ? 'them' : 'it') : targetStr;
                        p = mentioned ? (isPlural ? 'their' : 'its') : possessiveStr;
                    }

                    if (str.includes('{OMIT_TARGET}')) {
                        mentioned = true;
                        str = str.replace('{OMIT_TARGET}', '');
                    }

                    if (str.includes('{TARGET}') || str.includes('{POSS}')) {
                        mentioned = true;
                    }
                    
                    return str.replace(/\{POSS\}/g, p).replace(/\{TARGET\}/g, t);
                });

                let combined = joinWithAnd(processedArr);
                if (!mentioned && targetStr !== 'itself' && !combined.includes(targetStr) && !combined.includes(possessiveStr)) {
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