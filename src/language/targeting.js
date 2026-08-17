/**
 * src/language/targeting.js
 * Translates JSON target constraints into Noun Phrases.
 */

import { formatArrayToString } from './utils.js';

export function buildTargetDesc(qt, logicTree, trigger, allHaveSameImpliedZone, impliedZone, isPlural, allTribes = null, allAbilities = null) {
    if (!qt) return isPlural ? 'targets' : 'target';
    
    let isCardZone = qt && qt.zones && qt.zones.length > 0 && qt.zones.every(z => ['HAND', 'DECK', 'DISCARD', 'BANISH', 'ORIGINAL_DECK'].includes(z));

    let adjectives = [];
    let suffixes = [];
    
    let combatState = null;
    let attackingState = null;
    
    const isAre = isPlural ? 'are' : 'is';

    const parseNode = (node) => {
        if (!node) return;
        if (node.type === 'group' && node.children) {
            node.children.forEach(parseNode);
        } else if (node.type === 'condition') {
            const opMap = { '==': '', '!=': 'not', '>': 'more than', '<': 'less than', '>=': 'at least', '<=': 'at most' };
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
                
                if (node.operator === '==') {
                    adjectives.push(displayValue);
                } else {
                    suffixes.push(`that ${isAre} ${opText} ${displayValue}`.trim());
                }
            } else if (['health', 'strength', 'readiness', 'maxHealth', 'armor', 'power', 'cost', 'acts', 'maxActs', 'amount'].includes(node.attribute)) {
                let statName = node.attribute.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
                if (statName === 'amount') statName = 'event amount';
                suffixes.push(`with ${opText} ${node.value} ${statName}`.replace(/\s+/g, ' ').trim());
            } else if (node.attribute === 'alignment') {
                let val = String(node.value).toLowerCase();
                if (node.operator === '==') {
                    adjectives.push(val === 'friendly' ? 'ally' : val);
                } else {
                    suffixes.push(`that ${isAre} not ${val}`);
                }
            } else if (['isCombat', 'isAttacking'].includes(node.attribute)) {
                let isTrue = String(node.value).toLowerCase() === 'true';
                if (node.operator === '!=') isTrue = !isTrue; // Flip boolean if !=
                
                if (node.attribute === 'isCombat') {
                    combatState = isTrue ? `during combat` : `outside of combat`;
                } else {
                    attackingState = isTrue ? `as the attacker` : `as the defender`;
                }
            } else if (node.attribute === 'eventAbility') {
                if (node.operator === '==') suffixes.push(`where the event ability is '${node.value}'`);
                else suffixes.push(`where the event ability is not '${node.value}'`);
            } else if (node.attribute === 'hasAbility') {
                let abilityName = node.value;
                if (allAbilities && Array.isArray(allAbilities)) {
                    const match = allAbilities.find(a => a.abilityId === node.value || a.name === node.value);
                    if (match) abilityName = match.name;
                }
                if (node.operator === '==') suffixes.push(`with '${abilityName}'`);
                else suffixes.push(`without '${abilityName}'`);
            } else if (node.attribute === 'entity') {
                let val = String(node.value).toLowerCase();
                if (val === 'self') val = 'this card';
                
                if (node.operator === '==') {
                    if (val !== 'unit' && val !== 'avatar') adjectives.push(val);
                } else {
                    let nounStr = val;
                    if (val !== 'this card') {
                        if (isPlural) {
                            nounStr = (val === 'equipment' || val.endsWith('s')) ? val : val + 's';
                        } else {
                            nounStr = /^[aeiou]/i.test(val) ? 'an ' + val : 'a ' + val;
                        }
                    }
                    suffixes.push(`that ${isAre} not ${nounStr}`);
                }
            } else if (node.attribute === 'zone') {
                let val = String(node.value).toLowerCase();
                if (val === 'original_deck') val = 'original deck';
                if (node.operator === '==') suffixes.push(`in ${val}`);
                else suffixes.push(`not in ${val}`);
            }
        }
    };

    if (logicTree) parseNode(logicTree);
    
    // Resolve combat states with precedence (attacking entails combat)
    if (attackingState) {
        suffixes.push(attackingState);
    } else if (combatState) {
        suffixes.push(combatState);
    }

    let validAlignments = (qt.alignment || []).filter(a => a !== 'ANY' && a !== 'ALL');
    if (validAlignments.length === 0) validAlignments = ['FRIENDLY', 'ENEMY'];
    
    let scopeAlignments = formatArrayToString(validAlignments, 'any');
    if (scopeAlignments === 'friendly') scopeAlignments = isPlural ? 'allies' : 'ally';
    else if (scopeAlignments === 'enemy') scopeAlignments = isPlural ? 'enemies' : 'enemy';
    else if (scopeAlignments === 'enemy or friendly' || scopeAlignments === 'friendly or enemy') {
         if (isCardZone) scopeAlignments = isPlural ? 'cards' : 'card';
         else scopeAlignments = isPlural ? 'characters' : 'character';
    }
    
    let validTypes = (qt.entityType || []).filter(e => e !== 'ANY' && e !== 'ALL');
    let scopeTypes = formatArrayToString(validTypes, 'entity');
    if (isPlural) {
        scopeTypes = validTypes.map(s => {
            let l = s.toLowerCase();
            if (isCardZone) return l === 'entity' ? 'cards' : l + ' cards';
            return l === 'entity' ? 'entities' : l + 's';
        }).join(' or ');
    } else {
        scopeTypes = validTypes.map(s => {
            let l = s.toLowerCase();
            if (isCardZone) return l === 'entity' ? 'card' : l + ' card';
            return l;
        }).join(' or ');
    }
    if (scopeTypes === '') {
         if (isCardZone) scopeTypes = isPlural ? 'cards' : 'card';
         else scopeTypes = isPlural ? 'entities' : 'entity';
    }
    
    let noun = scopeTypes;
    if (['ally', 'allies', 'enemy', 'enemies', 'character', 'characters', 'card', 'cards'].includes(scopeAlignments)) {
        let adjAlign = '';
        if (validAlignments.length === 1) {
            adjAlign = validAlignments[0].toLowerCase();
            if (adjAlign === 'friendly') adjAlign = 'ally';
        }
        
        let canDropUnit = validTypes.length === 1 && validTypes[0] === 'UNIT' && !isCardZone;
        
        if (validTypes.length === 0 || canDropUnit) {
            if (adjAlign) {
                 noun = isCardZone ? `${adjAlign} ${isPlural ? 'cards' : 'card'}` : scopeAlignments;
            } else {
                 noun = scopeAlignments;
            }
        } else {
            noun = adjAlign ? `${adjAlign} ${scopeTypes}` : scopeTypes;
        }
    } else if (scopeAlignments !== 'any') {
        noun = `${scopeAlignments} ${scopeTypes}`;
    }

    let baseDesc = `${adjectives.join(' ')} ${noun}`.trim();

    if (!(allHaveSameImpliedZone && qt.zones && qt.zones.length === 1 && qt.zones[0] === impliedZone)) {
        let mappedZones = (qt.zones || []).map(z => {
            let zl = z.toLowerCase();
            if (zl === 'field') return 'on the field';
            if (zl === 'hand') return 'in hand';
            if (zl === 'deck') return 'in the deck';
            if (zl === 'discard') return 'in the discard pile';
            if (zl === 'banish') return 'in the banish zone';
            if (zl === 'original_deck') return 'in their original deck';
            return `in ${zl}`;
        });
        let scopeZones = mappedZones.join(' or ');
        baseDesc += ` ${scopeZones}`;
    }

    if (suffixes.length > 0) {
        baseDesc += ` ${suffixes.join(' and ')}`;
    }
    
    const isPlay = trigger === 'PLAY' || trigger === 'PLAY_OPTIONAL';
    const isManual = trigger === 'MANUAL';
    
    if (isPlay && qt.ignoreBattlelines === false) {
         baseDesc += ` (respecting battlelines)`;
    } else if (isManual && qt.ignoreBattlelines === true) {
         baseDesc += ` (ignoring battlelines)`;
    }

    return baseDesc.replace(/\s+/g, ' ').trim();
}