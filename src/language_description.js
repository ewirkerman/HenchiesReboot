import { ACTION_MANIFEST } from './actions.js';

const ZONE_NAMES = {
    'FIELD': 'the field',
    'HAND': 'hand',
    'DECK': 'deck',
    'DISCARD': 'the discard pile',
    'BANISH': 'the banish zone',
    'ORIGINAL_DECK': 'their original deck'
};

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
                let displayValue = String(node.value);
                if (node.attribute === 'tribe' && displayValue.toLowerCase().startsWith('tribe_')) {
                    displayValue = displayValue.substring(6).replace(/_/g, ' ');
                    displayValue = displayValue.replace(/\b\w/g, l => l.toUpperCase());
                }
                
                if (node.operator === '==') {
                    adjectives.push(displayValue);
                } else {
                    suffixes.push(`that is ${opText} ${displayValue}`.trim());
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

// --- CORE GENERATOR ---
export function generateAbilityDescription(ability, allAbilities = null, allCards = null) {
    // If the user provided a custom description, always prioritize it.
    if (ability.description && ability.description.trim() !== '') {
        return ability.description;
    }

    let descriptionParts = [];

    // --- PASSIVE FLAGS ---
    const flags = ability.passiveFlags || [];
    if (flags.includes('STRIKE_FAST')) descriptionParts.push("**Fast.**");
    if (flags.includes('STRIKE_SLOW')) descriptionParts.push("**Slow.**");

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
        'TURN_ENDING': 'At the end of the turn',
        'TURN_ENDED': 'After the turn ends',
        'PLAY': 'When you play this card',
        'PLAY_OPTIONAL': 'When you play this card, you may',
        'ON_BE_PLAYED': 'When you play this card',
        'SUMMON': 'When this card is summoned',
        'KILL': 'When this card destroys an enemy',
        'UNFIELD': 'When this card is unfielded',
        'WOULD_BE_PLAYED': 'When this card would be played',
        'ON_SUMMON': 'When this card summons',
        'ON_BE_SUMMONED': 'When this card is summoned',
        'WOULD_SUMMON': 'When this card would summon',
        'WOULD_BE_SUMMONED': 'When this card would be summoned',
        'ON_KILL': 'When this card destroys an enemy',
        'ON_BE_KILLED': 'When this card is destroyed',
        'WOULD_KILL': 'When this card would destroy an enemy',
        'WOULD_BE_KILLED': 'When this card would be destroyed',
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
            let targetDesc = buildTargetDesc(qt, lt, t, true, 'FIELD', false);
            
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
            else if (lowerTxt.startsWith('when this card ')) {
                if (lowerTxt.includes('takes') || lowerTxt.includes('deals') || lowerTxt.includes('kills') || lowerTxt.includes('draws') || lowerTxt.includes('heals') || lowerTxt.includes('recovers') || lowerTxt.includes('revives') || lowerTxt.includes('discards') || lowerTxt.includes('destroys')) {
                    lowerTxt = lowerTxt.replace('when this card ', `whenever ${targetDesc} `);
                } else {
                    lowerTxt = lowerTxt.replace('when this card ', `whenever ${targetDesc} is `);
                }
            } else if (lowerTxt.startsWith('when ')) {
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
             triggerAndCostStr += triggerText;
             if (triggerText.endsWith('may')) {
                 triggerAndCostStr += " ";
             } else if (trigger !== 'MANUAL') {
                 triggerAndCostStr += ", ";
             } else {
                 triggerAndCostStr += " ";
             }
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

            if (group.targetMethod === 'SELF') {
                targetStr = 'this card';
                possessiveStr = "this card's";
            } else if (group.targetMethod === 'AVATAR') {
                targetStr = 'your avatar';
                possessiveStr = "your avatar's";
            } else if (group.targetMethod === 'ENEMY_AVATAR') {
                targetStr = 'the enemy avatar';
                possessiveStr = "the enemy avatar's";
            } else if (group.targetMethod === 'EVENT_SOURCE') {
                targetStr = 'the triggering card';
                possessiveStr = "the triggering card's";
            } else if (group.targetMethod === 'EVENT_TARGET') {
                targetStr = 'the targeted card';
                possessiveStr = "the targeted card's";
            } else if (group.targetMethod === 'SAME_AS_ACTIVATION') {
                const actMethod = ability.activation?.method || 'NONE';
                if (actMethod === 'PLAYER_CHOICE') {
                    let actDesc = buildTargetDesc(ability.activation?.quickTargeting, ability.activation?.logicTree, trigger, true, 'FIELD', false);
                    targetStr = `a chosen ${actDesc}`;
                    possessiveStr = `that target's`;
                } else {
                    if (['ON_ATTACK', 'WOULD_ATTACK', 'MODIFY_ATTACK'].includes(trigger)) { targetStr = 'the defender'; possessiveStr = "the defender's"; }
                    else if (['ON_BE_ATTACKED', 'WOULD_BE_ATTACKED'].includes(trigger)) { targetStr = 'the attacker'; possessiveStr = "the attacker's"; }
                    else if (['ON_DEAL_DAMAGE', 'WOULD_DEAL_DAMAGE', 'MODIFY_DEAL_DAMAGE'].includes(trigger)) { targetStr = 'the damaged character'; possessiveStr = "the damaged character's"; }
                    else if (['ON_BE_DAMAGED', 'WOULD_BE_DAMAGED', 'MODIFY_BE_DAMAGED'].includes(trigger)) { targetStr = 'the damage source'; possessiveStr = "the damage source's"; }
                    else if (['ON_HEAL', 'WOULD_HEAL', 'MODIFY_HEAL'].includes(trigger)) { targetStr = 'the healed character'; possessiveStr = "the healed character's"; }
                    else if (['TURN_STARTING', 'TURN_STARTED', 'TURN_ENDING', 'TURN_ENDED', 'PLAY', 'PLAY_OPTIONAL', 'ON_BE_PLAYED'].includes(trigger)) { targetStr = 'this card'; possessiveStr = "this card's"; }
                    else { targetStr = `the target`; possessiveStr = `that target's`; }
                }
            } else {
                let isPlural = group.targetMethod === 'AUTO_ALL' || group.targetCount > 1;
                let baseDesc = buildTargetDesc(group.quickTargeting || {}, group.logicTree, trigger, allHaveSameImpliedZone, impliedZone, isPlural);
                singularDesc = buildTargetDesc(group.quickTargeting || {}, group.logicTree, trigger, allHaveSameImpliedZone, impliedZone, false);
                
                if (group.targetMethod === 'AUTO_ALL') targetStr = `all ${baseDesc}`;
                else if (group.targetMethod === 'AUTO_RANDOM') targetStr = group.targetCount === 1 ? `a random ${singularDesc}` : `${group.targetCount} random ${baseDesc}`;
                else if (group.targetMethod === 'AUTO_FIRST') targetStr = group.targetCount === 1 ? `the first ${singularDesc}` : `the first ${group.targetCount} ${baseDesc}`;
                else if (group.targetMethod === 'AUTO_LAST') targetStr = group.targetCount === 1 ? `the last ${singularDesc}` : `the last ${group.targetCount} ${baseDesc}`;
                else targetStr = baseDesc;
                
                if (targetStr === 'them' || targetStr === 'it') possessiveStr = targetStr === 'them' ? 'their' : 'its';
                else if (isPlural) possessiveStr = 'their';
                else possessiveStr = `that target's`;
            }

            let groupMentioned = false;

            const formatPayload = (eff) => {
                let effText = '';
                
                switch(eff.type) {
                    case 'DEAL_DAMAGE': 
                        if (eff.amount < 0) effText = `restore ${Math.abs(eff.amount)} health to {TARGET}`;
                        else effText = `deal ${eff.amount || 1} damage to {TARGET}`; 
                        break;
                    case 'HEAL': 
                        if (eff.amount < 0) effText = `deal ${Math.abs(eff.amount)} damage to {TARGET}`;
                        else effText = `restore ${eff.amount || 1} health to {TARGET}`; 
                        break;
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
                        if (eff.stat === 'readiness') {
                            if (eff.amount <= -2) effText = `exhaust {TARGET}`;
                            else if (eff.amount === -1) effText = `unready {TARGET}`;
                            else if (eff.amount === 1) effText = `ready {TARGET}`;
                            else if (eff.amount >= 2) effText = `over-ready {TARGET}`;
                            else effText = `modify {POSS} readiness by ${eff.amount}`;
                        } else if (eff.stat === 'power') {
                            if (eff.amount < 0) effText = `cause {TARGET} to lose ${Math.abs(eff.amount)} power`;
                            else effText = `give {TARGET} ${eff.amount || 1} power`;
                        } else {
                            let modStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                            if (eff.amount < 0) effText = `reduce {POSS} ${modStat} by ${Math.abs(eff.amount)}`;
                            else effText = `increase {POSS} ${modStat} by ${eff.amount || 1}`;
                        }
                        break;
                    case 'MODIFY_RESOURCE': 
                        let resName = eff.resource || 'resource';
                        if (resName === 'maxCarnie') resName = 'Max Carnie';
                        else resName = resName.replace(/_/g, ' ');
                        if (eff.amount < 0) effText = `lose ${Math.abs(eff.amount)} ${resName}{PER_TARGET}`;
                        else effText = `gain ${eff.amount || 1} ${resName}{PER_TARGET}`;
                        break;
                    case 'SET_STAT': 
                        if (eff.stat === 'readiness') {
                            if (eff.amount <= -1) effText = `exhaust {TARGET}`;
                            else if (eff.amount === 0) effText = `unready {TARGET}`;
                            else if (eff.amount === 1) effText = `ready {TARGET}`;
                            else if (eff.amount >= 2) effText = `over-ready {TARGET}`;
                            else effText = `set {POSS} readiness to ${eff.amount}`;
                            break;
                        }
                        let setStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                        effText = `set {POSS} ${setStat} to ${eff.amount || 1}`; break;
                    case 'BLOCK_ACT': effText = `block {TARGET} from acting`; break;
                    case 'BLOCK_ATTACK': effText = `block {TARGET} from attacking`; break;
                    case 'BLOCK_RETALIATE': effText = `block {TARGET} from retaliating`; break;
                    case 'BLOCK_TARGETING': effText = `prevent enemies from targeting {TARGET}`; break;
                    case 'SHUFFLE': effText = `shuffle {TARGET} into deck`; break;
                    case 'RETURN': effText = `return {TARGET} to hand`; break;
                    case 'ATTACH': effText = eff.invertRoles ? `attach to {TARGET}` : `attach {TARGET} to this card`; break;
                    case 'ATTACH_TO': effText = eff.invertRoles ? `attach {TARGET} to this card` : `attach to {TARGET}`; break;
                    case 'UNATTACH': effText = `unattach {TARGET}`; break;
                    case 'FIELD': effText = `field {TARGET}`; break;
                    case 'BANISH': effText = `banish {TARGET}`; break;
                    case 'KILL': effText = `destroy {TARGET}`; break;
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
                    case 'REBEL': effText = eff.invertRoles ? `give control of this card to {TARGET}` : `take control of {TARGET}`; break;
                    case 'MODIFY_EVENT': 
                        let eventNoun = "effect's amount";
                        if (trigger.includes('DAMAGE') || trigger.includes('ATTACK')) eventNoun = "damage";
                        else if (trigger.includes('HEAL')) eventNoun = "healing";
                        
                        if (eff.stat === 'amount') {
                            effText = eff.amount < 0 ? `decrease the ${eventNoun} by ${Math.abs(eff.amount)}{OMIT_TARGET}` : `increase the ${eventNoun} by ${eff.amount}{OMIT_TARGET}`;
                        } else {
                            let statName = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                            effText = eff.amount < 0 ? `decrease the event's ${statName} by ${Math.abs(eff.amount)}{OMIT_TARGET}` : `increase the event's ${statName} by ${eff.amount}{OMIT_TARGET}`;
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
                        effText = `grant **${abilityName}** to {TARGET}`;
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
                                return npText;
                            });
                            let combinedNested = joinWithAnd(nestedPayloadsText);
                            
                            let targetMethod = eff.nestedGroup.targetMethod || 'AUTO_ALL';
                            let targetCount = eff.nestedGroup.targetCount || 1;
                            let subTargetText = '';
                            
                            if (targetMethod === 'AUTO_RANDOM') subTargetText = ` for ${targetCount} of them at random`;
                            else if (targetMethod === 'AUTO_FIRST') subTargetText = ` for the first ${targetCount} of them`;
                            else if (targetMethod === 'AUTO_LAST') subTargetText = ` for the last ${targetCount} of them`;
                            else if (targetMethod === 'AUTO_ALL' && !combinedNested.includes('them') && !combinedNested.includes('their')) subTargetText = ` for all of them`;
                            
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

                return effText;
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
                return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}`; // generic matching
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
                        return `**${abilityName}**`;
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
                        return `**${rmAbilityName}**`;
                    });
                    effText = `remove abilities ${joinWithAnd(abNames)} from {TARGET}`;
                } else if (first.type === 'MODIFY_STAT' && first.stat !== 'readiness') {
                    let isDecrease = first.amount < 0;
                    let changes = effs.map(eff => {
                         let modStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                         return `${Math.abs(eff.amount || 1)} ${modStat}`;
                    });
                    if (isDecrease) {
                        effText = `reduce {POSS} ${joinWithAnd(changes)}`;
                    } else {
                        effText = `increase {POSS} ${joinWithAnd(changes)}`;
                    }
                } else if (first.type === 'MODIFY_RESOURCE') {
                    let isSpend = first.amount < 0;
                    let changes = effs.map(eff => {
                         let resName = eff.resource || 'resource';
                         return `${Math.abs(eff.amount || 1)} ${resName}`;
                    });
                    if (isSpend) {
                        effText = `lose ${joinWithAnd(changes)}{PER_TARGET}`;
                    } else {
                        effText = `gain ${joinWithAnd(changes)}{PER_TARGET}`;
                    }
                } else if (first.type === 'SET_STAT' && first.stat !== 'readiness') {
                    let changes = effs.map(eff => {
                         let setStat = eff.stat === 'maxHealth' ? 'max health' : (eff.stat || 'stat');
                         return `${setStat} to ${eff.amount || 1}`;
                    });
                    effText = `set {POSS} ${joinWithAnd(changes)}`;
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

                return effText;
            };

            const finalizeString = (arr) => {
                if(arr.length === 0) return null;
                
                let processedArr = arr.map(str => {
                    let t, p;
                    if (['this card', 'it', 'the triggering card', 'the targeted card', 'the target', 'the defender', 'the attacker', 'the damaged character', 'the damage source', 'the healed character'].includes(targetStr)) {
                        t = groupMentioned ? 'it' : targetStr;
                        p = groupMentioned ? 'its' : possessiveStr;
                    } else if (targetStr === 'your avatar' || targetStr === 'the enemy avatar') {
                        t = groupMentioned ? 'it' : targetStr;
                        p = groupMentioned ? 'its' : possessiveStr;
                    } else {
                        let isPlural = targetStr.startsWith('all ') || targetStr.includes(' random ') || targetStr.includes(' first ') || targetStr.includes(' last ') || targetStr.endsWith('s');
                        t = groupMentioned ? (isPlural ? 'them' : 'it') : targetStr;
                        p = groupMentioned ? (isPlural ? 'their' : 'its') : possessiveStr;
                    }

                    if (str.includes('{OMIT_TARGET}')) {
                        groupMentioned = true;
                        str = str.replace('{OMIT_TARGET}', '');
                    }

                    if (str.includes('{PER_TARGET}')) {
                        groupMentioned = true;
                        if (['this card', 'it', 'the initiating card', 'the target', 'your avatar', 'the enemy avatar'].includes(targetStr) || targetStr.startsWith('a chosen')) {
                            str = str.replace('{PER_TARGET}', '');
                        } else if (group.targetMethod === 'AUTO_ALL') {
                            str = str.replace('{PER_TARGET}', ` for each ${singularDesc}`);
                        } else {
                            str = str.replace('{PER_TARGET}', ` for each of ${targetStr}`);
                        }
                    }

                    if (str.includes('{TARGET}') || str.includes('{POSS}')) {
                        groupMentioned = true;
                    }
                    
                    return str.replace(/\{POSS\}/g, p).replace(/\{TARGET\}/g, t);
                });

                let combined = joinWithAnd(processedArr);
                
                if (!groupMentioned && !combined.includes(targetStr) && !combined.includes('this card') && !combined.includes('its') && !combined.includes('their') && !combined.includes(possessiveStr) && !combined.includes('them') && !combined.includes('it')) {
                    if (combined.includes(' for each ')) {
                        combined = combined.replace(' for each ', ` to ${targetStr} for each `);
                    } else {
                        combined += ` to ${targetStr}`;
                    }
                    groupMentioned = true;
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

        if (allCostSentences.length > 0 && allEffectSentences.length > 0) {
             let combinedCosts = allCostSentences.join(' and ');
             combinedCosts = combinedCosts.charAt(0).toUpperCase() + combinedCosts.slice(1);
             let combinedEffects = allEffectSentences.join(', then ');
             descriptionParts.push(`${combinedCosts} to ${combinedEffects}.`);
        } else if (allCostSentences.length > 0) {
             let combinedCosts = allCostSentences.join(' and ');
             descriptionParts.push(combinedCosts + '.');
        } else if (allEffectSentences.length > 0) {
             descriptionParts.push(allEffectSentences.join(', then ') + '.');
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