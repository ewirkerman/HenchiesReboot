/**
 * Ability Language Generator
 * Converts a structured Ability JSON payload into human-readable text.
 */

import { ACTION_MANIFEST } from './actions.js';

// --- UTILITY METHODS ---
function formatResourceAmount(amount) {
    if (!amount || amount <= 0) return '';
    return `${amount} Resource${amount > 1 ? 's' : ''}`;
}

function formatResource(amount, resourceName) {
    if (!amount || amount <= 0) return '';
    return `${amount} ${resourceName}`;
}

function joinWithAnd(arr) {
    if (!arr || arr.length === 0) return '';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
    return arr.slice(0, -1).join(', ') + ', and ' + arr[arr.length - 1];
}

function formatArrayToString(arr, fallback = 'any') {
    if (!arr || arr.length === 0) return fallback;
    // Format arrays like ['ENEMY', 'FRIENDLY'] into "enemy or friendly"
    return arr.map(s => s.toLowerCase().replace(/_/g, ' ')).join(' or ');
}

function buildTargetDesc(qt, logicTree, trigger, allHaveSameImpliedZone, impliedZone, isPlural) {
    if (!qt) return isPlural ? 'targets' : 'target';
    
    let isCardZone = qt && qt.zones && qt.zones.length > 0 && qt.zones.every(z => ['HAND', 'DECK', 'DISCARD', 'BANISH', 'ORIGINAL_DECK'].includes(z));

    let adjectives = [];
    let suffixes = [];

    const parseNode = (node) => {
        if (!node) return;
        if (node.type === 'group' && node.children) {
            node.children.forEach(parseNode);
        } else if (node.type === 'condition') {
            const opMap = { '==': '', '!=': 'not', '>': 'more than', '<': 'less than', '>=': 'at least', '<=': 'at most' };
            let opText = opMap[node.operator] !== undefined ? opMap[node.operator] : node.operator;
            
            if (['tribe', 'family', 'genus'].includes(node.attribute)) {
                if (node.operator === '==') {
                    adjectives.push(node.value);
                } else {
                    suffixes.push(`that is ${opText} ${node.value}`.trim());
                }
            } else if (['health', 'strength', 'readiness', 'maxHealth'].includes(node.attribute)) {
                let statName = node.attribute === 'maxHealth' ? 'max health' : node.attribute;
                suffixes.push(`with ${opText} ${node.value} ${statName}`.trim());
            } else if (node.attribute === 'isCombat') {
                if (String(node.value) === 'true') suffixes.push(`during combat`);
                else suffixes.push(`outside of combat`);
            } else if (node.attribute === 'isAttacking') {
                if (String(node.value) === 'true') suffixes.push(`as the attacker`);
                else suffixes.push(`as the defender`);
            } else if (node.attribute === 'hasAbility') {
                if (node.operator === '==') suffixes.push(`with ability '${node.value}'`);
                else suffixes.push(`without ability '${node.value}'`);
            }
        }
    };

    if (logicTree) parseNode(logicTree);

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
        let scopeZones = formatArrayToString(qt.zones, 'any zone');
        baseDesc += ` in ${scopeZones}`;
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

// --- CORE GENERATOR ---
export function generateAbilityDescription(ability, allAbilities = null, allCards = null) {
    // If the user provided a custom description, always prioritize it.
    if (ability.description && ability.description.trim() !== '') {
        return ability.description;
    }

    let descriptionParts = [];

    // --- PASSIVE FLAGS ---
    const flags = ability.passiveFlags || [];
    if (flags.includes('STRIKE_FAST')) descriptionParts.push("Fast.");
    if (flags.includes('STRIKE_SLOW')) descriptionParts.push("Slow.");

    let blocks = [];
    if (flags.includes('BLOCK_ACT')) blocks.push('act');
    if (flags.includes('BLOCK_ATTACK')) blocks.push('attack');
    if (flags.includes('BLOCK_RETALIATE')) blocks.push('retaliate');

    if (blocks.length === 1) descriptionParts.push(`Unable to ${blocks[0]}.`);
    else if (blocks.length === 2) descriptionParts.push(`Unable to ${blocks[0]} or ${blocks[1]}.`);
    else if (blocks.length > 2) descriptionParts.push(`Unable to act, attack, or retaliate.`);

    let ignores = [];
    if (flags.includes('IGNORE_BLOCK_ACT')) ignores.push('acting');
    if (flags.includes('IGNORE_BLOCK_ATTACK')) ignores.push('attacking');
    if (flags.includes('IGNORE_BLOCK_RETALIATE')) ignores.push('retaliating');

    if (ignores.length === 1) descriptionParts.push(`Ignores effects that prevent it from ${ignores[0]}.`);
    else if (ignores.length === 2) descriptionParts.push(`Ignores effects that prevent it from ${ignores[0]} or ${ignores[1]}.`);
    else if (ignores.length > 2) descriptionParts.push(`Ignores effects that prevent it from acting, attacking, or retaliating.`);

    if (flags.includes('BLOCK_TARGETING')) descriptionParts.push("Cannot be targeted by enemies.");
    if (flags.includes('IGNORE_BLOCK_TARGETING')) descriptionParts.push("Ignores enemy stealth and targeting restrictions.");
    if (flags.includes('BLOCK_TARGET_AVATAR')) descriptionParts.push("Cannot attack enemy avatars.");

    // 1. TRIGGER
    const trigger = ability.trigger || 'MANUAL';
    let triggerText = '';
    
    const triggerDict = {
        'MANUAL': '',
        'UNTRIGGERABLE': '',
        'TURN_STARTING': 'At the start of the turn',
        'TURN_STARTED': 'After the turn starts',
        'PLAY': 'When played',
        'PLAY_OPTIONAL': 'When played (Optional)',
        'ON_BE_PLAYED': 'When played',
        'SUMMON': 'When summoned',
        'KILL': 'When it kills an enemy',
        'UNFIELD': 'When unfielded',
        'WOULD_BE_PLAYED': 'When it would be played',
        'ON_SUMMON': 'When it summons',
        'ON_BE_SUMMONED': 'When summoned',
        'WOULD_SUMMON': 'When it would summon',
        'WOULD_BE_SUMMONED': 'When it would be summoned',
        'ON_KILL': 'When it kills an enemy',
        'ON_BE_KILLED': 'When killed',
        'WOULD_KILL': 'When it would kill an enemy',
        'WOULD_BE_KILLED': 'When it would be killed',
        'ON_ATTACK': 'When attacking',
        'ON_BE_ATTACKED': 'When attacked',
        'WOULD_ATTACK': 'When it would attack',
        'WOULD_BE_ATTACKED': 'When it would be attacked',
        'ON_DEAL_DAMAGE': 'When it deals damage',
        'ON_BE_DAMAGED': 'When it takes damage',
        'WOULD_DEAL_DAMAGE': 'When it would deal damage',
        'WOULD_BE_DAMAGED': 'When it would take damage',
        'ON_HEAL': 'When it heals',
        'ON_BE_HEALED': 'When healed',
        'WOULD_HEAL': 'When it would heal',
        'WOULD_BE_HEALED': 'When it would be healed',
        'ON_REBEL': 'When it takes control',
        'ON_BE_REBELLED': 'When it changes sides',
        'WOULD_REBEL': 'When it would take control',
        'WOULD_BE_REBELLED': 'When it would change sides',
        'ON_DRAW_CARD': 'When it draws a card',
        'ON_BE_DRAWN': 'When drawn',
        'WOULD_DRAW_CARD': 'When it would draw a card',
        'WOULD_BE_DRAWN': 'When it would be drawn',
        'ON_DISCARD': 'When it discards',
        'ON_BE_DISCARDED': 'When discarded',
        'WOULD_DISCARD': 'When it would discard',
        'WOULD_BE_DISCARDED': 'When it would be discarded',
        'WOULD_BE_HARVESTED': 'When it would be harvested',
        'ON_RECOVER': 'When it recovers a card',
        'ON_BE_RECOVERED': 'When recovered',
        'WOULD_RECOVER': 'When it would recover a card',
        'WOULD_BE_RECOVERED': 'When it would be recovered',
        'ON_REVIVE': 'When it revives a unit',
        'ON_BE_REVIVED': 'When revived',
        'WOULD_REVIVE': 'When it would revive a unit',
        'WOULD_BE_REVIVED': 'When it would be revived',
        'MODIFY_DEAL_DAMAGE': 'When dealing damage',
        'MODIFY_BE_DAMAGED': 'When taking damage',
        'MODIFY_HEAL': 'When healing',
        'MODIFY_BE_HEALED': 'When being healed',
        'MODIFY_ATTACK': 'When attacking'
    };

    const allTriggers = [ability.trigger || 'MANUAL', ...(ability.additionalTriggers || [])];

    let processedTriggers = allTriggers.map(t => {
        let txt = triggerDict[t];
        if (txt === undefined) {
            let readable = t.toLowerCase().replace(/_/g, ' ');
            if (readable.startsWith('on be ')) txt = `When ${readable.substring(6)}`;
            else if (readable.startsWith('on ')) txt = `When it ${readable.substring(3)}`;
            else if (readable.startsWith('would be ')) txt = `When it would be ${readable.substring(9)}`;
            else if (readable.startsWith('would ')) txt = `When it would ${readable.substring(6)}`;
            else txt = `On ${readable}`;
        }
        
        if (ability.triggerScope === 'GLOBAL') {
            let lowerTxt = txt.toLowerCase();
            const qt = ability.activation?.quickTargeting;
            const lt = ability.activation?.logicTree;
            const targetDesc = buildTargetDesc(qt, lt, t, true, 'FIELD', false);
            if (lowerTxt.startsWith('when ')) lowerTxt = lowerTxt.replace('when ', `whenever ${targetDesc} is `);
            
            return lowerTxt.charAt(0).toUpperCase() + lowerTxt.slice(1);
        } else {
            let combatSuffix = '';
            let attackSuffix = '';
            const scan = (node) => {
                if (!node) return;
                if (node.type === 'condition') {
                    if (node.attribute === 'isCombat') {
                        combatSuffix = String(node.value) === 'true' ? ' during combat' : ' outside of combat';
                    } else if (node.attribute === 'isAttacking') {
                        attackSuffix = String(node.value) === 'true' ? ' as the attacker' : ' as the defender';
                    }
                } else if (node.children) node.children.forEach(scan);
            };
            scan(ability.activation?.logicTree);
            return txt + attackSuffix + combatSuffix;
        }
    });

    if (processedTriggers.length === 1) {
        triggerText = processedTriggers[0];
    } else {
        let first = processedTriggers[0];
        let rest = processedTriggers.slice(1).map(t => t.toLowerCase());
        triggerText = first + ' or ' + rest.join(' or ');
    }

    const cost = ability.cost || {};
    
    if (trigger === 'UNTRIGGERABLE') {
        if (triggerText && triggerText.trim() !== '') {
            descriptionParts.push(triggerText.trim());
        }
    } else {
        let triggerAndCostStr = "";
        
        if (cost.reuseIgnoresReadiness && cost.readinessCost !== 'NONE') {
             triggerAndCostStr += `(Subsequent uses this round ignore readiness cost) `;
        }
        
        if (triggerText) {
             triggerAndCostStr += triggerText + (trigger !== 'MANUAL' ? ", " : " ");
        }

        if (triggerAndCostStr.trim() !== '') {
            descriptionParts.push(triggerAndCostStr.trim());
        }
    }

    // 3. LIMITS
    let limitSuffix = '';
    if (ability.triggerLimit === 'ONCE_PER_ROUND') {
        limitSuffix = ", once per round";
    } else if (ability.triggerLimit === 'TWICE_PER_ROUND') {
         limitSuffix = ", twice per round";
    }

    // 4. EFFECTS (Parsed by Target Groups)
    const targetGroups = ability.effects || [];
    if (targetGroups.length === 0) {
        if (trigger !== 'UNTRIGGERABLE') descriptionParts.push("do nothing.");
    } else {
        let allCostSentences = [];
        let allEffectSentences = [];

        targetGroups.forEach(group => {
            if (!group.payloads || group.payloads.length === 0) return;

            let allHaveSameImpliedZone = group.payloads.length > 0;
            let impliedZone = null;
            for (const p of group.payloads) {
                const man = ACTION_MANIFEST[p.type];
                const z = (man && man.validZones && man.validZones.length === 1 && man.validZones[0] !== 'ALL') ? man.validZones[0] : null;
                
                if (!z) { allHaveSameImpliedZone = false; break; }
                if (!impliedZone) impliedZone = z;
                else if (impliedZone !== z) { allHaveSameImpliedZone = false; break; }
            }

            let targetStr = 'them';
            let possessiveStr = 'their';

            if (group.targetMethod === 'SELF') {
                targetStr = 'itself';
                possessiveStr = 'its';
            } else if (group.targetMethod === 'AVATAR') {
                targetStr = 'your avatar';
                possessiveStr = "your avatar's";
            } else if (group.targetMethod === 'ENEMY_AVATAR') {
                targetStr = 'the enemy avatar';
                possessiveStr = "the enemy avatar's";
            } else if (group.targetMethod === 'SAME_AS_ACTIVATION') {
                const actMethod = ability.activation?.method || 'NONE';
                if (actMethod === 'PLAYER_CHOICE') {
                    let actDesc = buildTargetDesc(ability.activation?.quickTargeting, ability.activation?.logicTree, trigger, true, 'FIELD', false);
                    targetStr = `a chosen ${actDesc}`;
                    possessiveStr = `${targetStr}'s`;
                } else {
                    targetStr = `the triggered entity`;
                    possessiveStr = `the triggered entity's`;
                }
            } else {
                let isPlural = group.targetMethod === 'AUTO_ALL' || group.targetCount > 1;
                let baseDesc = buildTargetDesc(group.quickTargeting || {}, group.logicTree, trigger, allHaveSameImpliedZone, impliedZone, isPlural);
                
                if (group.targetMethod === 'AUTO_ALL') targetStr = `all ${baseDesc}`;
                else if (group.targetMethod === 'AUTO_RANDOM') targetStr = group.targetCount === 1 ? `a random ${baseDesc}` : `${group.targetCount || 1} random ${baseDesc}`;
                else if (group.targetMethod === 'AUTO_FIRST') targetStr = group.targetCount === 1 ? `the first ${baseDesc}` : `the first ${group.targetCount || 1} ${baseDesc}`;
                else if (group.targetMethod === 'AUTO_LAST') targetStr = group.targetCount === 1 ? `the last ${baseDesc}` : `the last ${group.targetCount || 1} ${baseDesc}`;
                
                if (targetStr.endsWith('s')) possessiveStr = `${targetStr}'`;
                else possessiveStr = `${targetStr}'s`;
            }

            const formatPayload = (eff) => {
                let effText = '';
                
                switch(eff.type) {
                    case 'DEAL_DAMAGE': effText = `deal ${eff.amount || 1} damage to {TARGET}`; break;
                    case 'HEAL': effText = `heal ${eff.amount || 1} health on {TARGET}`; break;
                    case 'DRAW_CARD': 
                        let isNormalDraw = group.targetMethod === 'AUTO_FIRST' && (!group.quickTargeting || !group.quickTargeting.alignment || group.quickTargeting.alignment.length === 0 || (group.quickTargeting.alignment.length === 1 && group.quickTargeting.alignment[0] === 'FRIENDLY'));
                        if (isNormalDraw) {
                            let drawAmt = group.targetCount || eff.amount || 1;
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
                        let modStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                        if (eff.amount < 0) {
                            effText = `decrease {POSS} ${modStat} by ${Math.abs(eff.amount)}`;
                        } else {
                            effText = `increase {POSS} ${modStat} by ${eff.amount || 1}`;
                            if (eff.maxStacks > 0) effText += ` (max ${eff.maxStacks})`;
                        }
                        break;
                    case 'MODIFY_RESOURCE':
                        let resName = eff.resource || 'resource';
                        if (eff.amount < 0) {
                            effText = `spend ${Math.abs(eff.amount)} ${resName}{OMIT_TARGET}`;
                        } else {
                            effText = `gain ${eff.amount || 1} ${resName}{OMIT_TARGET}`;
                        }
                        break;
                    case 'SET_STAT': 
                        let setStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                        effText = `set {POSS} ${setStat} to ${eff.amount || 1}`; break;
                    case 'BLOCK_ACT': effText = `block {TARGET} from acting`; break;
                    case 'BLOCK_ATTACK': effText = `block {TARGET} from attacking`; break;
                    case 'BLOCK_RETALIATE': effText = `block {TARGET} from retaliating`; break;
                    case 'BLOCK_TARGETING': effText = `prevent enemies from targeting {TARGET}`; break;
                    case 'SHUFFLE': effText = `shuffle {TARGET} into deck`; break;
                    case 'RETURN': effText = `return {TARGET} to hand`; break;
                    case 'ATTACH': effText = eff.invertRoles ? `attach to {TARGET}` : `attach {TARGET} to self`; break;
                    case 'ATTACH_TO': effText = eff.invertRoles ? `attach {TARGET} to self` : `attach to {TARGET}`; break;
                    case 'UNATTACH': effText = `unattach {TARGET}`; break;
                    case 'FIELD': effText = `field {TARGET}`; break;
                    case 'BANISH': effText = `banish {TARGET}`; break;
                    case 'KILL': effText = `kill {TARGET}`; break;
                    case 'ATTACK': effText = `attack {TARGET}`; break;
                    case 'CANCEL_EVENT': effText = `instead{OMIT_TARGET}`; break;
                    case 'CLEANSE': effText = `cleanse temporary effects from {TARGET}`; break;
                    case 'CHANGE_DESTINATION': 
                        let targetDest = (eff.zone || 'DECK').toUpperCase();
                        if (targetDest === 'FIELD') effText = `instead, field {TARGET}`;
                        else if (targetDest === 'HAND') effText = `instead, return {TARGET} to hand`;
                        else if (targetDest === 'DISCARD') effText = `instead, discard {TARGET}`;
                        else if (targetDest === 'DECK' || targetDest === 'ORIGINAL_DECK') effText = `instead, shuffle {TARGET} into deck`;
                        else if (targetDest === 'BANISH') effText = `instead, banish {TARGET}`;
                        else effText = `instead, move {TARGET} to ${targetDest.toLowerCase()}`;
                        break;
                    case 'REBEL': effText = eff.invertRoles ? `give control of self to {TARGET}` : `take control of {TARGET}`; break;
                    case 'MODIFY_EVENT': 
                        if (eff.stat === 'amount') {
                            effText = eff.amount < 0 ? `decrease the amount by ${Math.abs(eff.amount)}{OMIT_TARGET}` : `increase the amount by ${eff.amount}{OMIT_TARGET}`;
                        } else {
                            effText = `modify event ${eff.stat} by ${eff.amount > 0 ? '+' : ''}${eff.amount}{OMIT_TARGET}`;
                        }
                        break;
                    case 'CUSTOM_SCRIPT': effText = eff.description ? eff.description : `execute custom script on {TARGET}`; break;
                    case 'GRANT_ABILITY':
                        let abilityName = eff.grantedAbilityId;
                        if (allAbilities && Array.isArray(allAbilities)) {
                            const match = allAbilities.find(a => a.abilityId === eff.grantedAbilityId);
                            if (match) abilityName = match.name;
                        } else if (typeof window !== 'undefined' && typeof getAbility === 'function') {
                             const grantedAb = getAbility(eff.grantedAbilityId);
                             if(grantedAb) abilityName = grantedAb.name;
                        }
                        effText = `grant ability '${abilityName}' to {TARGET}`;
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
                        let article = /^[aeiou]/i.test(transCardName) ? 'an' : 'a';
                        if (targetStr === 'self' || targetStr === 'itself') {
                            effText = `transform into ${article} ${transCardName}{OMIT_TARGET}`;
                        } else {
                            effText = `transform {TARGET} into ${article} ${transCardName}`;
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
                    effText = `remove ability '${rmAbilityName}' from {TARGET}`;
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
                        const summonAmt = eff.amount || 1;
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

                        effText = `summon ${summonAmt} ${durAdj}${cardName}${pluralSuffix}{OMIT_TARGET}`;
                        
                        if (isCasterZone) {
                            if (destZone !== 'field') effText += ` to ${destZone}`;
                        } else {
                            effText += ` to {POSS} ${destZone}`;
                        }
                        
                        if (eff.nestedGroup && eff.nestedGroup.payloads && eff.nestedGroup.payloads.length > 0) {
                            let nestedPayloadsText = eff.nestedGroup.payloads.map(np => {
                                let npText = formatPayload(np);
                                npText = npText.replace(/\{TARGET\}/g, 'them').replace(/\{POSS\}/g, 'their').replace(/\{OMIT_TARGET\}/g, '');
                                return npText;
                            });
                            let combinedNested = joinWithAnd(nestedPayloadsText);
                            
                            let targetMethod = eff.nestedGroup.targetMethod || 'AUTO_ALL';
                            let targetCount = eff.nestedGroup.targetCount || 1;
                            let subTargetText = 'them';
                            
                            if (targetMethod === 'AUTO_RANDOM') subTargetText = `${targetCount} random of them`;
                            else if (targetMethod === 'AUTO_FIRST') subTargetText = `the first ${targetCount} of them`;
                            else if (targetMethod === 'AUTO_ALL') subTargetText = `all of them`;
                            
                            effText += ` and ${combinedNested} on ${subTargetText}`;
                        }
                        break;
                    default:
                        let readableType = eff.type.toLowerCase().replace(/_/g, ' ');
                        effText = `${readableType} {TARGET}`;
                }

                if (eff.invertRoles && !['ATTACH', 'ATTACH_TO', 'REBEL'].includes(eff.type)) {
                    effText = `force {TARGET} to ${effText}`;
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
                    if (effText.startsWith('instead, ')) {
                        effText = effText.replace('instead, ', `instead, ${adverb}`);
                    } else if (effText.startsWith('force {TARGET} to ')) {
                        effText = effText.replace('force {TARGET} to ', `force {TARGET} to ${adverb}`);
                    } else {
                        effText = adverb + effText;
                    }
                }

                if (suffix && eff.type !== 'SUMMON') {
                    effText += suffix;
                }

                return effText;
            };

            const getSimilarityKey = (eff) => {
                if (['GRANT_ABILITY', 'REMOVE_ABILITY', 'SET_STAT'].includes(eff.type)) {
                    return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}_${eff.blockDuplicates}`;
                }
                if (eff.type === 'MODIFY_STAT') {
                    return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}_${Math.sign(eff.amount)}_${eff.maxStacks}`;
                }
                if (eff.type === 'MODIFY_RESOURCE') {
                     return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}_${Math.sign(eff.amount)}`;
                }
                if (['BLOCK_ACT', 'BLOCK_ATTACK', 'BLOCK_RETALIATE'].includes(eff.type)) {
                    return `BLOCKS_${eff.duration}_${eff.invertRoles}_${eff.isCost}`;
                }
                return `${eff.type}_${Math.random()}`; // unique
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
                        return `'${abilityName}'`;
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
                        return `'${rmAbilityName}'`;
                    });
                    effText = `remove abilities ${joinWithAnd(abNames)} from {TARGET}`;
                } else if (first.type === 'MODIFY_STAT') {
                    let isDecrease = first.amount < 0;
                    let changes = effs.map(eff => {
                         let modStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                         return `${Math.abs(eff.amount || 1)} ${modStat}`;
                    });
                    if (isDecrease) {
                        effText = `decrease {POSS} ${joinWithAnd(changes)}`;
                    } else {
                        effText = `increase {POSS} ${joinWithAnd(changes)}`;
                        if (first.maxStacks > 0) effText += ` (max ${first.maxStacks})`;
                    }
                } else if (first.type === 'SET_STAT') {
                    let changes = effs.map(eff => {
                         let setStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                         return `${setStat} to ${eff.amount || 1}`;
                    });
                    effText = `set {POSS} ${joinWithAnd(changes)}`;
                } else if (first.type === 'MODIFY_RESOURCE') {
                    let isSpend = first.amount < 0;
                    let changes = effs.map(eff => {
                         let resName = eff.resource || 'resource';
                         return `${Math.abs(eff.amount || 1)} ${resName}`;
                    });
                    if (isSpend) {
                        effText = `spend ${joinWithAnd(changes)}{OMIT_TARGET}`;
                    } else {
                        effText = `gain ${joinWithAnd(changes)}{OMIT_TARGET}`;
                    }
                } else if (['BLOCK_ACT', 'BLOCK_ATTACK', 'BLOCK_RETALIATE'].includes(first.type)) {
                    let blockedActions = effs.map(eff => {
                        if (eff.type === 'BLOCK_ACT') return 'acting';
                        if (eff.type === 'BLOCK_ATTACK') return 'attacking';
                        if (eff.type === 'BLOCK_RETALIATE') return 'retaliating';
                        return '';
                    }).filter(Boolean);
                    effText = `block {TARGET} from ${joinWithAnd(blockedActions)}`;
                } else {
                    return effs.map(formatPayload).join(' and ');
                }
                
                if (first.invertRoles && !['ATTACH', 'ATTACH_TO', 'REBEL'].includes(first.type)) {
                    effText = `force {TARGET} to ${effText}`;
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
                    if (effText.startsWith('instead, ')) {
                        effText = effText.replace('instead, ', `instead, ${adverb}`);
                    } else if (effText.startsWith('force {TARGET} to ')) {
                        effText = effText.replace('force {TARGET} to ', `force {TARGET} to ${adverb}`);
                    } else {
                        effText = adverb + effText;
                    }
                }

                if (suffix && first.type !== 'SUMMON') {
                    effText += suffix;
                }

                return effText;
            };

            const finalizeString = (arr) => {
                if(arr.length === 0) return null;
                
                let mentioned = false;
                let processedArr = arr.map(str => {
                    let t, p;
                    if (targetStr === 'self' || targetStr === 'itself') {
                        t = 'self';
                        p = 'own';
                    } else if (targetStr === 'your avatar' || targetStr === 'the enemy avatar') {
                        t = mentioned ? 'it' : targetStr;
                        p = mentioned ? 'its' : possessiveStr;
                    } else {
                        let isPlural = group.targetMethod === 'AUTO_ALL' || group.targetCount > 1 || group.targetMethod === 'AUTO_RANDOM' || group.targetMethod === 'AUTO_FIRST' || group.targetMethod === 'AUTO_LAST' || targetStr.endsWith('s');
                        t = mentioned ? (isPlural ? 'them' : 'it') : targetStr;
                        p = mentioned ? (isPlural ? 'their' : 'its') : possessiveStr;
                    }

                    if (str.includes('{OMIT_TARGET}')) {
                        mentioned = true;
                        str = str.replace('{OMIT_TARGET}', '');
                    }

                    if (str.includes('{TARGET}') || str.includes('{POSS}')) {
                        mentioned = true;
                    }
                    
                    return str.replace(/\{POSS\}/g, p).replace(/\{TARGET\}/g, t);
                });

                let combined = joinWithAnd(processedArr);
                if (!mentioned && targetStr !== 'self' && targetStr !== 'itself' && !combined.includes(targetStr) && !combined.includes(possessiveStr)) {
                    combined += ` to ${targetStr}`;
                }
                
                combined = combined.replace(/\binstead and /gi, 'instead, ');
                
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

        if (allCostSentences.length > 0 && allEffectSentences.length > 0) {
             let combinedCosts = allCostSentences.join(' and ');
             let combinedEffects = allEffectSentences.join(' and ');
             descriptionParts.push(`${combinedCosts} to ${combinedEffects}.`);
        } else if (allCostSentences.length > 0) {
             let combinedCosts = allCostSentences.join(' and ');
             descriptionParts.push(combinedCosts + '.');
        } else if (allEffectSentences.length > 0) {
             descriptionParts.push(allEffectSentences.join('. ') + '.');
        }
    }

    let finalStr = descriptionParts.join(' ').trim();
    if (finalStr.length > 0) {
        if (limitSuffix) {
            if (finalStr.endsWith('.')) finalStr = finalStr.slice(0, -1);
            finalStr += limitSuffix + '.';
        }
        // Find the first alphabetical character after any symbols/brackets and capitalize it
        finalStr = finalStr.replace(/^([^a-zA-Z]*)([a-zA-Z])/i, (match, p1, p2) => p1 + p2.toUpperCase());
        // Ensure any subsequent sentences are properly capitalized
        finalStr = finalStr.replace(/\.\s+([a-z])/g, (match, p1) => '. ' + p1.toUpperCase());
    }

    return finalStr;
}