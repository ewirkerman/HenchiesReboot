/**
 * src/language/format_payload.js
 * Converts raw JSON payloads (single or grouped) into natural language strings.
 * Consolidates lookups, pronoun resolution, and modifier suffixes.
 */

import { resolveTokens } from './tokens.js';
import { joinWithAnd } from './utils.js';

// --- Helpers for Entity Resolution ---

function resolveAbility(abilityId, allAbilities) {
    let name = abilityId;
    let isManual = false;
    if (allAbilities && Array.isArray(allAbilities)) {
        const match = allAbilities.find(a => a.abilityId === abilityId || a.id === abilityId);
        if (match) {
            name = match.name;
            isManual = match.trigger === 'MANUAL';
        }
    } else if (typeof window !== 'undefined' && typeof getAbility === 'function') {
        const match = getAbility(abilityId);
        if (match) {
            name = match.name;
            isManual = match.trigger === 'MANUAL';
        }
    }
    return { name, isManual };
}

function resolveCard(cardId, allCards) {
    let name = cardId;
    if (allCards && Array.isArray(allCards)) {
        const match = allCards.find(c => c.id === cardId);
        if (match) name = match.name;
    } else if (typeof window !== 'undefined' && typeof getCard === 'function') {
        const match = getCard(cardId);
        if (match) name = match.name;
    }
    return name;
}

function resolveResource(resourceId, allTribes) {
    let resName = resourceId || 'resource';
    if (resName === 'maxCarnie') return 'Max Carnie';
    if (allTribes && Array.isArray(allTribes)) {
        const match = allTribes.find(t => t.id === resName || t.name.toLowerCase() === resName.toLowerCase());
        if (match) return match.name;
    } else if (resName.toLowerCase().startsWith('tribe_')) {
        resName = resName.substring(6).replace(/_/g, ' ');
        resName = resName.replace(/\b\w/g, l => l.toUpperCase());
        return resName;
    }
    return resName;
}

// --- Helper for Modifiers & Suffixes ---

function applyPayloadModifiers(effText, eff, formatCtx) {
    const { targetStr, trigger, group } = formatCtx;
    
    if (eff.invertRoles && !['ATTACH', 'ATTACH_TO', 'REBEL', 'DONATE'].includes(eff.type)) {
        if (!['this card', 'it', 'the triggering card', 'the targeted card', 'the target'].includes(targetStr)) {
            let isPl = targetStr === 'them' || targetStr.startsWith('all ') || targetStr.includes(' random ') || targetStr.includes(' first ') || targetStr.includes(' last ') || targetStr.endsWith('s');
            let reflexive = isPl ? 'themselves' : 'itself';
            let reflexivePoss = isPl ? 'their own' : 'its own';
            effText = `force {TARGET} to ${effText.replace(/\{TARGET\}/g, reflexive).replace(/\{POSS\}/g, reflexivePoss)}`;
        }
    }

    let adverb = '';
    let suffix = '';
    let isCustomMovement = (eff.type === 'SET_STAT' && eff.stat === 'line');
    
    if (eff.duration && eff.duration !== 'INSTANT' && eff.duration !== 'INDEFINITE') {
        if (eff.duration === 'WHILE_ATTACHED') {
            let hasAttach = group && group.payloads && group.payloads.some(p => p.type === 'ATTACH');
            if (trigger !== 'ON_BE_ATTACHED' && !hasAttach) suffix = ' while attached';
        } else if (eff.duration === 'ACTION') {
            if (isCustomMovement) suffix = ' this action'; else suffix = ' for the current action';
        } else if (eff.duration === 'TEMPORARY') {
            suffix = ' this round';
        } else if (eff.duration === 'BRIEF') {
            suffix = ' this turn';
        } else if (eff.duration === 'PERMANENT') {
            adverb = 'permanently ';
        }
    }

    if (adverb) {
        if (effText.endsWith(' instead')) {
            effText = effText.replace(' instead', '');
            effText = adverb + effText + ' instead';
        } else if (effText.endsWith(' instead{OMIT_TARGET}')) {
            effText = effText.replace(' instead{OMIT_TARGET}', '');
            effText = adverb + effText + ' instead{OMIT_TARGET}';
        } else if (effText.startsWith('force {TARGET} to ')) {
            effText = effText.replace('force {TARGET} to ', `force {TARGET} to ${adverb}`);
        } else {
            effText = adverb + effText;
        }
    }

    if (suffix) {
        if (effText.endsWith(' instead')) {
            effText = effText.replace(' instead', suffix + ' instead');
        } else if (effText.endsWith(' instead{OMIT_TARGET}')) {
            effText = effText.replace(' instead{OMIT_TARGET}', suffix + ' instead{OMIT_TARGET}');
        } else {
            effText += suffix;
        }
    }

    let resolved = resolveTokens(effText, formatCtx);
    if (resolved) {
        resolved = resolved.charAt(0).toUpperCase() + resolved.slice(1);
    }
    return resolved;
}

