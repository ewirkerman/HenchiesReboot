/**
 * src/language/payloads.js
 * Translates execution targets and payloads into action verbs.
 */

import { ACTION_MANIFEST } from '../engine/actions/index.js';
import { buildTargetDesc } from './targeting.js';
import { joinWithAnd, ZONE_NAMES } from './utils.js';

export function processTargetGroups(ability, ctx) {
    const { allAbilities, allCards, allTribes, globalTargetNoun, tracker, trigger } = ctx;
    let allCostSentences = [];
    let allEffectSentences = [];
    
    const targetGroups = ability.effects || [];
    
    targetGroups.forEach((group, gIdx) => {
        if (!group.payloads || group.payloads.length === 0) return;

        let allHaveSameImpliedZone = group.payloads.length > 0;
        let impliedZone = null;
        for (const p of group.payloads) {
            let z = null;
            const manifest = ACTION_MANIFEST[p.type];
            if (manifest) {
                if (manifest.endZone && manifest.endZone.length === 1) z = manifest.endZone[0];
                else if (Array.isArray(manifest.validZones) && manifest.validZones.length === 1) z = manifest.validZones[0];
            }
            if (!z && ['DEAL_DAMAGE', 'HEAL', 'KILL', 'ATTACH', 'UNATTACH', 'ATTACK'].includes(p.type)) z = 'FIELD';

            if (!z) { allHaveSameImpliedZone = false; break; }
            if (!impliedZone) impliedZone = z;
            else if (impliedZone !== z) { allHaveSameImpliedZone = false; break; }
        }

        let targetStr = 'them';
        let possessiveStr = 'their';
        let singularDesc = '';

        let isPlural = false;

        if (group.targetMethod === 'SELF') {
            targetStr = 'this card';
            possessiveStr = "this card's";
            isPlural = false;
        } else if (group.targetMethod === 'AVATAR') {
            targetStr = 'your avatar';
            possessiveStr = "your avatar's";
            isPlural = false;
        } else if (group.targetMethod === 'ENEMY_AVATAR') {
            targetStr = 'the enemy avatar';
            possessiveStr = "the enemy avatar's";
            isPlural = false;
        } else if (group.targetMethod === 'EVENT_SOURCE') {
            if (trigger === 'MANUAL' || ['TURN_STARTING', 'TURN_STARTED', 'TURN_ENDING', 'TURN_ENDED'].includes(trigger)) {
                targetStr = 'this card';
                possessiveStr = "this card's";
            } else {
                targetStr = 'the triggering card';
                possessiveStr = "the triggering card's";
            }
            isPlural = false;
        } else if (group.targetMethod === 'EVENT_TARGET') {
            const hasExternalTarget = ['ON_ATTACK', 'WOULD_ATTACK', 'MODIFY_ATTACK', 'ON_BE_ATTACKED', 'WOULD_BE_ATTACKED', 'ON_DEAL_DAMAGE', 'WOULD_DEAL_DAMAGE', 'MODIFY_DEAL_DAMAGE', 'ON_BE_DAMAGED', 'WOULD_BE_DAMAGED', 'MODIFY_BE_DAMAGED', 'ON_HEAL', 'WOULD_HEAL', 'MODIFY_HEAL', 'ON_BE_HEALED', 'WOULD_BE_HEALED', 'ON_KILL', 'WOULD_KILL', 'KILL'].includes(trigger) || (['MANUAL', 'PLAY', 'PLAY_OPTIONAL'].includes(trigger) && ability.activation?.method === 'PLAYER_CHOICE');
            
            if (!hasExternalTarget) {
                isPlural = group.targetCount > 1;
                let baseDesc = buildTargetDesc(group.quickTargeting || {}, group.logicTree, trigger, allHaveSameImpliedZone, impliedZone, isPlural, allTribes, allAbilities);
                
                if (isPlural) {
                    targetStr = `${group.targetCount} random ${baseDesc}`;
                    possessiveStr = `their`;
                } else {
                    targetStr = `a random ${baseDesc}`;
                    possessiveStr = `${targetStr}'s`;
                }
            } else {
                if (ability.triggerScope === 'GLOBAL' && globalTargetNoun) {
                    targetStr = `that ${globalTargetNoun}`;
                    isPlural = /(allies|enemies|cards|characters|entities|all\b)/i.test(globalTargetNoun) || globalTargetNoun.endsWith('s');
                } else if (trigger.includes('ATTACK')) targetStr = trigger.includes('BE_ATTACKED') ? 'the attacker' : 'the defender';
                else if (trigger.includes('DAMAGE')) targetStr = trigger.includes('BE_DAMAGED') ? 'the damage source' : 'the damaged character';
                else if (trigger.includes('HEAL')) targetStr = trigger.includes('BE_HEALED') ? 'the healer' : 'the healed character';
                else if (trigger.includes('KILL')) targetStr = trigger.includes('BE_KILLED') ? 'the killer' : 'the killed unit';
                else if (trigger.includes('PLAY')) targetStr = 'the played card';
                else if (trigger.includes('SUMMON')) targetStr = 'the summoned unit';
                else if (trigger.includes('DRAW')) targetStr = 'the drawn card';
                else if (trigger.includes('DISCARD')) targetStr = 'the discarded card';
                else if (trigger.includes('HARVEST')) targetStr = 'the harvested card';
                else if (['MANUAL', 'UNTRIGGERABLE', 'TURN_STARTING', 'TURN_STARTED', 'TURN_ENDING', 'TURN_ENDED'].includes(trigger)) targetStr = 'this card';
                else targetStr = `the target`;
                possessiveStr = `${targetStr}'s`;
            }
        } else if (group.targetMethod === 'SAME_AS_ACTIVATION') {
            const actMethod = ability.activation?.method || 'NONE';
            if (ability.triggerScope === 'GLOBAL' && globalTargetNoun) {
                targetStr = `that ${globalTargetNoun}`;
                isPlural = /(allies|enemies|cards|characters|entities|all\b)/i.test(globalTargetNoun) || globalTargetNoun.endsWith('s');
                possessiveStr = `${targetStr}'s`;
            } else if (actMethod === 'PLAYER_CHOICE') {
                let actDesc = buildTargetDesc(ability.activation?.quickTargeting, ability.activation?.logicTree, trigger, true, 'FIELD', false, allTribes, allAbilities);
                targetStr = `a chosen ${actDesc}`;
                possessiveStr = `${targetStr}'s`;
            } else if (['MANUAL', 'UNTRIGGERABLE', 'TURN_STARTING', 'TURN_STARTED', 'TURN_ENDING', 'TURN_ENDED'].includes(trigger)) {
                targetStr = 'this card';
                possessiveStr = "its";
            } else {
                if (trigger.includes('ATTACK')) targetStr = trigger.includes('BE_ATTACKED') ? 'the attacker' : 'the defender';
                else if (trigger.includes('DAMAGE')) targetStr = trigger.includes('BE_DAMAGED') ? 'the damage source' : 'the damaged character';
                else if (trigger.includes('HEAL')) targetStr = trigger.includes('BE_HEALED') ? 'the healer' : 'the healed character';
                else if (trigger.includes('KILL')) targetStr = trigger.includes('BE_KILLED') ? 'the killer' : 'the killed unit';
                else if (trigger.includes('PLAY')) targetStr = 'the played card';
                else if (trigger.includes('SUMMON')) targetStr = 'the summoned unit';
                else if (trigger.includes('DRAW')) targetStr = 'the drawn card';
                else if (trigger.includes('DISCARD')) targetStr = 'the discarded card';
                else if (trigger.includes('HARVEST')) targetStr = 'the harvested card';
                else targetStr = `the triggered entity`;
                possessiveStr = `its`;
            }
        } else {
            isPlural = group.targetMethod === 'AUTO_ALL' || group.targetCount > 1;
            let baseDesc = buildTargetDesc(group.quickTargeting || {}, group.logicTree, trigger, allHaveSameImpliedZone, impliedZone, isPlural, allTribes, allAbilities);
            singularDesc = buildTargetDesc(group.quickTargeting || {}, group.logicTree, trigger, allHaveSameImpliedZone, impliedZone, false, allTribes, allAbilities);
            
            if (group.targetMethod === 'AUTO_ALL') targetStr = `all ${baseDesc}`;
            else if (group.targetMethod === 'AUTO_RANDOM') targetStr = group.targetCount === 1 ? `a random ${singularDesc}` : `${group.targetCount} random ${baseDesc}`;
            else if (group.targetMethod === 'AUTO_FIRST') targetStr = group.targetCount === 1 ? `the first ${singularDesc}` : `the first ${group.targetCount} ${baseDesc}`;
            else if (group.targetMethod === 'AUTO_LAST') targetStr = group.targetCount === 1 ? `the last ${singularDesc}` : `the last ${group.targetCount} ${baseDesc}`;
            else targetStr = baseDesc;
            
            if (targetStr === 'them' || targetStr === 'it') possessiveStr = targetStr === 'them' ? 'their' : 'its';
            else if (isPlural) possessiveStr = targetStr.endsWith('s') ? `${targetStr}'` : `${targetStr}'s`;
            else possessiveStr = `${targetStr}'s`;
        }

        let groupId = `group_${gIdx}`;
        if (ability.triggerScope === 'GLOBAL' && globalTargetNoun && targetStr === `that ${globalTargetNoun}`) groupId = 'global_target';
        else if (targetStr === 'this card') groupId = 'self';
        else if (targetStr === 'your avatar') groupId = 'your_avatar';
        else if (targetStr === 'the enemy avatar') groupId = 'enemy_avatar';
        else if (targetStr === 'the attacker') groupId = 'attacker';
        else if (targetStr === 'the defender') groupId = 'defender';
        else if (targetStr === 'the damaged character') groupId = 'damaged_character';
        else if (targetStr === 'the damage source') groupId = 'damage_source';
        else if (targetStr === 'the healed character') groupId = 'healed_character';
        else if (targetStr === 'the targeted card') groupId = 'targeted_card';

        const resolveTokens = (text) => {
            text = text.replace(/\{SELF_POSS\}/g, () => tracker.mentionPoss('self', "this card's", false));
            text = text.replace(/\{SELF\}/g, () => tracker.mention('self', "this card", false));

            text = text.replace(/\{REFLEXIVE_POSS\}/g, isPlural ? 'their own' : 'its own');
            text = text.replace(/\{REFLEXIVE\}/g, isPlural ? 'themselves' : 'itself');

            if (text.includes('{OMIT_TARGET}')) {
                tracker.mention(groupId, targetStr, isPlural);
                text = text.replace(/\{OMIT_TARGET\}/g, '');
            }

            if (text.includes('{PER_TARGET}')) {
                tracker.mention(groupId, targetStr, isPlural);
                if (['this card', 'it', 'the triggering card', 'the targeted card', 'the attacker', 'the defender', 'the damaged character', 'the damage source', 'the healed character', 'the target', 'your avatar', 'the enemy avatar'].includes(targetStr) || targetStr.startsWith('a chosen')) {
                    text = text.replace(/\{PER_TARGET\}/g, '');
                } else if (group.targetMethod === 'AUTO_ALL') {
                    text = text.replace(/\{PER_TARGET\}/g, ` for each ${singularDesc}`);
                } else {
                    text = text.replace(/\{PER_TARGET\}/g, ` for each of ${targetStr}`);
                }
            }

            text = text.replace(/\{TARGET\}|\{POSS\}|\{DYNAMIC_STAT:(.*?)\|(.*?)\}/g, (match, action, statText) => {
                if (match === '{TARGET}') {
                    return tracker.mention(groupId, targetStr, isPlural);
                } else if (match === '{POSS}') {
                    return tracker.mentionPoss(groupId, possessiveStr, isPlural);
                } else {
                    let resolvedEntity = tracker.mention(groupId, targetStr, isPlural);
                    if (resolvedEntity === 'them') {
                        return `${action} their ${statText}`;
                    } else if (resolvedEntity === 'it') {
                        return `${action} its ${statText}`;
                    } else {
                        const isComplex = /\b(on|in|with|that|during)\b/i.test(resolvedEntity);
                        if (isComplex) {
                            return `${action} the ${statText} of ${resolvedEntity}`;
                        } else {
                            let dynamicPoss = resolvedEntity.endsWith('s') ? `${resolvedEntity}'` : `${resolvedEntity}'s`;
                            return `${action} ${dynamicPoss} ${statText}`;
                        }
                    }
                }
            });

            return text;
        };

        const formatPayload = (eff) => {
            let effText = '';
            
            switch(eff.type) {
                case 'DEAL_DAMAGE': 
                    if (eff.amount < 0) effText = `restore ${Math.abs(eff.amount)} health to {TARGET}`;
                    else effText = `deal ${eff.amount !== undefined ? eff.amount : 1} damage to {TARGET}`; 
                    break;
                case 'HEAL': 
                    if (eff.amount < 0) effText = `deal ${Math.abs(eff.amount)} damage to {TARGET}`;
                    else effText = `restore ${eff.amount !== undefined ? eff.amount : 1} health to {TARGET}`; 
                    break;
                case 'DRAW_CARD': 
                    let isNormalDraw = group.targetMethod === 'AUTO_FIRST' && (!group.quickTargeting || !group.quickTargeting.alignment || group.quickTargeting.alignment.length === 0 || (group.quickTargeting.alignment.length === 1 && group.quickTargeting.alignment[0] === 'FRIENDLY'));
                    if (isNormalDraw) {
                        let drawAmt = group.targetCount !== undefined ? group.targetCount : (eff.amount !== undefined ? eff.amount : 1);
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
                case 'REVIVE': effText = `revive {TARGET}`; break;
                case 'MODIFY_STAT': 
                    if (eff.stat === 'readiness') {
                        if (eff.amount <= -2) effText = `exhaust {TARGET}`;
                        else if (eff.amount === -1) effText = `unready {TARGET}`;
                        else if (eff.amount === 1) effText = `ready {TARGET}`;
                        else if (eff.amount >= 2) effText = `over-ready {TARGET}`;
                        else effText = `{DYNAMIC_STAT:modify|readiness by ${eff.amount}}`;
                    } else if (eff.stat === 'power') {
                        if (eff.amount < 0) effText = `cause {TARGET} to lose ${Math.abs(eff.amount)} power`;
                        else effText = `give {TARGET} ${eff.amount !== undefined ? eff.amount : 1} power`;
                    } else {
                        let modStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                        if (eff.amount < 0) effText = `{DYNAMIC_STAT:reduce|${modStat} by ${Math.abs(eff.amount)}}`;
                        else effText = `{DYNAMIC_STAT:increase|${modStat} by ${eff.amount !== undefined ? eff.amount : 1}}`;
                    }
                    break;
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
                    if (eff.amount < 0) effText = `lose ${Math.abs(eff.amount)} ${resName}{PER_TARGET}`;
                    else effText = `gain ${eff.amount !== undefined ? eff.amount : 1} ${resName}{PER_TARGET}`;
                    break;
                case 'SET_STAT': 
                    if (eff.stat === 'readiness') {
                        if (eff.amount <= -1) effText = `exhaust {TARGET}`;
                        else if (eff.amount === 0) effText = `unready {TARGET}`;
                        else if (eff.amount === 1) effText = `ready {TARGET}`;
                        else if (eff.amount >= 2) effText = `over-ready {TARGET}`;
                        else effText = `{DYNAMIC_STAT:set|readiness to ${eff.amount}}`;
                        break;
                    }
                    let setStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                    effText = `{DYNAMIC_STAT:set|${setStat} to ${eff.amount !== undefined ? eff.amount : 1}}`;
                    break;
                case 'BLOCK_ACT': effText = `block {TARGET} from acting`; break;
                case 'BLOCK_ATTACK': effText = `block {TARGET} from attacking`; break;
                case 'BLOCK_RETALIATE': effText = `block {TARGET} from retaliating`; break;
                case 'BLOCK_TARGETING': effText = `prevent enemies from targeting {TARGET}`; break;
                case 'SHUFFLE': effText = `shuffle {TARGET} into deck`; break;
                case 'RETURN': effText = `return {TARGET} to hand`; break;
                case 'ATTACH': effText = eff.invertRoles ? `attach to {TARGET}` : `attach {TARGET} to {SELF}`; break;
                case 'UNATTACH': effText = `unattach {TARGET}`; break;
                case 'FIELD': effText = `field {TARGET}`; break;
                case 'BANISH': effText = `banish {TARGET}`; break;
                case 'KILL': effText = `kill {TARGET}`; break;
                case 'ATTACK': effText = `attack {TARGET}`; break;
                case 'CANCEL_EVENT': effText = `cancel the triggering event instead{OMIT_TARGET}`; break;
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
                case 'REBEL': effText = eff.invertRoles ? `give control of {SELF} to {TARGET}` : `take control of {TARGET}`; break;
                case 'MODIFY_EVENT': 
                    let eventNoun = "amount";
                    if (trigger.includes('DAMAGE') || trigger.includes('ATTACK')) eventNoun = "damage";
                    else if (trigger.includes('HEAL')) eventNoun = "healing";
                    else if (trigger.includes('DRAW')) eventNoun = "cards drawn";
                    else if (trigger.includes('DISCARD') || trigger.includes('TRASH')) eventNoun = "cards discarded";
                    else if (trigger.includes('RESOURCE')) eventNoun = "resources";
                    else if (trigger.includes('SUMMON')) eventNoun = "units summoned";
                    
                    if (eff.stat === 'amount') {
                        effText = eff.amount < 0 ? `decrease the ${eventNoun} by ${Math.abs(eff.amount)}{OMIT_TARGET}` : `increase the ${eventNoun} by ${Math.abs(eff.amount)}{OMIT_TARGET}`;
                    } else {
                        let statName = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                        effText = eff.amount < 0 ? `decrease the ${statName} by ${Math.abs(eff.amount)}{OMIT_TARGET}` : `increase the ${statName} by ${Math.abs(eff.amount)}{OMIT_TARGET}`;
                    }
                    break;
                case 'CUSTOM_SCRIPT': effText = eff.description ? eff.description + '{OMIT_TARGET}' : `execute custom script on {TARGET}`; break;
                case 'GRANT_ABILITY':
                    let abilityName = eff.grantedAbilityId;
                    if (allAbilities && Array.isArray(allAbilities)) {
                        const match = allAbilities.find(a => a.abilityId === eff.grantedAbilityId);
                        if (match) abilityName = match.name;
                    } else if (typeof window !== 'undefined' && typeof getAbility === 'function') {
                         const grantedAb = getAbility(eff.grantedAbilityId);
                         if(grantedAb) abilityName = grantedAb.name;
                    }
                    effText = `grant @[${abilityName}] to {TARGET}`;
                    if (eff.blockDuplicates) effText += ` (if not present)`;
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
                    
                    if (isPlural) {
                        let pluralSuffix = transCardName.endsWith('s') ? '' : 's';
                        if (targetStr === 'self' || targetStr === 'itself') {
                            effText = `transform into ${transCardName}${pluralSuffix}{OMIT_TARGET}`;
                        } else {
                            effText = `transform {TARGET} into ${transCardName}${pluralSuffix}`;
                        }
                    } else {
                        let article = /^[aeiou]/i.test(transCardName) ? 'an' : 'a';
                        if (targetStr === 'self' || targetStr === 'itself') {
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
                effText = `remove @[${rmAbilityName}] from {TARGET}`;
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
                    const summonAmt = Math.max(1, Math.abs(eff.amount !== undefined ? eff.amount : 1));
                    const pluralSuffix = (summonAmt > 1 && !cardName.endsWith('s')) ? 's' : '';
                    
                    let destZone = (eff.zone || 'FIELD').toLowerCase();
                    let isCasterZone = (!eff.zoneOwner || eff.zoneOwner === 'CASTER');

                    let durAdj = '';
                    if (eff.duration && eff.duration !== 'INSTANT' && eff.duration !== 'INDEFINITE') {
                        if (eff.duration === 'TEMPORARY') durAdj = 'temporary ';
                        else if (eff.duration === 'BRIEF') durAdj = 'brief ';
                        else if (eff.duration === 'PERMANENT') durAdj = 'permanent ';
                        else if (eff.duration === 'ACTION') durAdj = 'action-bound ';
                        else if (eff.duration === 'WHILE_ATTACHED') durAdj = 'attached ';
                    }

                    let readinessAdj = '';
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
                            } else {
                                remainingNestedPayloads.push(np);
                            }
                        });
                    }

                    let amtText = summonAmt;
                    if (summonAmt === 1) {
                        const nextWord = durAdj || readinessAdj || cardName;
                        amtText = /^[aeiou]/i.test(nextWord) ? 'an' : 'a';
                    }

                    effText = `summon ${amtText} ${durAdj}${readinessAdj}${cardName}${pluralSuffix}{OMIT_TARGET}`;
                    
                    if (isCasterZone) {
                        if (destZone !== 'field') effText += ` to ${destZone}`;
                    } else {
                        effText += ` to {POSS} ${destZone}`;
                    }
                    
                    if (remainingNestedPayloads.length > 0) {
                        let nestedPayloadsText = remainingNestedPayloads.map(np => {
                            let npText = formatPayload(np);
                            npText = npText.replace(/\{TARGET\}/g, 'them').replace(/\{POSS\}/g, 'their').replace(/\{OMIT_TARGET\}/g, '');
                            if (np.type === 'ATTACH' && targetStr === 'self') npText = npText.replace('attach them to self', 'attach them to it');
                            return npText;
                        });
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
                    let readableType = eff.type.toLowerCase().replace(/_/g, ' ');
                    effText = `${readableType} {TARGET}`;
            }

            if (eff.invertRoles && !['ATTACH', 'ATTACH_TO', 'REBEL'].includes(eff.type)) {
                if (!['this card', 'it', 'the triggering card', 'the targeted card', 'the target'].includes(targetStr)) {
                    let isPl = targetStr === 'them' || targetStr.startsWith('all ') || targetStr.includes(' random ') || targetStr.includes(' first ') || targetStr.includes(' last ') || targetStr.endsWith('s');
                    let reflexive = isPl ? 'themselves' : 'itself';
                    let reflexivePoss = isPl ? 'their own' : 'its own';
                    effText = `force {TARGET} to ${effText.replace(/\{TARGET\}/g, reflexive).replace(/\{POSS\}/g, reflexivePoss)}`;
                }
            }

            let adverb = '';
            let suffix = '';
            
            if (eff.duration && eff.duration !== 'INSTANT' && eff.duration !== 'INDEFINITE') {
                if (eff.duration === 'WHILE_ATTACHED') {
                    suffix = ' while attached';
                } else if (eff.duration === 'ACTION') {
                    suffix = ' for the current action';
                } else if (eff.duration === 'TEMPORARY') {
                    adverb = 'temporarily ';
                } else if (eff.duration === 'BRIEF') {
                    adverb = 'briefly ';
                } else if (eff.duration === 'PERMANENT') {
                    adverb = 'permanently ';
                }
            }

            if (adverb && eff.type !== 'SUMMON') {
                if (effText.endsWith(' instead')) {
                    effText = effText.replace(' instead', '');
                    effText = adverb + effText + ' instead';
                } else if (effText.startsWith('force {TARGET} to ')) {
                    effText = effText.replace('force {TARGET} to ', `force {TARGET} to ${adverb}`);
                } else {
                    effText = adverb + effText;
                }
            }

            if (suffix && eff.type !== 'SUMMON') {
                effText += suffix;
            }

            return resolveTokens(effText);
        };

        const getSimilarityKey = (eff) => {
            if ((eff.type === 'MODIFY_STAT' || eff.type === 'SET_STAT') && eff.stat === 'readiness') {
                return `READINESS_${eff.type}_${eff.amount}_${eff.duration}_${eff.invertRoles}_${eff.isCost}`;
            }
            if (['GRANT_ABILITY', 'REMOVE_ABILITY', 'SET_STAT'].includes(eff.type)) {
                return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}_${eff.blockDuplicates}`;
            }
            if (eff.type === 'MODIFY_STAT') {
                return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}_${Math.sign(eff.amount)}`;
            }
            if (eff.type === 'MODIFY_RESOURCE') {
                return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}_${Math.sign(eff.amount)}`;
            }
            if (['BLOCK_ACT', 'BLOCK_ATTACK', 'BLOCK_RETALIATE'].includes(eff.type)) {
                return `BLOCKS_${eff.duration}_${eff.invertRoles}_${eff.isCost}`;
            }
            return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}`;
        };

        const formatCombinedPayloads = (effs) => {
            if (effs.length === 1) return formatPayload(effs[0]);
            
            const first = effs[0];
            let effText = '';
            
            if (first.type === 'GRANT_ABILITY') {
                let abNames = effs.map(eff => {
                    let abilityName = eff.grantedAbilityId;
                    if (allAbilities && Array.isArray(allAbilities)) {
                        const match = allAbilities.find(a => a.abilityId === eff.grantedAbilityId);
                        if (match) abilityName = match.name;
                    } else if (typeof window !== 'undefined' && typeof getAbility === 'function') {
                         const grantedAb = getAbility(eff.grantedAbilityId);
                         if(grantedAb) abilityName = grantedAb.name;
                    }
                    return `@[${abilityName}]`;
                });
                effText = `grant abilities ${joinWithAnd(abNames)} to {TARGET}`;
                if (first.blockDuplicates) effText += ` (if not present)`;
            } else if (first.type === 'REMOVE_ABILITY') {
                let abNames = effs.map(eff => {
                    let rmAbilityName = eff.grantedAbilityId;
                    if (allAbilities && Array.isArray(allAbilities)) {
                        const match = allAbilities.find(a => a.abilityId === eff.grantedAbilityId || a.id === eff.grantedAbilityId);
                        if (match) rmAbilityName = match.name;
                    } else if (typeof window !== 'undefined' && typeof getAbility === 'function') {
                         const grantedAb = getAbility(eff.grantedAbilityId);
                         if(grantedAb) rmAbilityName = grantedAb.name;
                    }
                    return `@[${rmAbilityName}]`;
                });
                effText = `remove abilities ${joinWithAnd(abNames)} from {TARGET}`;
            } else if (first.type === 'MODIFY_STAT' && first.stat !== 'readiness') {
                let isDecrease = first.amount < 0;
                let changes = effs.map(eff => {
                     let modStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                     return `${modStat} by ${Math.abs(eff.amount !== undefined ? eff.amount : 1)}`;
                });
                if (isDecrease) {
                    effText = `{DYNAMIC_STAT:decrease|${joinWithAnd(changes)}}`;
                } else {
                    effText = `{DYNAMIC_STAT:increase|${joinWithAnd(changes)}}`;
                }
            } else if (first.type === 'MODIFY_RESOURCE') {
                let isSpend = first.amount < 0;
                let changes = effs.map(eff => {
                     let resName = eff.resource || 'resource';
                     return `${Math.abs(eff.amount !== undefined ? eff.amount : 1)} ${resName}`;
                });
                if (isSpend) {
                    effText = `lose ${joinWithAnd(changes)}{PER_TARGET}`;
                } else {
                    effText = `gain ${joinWithAnd(changes)}{PER_TARGET}`;
                }
            } else if (first.type === 'SET_STAT' && first.stat !== 'readiness') {
                let changes = effs.map(eff => {
                     let setStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                     return `${setStat} to ${eff.amount !== undefined ? eff.amount : 1}`;
                });
                effText = `{DYNAMIC_STAT:set|${joinWithAnd(changes)}}`;
            } else if (['BLOCK_ACT', 'BLOCK_ATTACK', 'BLOCK_RETALIATE'].includes(first.type)) {
                let blockedActions = effs.map(eff => {
                    if (eff.type === 'BLOCK_ACT') return 'acting';
                    if (eff.type === 'BLOCK_ATTACK') return 'attacking';
                    if (eff.type === 'BLOCK_RETALIATE') return 'retaliating';
                    return '';
                }).filter(Boolean);
                effText = `block {TARGET} from ${joinWithAnd(blockedActions)}`;
            } else {
                let formatted = effs.map(formatPayload);
                formatted = [...new Set(formatted)];
                return formatted.join(', then ');
            }
            
            if (first.invertRoles && !['ATTACH', 'ATTACH_TO', 'REBEL'].includes(first.type)) {
                if (!['this card', 'it', 'the triggering card', 'the targeted card', 'the target'].includes(targetStr)) {
                    let isPl = targetStr === 'them' || targetStr.startsWith('all ') || targetStr.includes(' random ') || targetStr.includes(' first ') || targetStr.includes(' last ') || targetStr.endsWith('s');
                    let reflexive = isPl ? 'themselves' : 'itself';
                    let reflexivePoss = isPl ? 'their own' : 'its own';
                    effText = `force {TARGET} to ${effText.replace(/\{TARGET\}/g, reflexive).replace(/\{POSS\}/g, reflexivePoss)}`;
                }
            }

            let adverb = '';
            let suffix = '';
            
            if (first.duration && first.duration !== 'INSTANT' && first.duration !== 'INDEFINITE') {
                if (first.duration === 'WHILE_ATTACHED') {
                    suffix = ' while attached';
                } else if (first.duration === 'ACTION') {
                    suffix = ' for the current action';
                } else if (first.duration === 'TEMPORARY') {
                    adverb = 'temporarily ';
                } else if (first.duration === 'BRIEF') {
                    adverb = 'briefly ';
                } else if (first.duration === 'PERMANENT') {
                    adverb = 'permanently ';
                }
            }

            if (adverb && first.type !== 'SUMMON') {
                if (effText.endsWith(' instead')) {
                    effText = effText.replace(' instead', '');
                    effText = adverb + effText + ' instead';
                } else if (effText.startsWith('force {TARGET} to ')) {
                    effText = effText.replace('force {TARGET} to ', `force {TARGET} to ${adverb}`);
                } else {
                    effText = adverb + effText;
                }
            }

            if (suffix && first.type !== 'SUMMON') {
                effText += suffix;
            }

            return resolveTokens(effText);
        };

        const finalizeString = (arr) => {
            if(arr.length === 0) return null;
            
            let combined = joinWithAnd(arr);
            
            if (!tracker.hasMentioned(groupId)) {
                if (combined.includes(' for each ')) {
                    combined = combined.replace(' for each ', ` to ${tracker.mention(groupId, targetStr, isPlural)} for each `);
                } else {
                    combined += ` to ${tracker.mention(groupId, targetStr, isPlural)}`;
                }
            }
            return combined;
        };

        const groupPayloads = (payloadsToGroup) => {
            const grouped = new Map();
            const result = [];
            payloadsToGroup.forEach(eff => {
                const key = getSimilarityKey(eff);
                if (!grouped.has(key)) {
                    const arr = [];
                    grouped.set(key, arr);
                    result.push(arr);
                }
                grouped.get(key).push(eff);
            });
            return result.map(formatCombinedPayloads);
        };

        let costs = groupPayloads(group.payloads.filter(p => p.isCost));
        let effects = groupPayloads(group.payloads.filter(p => !p.isCost));
        
        let cStr = finalizeString(costs);
        if (cStr) allCostSentences.push(cStr);
        
        let eStr = finalizeString(effects);
        if (eStr) allEffectSentences.push(eStr);
    });

    return { allCostSentences, allEffectSentences };
}