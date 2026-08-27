/**
 * src/language/triggers.js
 * Generates the conditional prefix ("When/If") for an ability.
 */

import { buildTargetDesc } from './targeting.js';

export function getTriggerWord(t) {
    if (!t || t === 'MANUAL') return '';
    if (t === 'UNTRIGGERABLE') return 'Passive';
    if (t === 'ON_BE_ATTACHED') return 'While Attached';
    if (t.includes('STARTED')) return 'Started';
    if (t.includes('ENDED')) return 'Ended';
    if (t.includes('STARTING')) return 'Starting';
    if (t.includes('ENDING')) return 'Ending';
    if (t.includes('PLAY')) return 'Play';

    let isPassive = t.includes('_BE_') || t.includes('ATTACKED') || t.includes('DAMAGED') || t.includes('HEALED') || t.includes('KILLED') || t.includes('DRAWN') || t.includes('DISCARDED') || t.includes('SUMMONED');
    
    let base = '';
    if (t.includes('ATTACK')) base = isPassive ? 'Attacked' : 'Attack';
    else if (t.includes('DAMAGE')) base = isPassive ? 'Damaged' : 'Damage';
    else if (t.includes('HEAL')) base = isPassive ? 'Healed' : 'Heal';
    else if (t.includes('KILL')) base = isPassive ? 'Killed' : 'Kill';
    else if (t.includes('DRAW')) base = isPassive ? 'Drawn' : 'Draw';
    else if (t.includes('DISCARD')) base = isPassive ? 'Discarded' : 'Discard';
    else if (t.includes('SUMMON')) base = isPassive ? 'Summoned' : 'Summon';
    else if (t.includes('REBEL')) base = isPassive ? 'Controlled' : 'Control';
    else if (t.includes('FIELD')) base = isPassive ? 'Fielded' : 'Field';
    else if (t.includes('RECOVER')) base = isPassive ? 'Recovered' : 'Recover';
    else if (t.includes('REVIVE')) base = isPassive ? 'Revived' : 'Revive';
    else if (t.includes('HARVEST')) base = isPassive ? 'Harvested' : 'Harvest';
    else {
        const parts = t.split('_');
        base = parts[parts.length - 1];
    }

    if (t.startsWith('MODIFY_')) return `Before ${base.charAt(0).toUpperCase() + base.slice(1).toLowerCase()}`;
    return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

export function parseTriggers(ability, allTribes) {
    const allTriggers = [ability.trigger || 'MANUAL', ...(ability.additionalTriggers || [])];
    let globalTargetNoun = null;

    const words = allTriggers.map(t => getTriggerWord(t)).filter(Boolean);
    let triggerText = ''; // Omit prefix so the UI can compose it cleanly

    let conditionPhrases = [];
    let logicalOperator = 'AND';
    
    if (ability.triggerScope === 'GLOBAL') {
        const qt = ability.activation?.quickTargeting;
        const lt = ability.activation?.logicTree;
        let targetDesc = buildTargetDesc(qt, lt, ability.trigger, true, 'FIELD', false, allTribes);
        globalTargetNoun = targetDesc.replace(/^(a|an|the|some|any|all)\s+/i, '');
        conditionPhrases.push(`trigger is ${targetDesc}`);
    } else if (ability.activation?.method !== 'PLAYER_CHOICE') {
        const scan = (node) => {
            if (!node) return;
            if (node.type === 'group') {
                logicalOperator = node.logicalOperator || 'AND';
                if (node.children) node.children.forEach(scan);
            } else if (node.type === 'condition') {
                let checkAttr = node.attribute;
                const ctx = node.context || 'EVAL_TARGET';
                
                let contextSubject = "{POSS}";
                let contextPronoun = "{PRONOUN}";
                
                if (ctx === 'HOST') { contextSubject = "{POSS} host's"; contextPronoun = "{POSS} host"; }
                else if (ctx === 'EVENT_SOURCE') { contextSubject = "doer's"; contextPronoun = "doer"; }
                else if (ctx === 'EVENT_TARGET') { contextSubject = "receiver's"; contextPronoun = "receiver"; }
                else if (ctx === 'ABILITY_SOURCE') { contextSubject = "its"; contextPronoun = "it"; }

                const opMap = { '==': 'is', '!=': 'is not', '>': '>', '<': '<', '>=': '>=', '<=': '<=' };
                let opText = opMap[node.operator] !== undefined ? opMap[node.operator] : node.operator;
                
                if (['isCombat', 'isAttacking'].includes(checkAttr)) {
                    let isTrue = String(node.value).toLowerCase() === 'true';
                    if (node.operator === '!=') isTrue = !isTrue;
                    
                    if (checkAttr === 'isCombat') {
                        conditionPhrases.push(isTrue ? 'in combat' : 'not in combat');
                    } else {
                        conditionPhrases.push(isTrue ? `the event is an attack` : `the event is not an attack`);
                    }
                } else if (checkAttr === 'eventAbility') {
                    if (node.operator === '==') conditionPhrases.push(`event is '${node.value}'`);
                    else conditionPhrases.push(`event is not '${node.value}'`);
                } else {
                    if (['tribe', 'family', 'genus'].includes(checkAttr)) {
                        let displayValue = String(node.value);
                        if (checkAttr === 'tribe') {
                            if (allTribes && Array.isArray(allTribes)) {
                                const match = allTribes.find(t => t.id === displayValue || t.name.toLowerCase() === displayValue.toLowerCase());
                                if (match) displayValue = match.name;
                            } else if (displayValue.toLowerCase().startsWith('tribe_')) {
                                displayValue = displayValue.substring(6).replace(/_/g, ' ');
                                displayValue = displayValue.replace(/\b\w/g, l => l.toUpperCase());
                            }
                        }
                        let subj = ctx === 'EVAL_TARGET' ? "{PRONOUN}" : contextPronoun;
                        conditionPhrases.push(`${subj} ${opText} ${displayValue}`);
                    } else if (['health', 'strength', 'readiness', 'maxHealth', 'armor', 'power', 'cost', 'acts', 'maxActs'].includes(checkAttr)) {
                        let statName = checkAttr.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
                        let subj = ctx === 'EVAL_TARGET' ? "{POSS}" : contextSubject;
                        conditionPhrases.push(`${subj} ${statName} ${opText} ${node.value}`);
                    } else if (checkAttr === 'line') {
                        let subj = ctx === 'EVAL_TARGET' ? "{PRONOUN}" : contextPronoun;
                        if (node.operator === '==') conditionPhrases.push(`${subj} is in [BATTLELINE:${node.value}]`);
                        else conditionPhrases.push(`${subj} is not in [BATTLELINE:${node.value}]`);
                    } else if (checkAttr === 'alignment') {
                        let subj = ctx === 'EVAL_TARGET' ? "{PRONOUN}" : contextPronoun;
                        conditionPhrases.push(`${subj} is ${String(node.value).toLowerCase()}`);
                    } else if (checkAttr === 'hasAbility') {
                        let subj = ctx === 'EVAL_TARGET' ? "{PRONOUN}" : contextPronoun;
                        if (node.operator === '==') conditionPhrases.push(`${subj} has '${node.value}'`);
                        else conditionPhrases.push(`${subj} lacks '${node.value}'`);
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
        scan(ability.activation?.logicTree);
    }

    let conditionsText = '';
    if (conditionPhrases.length > 0) {
        let joinWord = logicalOperator === 'OR' ? ' or ' : ' and ';
        conditionsText = conditionPhrases.join(joinWord);
        conditionsText = conditionsText.replace(/\{POSS\}/g, 'its').replace(/\{PRONOUN\}/g, 'it');
    }

    return { triggerText, globalTargetNoun, conditionsText };
}