// --- Main Formatting Exports ---

export function formatPayload(eff, formatCtx) {
    const { group, allTribes, allAbilities, allCards, targetStr, isPlural } = formatCtx;
    let effText = '';
    
    switch(eff.type) {
        case 'DEAL_DAMAGE': 
            if (eff.amountIsX) effText = `deal X damage to {TARGET}`;
            else if (eff.amount < 0) effText = `heal {TARGET} for ${Math.abs(eff.amount)}`;
            else effText = `deal ${eff.amount !== undefined ? eff.amount : 1} damage to {TARGET}`; 
            break;
        case 'HEAL': 
            if (eff.amountIsX) effText = `heal {TARGET} for X`;
            else if (eff.amount < 0) effText = `deal ${Math.abs(eff.amount)} damage to {TARGET}`;
            else effText = `heal {TARGET} for ${eff.amount !== undefined ? eff.amount : 1}`; 
            break;
        case 'DRAW_CARD': 
            let isStandardTypes = true;
            if (group.quickTargeting?.entityType?.length > 0) {
                const types = group.quickTargeting.entityType.filter(t => t !== 'ANY' && t !== 'ALL');
                if (types.length > 0 && types.length <= 4) isStandardTypes = false;
            }
            let hasConditions = false;
            const checkTree = (node) => {
                if (!node) return;
                if (node.type === 'condition') hasConditions = true;
                if (node.children) node.children.forEach(checkTree);
            };
            checkTree(group.logicTree);
            
            let isStandardAlignment = !group.quickTargeting?.alignment || group.quickTargeting.alignment.length === 0 || (group.quickTargeting.alignment.length === 1 && group.quickTargeting.alignment[0] === 'FRIENDLY');
            let isDeck = group.quickTargeting?.zones?.length === 1 && group.quickTargeting.zones[0] === 'DECK';
            
            let isNormalDraw = group.targetMethod === 'AUTO_FIRST' && isStandardAlignment && isDeck && !hasConditions;
            
            if (isNormalDraw) {
                let drawAmt = group.targetCount || 1;
                let typeStr = 'card';
                if (group.quickTargeting?.entityType?.length === 1) {
                    typeStr = group.quickTargeting.entityType[0].toLowerCase();
                }
                
                if (eff.amountIsX) effText = `draw X ${typeStr}s{OMIT_TARGET}`;
                else effText = `draw ${drawAmt === 1 ? (/^[aeiou]/i.test(typeStr) ? 'an' : 'a') + ' ' + typeStr : drawAmt + ' ' + (typeStr === 'equipment' ? typeStr : typeStr + 's')}{OMIT_TARGET}`;
            } else {
                effText = `draw {TARGET}`;
            }
            break;
        case 'DISCARD':
        case 'DISCARD_CARD':
            effText = `discard {TARGET}`; 
            break;
        case 'MILL':
            if (eff.amountIsX) effText = `mill X cards{OMIT_TARGET}`;
            else if (eff.amount > 1) effText = `mill ${eff.amount} cards{OMIT_TARGET}`;
            else effText = `mill {TARGET}`;
            break;
        case 'TRASH':
            effText = `trash {TARGET}`; 
            break;
        case 'HARVEST':
            if (eff.amount !== undefined && eff.amount !== 2) {
                let resName = (eff.resource && eff.resource !== 'maxCarnie') ? eff.resource : 'Carnie';
                effText = `harvest {TARGET} for ${eff.amount} ${resName}`;
            } else {
                effText = `harvest {TARGET}`;
            }
            break;
        case 'RECOVER': effText = `recover {TARGET}`; break;
        case 'REVIVE': effText = `revive {TARGET}`; break;
        case 'MODIFY_STAT': 
            let modStat = `[STAT:${eff.stat || 'stat'}]`;
            let sign = eff.amount > 0 && !eff.amountIsX ? '+' : '';
            let amtStr = eff.amountIsX ? 'X' : eff.amount;
            
            if (targetStr === 'this card' || targetStr === 'self') {
                effText = `${modStat}${sign}${amtStr}{OMIT_TARGET}`;
            } else if (eff.duration === 'WHILE_ATTACHED') {
                effText = `{TARGET} gains ${sign}${amtStr} ${modStat}`;
            } else {
                effText = `give {TARGET} ${sign}${amtStr} ${modStat}`;
            }
            break;
        case 'MODIFY_RESOURCE': 
            let resName = resolveResource(eff.resource, allTribes);
            if (eff.amountIsX) effText = `gain X ${resName}{PER_TARGET}`;
            else if (eff.amount < 0) effText = `lose ${Math.abs(eff.amount)} ${resName}{PER_TARGET}`;
            else effText = `gain ${eff.amount !== undefined ? eff.amount : 1} ${resName}{PER_TARGET}`;
            break;
        case 'SET_STAT': 
            let setAmtStr = eff.amountIsX ? 'X' : eff.amount;
            if (eff.stat === 'line') {
                if (targetStr === 'this card' || targetStr === 'self' || targetStr === 'itself') {
                    effText = `move to [BATTLELINE:${setAmtStr}]{OMIT_TARGET}`;
                } else {
                    effText = `move {TARGET} to [BATTLELINE:${setAmtStr}]`;
                }
            } else {
                let setStat = `[STAT:${eff.stat || 'stat'}]`;
                if (targetStr === 'this card' || targetStr === 'self') {
                    effText = `${setStat}=${setAmtStr}{OMIT_TARGET}`;
                } else {
                    effText = `set {POSS} ${setStat} to ${setAmtStr}`;
                }
            }
            break;
        case 'BLOCK_ACT': effText = `stun {TARGET}`; break;
        case 'BLOCK_ATTACK': effText = `pacify {TARGET}`; break;
        case 'BLOCK_RETALIATE': effText = `daze {TARGET}`; break;
        case 'BLOCK_TARGETING': effText = `stealth {TARGET}`; break;
        case 'SHUFFLE': effText = `shuffle {TARGET} into the deck`; break;
        case 'RETURN': effText = `return {TARGET}`; break;
        case 'ATTACH': effText = eff.invertRoles ? `attach to {TARGET}` : `attach {TARGET} to {SELF}`; break;
        case 'UNATTACH': effText = `unattach {TARGET}`; break;
        case 'FIELD': effText = `field {TARGET}`; break;
        case 'BANISH': effText = `banish {TARGET}`; break;
        case 'KILL': effText = `kill {TARGET}`; break;
        case 'ATTACK': effText = `attack {TARGET}`; break;
        case 'CANCEL_EVENT': effText = `cancel that effect instead{OMIT_TARGET}`; break;
        case 'CLEANSE': effText = `cleanse temporary effects from {TARGET}`; break;
        case 'CHANGE_DESTINATION': 
            let targetDest = (eff.zone || 'DECK').toUpperCase();
            if (targetDest === 'FIELD') effText = `field {TARGET} instead`;
            else if (targetDest === 'HAND') effText = `return {TARGET} to hand instead`;
            else if (targetDest === 'DISCARD') effText = `discard {TARGET} instead`;
            else if (targetDest === 'DECK' || targetDest === 'ORIGINAL_DECK') effText = `shuffle {TARGET} instead`;
            else if (targetDest === 'BANISH') effText = `banish {TARGET} instead`;
            else effText = `move {TARGET} to ${targetDest} instead`;
            break;
        case 'REBEL': effText = eff.invertRoles ? `give control of this card to {TARGET}` : `control {TARGET}`; break;
        case 'DONATE': effText = `donate {TARGET}`; break;
        case 'MODIFY_EVENT': 
            if (eff.stat === 'amount') {
                if (eff.amountIsX) effText = `modify the effect's amount by X{OMIT_TARGET}`;
                else effText = eff.amount < 0 ? `decrease the effect's amount by ${Math.abs(eff.amount)}{OMIT_TARGET}` : `increase the effect's amount by ${eff.amount}{OMIT_TARGET}`;
            } else {
                let statName = `[STAT:${eff.stat || 'stat'}]`;
                if (eff.amountIsX) effText = `modify ${statName} by X{OMIT_TARGET}`;
                else effText = eff.amount < 0 ? `modify ${statName} by ${eff.amount}{OMIT_TARGET}` : `modify ${statName} by +${eff.amount}{OMIT_TARGET}`;
            }
            break;
        case 'CUSTOM_SCRIPT': effText = eff.description ? eff.description + '{OMIT_TARGET}' : `execute script on {TARGET}`; break;
        case 'GRANT_ABILITY':
            let { name: abilityName, isManual } = resolveAbility(eff.grantedAbilityId, allAbilities);
            let grantVerb = isManual ? 'grant' : 'apply';
            let paramSuffix = eff.grantedAbilityParamXIsX ? ' (X)' : (eff.grantedAbilityParamX !== undefined && eff.grantedAbilityParamX !== null ? ` (${eff.grantedAbilityParamX})` : '');
            
            if (eff.duration === 'WHILE_ATTACHED') {
                effText = `{TARGET} gains @[${abilityName}]${paramSuffix}`;
            } else {
                effText = `${grantVerb} @[${abilityName}]${paramSuffix} to {TARGET}`;
            }
            if (eff.blockDuplicates) effText += ` (unique)`;
            break;
        case 'TRANSFORM':
            let transCardName = resolveCard(eff.cardId, allCards);
            let isSelfTarget = ['this card', 'it', 'the triggering card', 'self', 'itself'].includes(targetStr);
            
            if (isPlural) {
                let pluralSuffix = transCardName.endsWith('s') ? '' : 's';
                if (isSelfTarget) {
                    effText = `transform into ${transCardName}${pluralSuffix}{OMIT_TARGET}`;
                } else {
                    effText = `transform {TARGET} into ${transCardName}${pluralSuffix}`;
                }
            } else {
                let article = /^[aeiou]/i.test(transCardName) ? 'an' : 'a';
                if (isSelfTarget) {
                    effText = `transform into ${article} ${transCardName}{OMIT_TARGET}`;
                } else {
                    effText = `transform {TARGET} into ${article} ${transCardName}`;
                }
            }
            break;
        case 'REMOVE_ABILITY':
            let rmAbilityName = resolveAbility(eff.grantedAbilityId, allAbilities).name;
            effText = `remove **${rmAbilityName}** from {TARGET}`;
            break;
        case 'SUMMON':
            let cardName = resolveCard(eff.cardId, allCards);
            const summonAmt = Math.max(1, Math.abs(eff.amount || 1));
            const pluralSuffix = (summonAmt > 1 && !cardName.endsWith('s')) ? 's' : '';
            
            let destZone = (eff.zone || 'FIELD').toLowerCase();
            let isCasterZone = (!eff.zoneOwner || eff.zoneOwner === 'CASTER');

            let readinessAdj = '';
            let lineAdj = '';
            let remainingNestedPayloads = [];

            if (eff.nestedGroup && eff.nestedGroup.payloads && eff.nestedGroup.payloads.length > 0) {
                eff.nestedGroup.payloads.forEach(np => {
                    if (np.type === 'MODIFY_STAT' && np.stat === 'readiness') {
                        if (np.amount <= -2) readinessAdj = 'exhausted ';
                        else if (np.amount === -1) readinessAdj = 'unready ';
                        else if (np.amount === 1) readinessAdj = 'ready ';
                        else if (np.amount >= 2) readinessAdj = 'over-ready ';
                        else remainingNestedPayloads.push(np);
                    } else if (np.type === 'SET_STAT' && np.stat === 'readiness') {
                        if (np.amount <= -1) readinessAdj = 'exhausted ';
                        else if (np.amount === 0) readinessAdj = 'unready ';
                        else if (np.amount === 1) readinessAdj = 'ready ';
                        else if (np.amount >= 2) readinessAdj = 'over-ready ';
                        else remainingNestedPayloads.push(np);
                    } else if (np.type === 'SET_STAT' && np.stat === 'line') {
                        lineAdj = `${np.amount} `;
                    } else {
                        remainingNestedPayloads.push(np);
                    }
                });
            }

            let amtText = eff.amountIsX ? 'X' : summonAmt;
            if (!eff.amountIsX && summonAmt === 1) {
                const nextWord = readinessAdj || lineAdj || cardName;
                let testWord = nextWord;
                if (nextWord === lineAdj) {
                    testWord = lineAdj.trim();
                }
                amtText = /^[aeiou]/i.test(testWord) ? 'an' : 'a';
            }

            effText = `summon ${amtText} ${readinessAdj}${lineAdj}${cardName}${pluralSuffix}{OMIT_TARGET}`;
            
            if (isCasterZone) {
                if (destZone !== 'field') effText += ` to ${destZone}`;
            } else {
                effText += ` to {POSS} ${destZone}`;
            }
            
            if (remainingNestedPayloads.length > 0) {
                let tempTargetStr = formatCtx.targetStr;
                let tempGroupId = formatCtx.groupId;
                
                formatCtx.targetStr = 'them';
                formatCtx.groupId = 'summon_nested';
                
                let nestedPayloadsText = remainingNestedPayloads.map(np => {
                    let npText = formatPayload(np, formatCtx);
                    if (npText) npText = npText.charAt(0).toLowerCase() + npText.slice(1);
                    npText = npText.replace(/\{TARGET\}/g, 'them').replace(/\{POSS\}/g, 'their').replace(/\{OMIT_TARGET\}/g, '');
                    if (np.type === 'ATTACH' && tempTargetStr === 'self') {
                        npText = npText.replace('attach them to self', 'attach them to it');
                        npText = npText.replace('attach it to self', 'attach it to it');
                    }
                    return npText;
                });
                
                formatCtx.targetStr = tempTargetStr;
                formatCtx.groupId = tempGroupId;
                
                let combinedNested = joinWithAnd(nestedPayloadsText);
                
                let targetMethod = eff.nestedGroup.targetMethod || 'AUTO_ALL';
                let targetCount = eff.nestedGroup.targetCount || 1;
                let subTargetText = '';
                
                if (targetMethod === 'AUTO_RANDOM') subTargetText = ` for ${targetCount} of them at random`;
                else if (targetMethod === 'AUTO_FIRST') subTargetText = ` for the first ${targetCount} of them`;
                else if (targetMethod === 'AUTO_LAST') subTargetText = ` for the last ${targetCount} of them`;
                else if (targetMethod === 'AUTO_ALL' && !combinedNested.includes('them') && !combinedNested.includes('their') && !combinedNested.includes('it')) subTargetText = ` for all of them`;
                
                effText += ` and ${combinedNested}${subTargetText}`;
            }
            break;
        default:
            let readableType = eff.type.replace(/_/g, ' ').toLowerCase();
            effText = `${readableType} {TARGET}`;
    }

    return applyPayloadModifiers(effText, eff, formatCtx);
}

