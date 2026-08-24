/**
 * src/language/payloads.js
 * Entry point for Target Group iteration and contextual setup.
 * Uses helper modules for tokenization and string formatting.
 */

import { ACTION_MANIFEST } from '../engine/actions/index.js';
import { buildTargetDesc } from './targeting.js';
import { groupPayloads, finalizeString } from './grouping.js';

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
                else targetStr = `the targeted card`;
                possessiveStr = `its`;
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

        const formatCtx = {
            group, trigger, allTribes, allAbilities, allCards, 
            targetStr, possessiveStr, singularDesc, groupId, isPlural, tracker, globalTargetNoun
        };

        let costs = groupPayloads(group.payloads.filter(p => p.isCost), formatCtx);
        let effects = groupPayloads(group.payloads.filter(p => !p.isCost), formatCtx);
        
        let cStr = finalizeString(costs, true, formatCtx);
        if (cStr) allCostSentences.push(cStr);
        
        let eStr = finalizeString(effects, false, formatCtx);
        if (eStr) allEffectSentences.push(eStr);
    });

    if (trigger.startsWith('WOULD_') && allEffectSentences.length > 0) {
        if (!allEffectSentences[0].startsWith('Instead')) {
            allEffectSentences[0] = 'Instead, ' + allEffectSentences[0];
        }
    }

    return { allCostSentences, allEffectSentences };
}