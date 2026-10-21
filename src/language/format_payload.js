/**
 * src/language/format_payload.js
 * Converts raw JSON payloads (single or grouped) into natural language strings.
 * Consolidates lookups, pronoun resolution, and modifier suffixes.
 */

import { resolveTokens } from './tokens.js';
import { joinWithAnd, formatResourceIcons, resolveEntityName, getIndefiniteArticle, resolveAbility, resolveTribeName, formatXValue } from './utils.js';
import { generateLogicTreeText } from './triggers.js';

const v = (verb) => `<v>${verb}</v>`;

const lowerFirst = (str) => {
    if (!str) return str;
    return str.replace(/^((?:<[^>]+>|\[[^\]]+\]|@\[[^\]]+\]|[^a-zA-Z])*)([a-zA-Z])/, (m, prefix, letter) => prefix + letter.toLowerCase());
};

// --- Helper for Modifiers & Suffixes ---

export function getConditionText(logicTree, formatCtx = null) {
    if (!logicTree || !logicTree.children || logicTree.children.length === 0) {
        return 'a condition is met';
    }

    const text = generateLogicTreeText(logicTree, formatCtx?.trigger, formatCtx?.allTribes, formatCtx?.allAbilities, formatCtx?.paramX);
    return text || 'a condition is met';
}

function applyPayloadModifiers(effText, eff, formatCtx) {
    const { targetStr, trigger, group } = formatCtx;

    if (eff.invertRoles && !['ATTACH', 'ATTACH_TO', 'REBEL', 'DONATE'].includes(eff.type)) {
        if (!['this', 'it', 'the triggering card', 'the targeted card', 'the target'].includes(targetStr)) {
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
            let hasAttach = group && group.payloads && group.payloads.some(p => p.type === 'ATTACH');
            if (trigger !== 'ON_BE_ATTACHED' && !hasAttach) suffix = ' while attached';
        } else if (eff.duration === 'ACTION') {
            if (isCustomMovement) suffix = ' this action'; else suffix = ' for the current action';
        } else if (eff.duration === 'TEMPORARY') {
            suffix = ' this round';
        } else if (eff.duration === 'BRIEF') {
            suffix = ' this turn';
        } else if (eff.duration === 'PERMANENT') {
            adverb = 'permanently ';
        }
    }

    if (adverb) {
        if (effText.endsWith(' instead')) {
            effText = effText.replace(' instead', '');
            effText = adverb + effText + ' instead';
        } else if (effText.endsWith(' instead{OMIT_TARGET}')) {
            effText = effText.replace(' instead{OMIT_TARGET}', '');
            effText = adverb + effText + ' instead{OMIT_TARGET}';
        } else if (effText.startsWith('force {TARGET} to ')) {
            effText = effText.replace('force {TARGET} to ', `force {TARGET} to ${adverb}`);
        } else if (effText.startsWith('<v>')) {
            effText = adverb + effText;
        } else {
            effText = adverb + effText;
        }
    }

    if (suffix) {
        if (effText.endsWith(' instead')) {
            effText = effText.replace(' instead', suffix + ' instead');
        } else if (effText.endsWith(' instead{OMIT_TARGET}')) {
            effText = effText.replace(' instead{OMIT_TARGET}', suffix + ' instead{OMIT_TARGET}');
        } else {
            effText += suffix;
        }
    }

    let resolved = resolveTokens(effText, formatCtx);
    return resolved;
}

