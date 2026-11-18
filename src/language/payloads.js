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

function getGlobalTriggerTargeting(quickTargeting, trigger) {
    if (!quickTargeting) return quickTargeting;

    const event = trigger.replace(/^(WOULD|MODIFY|ON)_/, '');
    const hasImpliedZoneMovement = Object.entries(ACTION_MANIFEST).some(([action, manifest]) =>
        manifest.endZone && (action === event || manifest.passiveType === event)
    );

    return hasImpliedZoneMovement ? { ...quickTargeting, zones: [] } : quickTargeting;
}

function getEventSourceNounStr(trigger) {
    if (!trigger) return "triggering card";
    if (trigger.includes('ATTACK') || trigger.includes('COMBAT')) return trigger.includes('BE_ATTACKED') ? "defender" : "attacker";
    if (trigger.includes('DAMAGE')) return trigger.includes('BE_DAMAGED') ? "damaged character" : "damage source";
    if (trigger.includes('HEAL')) return trigger.includes('BE_HEALED') ? "healed character" : "healer";
    if (trigger.includes('KILL')) return trigger.includes('BE_KILLED') ? "killed unit" : "killer";
    if (trigger.includes('PLAY')) return "played card";
    if (trigger.includes('SUMMON')) return "summoned unit";
    return "triggering card";
}

function getLogicTreeForContext(node, context) {
    if (!node) return null;
    if (node.type !== 'group') {
        return node.type === 'condition' && (node.context || 'EVAL_TARGET') === context ? node : null;
    }

    const children = (node.children || []).map(child => getLogicTreeForContext(child, context)).filter(Boolean);
    return children.length > 0 ? { ...node, children } : null;
}

function getLogicTreeContexts(node, contexts = new Set()) {
    if (!node) return contexts;
    if (node.type === 'group') {
        (node.children || []).forEach(child => getLogicTreeContexts(child, contexts));
    } else if (node.type === 'condition') {
        contexts.add(node.context || 'EVAL_TARGET');
    }
    return contexts;
}

function hasDisjunction(node) {
    if (!node || node.type !== 'group') return false;
    return node.logicalOperator === 'OR' || (node.children || []).some(hasDisjunction);
}

function buildGlobalEventDesc(quickTargeting, logicTree, trigger, allHaveSameImpliedZone, impliedZone, isPlural, allTribes, allAbilities, allCards, paramX) {
    const entityTypes = (quickTargeting?.entityType || []).filter(type => type !== 'ANY' && type !== 'ALL');
    const isUntypedPlayedCard = trigger.includes('PLAY') && entityTypes.length === 0;
    const eventTargeting = isUntypedPlayedCard
        ? { ...quickTargeting, zones: [], entityType: ['CARD'] }
        : quickTargeting;

    return buildTargetDesc(
        eventTargeting,
        logicTree,
        trigger,
        allHaveSameImpliedZone,
        impliedZone,
        isPlural,
        allTribes,
        allAbilities,
        allCards,
        paramX,
        { eventCard: isUntypedPlayedCard }
    );
}

function buildContextualGlobalFilter(ability, quickTargeting, trigger, allHaveSameImpliedZone, impliedZone, allTribes, allAbilities, allCards, paramX) {
    const logicTree = ability.activation?.logicTree;
    const contexts = getLogicTreeContexts(logicTree);
    if (hasDisjunction(logicTree) || contexts.size !== 2 || !contexts.has('EVAL_TARGET') || !contexts.has('ABILITY_SOURCE')) return null;

    const eventTree = getLogicTreeForContext(logicTree, 'EVAL_TARGET');
    const sourceTree = getLogicTreeForContext(logicTree, 'ABILITY_SOURCE');
    const eventDesc = buildGlobalEventDesc(quickTargeting, eventTree, trigger, allHaveSameImpliedZone, impliedZone, false, allTribes, allAbilities, allCards, paramX);
    const genericDescriptions = ['card', 'character', 'entity', 'unit', 'character or card'];
    if (!eventDesc || genericDescriptions.includes(eventDesc.toLowerCase())) return null;

    const sourceCondition = buildTargetDesc({}, sourceTree, trigger, false, null, false, allTribes, allAbilities, allCards, paramX, {
        conditionContexts: ['ABILITY_SOURCE'],
        conditionsOnly: true,
        naturalizeAbilitySource: true
    });
    if (!sourceCondition) return null;

    const article = getIndefiniteArticle(eventDesc);
    return `the ${getEventSourceNounStr(trigger)} is ${article} ${eventDesc} and ${sourceCondition}`;
}

