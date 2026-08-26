/**
 * src/language/format_payload.js
 * The core switch statement that converts raw JSON payloads into natural language strings.
 */

import { resolveTokens } from './tokens.js';
import { joinWithAnd, ZONE_NAMES } from './utils.js';

export function formatPayload(eff, formatCtx) {
    const { group, trigger, allTribes, allAbilities, allCards, targetStr, isPlural, groupId } = formatCtx;
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
            } else {
                effText = `give {TARGET} ${sign}${amtStr} ${modStat}`;
            }
            break;
        case 'MODIFY_RESOURCE': 
        case 'MODIFY_RESOURCE': 
            let resName = eff.resource || 'resource';
            if (resName === 'maxCarnie') resName = 'Max Carnie';
            else {
                if (allTribes && Array.isArray(allTribes)) {
                    const match = allTribes.find(t => t.id === resName || t.name.toLowerCase() === resName.toLowerCase());
                    if (match) resName = match.name;
                } else if (resName.toLowerCase().startsWith('tribe_')) {
                    resName = resName.substring(6);
                    resName = resName.replace(/_/g, ' ');
                    resName = resName.replace(/\b\w/g, l => l.toUpperCase());
                }
            }
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
            let destName = ZONE_NAMES[targetDest] || targetDest.toLowerCase();
            if (targetDest === 'FIELD') effText = `field {TARGET} instead`;
            else if (targetDest === 'HAND') effText = `return {TARGET} to hand instead`;
            else if (targetDest === 'DISCARD') effText = `discard {TARGET} instead`;
            else if (targetDest === 'DECK' || targetDest === 'ORIGINAL_DECK') effText = `shuffle {TARGET} into ${destName} instead`;
            else if (targetDest === 'BANISH') effText = `banish {TARGET} instead`;
            else effText = `move {TARGET} to ${destName} instead`;
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
            let abilityName = eff.grantedAbilityId;
            let grantVerb = 'grant';
            if (allAbilities && Array.isArray(allAbilities)) {
                const match = allAbilities.find(a => a.abilityId === eff.grantedAbilityId);
                if (match) {
                    abilityName = match.name;
                    if (match.trigger !== 'MANUAL') grantVerb = 'apply';
                }
            } else if (typeof window !== 'undefined' && typeof getAbility === 'function') {
                 const grantedAb = getAbility(eff.grantedAbilityId);
                 if(grantedAb) {
                     abilityName = grantedAb.name;
                     if (grantedAb.trigger !== 'MANUAL') grantVerb = 'apply';
                 }
            }
            let paramSuffix = '';
            if (eff.grantedAbilityParamXIsX) paramSuffix = ' (X)';
            else if (eff.grantedAbilityParamX !== undefined && eff.grantedAbilityParamX !== null) paramSuffix = ` (${eff.grantedAbilityParamX})`;
            
            effText = `${grantVerb} @[${abilityName}]${paramSuffix} to {TARGET}`;
            if (eff.duration === 'WHILE_ATTACHED' || trigger === 'ON_BE_ATTACHED') {
                effText = `${grantVerb} @[${abilityName}]${paramSuffix}{OMIT_TARGET}`;
            }
            if (eff.blockDuplicates) effText += ` (unique)`;
            break;
        case 'TRANSFORM':
            let transCardName = eff.cardId;
            if (allCards && Array.isArray(allCards)) {
                const match = allCards.find(c => c.id === eff.cardId);
                if (match) transCardName = match.name;
            } else if (typeof window !== 'undefined' && typeof getCard === 'function') {
                const foundCard = getCard(eff.cardId);
                if (foundCard) transCardName = foundCard.name;
            }
            
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
            let rmAbilityName = eff.grantedAbilityId;
            if (allAbilities && Array.isArray(allAbilities)) {
                const match = allAbilities.find(a => a.abilityId === eff.grantedAbilityId || a.id === eff.grantedAbilityId);
                if (match) rmAbilityName = match.name;
            } else if (typeof window !== 'undefined' && typeof getAbility === 'function') {
                 const grantedAb = getAbility(eff.grantedAbilityId);
                 if(grantedAb) rmAbilityName = grantedAb.name;
            }
            effText = `remove **${rmAbilityName}** from {TARGET}`;
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
                const summonAmt = Math.max(1, Math.abs(eff.amount || 1));
                const pluralSuffix = (summonAmt > 1 && !cardName.endsWith('s')) ? 's' : '';
                
                let destZone = (eff.zone || 'FIELD').toUpperCase();
            let zonePh = ZONE_NAMES[destZone] || destZone.toLowerCase();
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
                    if (destZone !== 'FIELD') effText += ` to ${zonePh}`;
                } else {
                    effText += ` to {POSS} ${zonePh}`;
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
            if (trigger !== 'ON_BE_ATTACHED') suffix = ' while attached';
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