// --- Structural Helper for Targeted Grammar ---
function applyTargetedAction(actionType, valueStr, formatCtx, duration) {
    const { targetStr, isPlural } = formatCtx;
    const isSelf = targetStr === 'this' || targetStr === 'self' || targetStr === 'itself';
    const isSimpleSubject = ['it', 'them', 'host'].includes(targetStr);
    const isComplex = targetStr.includes(' with ') || targetStr.includes(' that ') || targetStr.includes(' where ') || targetStr.includes(' in ') || targetStr.includes(' on ');

    if (actionType === 'GAIN_STAT') {
        if (isSelf) return `${v('gain')} ${valueStr}{OMIT_TARGET}`;
        if (duration === 'WHILE_ATTACHED' || isSimpleSubject) return `{TARGET} ${v(isPlural ? 'gain' : 'gains')} ${valueStr}`;
        if (isComplex) return `${v('give')} ${valueStr} to {TARGET}`;
        return `${v('give')} {TARGET} ${valueStr}`;
    } else if (actionType === 'LOSE_STAT') {
        if (isSelf) return `${v('lose')} ${valueStr}{OMIT_TARGET}`;
        if (duration === 'WHILE_ATTACHED' || isSimpleSubject) return `{TARGET} ${v(isPlural ? 'lose' : 'loses')} ${valueStr}`;
        // Fix: Use an imperative verb so it seamlessly attaches to "Pay X to..."
        return `force {TARGET} to ${v('lose')} ${valueStr}`;
    } else if (actionType === 'SET_STAT') {
        if (isSelf) return `${v('set')} ${valueStr}{OMIT_TARGET}`;
        if (targetStr === 'them' || targetStr === 'it') return `${v('set')} {POSS} ${valueStr}`;
        return `${v('set')} the ${valueStr.replace(' to ', ' of {TARGET} to ')}`;
    }
    return `${v(actionType.toLowerCase())} {TARGET}`;
}

function getDestinationText(zone, zoneOwner, verb) {
    let z = (zone || 'FIELD').toLowerCase();
    let isCaster = (!zoneOwner || zoneOwner === 'CASTER');
    let zoneNoun = z;
    if (z === 'discard') zoneNoun = 'discard pile';
    else if (z === 'banish') zoneNoun = 'banish zone';
    else if (z === 'original_deck') zoneNoun = 'original deck';

    let prep = verb === 'shuffle' ? 'into' : 'to';
    if (z === 'banish') return ` ${prep} the banish zone`;

    if (z === 'field') {
        if (isCaster && verb === 'summon') return '';
        return ` ${prep} ${isCaster ? 'the' : '{POSS}'} field`;
    }

    let prefix = isCaster ? 'your' : '{POSS}';
    return ` ${prep} ${prefix} ${zoneNoun}`;
}

function getReadinessState(amount, type) {
    if (type === 'MODIFY_STAT') {
        if (amount <= -2) return { verb: 'exhaust', adj: 'exhausted ' };
        if (amount === -1) return { verb: 'unready', adj: 'unready ' };
        if (amount === 1) return { verb: 'ready', adj: 'ready ' };
        if (amount >= 2) return { verb: 'over-ready', adj: 'over-ready ' };
    } else { // SET_STAT
        if (amount <= -1) return { verb: 'exhaust', adj: 'exhausted ' };
        if (amount === 0) return { verb: 'unready', adj: 'unready ' };
        if (amount === 1) return { verb: 'ready', adj: 'ready ' };
        if (amount >= 2) return { verb: 'over-ready', adj: 'over-ready ' };
    }
    return null;
}

// --- Main Formatting Exports ---

