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
                const article = /^[aeiou]/i.test(actDesc) ? 'an' : 'a';
                targetStr = `${article} ${actDesc}`;
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
                if (['this card', 'it', 'the triggering card', 'the targeted card', 'the attacker', 'the defender', 'the damaged character', 'the damage source', 'the healed character', 'the target', 'your avatar', 'the enemy avatar'].includes(targetStr) || targetStr.startsWith('a ') || targetStr.startsWith('an ')) {
                    text = text.replace(/\{PER_TARGET\}/g, '');
                } else if (group.targetMethod === 'AUTO_ALL') {
                    text = text.replace(/\{PER_TARGET\}/g, ` for each ${singularDesc}`);
                } else {
                    text = text.replace(/\{PER_TARGET\}/g, ` for each of ${targetStr}`);
                }
            }

            text = text.replace(/\{TARGET\}|\{POSS\}/g, (match) => {
                if (match === '{TARGET}') {
                    return tracker.mention(groupId, targetStr, isPlural);
                } else if (match === '{POSS}') {
                    return tracker.mentionPoss(groupId, possessiveStr, isPlural);
                }
            });

            return text;
        };

        const formatPayload = (eff) => {
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
                    if (eff.stat === 'readiness') {
                        if (eff.amountIsX) effText = `modify [STAT:readiness] by X`;
                        else if (eff.amount <= -2) effText = `exhaust {TARGET}`;
                        else if (eff.amount === -1) effText = `unready {TARGET}`;
                        else if (eff.amount === 1) effText = `ready {TARGET}`;
                        else if (eff.amount >= 2) effText = `over-ready {TARGET}`;
                        else effText = `modify {TARGET} [STAT:readiness] by ${eff.amount}`;
                    } else {
                        effText = `give {TARGET} ${sign}${amtStr} ${modStat}`;
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
                    if (eff.amountIsX) effText = `gain X ${resName}{PER_TARGET}`;
                    else if (eff.amount < 0) effText = `lose ${Math.abs(eff.amount)} ${resName}{PER_TARGET}`;
                    else effText = `gain ${eff.amount !== undefined ? eff.amount : 1} ${resName}{PER_TARGET}`;
                    break;
                case 'SET_STAT': 
                    let setAmtStr = eff.amountIsX ? 'X' : eff.amount;
                    if (eff.stat === 'line') {
                        if (targetStr === 'this card' || targetStr === 'self' || targetStr === 'itself') {
                            effText = `move to [ZONE:${setAmtStr}]{OMIT_TARGET}`;
                        } else {
                            effText = `move {TARGET} to [ZONE:${setAmtStr}]`;
                        }
                    } else if (eff.stat === 'readiness') {
                        if (eff.amountIsX) effText = `set [STAT:readiness] to X`;
                        else if (eff.amount <= -1) effText = `exhaust {TARGET}`;
                        else if (eff.amount === 0) effText = `unready {TARGET}`;
                        else if (eff.amount === 1) effText = `ready {TARGET}`;
                        else if (eff.amount >= 2) effText = `over-ready {TARGET}`;
                        else effText = `set {POSS} [STAT:readiness] to ${eff.amount}`;
                    } else {
                        let setStat = `[STAT:${eff.stat || 'stat'}]`;
                        effText = `set {POSS} ${setStat} to ${setAmtStr}`;
                    }
                    break;
                case 'BLOCK_ACT': effText = `stun {TARGET}`; break;
                case 'BLOCK_ATTACK': effText = `pacify {TARGET}`; break;
                case 'BLOCK_RETALIATE': effText = `daze {TARGET}`; break;
                case 'BLOCK_TARGETING': effText = `stealth {TARGET}`; break;
                case 'SHUFFLE': effText = `shuffle {TARGET} into [ZONE:deck]`; break;
                case 'RETURN': effText = `return {TARGET}`; break;
                case 'ATTACH': effText = eff.invertRoles ? `attach to {TARGET}` : `attach {TARGET} to {SELF}`; break;
                case 'UNATTACH': effText = `unattach {TARGET}`; break;
                case 'FIELD': effText = `field {TARGET}`; break;
                case 'BANISH': effText = `banish {TARGET}`; break;
                case 'KILL': effText = `kill {TARGET}`; break;
                case 'ATTACK': effText = `attack {TARGET}`; break;
                case 'CANCEL_EVENT': effText = `instead{OMIT_TARGET}`; break;
                case 'CLEANSE': effText = `cleanse temporary effects from {TARGET}`; break;
                case 'CHANGE_DESTINATION': 
                    let targetDest = (eff.zone || 'DECK').toUpperCase();
                    let destName = ZONE_NAMES[targetDest] || `[ZONE:${targetDest.toLowerCase()}]`;
                    if (targetDest === 'FIELD') effText = `field {TARGET}`;
                    else if (targetDest === 'HAND') effText = `return {TARGET} to [ZONE:hand]`;
                    else if (targetDest === 'DISCARD') effText = `discard {TARGET}`;
                    else if (targetDest === 'DECK' || targetDest === 'ORIGINAL_DECK') effText = `shuffle {TARGET} into ${destName}`;
                    else if (targetDest === 'BANISH') effText = `banish {TARGET}`;
                    else effText = `move {TARGET} to ${destName}`;
                    break;
                case 'REBEL': effText = eff.invertRoles ? `give control of this card to {TARGET}` : `take control of {TARGET}`; break;
                case 'DONATE': effText = `donate {TARGET}`; break;
                case 'MODIFY_EVENT': 
                    if (eff.stat === 'amount') {
                        if (eff.amountIsX) effText = `modify effect amount by X{OMIT_TARGET}`;
                        else effText = eff.amount < 0 ? `decrease effect amount by ${Math.abs(eff.amount)}{OMIT_TARGET}` : `increase effect amount by ${eff.amount}{OMIT_TARGET}`;
                    } else {
                        let statName = `[STAT:${eff.stat || 'stat'}]`;
                        if (eff.amountIsX) effText = `modify ${statName} by X{OMIT_TARGET}`;
                        else effText = eff.amount < 0 ? `modify ${statName} by ${eff.amount}{OMIT_TARGET}` : `modify ${statName} by +${eff.amount}{OMIT_TARGET}`;
                    }
                    break;
                case 'CUSTOM_SCRIPT': effText = eff.description ? eff.description + '{OMIT_TARGET}' : `execute script on {TARGET}`; break;
                case 'GRANT_ABILITY':
                    let abilityName = eff.grantedAbilityId;
                    if (allAbilities && Array.isArray(allAbilities)) {
                        const match = allAbilities.find(a => a.abilityId === eff.grantedAbilityId);
                        if (match) abilityName = match.name;
                    } else if (typeof window !== 'undefined' && typeof getAbility === 'function') {
                         const grantedAb = getAbility(eff.grantedAbilityId);
                         if(grantedAb) abilityName = grantedAb.name;
                    }
                    let paramSuffix = '';
                    if (eff.grantedAbilityParamXIsX) paramSuffix = ' (X)';
                    else if (eff.grantedAbilityParamX !== undefined && eff.grantedAbilityParamX !== null) paramSuffix = ` (${eff.grantedAbilityParamX})`;
                    
                    effText = `grant @[${abilityName}]${paramSuffix} to {TARGET}`;
                    if (eff.duration === 'WHILE_ATTACHED' || trigger === 'ON_BE_ATTACHED') {
                        effText = `grant @[${abilityName}]${paramSuffix}{OMIT_TARGET}`;
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
                    let zonePh = ZONE_NAMES[destZone] || `[ZONE:${destZone.toLowerCase()}]`;
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
                                lineAdj = `[ZONE:${np.amount}] `;
                            } else {
                                remainingNestedPayloads.push(np);
                            }
                        });
                    }

                    let amtText = eff.amountIsX ? 'X' : summonAmt;
                    if (!eff.amountIsX && summonAmt === 1) {
                        const nextWord = durAdj || readinessAdj || lineAdj || cardName;
                        let testWord = nextWord;
                        if (nextWord === lineAdj) {
                            const match = lineAdj.match(/\[ZONE:([a-z_]+)\]/i);
                            if (match) testWord = match[1];
                        }
                        amtText = /^[aeiou]/i.test(testWord) ? 'an' : 'a';
                    }

                    effText = `summon ${amtText} ${durAdj}${readinessAdj}${lineAdj}${cardName}${pluralSuffix}{OMIT_TARGET}`;
                    
                    if (isCasterZone) {
                        if (destZone !== 'FIELD') effText += ` to ${zonePh}`;
                    } else {
                        effText += ` to {POSS} ${zonePh}`;
                    }
                    
                    if (remainingNestedPayloads.length > 0) {
                        let tempTargetStr = targetStr;
                        let tempGroupId = groupId;
                        targetStr = 'them';
                        groupId = 'summon_nested';
                        
                        let nestedPayloadsText = remainingNestedPayloads.map(np => {
                            let npText = formatPayload(np);
                            if (npText) npText = npText.charAt(0).toLowerCase() + npText.slice(1);
                            npText = npText.replace(/\{TARGET\}/g, 'them').replace(/\{POSS\}/g, 'their').replace(/\{OMIT_TARGET\}/g, '');
                            if (np.type === 'ATTACH' && tempTargetStr === 'self') {
                                npText = npText.replace('attach them to self', 'attach them to it');
                                npText = npText.replace('attach it to self', 'attach it to it');
                            }
                            return npText;
                        });
                        
                        targetStr = tempTargetStr;
                        groupId = tempGroupId;
                        
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
                    if (isCustomMovement) suffix = ' this round'; else adverb = 'temporarily ';
                } else if (eff.duration === 'BRIEF') {
                    if (isCustomMovement) suffix = ' this turn'; else adverb = 'briefly ';
                } else if (eff.duration === 'PERMANENT') {
                    adverb = 'permanently ';
                }
            }

            if (adverb && eff.type !== 'SUMMON') {
                if (effText.startsWith('force {TARGET} to ')) {
                    effText = effText.replace('force {TARGET} to ', `force {TARGET} to ${adverb}`);
                } else {
                    effText = adverb + effText;
                }
            }

            if (suffix && eff.type !== 'SUMMON') {
                effText += suffix;
            }

            let resolved = resolveTokens(effText);
            if (resolved) {
                resolved = resolved.charAt(0).toUpperCase() + resolved.slice(1);
            }
            return resolved;
        };

        const getSimilarityKey = (eff) => {
            if ((eff.type === 'MODIFY_STAT' || eff.type === 'SET_STAT') && eff.stat === 'readiness') {
                return `READINESS_${eff.type}_${eff.amountIsX ? 'X' : eff.amount}_${eff.duration}_${eff.invertRoles}_${eff.isCost}`;
            }
            if (['GRANT_ABILITY', 'REMOVE_ABILITY', 'SET_STAT'].includes(eff.type)) {
                return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}_${eff.blockDuplicates}`;
            }
            if (eff.type === 'MODIFY_STAT') {
                return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}_${eff.amountIsX ? 'X' : Math.sign(eff.amount)}`;
            }
            if (eff.type === 'MODIFY_RESOURCE') {
                return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}_${eff.amountIsX ? 'X' : Math.sign(eff.amount)}`;
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
                    let paramSuffix = '';
                    if (eff.grantedAbilityParamXIsX) paramSuffix = ' (X)';
                    else if (eff.grantedAbilityParamX !== undefined && eff.grantedAbilityParamX !== null) paramSuffix = ` (${eff.grantedAbilityParamX})`;
                    return `@[${abilityName}]${paramSuffix}`;
                });
                effText = `grant ${joinWithAnd(abNames)} to {TARGET}`;
                if (first.blockDuplicates) effText += ` (unique)`;
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
                    return `**${rmAbilityName}**`;
                });
                effText = `remove ${joinWithAnd(abNames)} from {TARGET}`;
            } else if (first.type === 'MODIFY_STAT' && first.stat !== 'readiness') {
                let changes = effs.map(eff => {
                     let modStat = `[STAT:${eff.stat || 'stat'}]`;
                     let sign = eff.amount > 0 && !eff.amountIsX ? '+' : '';
                     let amtStr = eff.amountIsX ? 'X' : eff.amount;
                     return `${sign}${amtStr} ${modStat}`;
                });
                effText = `give {TARGET} ${joinWithAnd(changes)}`;
            } else if (first.type === 'MODIFY_RESOURCE') {
                let changes = effs.map(eff => {
                     let resName = eff.resource || 'resource';
                     let amtStr = eff.amountIsX ? 'X' : Math.abs(eff.amount);
                     return `${amtStr} ${resName}`;
                });
                let isSpend = first.amount < 0;
                effText = `${isSpend ? 'lose' : 'gain'} ${joinWithAnd(changes)}{PER_TARGET}`;
            } else if (first.type === 'SET_STAT' && first.stat !== 'readiness') {
                if (first.stat === 'line') {
                    let changes = effs.map(eff => {
                         let amtStr = eff.amountIsX ? 'X' : eff.amount;
                         return `[ZONE:${amtStr}]`;
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
                         return `${setStat} to ${amtStr}`;
                    });
                    effText = `set {POSS} ${joinWithAnd(changes)}`;
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
                let formatted = effs.map(formatPayload);
                formatted = [...new Set(formatted)];
                let joined = '';
                if (formatted[0] === 'Instead') {
                    joined = formatted.length > 1 ? formatted[0] + ', ' + formatted.slice(1).join(', then ') : formatted[0];
                } else {
                    joined = formatted.join(', then ');
                }
                return joined;
            }
            
            if (first.invertRoles && !['ATTACH', 'ATTACH_TO', 'REBEL', 'DONATE'].includes(first.type)) {
                if (!['this card', 'it', 'the triggering card', 'the targeted card', 'the target'].includes(targetStr)) {
                    let isPl = targetStr === 'them' || targetStr.startsWith('all ') || targetStr.includes(' random ') || targetStr.includes(' first ') || targetStr.includes(' last ') || targetStr.endsWith('s');
                    let reflexive = isPl ? 'themselves' : 'itself';
                    let reflexivePoss = isPl ? 'their own' : 'its own';
                    effText = `force {TARGET} to ${effText.replace(/\{TARGET\}/g, reflexive).replace(/\{POSS\}/g, reflexivePoss)}`;
                }
            }

            let adverb = '';
            let suffix = '';
            let isCustomMovement = (first.type === 'SET_STAT' && first.stat === 'line');
            
            if (first.duration && first.duration !== 'INSTANT' && first.duration !== 'INDEFINITE') {
                if (first.duration === 'WHILE_ATTACHED') {
                    if (trigger !== 'ON_BE_ATTACHED') suffix = ' while attached';
                } else if (first.duration === 'ACTION') {
                    if (isCustomMovement) suffix = ' this action'; else suffix = ' for the current action';
                } else if (first.duration === 'TEMPORARY') {
                    if (isCustomMovement) suffix = ' this round'; else adverb = 'temporarily ';
                } else if (first.duration === 'BRIEF') {
                    if (isCustomMovement) suffix = ' this turn'; else adverb = 'briefly ';
                } else if (first.duration === 'PERMANENT') {
                    adverb = 'permanently ';
                }
            }

            if (adverb && first.type !== 'SUMMON') {
                if (effText.startsWith('force {TARGET} to ')) {
                    effText = effText.replace('force {TARGET} to ', `force {TARGET} to ${adverb}`);
                } else {
                    effText = adverb + effText;
                }
            }

            if (suffix && first.type !== 'SUMMON') {
                effText += suffix;
            }

            let resolved = resolveTokens(effText);
            if (resolved) {
                resolved = resolved.charAt(0).toUpperCase() + resolved.slice(1);
            }
            return resolved;
        };

        const finalizeString = (arr, isCost) => {
            if(arr.length === 0) return null;
            
            let combined = '';
            if (isCost) {
                combined = joinWithAnd(arr);
            } else {
                if (arr[0] === 'Instead') {
                    combined = arr.length > 1 ? arr[0] + ', ' + arr.slice(1).join(', then ') : arr[0];
                } else {
                    combined = arr.join(', then ');
                }
            }
            
            if (!tracker.hasMentioned(groupId)) {
                if (combined.includes(' for each ')) {
                    combined = combined.replace(' for each ', ` to ${tracker.mention(groupId, targetStr, isPlural)} for each `);
                } else if (combined !== 'Instead') {
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
        
        let cStr = finalizeString(costs, true);
        if (cStr) allCostSentences.push(cStr);
        
        let eStr = finalizeString(effects, false);
        if (eStr) allEffectSentences.push(eStr);
    });

    if (trigger.startsWith('WOULD_') && allEffectSentences.length > 0) {
        if (!allEffectSentences[0].startsWith('Instead')) {
            allEffectSentences[0] = 'Instead, ' + allEffectSentences[0];
        }
    }

    return { allCostSentences, allEffectSentences };
}