export function processTargetGroups(ability, ctx) {
    const { allAbilities, allCards, allTribes, globalTargetNoun, tracker, trigger } = ctx;
    const paramX = ctx.paramX !== undefined ? ctx.paramX : ability?.paramX;
    const globalTriggerTargeting = getGlobalTriggerTargeting(ability.activation?.quickTargeting, trigger);

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
                    let noun = getEventSourceNounStr(trigger);
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
        else if (['DEAL_DAMAGE', 'HEAL', 'KILL', 'ATTACH', 'UNATTACH', 'ATTACK', 'TRASH', 'BLOCK_ACT', 'BLOCK_ATTACK', 'BLOCK_RETALIATE', 'RETURN', 'SET_STAT', 'MODIFY_STAT', 'MODIFY_RESOURCE', 'GRANT_ABILITY', 'REMOVE_ABILITY', 'BANISH', 'TRANSFORM', 'CLEANSE', 'REBEL', 'DONATE'].includes(primaryType)) impliedZone = 'FIELD';

        let allHaveSameImpliedZone = impliedZone !== null;

        let targetStr = 'them';
        let possessiveStr = 'their';
        let singularDesc = '';

        let isPlural = false;

        let globalFilterCondition = null;

        // Keep event-card and ability-source conditions grammatically distinct when possible.
        if (ability.triggerScope === 'GLOBAL') {
            globalFilterCondition = buildContextualGlobalFilter(
                ability,
                globalTriggerTargeting,
                trigger,
                allHaveSameImpliedZone,
                impliedZone,
                allTribes,
                allAbilities,
                allCards,
                paramX
            );

            if (!globalFilterCondition) {
                let actDesc = buildGlobalEventDesc(globalTriggerTargeting, ability.activation?.logicTree, trigger, allHaveSameImpliedZone, impliedZone, false, allTribes, allAbilities, allCards, paramX);
                let isGeneric = ['card', 'character', 'entity', 'unit', 'character or card'].includes(actDesc.toLowerCase());

                if (!isGeneric) {
                    let article = getIndefiniteArticle(actDesc);
                    let subj = ['SELF', 'EVENT_TARGET', 'SAME_AS_ACTIVATION'].includes(group.targetMethod) ? 'it' : `the ${getEventSourceNounStr(trigger)}`;
                    globalFilterCondition = `${subj} is ${article} ${actDesc}`;
                }
            }
        }

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
        } else if (group.targetMethod === 'HOST') {
            targetStr = 'host';
            possessiveStr = "host's";
            isPlural = false;
        } else if (group.targetMethod === 'EVENT_SOURCE') {
            if (trigger === 'MANUAL' || ['GAME_STARTING', 'TURN_STARTING', 'TURN_STARTED', 'TURN_ENDING', 'TURN_ENDED', 'OWN_TURN_STARTING', 'OWN_TURN_STARTED', 'OWN_TURN_ENDING', 'OWN_TURN_ENDED', 'OPP_TURN_STARTING', 'OPP_TURN_STARTED', 'OPP_TURN_ENDING', 'OPP_TURN_ENDED'].includes(trigger)) {
                targetStr = 'this';
                possessiveStr = "its";
            } else if (ability.triggerScope === 'GLOBAL') {
                let baseDesc = buildTargetDesc(group.quickTargeting || {}, group.logicTree, trigger, allHaveSameImpliedZone, impliedZone, false, allTribes, allAbilities, allCards, paramX);
                let isGeneric = ['card', 'character', 'entity', 'unit', 'character or card'].includes(baseDesc.toLowerCase());
                if (!isGeneric) {
                    let article = getIndefiniteArticle(baseDesc);
                    targetStr = 'it';
                    possessiveStr = 'its';

                    let groupCond = `it is ${article} ${baseDesc}`;
                    globalFilterCondition = globalFilterCondition ? `${globalFilterCondition} and ${groupCond}` : groupCond;
                } else {
                    let noun = getEventSourceNounStr(trigger);
                    targetStr = `the ${noun}`;
                    possessiveStr = `the ${noun}'s`;
                }
            } else {
                let noun = getEventSourceNounStr(trigger);
                targetStr = `the ${noun}`;
                possessiveStr = `the ${noun}'s`;
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

                        let groupCond = `it is ${article} ${baseDesc}`;
                        globalFilterCondition = globalFilterCondition ? `${globalFilterCondition} and ${groupCond}` : groupCond;
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
                else if (['MANUAL', 'UNTRIGGERABLE', 'GAME_STARTING', 'TURN_STARTING', 'TURN_STARTED', 'TURN_ENDING', 'TURN_ENDED', 'OWN_TURN_STARTING', 'OWN_TURN_STARTED', 'OWN_TURN_ENDING', 'OWN_TURN_ENDED', 'OPP_TURN_STARTING', 'OPP_TURN_STARTED', 'OPP_TURN_ENDING', 'OPP_TURN_ENDED'].includes(trigger)) { targetStr = 'this'; possessiveStr = 'its'; }
                else { targetStr = `the targeted card`; possessiveStr = `its`; }
            }

        } else if (group.targetMethod === 'SAME_AS_ACTIVATION') {
            const actMethod = ability.activation?.method || 'NONE';
            if (ability.triggerScope === 'GLOBAL') {
                let actDesc = buildTargetDesc(globalTriggerTargeting, ability.activation?.logicTree, trigger, allHaveSameImpliedZone, impliedZone, false, allTribes, allAbilities, allCards, paramX);
                let isGeneric = ['card', 'character', 'entity', 'unit', 'character or card'].includes(actDesc.toLowerCase());

                if (!isGeneric) {
                    targetStr = 'it';
                    possessiveStr = 'its';
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
            } else if (['MANUAL', 'UNTRIGGERABLE', 'GAME_STARTING', 'TURN_STARTING', 'TURN_STARTED', 'TURN_ENDING', 'TURN_ENDED', 'OWN_TURN_STARTING', 'OWN_TURN_STARTED', 'OWN_TURN_ENDING', 'OWN_TURN_ENDED', 'OPP_TURN_STARTING', 'OPP_TURN_STARTED', 'OPP_TURN_ENDING', 'OPP_TURN_ENDED'].includes(trigger)) {
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
        else if (group.targetMethod === 'HOST') groupId = 'host';

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

        if (globalFilterCondition) {
            if (cStr) cStr = `if ${globalFilterCondition}, ${lowercaseSentence(cStr)}`;
            if (eStr) eStr = `if ${globalFilterCondition}, ${lowercaseSentence(eStr)}`;
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