export function formatPayload(eff, formatCtx) {
    const { group, allTribes, allAbilities, allCards, targetStr, isPlural, paramX } = formatCtx;
    let effText = '';
    const xDisplay = formatXValue(paramX);

    switch (eff.type) {
        case 'DEAL_DAMAGE':
            if (eff.amountIsX) effText = `${v('deal')} ${xDisplay} damage to {TARGET}`;
            else if (eff.amount < 0) effText = `${v('heal')} {TARGET} for ${Math.abs(eff.amount)}`;
            else effText = `${v('deal')} ${eff.amount !== undefined ? eff.amount : 1} damage to {TARGET}`;
            break;
        case 'HEAL':
            const healVerb = eff.overheal ? 'overheal' : 'heal';
            if (eff.amountIsX) effText = `${v(healVerb)} {TARGET} for ${xDisplay}`;
            else if (eff.amount < 0) effText = `${v('deal')} ${Math.abs(eff.amount)} damage to {TARGET}`;
            else effText = `${v(healVerb)} {TARGET} for ${eff.amount !== undefined ? eff.amount : 1}`;
            break;
        case 'TOP_DECK':
            let tdAmt = eff.amountIsX ? xDisplay : (eff.amount !== undefined ? eff.amount : 1);
            let tdWord = eff.amountIsX ? `${xDisplay} cards` : (tdAmt === 1 ? 'a card' : `${tdAmt} cards`);
            effText = `${v('draw')} ${tdWord}{OMIT_TARGET}{PER_TARGET}`;
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

                if (eff.amountIsX) effText = `${v('draw')} ${xDisplay} ${typeStr}s{OMIT_TARGET}`;
                else effText = `${v('draw')} ${drawAmt === 1 ? getIndefiniteArticle(typeStr) + ' ' + typeStr : drawAmt + ' ' + (typeStr === 'equipment' ? typeStr : typeStr + 's')}{OMIT_TARGET}`;
            } else {
                effText = `${v('draw')} {TARGET}`;
            }
            break;
        case 'DISCARD':
        case 'DISCARD_CARD':
            effText = `${v('discard')} {TARGET}`;
            break;
        case 'MILL':
            if (eff.amountIsX) effText = `${v('mill')} ${xDisplay} cards{OMIT_TARGET}`;
            else if (eff.amount > 1) effText = `${v('mill')} ${eff.amount} cards{OMIT_TARGET}`;
            else effText = `${v('mill')} {TARGET}`;
            break;
        case 'TRASH':
            effText = `${v('trash')} {TARGET}`;
            break;
        case 'HARVEST':
            if (eff.amount) {
                let resName = (eff.resource) ? eff.resource : 'Carnie';
                let iconString = formatResourceIcons(Math.abs(eff.amount), resName, eff.amountIsX);
                if (eff.amountIsX && paramX !== null && paramX !== undefined && !isNaN(Number(paramX))) {
                    iconString = iconString.replace(/^X\b/, `X (${paramX})`);
                }
                effText = `${v('harvest')} {TARGET} for ${iconString}`;
            } else {
                effText = `${v('harvest')} {TARGET}`;
            }
            break;
        case 'RECOVER': effText = `${v('recover')} {TARGET}`; break;
        case 'REVIVE': effText = `${v('revive')} {TARGET}`; break;
        case 'MODIFY_STAT':
            let modStat = `[STAT:${eff.stat || 'stat'}]`;
            let isNeg = !eff.amountIsX && Number(eff.amount) < 0;
            let absAmtStr = eff.amountIsX ? xDisplay : Math.abs(eff.amount);
            let amtStr = eff.amountIsX ? xDisplay : eff.amount;

            let valStr = `${isNeg ? absAmtStr : amtStr} ${modStat}`;
            effText = applyTargetedAction(isNeg ? 'LOSE_STAT' : 'GAIN_STAT', valStr, formatCtx, eff.duration);
            break;
        case 'MODIFY_RESOURCE':
            let resName2 = resolveTribeName(eff.resource, allTribes);
            let iconString2 = formatResourceIcons(Math.abs(eff.amount !== undefined ? eff.amount : 1), resName2, eff.amountIsX);
            if (eff.amountIsX && paramX !== null && paramX !== undefined && !isNaN(Number(paramX))) {
                iconString2 = iconString2.replace(/^X\b/, `X (${paramX})`);
            }

            if (eff.amount < 0) {
                effText = `${v('lose')} ${iconString2}{PER_TARGET}`;
            } else {
                effText = `${v('gain')} ${iconString2}{PER_TARGET}`;
            }
            break;
        case 'SET_STAT':
            let setAmtStr = eff.amountIsX ? xDisplay : eff.amount;
            if (eff.stat === 'line') {
                if (targetStr === 'this' || targetStr === 'self' || targetStr === 'itself') {
                    effText = `[BATTLELINE:${setAmtStr}]{OMIT_TARGET}`;
                } else {
                    effText = `[BATTLELINE:${setAmtStr}] {TARGET}`;
                }
            } else if (eff.stat === 'readiness' && !eff.amountIsX) {
                let rState = getReadinessState(eff.amount, 'SET_STAT');
                if (rState) effText = `${v(rState.verb)} {TARGET}`;
            } else {
                let setStat = `[STAT:${eff.stat || 'stat'}]`;
                effText = applyTargetedAction('SET_STAT', `${setStat} to ${setAmtStr}`, formatCtx, eff.duration);
            }
            break;
        case 'BLOCK_ACT': effText = `${v('stun')} {TARGET}`; break;
        case 'BLOCK_ATTACK': effText = `${v('pacify')} {TARGET}`; break;
        case 'BLOCK_RETALIATE': effText = `${v('daze')} {TARGET}`; break;
        case 'BLOCK_TARGETING': effText = `${v('stealth')} {TARGET}`; break;
        case 'SHUFFLE': effText = `${v('shuffle')} {TARGET} into the deck`; break;
        case 'RETURN': effText = `${v('return')} {TARGET}`; break;
        case 'ATTACH': effText = eff.invertRoles ? `${v('attach')} to {TARGET}` : `${v('attach')} {TARGET} to {SELF}`; break;
        case 'UNATTACH': effText = `${v('unattach')} {TARGET}`; break;
        case 'FIELD': effText = `${v('field')} {TARGET}`; break;
        case 'BANISH': effText = `${v('banish')} {TARGET}`; break;
        case 'KILL': effText = `${v('kill')} {TARGET}`; break;
        case 'ATTACK': effText = `${v('attack')} {TARGET}`; break;
        case 'CANCEL_EVENT': effText = `${v('cancel')} that effect{OMIT_TARGET}`; break;
        case 'CLEANSE': effText = `${v('cleanse')} temporary effects from {TARGET}`; break;
        case 'CHANGE_DESTINATION':
            effText = `${v('move')} {TARGET}${getDestinationText(eff.zone, eff.zoneOwner, 'move')}`;
            let targetDest = (eff.zone || 'DECK').toUpperCase();
            if (targetDest === 'FIELD') effText = `${v('field')} {TARGET}`;
            else if (targetDest === 'HAND') effText = `${v('return')} {TARGET}${getDestinationText(eff.zone, eff.zoneOwner, 'return')}`;
            else if (targetDest === 'DISCARD') effText = `${v('discard')} {TARGET}`;
            else if (targetDest === 'DECK' || targetDest === 'ORIGINAL_DECK') effText = `${v('shuffle')} {TARGET}${getDestinationText(eff.zone, eff.zoneOwner, 'shuffle')}`;
            else if (targetDest === 'BANISH') effText = `${v('banish')} {TARGET}`;
            break;
        case 'REBEL': effText = eff.invertRoles ? `${v('give')} control of this card to {TARGET}` : `${v('control')} {TARGET}`; break;
        case 'DONATE': effText = `${v('donate')} {TARGET}`; break;
        case 'MODIFY_EVENT':
            let amountNoun = "the effect's amount";
            if (formatCtx.trigger) {
                if (formatCtx.trigger.includes('DAMAGE') || formatCtx.trigger.includes('HIT') || formatCtx.trigger.includes('ATTACK')) amountNoun = "damage";
                else if (formatCtx.trigger.includes('HEAL')) amountNoun = "healing";
                else if (formatCtx.trigger.includes('DRAW')) amountNoun = "cards drawn";
                else if (formatCtx.trigger.includes('DISCARD')) amountNoun = "cards discarded";
            }

            if (eff.stat === 'amount') {
                if (eff.amountIsX) effText = `${v('modify')} ${amountNoun} by ${xDisplay}{OMIT_TARGET}`;
                else effText = eff.amount < 0 ? `${v('decrease')} ${amountNoun} by ${Math.abs(eff.amount)}{OMIT_TARGET}` : `${v('increase')} ${amountNoun} by ${eff.amount}{OMIT_TARGET}`;
            } else {
                let statName = `[STAT:${eff.stat || 'stat'}]`;
                if (eff.amountIsX) effText = `${v('modify')} ${statName} by ${xDisplay}{OMIT_TARGET}`;
                else effText = eff.amount < 0 ? `${v('modify')} ${statName} by ${eff.amount}{OMIT_TARGET}` : `${v('modify')} ${statName} by +${eff.amount}{OMIT_TARGET}`;
            }
            break;
        case 'CUSTOM_SCRIPT':
            if (eff.description) {
                let desc = eff.description;
                if (paramX !== null && paramX !== undefined && !isNaN(Number(paramX))) {
                    desc = desc.replace(/\bX\b/g, xDisplay);
                }
                effText = desc + '{OMIT_TARGET}';
            } else {
                effText = `${v('execute')} script on {TARGET}`;
            }
            break;
        case 'GRANT_ABILITY':
            let { name: abilityName, isManual } = resolveAbility(eff.grantedAbilityId, allAbilities);
            let grantVerb = isManual ? 'grant' : 'apply';
            let paramSuffix = '';
            if (eff.grantedAbilityParamXIsX) {
                paramSuffix = ` (${xDisplay})`;
            } else if (eff.grantedAbilityParamX !== undefined && eff.grantedAbilityParamX !== null) {
                paramSuffix = ` (${eff.grantedAbilityParamX})`;
            }

            let isSelf_GA = targetStr === 'this' || targetStr === 'self' || targetStr === 'itself';
            let isSimpleSubject_GA = ['it', 'them', 'host'].includes(targetStr);

            if (isSelf_GA) {
                effText = `${v('gain')} @[${abilityName}]${paramSuffix}{OMIT_TARGET}`;
            } else if (eff.duration === 'WHILE_ATTACHED' || isSimpleSubject_GA) {
                effText = `{TARGET} ${v(isPlural ? 'gain' : 'gains')} @[${abilityName}]${paramSuffix}`;
            } else {
                effText = `${v(grantVerb)} @[${abilityName}]${paramSuffix} to {TARGET}`;
            }
            if (eff.blockDuplicates) effText += ` (unique)`;
            break;
        case 'TRANSFORM':
            let transCardName = resolveEntityName(eff.cardId, allCards);
            let isSelfTarget = ['this', 'it', 'the triggering card', 'self', 'itself'].includes(targetStr);

            if (isPlural) {
                let isTransPlural = transCardName.toLowerCase().endsWith('s]') || transCardName.toLowerCase().endsWith('s');
                let pluralSuffix = isTransPlural ? '' : 's';
                if (isSelfTarget) {
                    effText = `${v('transform')} into ${transCardName}${pluralSuffix}{OMIT_TARGET}`;
                } else {
                    effText = `${v('transform')} {TARGET} into ${transCardName}${pluralSuffix}`;
                }
            } else {
                let article = getIndefiniteArticle(transCardName);
                if (isSelfTarget) {
                    effText = `${v('transform')} into ${article} ${transCardName}{OMIT_TARGET}`;
                } else {
                    effText = `${v('transform')} {TARGET} into ${article} ${transCardName}`;
                }
            }
            break;
        case 'REMOVE_ABILITY':
            let rmAbilityName = resolveAbility(eff.grantedAbilityId, allAbilities).name;
            effText = `${v('remove')} **${rmAbilityName}** from {TARGET}`;
            break;
        case 'SUMMON':
            let cardName = resolveEntityName(eff.cardId, allCards);
            const summonAmt = Math.max(1, Math.abs(eff.amount || 1));
            const isSummonPlural = cardName.toLowerCase().endsWith('s]') || cardName.toLowerCase().endsWith('s');
            const pluralSuffix = (summonAmt > 1 && !isSummonPlural) ? 's' : '';

            let destZone = (eff.zone || 'FIELD').toLowerCase();
            let isCasterZone = (!eff.zoneOwner || eff.zoneOwner === 'CASTER');

            let readinessAdj = '';
            let lineAdj = '';
            let remainingNestedPayloads = [];

            if (eff.nestedGroup && eff.nestedGroup.payloads && eff.nestedGroup.payloads.length > 0) {
                eff.nestedGroup.payloads.forEach(np => {
                    if ((np.type === 'MODIFY_STAT' || np.type === 'SET_STAT') && np.stat === 'readiness' && !np.amountIsX) {
                        let rState = getReadinessState(np.amount, np.type);
                        if (rState) readinessAdj = rState.adj;
                        else remainingNestedPayloads.push(np);
                    } else if (np.type === 'SET_STAT' && np.stat === 'line') {
                        lineAdj = `${np.amount} `;
                    } else {
                        remainingNestedPayloads.push(np);
                    }
                });
            }

            let amtText = eff.amountIsX ? xDisplay : summonAmt;
            if (!eff.amountIsX && summonAmt === 1) {
                const nextWord = readinessAdj || lineAdj || cardName;
                let testWord = nextWord;
                if (nextWord === lineAdj) {
                    testWord = lineAdj.trim();
                }
                amtText = getIndefiniteArticle(testWord);
            }

            effText = `${v('summon')} ${amtText} ${readinessAdj}${lineAdj}${cardName}${pluralSuffix}{OMIT_TARGET}${getDestinationText(eff.zone, eff.zoneOwner, 'summon')}`;

            if (remainingNestedPayloads.length > 0) {
                let tempTargetStr = formatCtx.targetStr;
                let tempGroupId = formatCtx.groupId;

                formatCtx.targetStr = 'them';
                formatCtx.groupId = 'summon_nested';

                let nestedPayloadsText = remainingNestedPayloads.map(np => {
                    let npText = formatPayload(np, formatCtx);
                    if (npText) npText = lowerFirst(npText);
                    npText = npText.replace(/\{TARGET\}/g, 'them').replace(/\{POSS\}/g, 'their').replace(/\{OMIT_TARGET\}/g, '');
                    if (np.type === 'ATTACH' && tempTargetStr === 'self') {
                        npText = npText.replace(`${v('attach')} them to self`, `${v('attach')} them to it`);
                        npText = npText.replace(`${v('attach')} it to self`, `${v('attach')} it to it`);
                    }
                    return npText;
                });

                formatCtx.targetStr = tempTargetStr;
                formatCtx.groupId = tempGroupId;

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
        case 'CONDITIONAL':
        case 'EVENT_CONDITIONAL':
            const conditionStr = getConditionText(eff.nestedGroup?.logicTree, formatCtx);
            effText = `if ${conditionStr}, ${eff.nestedGroup?.payloads?.map(np => formatPayload(np, formatCtx).replace(/\{OMIT_TARGET\}/g, '')).filter(Boolean).join(' and ') || 'do nothing'}`;
            break;
        // Simple verbs cleanly fallback here (e.g. DISCARD, TRASH, MILL, BANISH, KILL, RECOVER, REVIVE, FIELD, UNATTACH, ATTACK, DONATE)
        default:
            let readableType = eff.type.replace(/_/g, ' ').toLowerCase();
            effText = `${v(readableType)} {TARGET}`;
    }

    return applyPayloadModifiers(effText, eff, formatCtx);
}