export function formatCombinedPayloads(effs, formatCtx) {
    if (effs.length === 1) return formatPayload(effs[0], formatCtx);
    
    const first = effs[0];
    const { allAbilities, allTribes, targetStr } = formatCtx;
    let effText = '';
    
    if (first.type === 'GRANT_ABILITY') {
        let hasManual = false;
        let abNames = effs.map(eff => {
            let { name, isManual } = resolveAbility(eff.grantedAbilityId, allAbilities);
            if (isManual) hasManual = true;
            let paramSuffix = eff.grantedAbilityParamXIsX ? ' (X)' : (eff.grantedAbilityParamX !== undefined && eff.grantedAbilityParamX !== null ? ` (${eff.grantedAbilityParamX})` : '');
            return `@[${name}]${paramSuffix}`;
        });
        
        let grantVerb = hasManual ? 'grant' : 'apply';
        if (first.duration === 'WHILE_ATTACHED') {
            effText = `{TARGET} gains ${joinWithAnd(abNames)}`;
        } else {
            effText = `${grantVerb} ${joinWithAnd(abNames)} to {TARGET}`;
        }
        if (first.blockDuplicates) effText += ` (unique)`;
        
    } else if (first.type === 'REMOVE_ABILITY') {
        let abNames = effs.map(eff => `**${resolveAbility(eff.grantedAbilityId, allAbilities).name}**`);
        effText = `remove ${joinWithAnd(abNames)} from {TARGET}`;
        
    } else if (first.type === 'MODIFY_STAT') {
        let changes = effs.map(eff => {
             let modStat = `[STAT:${eff.stat || 'stat'}]`;
             let sign = eff.amount > 0 && !eff.amountIsX ? '+' : '';
             let amtStr = eff.amountIsX ? 'X' : eff.amount;
             if (targetStr === 'this card' || targetStr === 'self') {
                 return `${modStat}${sign}${amtStr}`;
             }
             return `${sign}${amtStr} ${modStat}`;
        });
        
        if (targetStr === 'this card' || targetStr === 'self') {
            effText = `${joinWithAnd(changes)}{OMIT_TARGET}`;
        } else if (first.duration === 'WHILE_ATTACHED') {
            effText = `{TARGET} gains ${joinWithAnd(changes)}`;
        } else {
            effText = `give {TARGET} ${joinWithAnd(changes)}`;
        }
        
    } else if (first.type === 'MODIFY_RESOURCE') {
        let changes = effs.map(eff => {
             let resName = resolveResource(eff.resource, allTribes);
             let amtStr = eff.amountIsX ? 'X' : Math.abs(eff.amount);
             return `${amtStr} ${resName}`;
        });
        let isSpend = first.amount < 0;
        effText = `${isSpend ? 'lose' : 'gain'} ${joinWithAnd(changes)}{PER_TARGET}`;
        
    } else if (first.type === 'SET_STAT') {
        if (first.stat === 'line') {
            let changes = effs.map(eff => {
                 let amtStr = eff.amountIsX ? 'X' : eff.amount;
                 return `[BATTLELINE:${amtStr}]`;
            });
            if (targetStr === 'this card' || targetStr === 'self' || targetStr === 'itself') {
                effText = `move to ${joinWithAnd(changes)}{OMIT_TARGET}`;
            } else {
                effText = `move {TARGET} to ${joinWithAnd(changes)}`;
            }
        } else {
            let changes = effs.map(eff => {
                 let setStat = `[STAT:${eff.stat || 'stat'}]`;
                 let amtStr = eff.amountIsX ? 'X' : eff.amount;
                 if (targetStr === 'this card' || targetStr === 'self') {
                     return `${setStat}=${amtStr}`;
                 }
                 return `${setStat} to ${amtStr}`;
            });
            if (targetStr === 'this card' || targetStr === 'self') {
                effText = `${joinWithAnd(changes)}{OMIT_TARGET}`;
            } else {
                effText = `set {POSS} ${joinWithAnd(changes)}`;
            }
        }
        
    } else if (['BLOCK_ACT', 'BLOCK_ATTACK', 'BLOCK_RETALIATE'].includes(first.type)) {
        let blockedActions = effs.map(eff => {
            if (eff.type === 'BLOCK_ACT') return 'act';
            if (eff.type === 'BLOCK_ATTACK') return 'attack';
            if (eff.type === 'BLOCK_RETALIATE') return 'retaliate';
            return '';
        }).filter(Boolean);
        effText = `prevent {TARGET} from ${blockedActions.map(a => a + 'ing').join(' and ')}`;
        
    } else {
        // If it's a grouped list of unmatched verbs, process them individually and join them
        let formatted = effs.map(e => formatPayload(e, formatCtx));
        formatted = [...new Set(formatted)];
        let joined = '';
        
        let parts = formatted.map((f, i) => i > 0 && f !== 'Instead' ? f.charAt(0).toLowerCase() + f.slice(1) : f);

        if (parts[0] === 'Instead') {
            if (parts.length === 1) joined = parts[0];
            else if (parts.length === 2) joined = parts[0] + ', ' + parts[1];
            else {
                const last = parts.pop();
                joined = parts[0] + ', ' + parts.slice(1).join(', ') + ', then ' + last;
            }
        } else {
            if (parts.length === 1) joined = parts[0];
            else if (parts.length === 2) joined = parts[0] + ', then ' + parts[1];
            else {
                const last = parts.pop();
                joined = parts.join(', ') + ', then ' + last;
            }
        }
        return joined; // Returns early because formatPayload recursively handled modifiers
    }
    
    return applyPayloadModifiers(effText, first, formatCtx);
}