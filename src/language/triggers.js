/**
 * src/language/triggers.js
 * Generates the conditional prefix ("When/If") for an ability.
 */

import { buildTargetDesc } from './targeting.js';

export function parseTriggers(ability, allTribes) {
    const trigger = ability.trigger || 'MANUAL';
    let triggerText = '';
    
    const triggerDict = {
        'MANUAL': '',
        'UNTRIGGERABLE': '',
        'TURN_STARTING': 'At the start of the turn',
        'TURN_STARTED': 'After the turn starts',
        'TURN_ENDING': 'At the end of the turn',
        'TURN_ENDED': 'After the turn ends',
        'PLAY': 'When you play this card',
        'PLAY_OPTIONAL': 'When you play this card, you may',
        'ON_BE_PLAYED': 'When you play this card',
        'SUMMON': 'When this card is summoned',
        'KILL': 'When this card kills an enemy',
        'UNFIELD': 'When this card is unfielded',
        'WOULD_BE_PLAYED': 'When this card would be played',
        'ON_SUMMON': 'When this card summons',
        'ON_BE_SUMMONED': 'When this card is summoned',
        'WOULD_SUMMON': 'When this card would summon',
        'WOULD_BE_SUMMONED': 'When this card would be summoned',
        'ON_KILL': 'When this card kills an enemy',
        'ON_BE_KILLED': 'When this card is killed',
        'WOULD_KILL': 'When this card would kill an enemy',
        'WOULD_BE_KILLED': 'When this card would be killed',
        'ON_ATTACK': 'When this card attacks',
        'ON_BE_ATTACKED': 'When this card is attacked',
        'WOULD_ATTACK': 'When this card would attack',
        'WOULD_BE_ATTACKED': 'When this card would be attacked',
        'ON_DEAL_DAMAGE': 'When this card deals damage',
        'ON_BE_DAMAGED': 'When this card takes damage',
        'WOULD_DEAL_DAMAGE': 'When this card would deal damage',
        'WOULD_BE_DAMAGED': 'When this card would take damage',
        'ON_HEAL': 'When this card heals',
        'ON_BE_HEALED': 'When this card is healed',
        'WOULD_HEAL': 'When this card would heal',
        'WOULD_BE_HEALED': 'When this card would be healed',
        'ON_REBEL': 'When this card takes control',
        'ON_BE_REBELLED': 'When this card changes sides',
        'WOULD_REBEL': 'When this card would take control',
        'WOULD_BE_REBELLED': 'When this card would change sides',
        'ON_DRAW_CARD': 'When this card draws a card',
        'ON_BE_DRAWN': 'When this card is drawn',
        'WOULD_DRAW_CARD': 'When this card would draw a card',
        'WOULD_BE_DRAWN': 'When this card would be drawn',
        'ON_DISCARD': 'When this card discards',
        'ON_BE_DISCARDED': 'When this card is discarded',
        'WOULD_DISCARD': 'When this card would discard',
        'WOULD_BE_DISCARDED': 'When this card would be discarded',
        'WOULD_BE_HARVESTED': 'When this card would be harvested',
        'ON_RECOVER': 'When this card recovers a card',
        'ON_BE_RECOVERED': 'When this card is recovered',
        'WOULD_RECOVER': 'When this card would recover a card',
        'WOULD_BE_RECOVERED': 'When this card would be recovered',
        'ON_REVIVE': 'When this card revives a unit',
        'ON_BE_REVIVED': 'When this card is revived',
        'WOULD_REVIVE': 'When this card would revive a unit',
        'WOULD_BE_REVIVED': 'When this card would be revived',
        'MODIFY_DEAL_DAMAGE': 'When this card is dealing damage',
        'MODIFY_BE_DAMAGED': 'When this card is taking damage',
        'MODIFY_HEAL': 'When this card is healing',
        'MODIFY_BE_HEALED': 'When this card is being healed',
        'MODIFY_ATTACK': 'When this card is attacking'
    };

    const allTriggers = [ability.trigger || 'MANUAL', ...(ability.additionalTriggers || [])];
    let globalTargetNoun = null;

    let processedTriggers = allTriggers.map(t => {
        let txt = triggerDict[t];
        if (txt === undefined) {
            let readable = t.toLowerCase().replace(/_/g, ' ');
            if (readable.startsWith('on be ')) txt = `When this card is ${readable.substring(6)}`;
            else if (readable.startsWith('on ')) txt = `When this card ${readable.substring(3)}`;
            else if (readable.startsWith('would be ')) txt = `When this card would be ${readable.substring(9)}`;
            else if (readable.startsWith('would ')) txt = `When this card would ${readable.substring(6)}`;
            else txt = `On ${readable}`;
        }
        
        if (ability.triggerScope === 'GLOBAL') {
            let lowerTxt = txt.toLowerCase();
            const qt = ability.activation?.quickTargeting;
            const lt = ability.activation?.logicTree;
            let targetDesc = buildTargetDesc(qt, lt, t, true, 'FIELD', false, allTribes);
            
            globalTargetNoun = targetDesc.replace(/^(a|an|the|some|any|all)\s+/i, '');
            
            const addArticle = (word) => {
                if (/^(allies|enemies|cards|characters|entities|all|any)\b/i.test(word)) return word;
                if (/^u[ni]/i.test(word)) return 'a ' + word;
                return (/^[aeiou]/i.test(word) ? 'an ' : 'a ') + word;
            };
            targetDesc = addArticle(targetDesc);
            
            if (lowerTxt.startsWith('when this card would be ')) lowerTxt = lowerTxt.replace('when this card would be ', `whenever ${targetDesc} would be `);
            else if (lowerTxt.startsWith('when this card would ')) lowerTxt = lowerTxt.replace('when this card would ', `whenever ${targetDesc} would `);
            else if (lowerTxt.startsWith('when you play this card, you may')) lowerTxt = `whenever you play ${targetDesc}, you may`;
            else if (lowerTxt.startsWith('when you play this card')) lowerTxt = `whenever you play ${targetDesc}`;
            else if (lowerTxt.startsWith('when this card is ')) lowerTxt = lowerTxt.replace('when this card is ', `whenever ${targetDesc} is `);
            else if (lowerTxt.startsWith('when this card ')) lowerTxt = lowerTxt.replace('when this card ', `whenever ${targetDesc} `);
            else if (lowerTxt.startsWith('when ')) {
                if (lowerTxt.includes('ing ')) {
                    lowerTxt = lowerTxt.replace('when ', `whenever ${targetDesc} is `);
                } else if (lowerTxt.includes('deals ') || lowerTxt.includes('kills ') || lowerTxt.includes('draws ') || lowerTxt.includes('heals ') || lowerTxt.includes('recovers ') || lowerTxt.includes('revives ')) {
                    lowerTxt = lowerTxt.replace('when ', `whenever ${targetDesc} `);
                } else {
                    lowerTxt = lowerTxt.replace('when ', `whenever ${targetDesc} is `);
                }
            }
            
            return lowerTxt.charAt(0).toUpperCase() + lowerTxt.slice(1);
        } else {
            let combatSuffix = '';
            let attackSuffix = '';
            let conditionPhrases = [];
            let rootOperator = 'AND';
            
            if (ability.activation?.method !== 'PLAYER_CHOICE') {
                if (ability.activation?.logicTree?.logicalOperator) {
                    rootOperator = ability.activation.logicTree.logicalOperator;
                }
                
                const scan = (node) => {
                    if (!node) return;
                    if (node.type === 'condition') {
                        if (['isCombat', 'isAttacking'].includes(node.attribute)) {
                            let isTrue = String(node.value).toLowerCase() === 'true';
                            if (node.operator === '!=') isTrue = !isTrue;
                            
                            if (node.attribute === 'isCombat') {
                                combatSuffix = isTrue ? ' during combat' : ' outside of combat';
                            } else {
                                attackSuffix = isTrue ? ' as the attacker' : ' as the defender';
                            }
                        } else if (node.attribute === 'eventAbility') {
                            if (node.operator === '==') conditionPhrases.push(`the event ability is '${node.value}'`);
                            else conditionPhrases.push(`the event ability is not '${node.value}'`);
                        } else {
                            const opMap = { '==': 'is', '!=': 'is not', '>': 'is more than', '<': 'is less than', '>=': 'is at least', '<=': 'is at most' };
                            let opText = opMap[node.operator] !== undefined ? opMap[node.operator] : node.operator;
                            
                            if (['tribe', 'family', 'genus'].includes(node.attribute)) {
                                let displayValue = String(node.value);
                                if (node.attribute === 'tribe') {
                                    if (allTribes && Array.isArray(allTribes)) {
                                        const match = allTribes.find(t => t.id === displayValue || t.name.toLowerCase() === displayValue.toLowerCase());
                                        if (match) displayValue = match.name;
                                    } else if (displayValue.toLowerCase().startsWith('tribe_')) {
                                        displayValue = displayValue.substring(6).replace(/_/g, ' ');
                                        displayValue = displayValue.replace(/\b\w/g, l => l.toUpperCase());
                                    }
                                }
                                conditionPhrases.push(`{POSS} ${node.attribute} ${opText} ${displayValue}`);
                            } else if (['health', 'strength', 'readiness', 'maxHealth', 'armor', 'power', 'cost', 'acts', 'maxActs'].includes(node.attribute)) {
                                let statName = node.attribute.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
                                conditionPhrases.push(`{POSS} ${statName} ${opText} ${node.value}`);
                            } else if (node.attribute === 'alignment') {
                                conditionPhrases.push(`{PRONOUN} ${opText} ${String(node.value).toLowerCase()}`);
                            } else if (node.attribute === 'hasAbility') {
                                if (node.operator === '==') conditionPhrases.push(`{PRONOUN} has ability '${node.value}'`);
                                else conditionPhrases.push(`{PRONOUN} does not have ability '${node.value}'`);
                            }
                        }
                    } else if (node.children) {
                        node.children.forEach(scan);
                    }
                };
                scan(ability.activation?.logicTree);
            }
            
            if (attackSuffix) {
                combatSuffix = ''; // Attacking entails combat, prevent redundancy
            }
            
            let finalTxt = txt + attackSuffix + combatSuffix;
            if (conditionPhrases.length > 0) {
                let hasThisCard = finalTxt.toLowerCase().includes('this card');
                let poss = hasThisCard ? 'its' : "this card's";
                let pro = hasThisCard ? 'it' : 'this card';
                
                let joinWord = rootOperator === 'OR' ? ' or ' : ' and ';
                let joined = conditionPhrases.join(joinWord);
                joined = joined.replace(/\{POSS\}/g, poss).replace(/\{PRONOUN\}/g, pro);
                finalTxt += `, if ${joined}`;
            }
            return finalTxt;
        }
    });

    if (processedTriggers.length === 1) {
        triggerText = processedTriggers[0];
    } else {
        let first = processedTriggers[0];
        let rest = processedTriggers.slice(1).map(t => t.toLowerCase());
        triggerText = first + ' or ' + rest.join(' or ');
    }

    return { triggerText, globalTargetNoun };
}