export function formatCombinedPayloads(effs, formatCtx) {
    if (effs.length === 1) return formatPayload(effs[0], formatCtx);

    const first = effs[0];
    const { allAbilities, allTribes, targetStr, isPlural } = formatCtx;
    let effText = '';

    if (first.type === 'GRANT_ABILITY') {
        let hasManual = false;
        let abNames = effs.map(eff => {
            let { name, isManual } = resolveAbility(eff.grantedAbilityId, allAbilities);
            if (isManual) hasManual = true;
            let paramSuffix = eff.grantedAbilityParamXIsX ? ' (X)' : (eff.grantedAbilityParamX !== undefined && eff.grantedAbilityParamX !== null ? ` (${eff.grantedAbilityParamX})` : '');
            return `@[${name}]${paramSuffix}`;
        });

        let grantVerb = hasManual ? 'grant' : 'apply';
        let isSelf_GA = targetStr === 'this' || targetStr === 'self' || targetStr === 'itself';
        let isSimpleSubject_GA = ['it', 'them', 'host'].includes(targetStr);

        if (isSelf_GA) {
            effText = `${v('gain')} ${joinWithAnd(abNames)}{OMIT_TARGET}`;
        } else if (first.duration === 'WHILE_ATTACHED' || isSimpleSubject_GA) {
            effText = `{TARGET} ${v(isPlural ? 'gain' : 'gains')} ${joinWithAnd(abNames)}`;
        } else {
            effText = `${v(grantVerb)} ${joinWithAnd(abNames)} to {TARGET}`;
        }
        if (first.blockDuplicates) effText += ` (unique)`;

    } else if (first.type === 'REMOVE_ABILITY') {
        let abNames = effs.map(eff => `**${resolveAbility(eff.grantedAbilityId, allAbilities).name}**`);
        effText = `${v('remove')} ${joinWithAnd(abNames)} from {TARGET}`;

    } else if (first.type === 'MODIFY_STAT') {
        let isNeg = !first.amountIsX && Number(first.amount) < 0;
        let changes = effs.map(eff => {
            let modStat = `[STAT:${eff.stat || 'stat'}]`;
            let amtVal = eff.amountIsX ? 'X' : (isNeg ? Math.abs(eff.amount) : eff.amount);
            return `${amtVal} ${modStat}`;
        });

        let valStr = joinWithAnd(changes);
        effText = applyTargetedAction(isNeg ? 'LOSE_STAT' : 'GAIN_STAT', valStr, formatCtx, first.duration);

    } else if (first.type === 'MODIFY_RESOURCE') {
        let changes = effs.map(eff => {
            let resName = resolveTribeName(eff.resource, allTribes);
            let amount = eff.amount !== undefined ? Math.abs(eff.amount) : 1;
            return formatResourceIcons(amount, resName, eff.amountIsX);
        });
        let isSpend = first.amount < 0;
        effText = `${v(isSpend ? 'lose' : 'gain')} ${joinWithAnd(changes)}{PER_TARGET}`;

    } else if (first.type === 'SET_STAT') {
        if (first.stat === 'readiness' && !first.amountIsX) {
            let rState = getReadinessState(first.amount, 'SET_STAT');
            if (rState) effText = `${v(rState.verb)} {TARGET}`;
        } else if (first.stat === 'line') {
            let changes = effs.map(eff => {
                let amtStr = eff.amountIsX ? 'X' : eff.amount;
                return `[BATTLELINE:${amtStr}]`;
            });
            if (targetStr === 'this' || targetStr === 'self' || targetStr === 'itself') {
                effText = `${joinWithAnd(changes)}{OMIT_TARGET}`;
            } else {
                effText = `${joinWithAnd(changes)} {TARGET}`;
            }
        } else {
            let changes = effs.map(eff => {
                let setStat = `[STAT:${eff.stat || 'stat'}]`;
                let amtStr = eff.amountIsX ? 'X' : eff.amount;
                return `${setStat} to ${amtStr}`;
            });

            let valStr = joinWithAnd(changes);
            effText = applyTargetedAction('SET_STAT', valStr, formatCtx, first.duration);
        }

    } else if (['BLOCK_ACT', 'BLOCK_ATTACK', 'BLOCK_RETALIATE'].includes(first.type)) {
        let blockedActions = effs.map(eff => {
            if (eff.type === 'BLOCK_ACT') return 'act';
            if (eff.type === 'BLOCK_ATTACK') return 'attack';
            if (eff.type === 'BLOCK_RETALIATE') return 'retaliate';
            return '';
        }).filter(Boolean);
        effText = `${v('prevent')} {TARGET} from ${blockedActions.map(a => a + 'ing').join(' and ')}`;

    } else {
        // If it's a grouped list of unmatched verbs, process them individually and join them
        let formatted = effs.map(e => formatPayload(e, formatCtx));
        formatted = [...new Set(formatted)];
        let joined = '';

        let parts = formatted.map((f, i) => i > 0 && f !== 'Instead' ? lowerFirst(f) : f);

        if (parts[0] === 'Instead') {
            if (parts.length === 1) joined = parts[0];
            else if (parts.length === 2) joined = parts[0] + ', ' + parts[1];
            else {
                const last = parts.pop();
                joined = parts[0] + ', ' + parts.slice(1).join(', ') + ', then ' + last;
            }
        } else {
            if (parts.length === 1) joined = parts[0];
            else if (parts.length === 2) joined = parts[0] + ', then ' + parts[1];
            else {
                const last = parts.pop();
                joined = parts.join(', ') + ', then ' + last;
            }
        }
        return joined; // Returns early because formatPayload recursively handled modifiers
    }

    return applyPayloadModifiers(effText, first, formatCtx);
}