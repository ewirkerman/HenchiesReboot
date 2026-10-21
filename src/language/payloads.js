/**
 * src/language/payloads.js
 * Entry point for Target Group iteration and contextual setup.
 * Uses helper modules for tokenization and string formatting.
 */

import { ACTION_MANIFEST } from '../engine/actions/action_index.js';
import { buildTargetDesc } from './targeting.js';
import { groupPayloads, finalizeString } from './grouping.js';
import anExclusions from './an_exclusions.js';
import { getConditionText } from './format_payload.js';
import { lowercaseSentence, getIndefiniteArticle } from './utils.js';

export function processTargetGroups(ability, ctx) {
    const { allAbilities, allCards, allTribes, globalTargetNoun, tracker, trigger } = ctx;
    const paramX = ctx.paramX !== undefined ? ctx.paramX : ability?.paramX;

    // Pre-register conditions in tracker so they dynamically resolve to pronouns in the effects
    if (ability.activation?.logicTree) {
        const preScan = (node) => {
            if (!node) return;
            if (node.type === 'group') {
                if (node.children) node.children.forEach(preScan);
            } else if (node.type === 'condition') {
                let ctxType = node.context || 'EVAL_TARGET';
                if (ctxType === 'EVENT_TARGET') {
                    let noun = "receiver";
                    if (trigger.includes('ATTACK') || trigger.includes('COMBAT')) noun = trigger.includes('BE_ATTACKED') ? "attacker" : "defender";
                    else if (trigger.includes('DAMAGE')) noun = trigger.includes('BE_DAMAGED') ? "damage source" : "damaged character";
                    else if (trigger.includes('HEAL')) noun = trigger.includes('BE_HEALED') ? "healer" : "healed character";
                    else if (trigger.includes('KILL')) noun = trigger.includes('BE_KILLED') ? "killer" : "killed unit";
                    tracker.mention(noun.replace(/ /g, '_'), `the ${noun}`, false);
                } else if (ctxType === 'EVENT_SOURCE') {
                    let noun = "doer";
                    if (trigger.includes('ATTACK') || trigger.includes('COMBAT')) noun = trigger.includes('BE_ATTACKED') ? "defender" : "attacker";
                    else if (trigger.includes('DAMAGE')) noun = trigger.includes('BE_DAMAGED') ? "damaged character" : "damage source";
                    else if (trigger.includes('HEAL')) noun = trigger.includes('BE_HEALED') ? "healed character" : "healer";
                    else if (trigger.includes('KILL')) noun = trigger.includes('BE_KILLED') ? "killed unit" : "killer";
                    else if (trigger.includes('PLAY')) noun = "played card";
                    else if (trigger.includes('SUMMON')) noun = "summoned unit";
                    tracker.mention(noun.replace(/ /g, '_'), `the ${noun}`, false);
                } else if (ctxType === 'HOST') {
                    tracker.mention('host', 'host', false);
                } else if (ctxType === 'ABILITY_SOURCE') {
                    tracker.mention('self', 'this', false);
                }
            }
        };
        preScan(ability.activation.logicTree);
    }

    let allCostSentences = [];
    let allEffectSentences = [];

    const targetGroups = ability.effects || [];

    targetGroups.forEach((group, gIdx) => {
        if (!group.payloads || group.payloads.length === 0) return;

        // CANCEL_EVENT is implied by the event trigger (e.g., BLOCK), so we hide it from NLG
        const activePayloads = group.payloads.filter(p => p.type !== 'CANCEL_EVENT');
        if (activePayloads.length === 0) return;

        // Simplify: The primary action verb dictates the implied zone context.
        let impliedZone = null;
        const primaryType = activePayloads[0].type;

        if (['REVIVE', 'RECOVER'].includes(primaryType)) impliedZone = 'DISCARD';
        else if (['DRAW_CARD', 'MILL', 'TOP_DECK'].includes(primaryType)) impliedZone = 'DECK';
        else if (['DISCARD', 'DISCARD_CARD'].includes(primaryType)) impliedZone = 'HAND';
        else if (['DEAL_DAMAGE', 'HEAL', 'KILL', 'ATTACH', 'UNATTACH', 'ATTACK', 'TRASH', 'BLOCK_ACT', 'BLOCK_ATTACK', 'BLOCK_RETALIATE', 'RETURN', 'SET_STAT', 'MODIFY_STAT', 'GRANT_ABILITY', 'REMOVE_ABILITY', 'BANISH', 'TRANSFORM', 'CLEANSE', 'REBEL', 'DONATE'].includes(primaryType)) impliedZone = 'FIELD';

        let allHaveSameImpliedZone = impliedZone !== null;

        let targetStr = 'them';
        let possessiveStr = 'their';
        let singularDesc = '';

        let isPlural = false;

        if (group.targetMethod === 'SELF') {
            targetStr = 'this';
            possessiveStr = "its";
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
            if (trigger === 'MANUAL' || ['TURN_STARTING', 'TURN_STARTED', 'TURN_ENDING', 'TURN_ENDED', 'OWN_TURN_STARTING', 'OWN_TURN_STARTED', 'OWN_TURN_ENDING', 'OWN_TURN_ENDED', 'OPP_TURN_STARTING', 'OPP_TURN_STARTED', 'OPP_TURN_ENDING', 'OPP_TURN_ENDED'].includes(trigger)) {
                targetStr = 'this';
                possessiveStr = "its";
            } else if (ability.triggerScope === 'GLOBAL') {
                let baseDesc = buildTargetDesc(group.quickTargeting || {}, group.logicTree, trigger, allHaveSameImpliedZone, impliedZone, false, allTribes, allAbilities, allCards, paramX);
                let isGeneric = ['card', 'character', 'entity', 'unit', 'character or card'].includes(baseDesc.toLowerCase());
                if (!isGeneric) {
                    let article = getIndefiniteArticle(baseDesc);
                    targetStr = 'it';
                    possessiveStr = 'its';
                    group._globalFilterCondition = `it is ${article} ${baseDesc}`;
                } else {
                    targetStr = 'the triggering card';
                    possessiveStr = "the triggering card's";
                }
            } else {
                targetStr = 'the triggering card';
                possessiveStr = "the triggering card's";
            }
            isPlural = false;

        } else if (group.targetMethod === 'EVENT_TARGET') {
            const hasExternalTarget = ['ON_ATTACK', 'WOULD_ATTACK', 'MODIFY_ATTACK', 'ON_BE_ATTACKED', 'WOULD_BE_ATTACKED', 'ON_DEAL_DAMAGE', 'WOULD_DEAL_DAMAGE', 'MODIFY_DEAL_DAMAGE', 'ON_BE_DAMAGED', 'WOULD_BE_DAMAGED', 'MODIFY_BE_DAMAGED', 'ON_HEAL', 'WOULD_HEAL', 'MODIFY_HEAL', 'ON_BE_HEALED', 'WOULD_BE_HEALED', 'ON_KILL', 'WOULD_KILL', 'KILL'].includes(trigger) || (['MANUAL', 'PLAY', 'PLAY_OPTIONAL'].includes(trigger) && ability.activation?.method === 'PLAYER_CHOICE');

            if (!hasExternalTarget) {
                isPlural = group.targetCount > 1;
                let baseDesc = buildTargetDesc(group.quickTargeting || {}, group.logicTree, trigger, allHaveSameImpliedZone, impliedZone, isPlural, allTribes, allAbilities, allCards, paramX);

                if (isPlural) {
                    targetStr = `${group.targetCount} random ${baseDesc}`;
                    possessiveStr = `their`;
                } else {
                    targetStr = `a random ${baseDesc}`;
                    possessiveStr = `${targetStr}'s`;
                }
            } else {
                if (ability.triggerScope === 'GLOBAL') {
                    let baseDesc = buildTargetDesc(group.quickTargeting || {}, group.logicTree, trigger, allHaveSameImpliedZone, impliedZone, false, allTribes, allAbilities, allCards, paramX);
                    let isGeneric = ['card', 'character', 'entity', 'unit', 'character or card'].includes(baseDesc.toLowerCase());

                    if (!isGeneric) {
                        let article = getIndefiniteArticle(baseDesc);
                        targetStr = 'it';
                        possessiveStr = 'its';
                        group._globalFilterCondition = `it is ${article} ${baseDesc}`;
                        isPlural = false;
                    } else if (globalTargetNoun) {
                        targetStr = `that ${globalTargetNoun}`;
                        isPlural = /(allies|enemies|cards|characters|entities|all\b)/i.test(globalTargetNoun) || globalTargetNoun.endsWith('s');
                        possessiveStr = isPlural ? 'their' : 'its';
                    } else {
                        targetStr = 'it';
                        possessiveStr = 'its';
                        isPlural = false;
                    }
                } else if (trigger.includes('ATTACK') || trigger.includes('COMBAT')) { targetStr = trigger.includes('BE_ATTACKED') ? 'the attacker' : 'the defender'; possessiveStr = 'its'; }
                else if (trigger.includes('DAMAGE')) { targetStr = trigger.includes('BE_DAMAGED') ? 'the damage source' : 'the damaged character'; possessiveStr = 'its'; }
                else if (trigger.includes('HEAL')) { targetStr = trigger.includes('BE_HEALED') ? 'the healer' : 'the healed character'; possessiveStr = 'its'; }
                else if (trigger.includes('KILL')) { targetStr = trigger.includes('BE_KILLED') ? 'the killer' : 'the killed unit'; possessiveStr = 'its'; }
                else if (trigger.includes('PLAY')) { targetStr = 'the played card'; possessiveStr = 'its'; }
                else if (trigger.includes('SUMMON')) { targetStr = 'the summoned unit'; possessiveStr = 'its'; }
                else if (trigger.includes('DRAW')) { targetStr = 'the drawn card'; possessiveStr = 'its'; }
                else if (trigger.includes('DISCARD')) { targetStr = 'the discarded card'; possessiveStr = 'its'; }
                else if (trigger.includes('HARVEST')) { targetStr = 'the harvested card'; possessiveStr = 'its'; }
                else if (trigger === 'ON_BE_ATTACHED') { targetStr = 'host'; possessiveStr = 'its'; }
                else if (['MANUAL', 'UNTRIGGERABLE', 'TURN_STARTING', 'TURN_STARTED', 'TURN_ENDING', 'TURN_ENDED', 'OWN_TURN_STARTING', 'OWN_TURN_STARTED', 'OWN_TURN_ENDING', 'OWN_TURN_ENDED', 'OPP_TURN_STARTING', 'OPP_TURN_STARTED', 'OPP_TURN_ENDING', 'OPP_TURN_ENDED'].includes(trigger)) { targetStr = 'this'; possessiveStr = 'its'; }
                else { targetStr = `the targeted card`; possessiveStr = `its`; }
            }

        } else if (group.targetMethod === 'SAME_AS_ACTIVATION') {
            const actMethod = ability.activation?.method || 'NONE';
            if (ability.triggerScope === 'GLOBAL') {
                let actDesc = buildTargetDesc(ability.activation?.quickTargeting, ability.activation?.logicTree, trigger, allHaveSameImpliedZone, impliedZone, false, allTribes, allAbilities, allCards, paramX);
                let isGeneric = ['card', 'character', 'entity', 'unit', 'character or card'].includes(actDesc.toLowerCase());

                if (!isGeneric) {
                    let article = getIndefiniteArticle(actDesc);
                    targetStr = 'it';
                    possessiveStr = 'its';
                    group._globalFilterCondition = `it is ${article} ${actDesc}`;
                    isPlural = false;
                } else if (globalTargetNoun) {
                    targetStr = `that ${globalTargetNoun}`;
                    isPlural = /(allies|enemies|cards|characters|entities|all\b)/i.test(globalTargetNoun) || globalTargetNoun.endsWith('s');
                    possessiveStr = isPlural ? 'their' : 'its';
                } else {
                    targetStr = 'it';
                    possessiveStr = 'its';
                    isPlural = false;
                }
            } else if (actMethod === 'PLAYER_CHOICE') {
                let actDesc = buildTargetDesc(ability.activation?.quickTargeting, ability.activation?.logicTree, trigger, allHaveSameImpliedZone, impliedZone, false, allTribes, allAbilities, allCards, paramX);

                let article = getIndefiniteArticle(actDesc);

                targetStr = `${article} ${actDesc}`;
                possessiveStr = `${targetStr}'s`;
            } else if (['MANUAL', 'UNTRIGGERABLE', 'TURN_STARTING', 'TURN_STARTED', 'TURN_ENDING', 'TURN_ENDED', 'OWN_TURN_STARTING', 'OWN_TURN_STARTED', 'OWN_TURN_ENDING', 'OWN_TURN_ENDED', 'OPP_TURN_STARTING', 'OPP_TURN_STARTED', 'OPP_TURN_ENDING', 'OPP_TURN_ENDED'].includes(trigger)) {
                targetStr = 'this';
                possessiveStr = "its";
            } else {
                if (trigger.includes('ATTACK') || trigger.includes('COMBAT')) targetStr = trigger.includes('BE_ATTACKED') ? 'the attacker' : 'the defender';
                else if (trigger.includes('DAMAGE')) targetStr = trigger.includes('BE_DAMAGED') ? 'the damage source' : 'the damaged character';
                else if (trigger.includes('HEAL')) targetStr = trigger.includes('BE_HEALED') ? 'the healer' : 'the healed character';
                else if (trigger.includes('KILL')) targetStr = trigger.includes('BE_KILLED') ? 'the killer' : 'the killed unit';
                else if (trigger.includes('PLAY')) targetStr = 'the played card';
                else if (trigger.includes('SUMMON')) targetStr = 'the summoned unit';
                else if (trigger.includes('DRAW')) targetStr = 'the drawn card';
                else if (trigger.includes('DISCARD')) targetStr = 'the discarded card';
                else if (trigger.includes('HARVEST')) targetStr = 'the harvested card';
                else if (trigger === 'ON_BE_ATTACHED') targetStr = 'host';
                else targetStr = `the triggered entity`;
                possessiveStr = `its`;
            }

        } else {
            isPlural = group.targetMethod === 'AUTO_ALL' || group.targetCount > 1;
            let baseDesc = buildTargetDesc(group.quickTargeting || {}, group.logicTree, trigger, allHaveSameImpliedZone, impliedZone, isPlural, allTribes, allAbilities, allCards, paramX);
            singularDesc = buildTargetDesc(group.quickTargeting || {}, group.logicTree, trigger, allHaveSameImpliedZone, impliedZone, false, allTribes, allAbilities, allCards, paramX);

            if (group.targetMethod === 'AUTO_ALL') targetStr = `all ${baseDesc}`;
            else if (group.targetMethod === 'AUTO_RANDOM') targetStr = group.targetCount === 1 ? `a random ${singularDesc}` : `${group.targetCount} random ${baseDesc}`;
            else if (group.targetMethod === 'AUTO_FIRST') targetStr = group.targetCount === 1 ? `the first ${singularDesc}` : `the first ${group.targetCount} ${baseDesc}`;
            else if (group.targetMethod === 'AUTO_LAST') targetStr = group.targetCount === 1 ? `the last ${singularDesc}` : `the last ${group.targetCount} ${baseDesc}`;
            else targetStr = baseDesc;

            // Natural language smoothing for the "other" adjective
            targetStr = targetStr.replace('random other', 'other random');
            targetStr = targetStr.replace('a other', 'another');

            if (targetStr === 'them' || targetStr === 'it') possessiveStr = targetStr === 'them' ? 'their' : 'its';
            else if (isPlural) possessiveStr = targetStr.endsWith('s') ? `${targetStr}'` : `${targetStr}'s`;
            else possessiveStr = `${targetStr}'s`;
        }

        let groupId = `group_${gIdx}`;
        if (ability.triggerScope === 'GLOBAL' && globalTargetNoun && targetStr === `that ${globalTargetNoun}`) groupId = 'global_target';
        else if (targetStr === 'this') groupId = 'self';
        else if (targetStr === 'your avatar') groupId = 'your_avatar';
        else if (targetStr === 'the enemy avatar') groupId = 'enemy_avatar';
        else if (targetStr === 'the attacker') groupId = 'attacker';
        else if (targetStr === 'the defender') groupId = 'defender';
        else if (targetStr === 'the damaged character') groupId = 'damaged_character';
        else if (targetStr === 'the damage source') groupId = 'damage_source';
        else if (targetStr === 'the healed character') groupId = 'healed_character';
        else if (targetStr === 'the targeted card') groupId = 'targeted_card';
        else if (targetStr === 'the played card') groupId = 'played_card';
        else if (targetStr === 'the summoned unit') groupId = 'summoned_unit';
        else if (targetStr === 'the drawn card') groupId = 'drawn_card';
        else if (targetStr === 'the discarded card') groupId = 'discarded_card';
        else if (targetStr === 'the harvested card') groupId = 'harvested_card';
        else if (targetStr === 'the killer') groupId = 'killer';
        else if (targetStr === 'the killed unit') groupId = 'killed_unit';
        else if (targetStr === 'the healer') groupId = 'healer';
        else if (targetStr === 'host') groupId = 'host';

        const formatCtx = {
            group, trigger, allTribes, allAbilities, allCards,
            targetStr, possessiveStr, singularDesc, groupId, isPlural, tracker, globalTargetNoun,
            paramX
        };

        let costs = groupPayloads(activePayloads.filter(p => p.isCost), formatCtx);
        let effects = groupPayloads(activePayloads.filter(p => !p.isCost), formatCtx);

        let cStr = finalizeString(costs, true, formatCtx);
        let eStr = finalizeString(effects, false, formatCtx);

        const applyTopDeckLanguage = (str, payloads, isCost) => {
            const tdPayload = payloads.find(p => p.type === 'TOP_DECK' && !!p.isCost === !!isCost);
            if (!tdPayload) return str;

            const amt = tdPayload.amount || 1;
            const cardWord = amt === 1 ? 'a card' : `${amt} cards`;
            let phrase = `<v>draw</v> ${cardWord}`;

            // Smart contextual overrides based on the targeting loop
            if (group.targetMethod === 'AUTO_ALL') phrase = `<v>draw</v> ${cardWord} for each ${singularDesc}`;
            else if (group.targetMethod.startsWith('AUTO_')) phrase = `<v>draw</v> ${cardWord} for ${targetStr}`;

            if (payloads.filter(p => !!p.isCost === !!isCost).length === 1) {
                // If Top Deck is the only payload, cleanly overwrite the entire sentence
                return phrase;
            } else if (str) {
                // Otherwise, intelligently swap out the raw phrase while preserving other actions (like Healing)
                return str.replace(/<v>draw<\/v> (them|it|this|that|[0-9]+)/i, phrase);
            }
            return str;
        };

        cStr = applyTopDeckLanguage(cStr, activePayloads, true);
        eStr = applyTopDeckLanguage(eStr, activePayloads, false);

        if (group._globalFilterCondition) {
            if (cStr) cStr = `if ${group._globalFilterCondition}, ${lowercaseSentence(cStr)}`;
            if (eStr) eStr = `if ${group._globalFilterCondition}, ${lowercaseSentence(eStr)}`;
        }

        if (cStr) allCostSentences.push(cStr);
        if (eStr) allEffectSentences.push(eStr);
    });

    if (trigger === 'PLAY_OPTIONAL') {
        if (allCostSentences.length > 0) {
            const first = allCostSentences[0];
            allCostSentences[0] = 'may ' + first;
        } else if (allEffectSentences.length > 0) {
            const first = allEffectSentences[0];
            allEffectSentences[0] = 'may ' + first;
        }
    }

    // --- POST-PROCESSING: Sentence Chaining Casing ---
    // We delay true capitalization until the final string is assembled by the master NLG wrapper.
    // Here, we only ensure that chained effects (i > 0) are lowercased to fit seamlessly after a comma.
    const applyChainingCasing = (sentences) => sentences.map((s, i) => {
        if (!s) return s;
        if (i > 0) return lowercaseSentence(s);
        return s; // Leave the 0th element natural (uncapitalized)
    });

    allCostSentences = applyChainingCasing(allCostSentences);
    allEffectSentences = applyChainingCasing(allEffectSentences);

    // --- POST-PROCESSING: Action Verb Annotation Resolution ---
    // Replace our <v> annotations with the final UI spans
    const resolveActionVerbs = (sentences) => sentences.map(s => {
        if (!s) return s;
        return s.replace(/<v>(.*?)<\/v>/gi, '<span class="action-verb">$1</span>');
    });

    allCostSentences = resolveActionVerbs(allCostSentences);
    allEffectSentences = resolveActionVerbs(allEffectSentences);

    return { allCostSentences, allEffectSentences };
}