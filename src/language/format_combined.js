/**
 * src/language/format_combined.js
 * Combines arrays of identical/similar payloads (like giving multiple stats) into single flowing sentences.
 */

import { resolveTokens } from './tokens.js';
import { joinWithAnd } from './utils.js';
import { formatPayload } from './format_payload.js';

export function formatCombinedPayloads(effs, formatCtx) {
    if (effs.length === 1) return formatPayload(effs[0], formatCtx);
    
    const first = effs[0];
    const { allAbilities, targetStr, trigger } = formatCtx;
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
            let paramSuffix = '';
            if (eff.grantedAbilityParamXIsX) paramSuffix = ' (X)';
            else if (eff.grantedAbilityParamX !== undefined && eff.grantedAbilityParamX !== null) paramSuffix = ` (${eff.grantedAbilityParamX})`;
            return `@[${abilityName}]${paramSuffix}`;
        });
        effText = `grant ${joinWithAnd(abNames)} to {TARGET}`;
        if (first.blockDuplicates) effText += ` (unique)`;
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
        effText = `remove ${joinWithAnd(abNames)} from {TARGET}`;
    } else if (first.type === 'MODIFY_STAT') {
        let changes = effs.map(eff => {
             let modStat = `[STAT:${eff.stat || 'stat'}]`;
             let sign = eff.amount > 0 && !eff.amountIsX ? '+' : '';
             let amtStr = eff.amountIsX ? 'X' : eff.amount;
             if (targetStr === 'this card' || targetStr === 'self') {
                 return `${modStat}${sign}${amtStr}`;
             }
             return `${sign}${amtStr} ${modStat}`;
        });
        if (targetStr === 'this card' || targetStr === 'self') {
            effText = `${joinWithAnd(changes)}{OMIT_TARGET}`;
        } else {
            effText = `give {TARGET} ${joinWithAnd(changes)}`;
        }
    } else if (first.type === 'MODIFY_RESOURCE') {
        let changes = effs.map(eff => {
             let resName = eff.resource || 'resource';
             let amtStr = eff.amountIsX ? 'X' : Math.abs(eff.amount);
             return `${amtStr} ${resName}`;
        });
        let isSpend = first.amount < 0;
        effText = `${isSpend ? 'lose' : 'gain'} ${joinWithAnd(changes)}{PER_TARGET}`;
    } else if (first.type === 'SET_STAT') {
        if (first.stat === 'line') {
            let changes = effs.map(eff => {
                 let amtStr = eff.amountIsX ? 'X' : eff.amount;
                 return `[ZONE:${amtStr}]`;
            });
            if (targetStr === 'this card' || targetStr === 'self' || targetStr === 'itself') {
                effText = `move to ${joinWithAnd(changes)}{OMIT_TARGET}`;
            } else {
                effText = `move {TARGET} to ${joinWithAnd(changes)}`;
            }
        } else {
            let changes = effs.map(eff => {
                 let setStat = `[STAT:${eff.stat || 'stat'}]`;
                 let amtStr = eff.amountIsX ? 'X' : eff.amount;
                 if (targetStr === 'this card' || targetStr === 'self') {
                     return `${setStat}=${amtStr}`;
                 }
                 return `${setStat} to ${amtStr}`;
            });
            if (targetStr === 'this card' || targetStr === 'self') {
                effText = `${joinWithAnd(changes)}{OMIT_TARGET}`;
            } else {
                effText = `set {POSS} ${joinWithAnd(changes)}`;
            }
        }
    } else if (['BLOCK_ACT', 'BLOCK_ATTACK', 'BLOCK_RETALIATE'].includes(first.type)) {
        let blockedActions = effs.map(eff => {
            if (eff.type === 'BLOCK_ACT') return 'act';
            if (eff.type === 'BLOCK_ATTACK') return 'attack';
            if (eff.type === 'BLOCK_RETALIATE') return 'retaliate';
            return '';
        }).filter(Boolean);
        effText = `prevent {TARGET} from ${blockedActions.map(a => a + 'ing').join(' and ')}`;
    } else {
        let formatted = effs.map(e => formatPayload(e, formatCtx));
        formatted = [...new Set(formatted)];
        let joined = '';
        if (formatted[0] === 'Instead') {
            joined = formatted.length > 1 ? formatted[0] + ', ' + formatted.slice(1).join(', then ') : formatted[0];
        } else {
            joined = formatted.join(', then ');
        }
        return joined;
    }
    
    if (first.invertRoles && !['ATTACH', 'ATTACH_TO', 'REBEL', 'DONATE'].includes(first.type)) {
        if (!['this card', 'it', 'the triggering card', 'the targeted card', 'the target'].includes(targetStr)) {
            let isPl = targetStr === 'them' || targetStr.startsWith('all ') || targetStr.includes(' random ') || targetStr.includes(' first ') || targetStr.includes(' last ') || targetStr.endsWith('s');
            let reflexive = isPl ? 'themselves' : 'itself';
            let reflexivePoss = isPl ? 'their own' : 'its own';
            effText = `force {TARGET} to ${effText.replace(/\{TARGET\}/g, reflexive).replace(/\{POSS\}/g, reflexivePoss)}`;
        }
    }

    let adverb = '';
    let suffix = '';
    let isCustomMovement = (first.type === 'SET_STAT' && first.stat === 'line');
    
    if (first.duration && first.duration !== 'INSTANT' && first.duration !== 'INDEFINITE') {
        if (first.duration === 'WHILE_ATTACHED') {
            if (trigger !== 'ON_BE_ATTACHED') suffix = ' while attached';
        } else if (first.duration === 'ACTION') {
            if (isCustomMovement) suffix = ' this action'; else suffix = ' for the current action';
        } else if (first.duration === 'TEMPORARY') {
            if (isCustomMovement) suffix = ' this round'; else adverb = 'temporarily ';
        } else if (first.duration === 'BRIEF') {
            if (isCustomMovement) suffix = ' this turn'; else adverb = 'briefly ';
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

    let resolved = resolveTokens(effText, formatCtx);
    if (resolved) {
        resolved = resolved.charAt(0).toUpperCase() + resolved.slice(1);
    }
    return resolved;
}