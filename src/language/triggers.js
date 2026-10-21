/**
 * src/language/triggers.js
 * Generates the conditional prefix ("When/If") for an ability.
 */

import { buildTargetDesc } from './targeting.js';
import { getReadinessConditionState, getZoneLinguistics, resolveAbility, resolveTribeName, formatXValue } from './utils.js';

export function getTriggerWord(t) {
    if (!t || t === 'MANUAL') return '';
    if (t === 'UNTRIGGERABLE') return 'Passive';
    if (t === 'ON_BE_ATTACHED') return 'While Attached';
    if (t.includes('STARTED')) return 'Started';
    if (t.includes('COMBAT_ENDED')) return 'Combat End';
    if (t.includes('ENDED')) return 'Ended';
    if (t.includes('STARTING')) return 'Starting';
    if (t.includes('ENDING')) return 'Ending';
    if (t.includes('PLAY')) return 'Play';

    let isPassive = t.includes('_BE_') || t.includes('ATTACKED') || t.includes('DAMAGED') || t.includes('HEALED') || t.includes('KILLED') || t.includes('DRAWN') || t.includes('DISCARDED') || t.includes('SUMMONED');

    let base = '';
    if (t.includes('COMBAT') || t.includes('ATTACK')) base = isPassive ? 'Attacked' : 'Attack';
    else if (t.includes('DAMAGE')) base = isPassive ? 'Damaged' : 'Damage';
    else if (t.includes('HEAL')) base = isPassive ? 'Healed' : 'Heal';
    else if (t.includes('KILL')) base = isPassive ? 'Killed' : 'Kill';
    else if (t.includes('DRAW')) base = isPassive ? 'Drawn' : 'Draw';
    else if (t.includes('DISCARD')) base = isPassive ? 'Discarded' : 'Discard';
    else if (t.includes('SUMMON')) base = isPassive ? 'Summoned' : 'Summon';
    else if (t.includes('REBEL')) base = isPassive ? 'Controlled' : 'Control';
    else if (t.includes('UNFIELD')) base = isPassive ? 'Unfielded' : 'Unfield';
    else if (t.includes('FIELD')) base = isPassive ? 'Fielded' : 'Field';
    else if (t.includes('RECOVER')) base = isPassive ? 'Recovered' : 'Recover';
    else if (t.includes('REVIVE')) base = isPassive ? 'Revived' : 'Revive';
    else if (t.includes('HARVEST')) base = isPassive ? 'Harvested' : 'Harvest';
    else {
        const parts = t.split('_');
        base = parts[parts.length - 1];
    }

    if (t.startsWith('MODIFY_')) return `Before ${base.charAt(0).toUpperCase() + base.slice(1).toLowerCase()}`;
    if (t.startsWith('WOULD_')) return `Block ${base.charAt(0).toUpperCase() + base.slice(1).toLowerCase()}`;
    return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

export function generateLogicTreeText(logicTree, trigger, allTribes, allAbilities = null, paramX = null) {
    if (!logicTree) return '';
    let conditionPhrases = [];
    let logicalOperator = logicTree.logicalOperator || 'AND';

    const scan = (node) => {
        if (!node) return;
        if (node.type === 'group') {
            let currentOp = node.logicalOperator || 'AND';
            if (node.children) {
                const eventAbilityNodes = node.children.filter(c => c && c.type === 'condition' && c.attribute === 'eventAbility');
                const otherNodes = node.children.filter(c => !c || c.type !== 'condition' || c.attribute !== 'eventAbility');

                if (eventAbilityNodes.length > 1 && eventAbilityNodes.every(c => c.operator === '==')) {
                    const tags = eventAbilityNodes.map(c => {
                        let val = String(c.value);
                        return val.startsWith('@[') && val.endsWith(']') ? val : `@[${val}]`;
                    });
                    const opWord = currentOp === 'OR' ? ' or ' : ' and ';
                    conditionPhrases.push(`the ability is ${tags.join(opWord)}`);
                    if (otherNodes.length > 0) otherNodes.forEach(scan);
                    return;
                }
                node.children.forEach(scan);
            }
        } else if (node.type === 'condition') {
            let checkAttr = node.attribute;
            const ctx = node.context || 'EVAL_TARGET';

            let contextSubject = "{POSS}";
            let contextPronoun = "{PRONOUN}";

            if (ctx === 'HOST') { contextSubject = "{POSS} host's"; contextPronoun = "{POSS} host"; }
            else if (ctx === 'EVENT_SOURCE') {
                let noun = "doer";
                if (trigger && (trigger.includes('ATTACK') || trigger.includes('COMBAT'))) noun = trigger.includes('BE_ATTACKED') ? "defender" : "attacker";
                else if (trigger && trigger.includes('DAMAGE')) noun = trigger.includes('BE_DAMAGED') ? "damaged character" : "damage source";
                else if (trigger && trigger.includes('HEAL')) noun = trigger.includes('BE_HEALED') ? "healed character" : "healer";
                else if (trigger && trigger.includes('KILL')) noun = trigger.includes('BE_KILLED') ? "killed unit" : "killer";
                else if (trigger && trigger.includes('PLAY')) noun = "played card";
                else if (trigger && trigger.includes('SUMMON')) noun = "summoned unit";

                contextSubject = `the ${noun}'s`;
                contextPronoun = `the ${noun}`;
            }
            else if (ctx === 'EVENT_TARGET') {
                let noun = "receiver";
                if (trigger && (trigger.includes('ATTACK') || trigger.includes('COMBAT'))) noun = trigger.includes('BE_ATTACKED') ? "attacker" : "defender";
                else if (trigger && trigger.includes('DAMAGE')) noun = trigger.includes('BE_DAMAGED') ? "damage source" : "damaged character";
                else if (trigger && trigger.includes('HEAL')) noun = trigger.includes('BE_HEALED') ? "healer" : "healed character";
                else if (trigger && trigger.includes('KILL')) noun = trigger.includes('BE_KILLED') ? "killer" : "killed unit";

                contextSubject = `the ${noun}'s`;
                contextPronoun = `the ${noun}`;
            }
            else if (ctx === 'ABILITY_SOURCE') { contextSubject = "its"; contextPronoun = "it"; }

            const opMap = { '==': 'is', '!=': 'is not', '>': '>', '<': '<', '>=': '>=', '<=': '<=' };
            let opText = opMap[node.operator] !== undefined ? opMap[node.operator] : node.operator;

            if (['isCombat', 'isAttacking'].includes(checkAttr)) {
                let isTrue = String(node.value).toLowerCase() === 'true';
                if (node.operator === '!=') isTrue = !isTrue;

                let subj = ctx === 'EVAL_TARGET' ? "{PRONOUN}" : contextPronoun;
                let isSelf = subj === 'it' || subj === '{PRONOUN}';

                if (checkAttr === 'isCombat') {
                    conditionPhrases.push(isTrue ? (isSelf ? 'in combat' : `${subj} is in combat`) : (isSelf ? 'not in combat' : `${subj} is not in combat`));
                } else {
                    conditionPhrases.push(isTrue ? (isSelf ? 'attacking' : `${subj} is attacking`) : (isSelf ? 'not attacking' : `${subj} is not attacking`));
                }
            } else if (checkAttr === 'eventAbility') {
                let val = String(node.value);
                let tag = val.startsWith('@[') && val.endsWith(']') ? val : `@[${val}]`;
                if (node.operator === '==') conditionPhrases.push(`the ability is ${tag}`);
                else conditionPhrases.push(`the ability is not ${tag}`);
            } else if (checkAttr === 'customScript') {
                let desc = node.description || 'a custom condition is met';
                // Unconditionally evaluate paramX replacement for custom script descriptions
                desc = desc.replace(/\bX\b/g, formatXValue(paramX));
                conditionPhrases.push(desc);
            } else {
                if (['tribe', 'family', 'genus'].includes(checkAttr)) {
                    let displayValue = checkAttr === 'tribe' ? resolveTribeName(node.value, allTribes) : String(node.value);
                    let subj = ctx === 'EVAL_TARGET' ? "{PRONOUN}" : contextPronoun;
                    conditionPhrases.push(`${subj} ${opText} ${displayValue}`);
                } else if (checkAttr === 'readiness') {
                    let rState = getReadinessConditionState(node.operator, node.value);
                    if (rState) {
                        let subj = ctx === 'EVAL_TARGET' ? "{PRONOUN}" : contextPronoun;
                        conditionPhrases.push(`${subj} is ${rState}`);
                    } else {
                        let statName = `[STAT:${checkAttr}]`;
                        let subj = ctx === 'EVAL_TARGET' ? "{POSS}" : contextSubject;
                        conditionPhrases.push(`${subj} ${statName} ${opText} ${node.value}`);
                    }
                } else if (['health', 'strength', 'maxHealth', 'armor', 'power', 'cost', 'acts', 'maxActs'].includes(checkAttr)) {
                    let statName = `[STAT:${checkAttr}]`;
                    let subj = ctx === 'EVAL_TARGET' ? "{POSS}" : contextSubject;
                    conditionPhrases.push(`${subj} ${statName} ${opText} ${node.value}`);
                } else if (checkAttr === 'line') {
                    let subj = ctx === 'EVAL_TARGET' ? "{PRONOUN}" : contextPronoun;
                    if (node.operator === '==') conditionPhrases.push(`${subj} is in [BATTLELINE:${node.value}]`);
                    else conditionPhrases.push(`${subj} is not in [BATTLELINE:${node.value}]`);
                } else if (checkAttr === 'zone') {
                    const { name: val, prep } = getZoneLinguistics(node.value);
                    let subj = ctx === 'EVAL_TARGET' ? "{PRONOUN}" : contextPronoun;
                    if (node.operator === '==') conditionPhrases.push(`${subj} is ${prep} ${val}`);
                    else conditionPhrases.push(`${subj} is not ${prep} ${val}`);
                } else if (checkAttr === 'alignment') {
                    let subj = ctx === 'EVAL_TARGET' ? "{PRONOUN}" : contextPronoun;
                    conditionPhrases.push(`${subj} is ${String(node.value).toLowerCase()}`);
                } else if (checkAttr === 'hasAbility') {
                    let abilityName = resolveAbility(node.value, allAbilities).name;
                    let subj = ctx === 'EVAL_TARGET' ? "{PRONOUN}" : contextPronoun;
                    if (node.operator === '==') conditionPhrases.push(`${subj} has '${abilityName}'`);
                    else conditionPhrases.push(`${subj} lacks '${abilityName}'`);
                } else if (checkAttr === 'entity') {
                    let val = String(node.value).toLowerCase();
                    if (val === 'self') val = 'it';
                    let subj = ctx === 'EVAL_TARGET' ? "{PRONOUN}" : contextPronoun;
                    if (node.operator === '==') conditionPhrases.push(`${subj} is ${val}`);
                    else conditionPhrases.push(`${subj} is not ${val}`);
                }
            }
        }
    };
    scan(logicTree);

    let conditionsText = '';
    if (conditionPhrases.length > 0) {
        let joinWord = logicalOperator === 'OR' ? ' or ' : ' and ';
        conditionsText = conditionPhrases.join(joinWord);
        conditionsText = conditionsText.replace(/\{POSS\}/g, 'its').replace(/\{PRONOUN\}/g, 'it');
    }

    return conditionsText;
}

export function parseTriggers(ability, allTribesOrCtx, allAbilities = null, paramX = null) {
    let allTribes = allTribesOrCtx;
    let ctxParamX = paramX;

    // Safely extract from Context if the UI wrapper passed `ctx` instead of discrete args
    // Changed to strictly check typeof object to reliably extract paramX from the environment context
    if (allTribesOrCtx && typeof allTribesOrCtx === 'object' && !Array.isArray(allTribesOrCtx)) {
        allTribes = allTribesOrCtx.allTribes;
        allAbilities = allTribesOrCtx.allAbilities || allAbilities;
        ctxParamX = allTribesOrCtx.paramX !== undefined ? allTribesOrCtx.paramX : paramX;
    }

    const allTriggers = [ability.trigger || 'MANUAL', ...(ability.additionalTriggers || [])];
    let globalTargetNoun = null;

    const words = allTriggers.map(t => getTriggerWord(t)).filter(Boolean);
    let triggerText = ''; // Omit prefix so the UI can compose it cleanly

    let conditionsText = '';
    const resolvedParamX = ctxParamX !== null && ctxParamX !== undefined ? ctxParamX : ability?.paramX;

    if (ability.triggerScope === 'GLOBAL') {
        const qt = ability.activation?.quickTargeting;
        const lt = ability.activation?.logicTree;
        let targetDesc = buildTargetDesc(qt, lt, ability.trigger, true, 'FIELD', false, allTribes, allAbilities, null, resolvedParamX);
        globalTargetNoun = targetDesc.replace(/^(a|an|the|some|any|all)\s+/i, '');
        conditionsText = `trigger is ${targetDesc}`;
    } else if (ability.activation?.method !== 'PLAYER_CHOICE') {
        conditionsText = generateLogicTreeText(ability.activation?.logicTree, ability.trigger, allTribes, allAbilities, resolvedParamX);
    }

    return { triggerText, globalTargetNoun, conditionsText };
}