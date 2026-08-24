/**
 * src/language/grouping.js
 * Sorts and chunks payloads by Similarity Key so they can be merged linguistically.
 */

import { formatCombinedPayloads } from './format_combined.js';
import { joinWithAnd } from './utils.js';

export function getSimilarityKey(eff) {
    if ((eff.type === 'MODIFY_STAT' || eff.type === 'SET_STAT') && eff.stat === 'readiness') {
        return `READINESS_${eff.type}_${eff.amountIsX ? 'X' : eff.amount}_${eff.duration}_${eff.invertRoles}_${eff.isCost}`;
    }
    if (['GRANT_ABILITY', 'REMOVE_ABILITY', 'SET_STAT'].includes(eff.type)) {
        return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}_${eff.blockDuplicates}`;
    }
    if (eff.type === 'MODIFY_STAT') {
        return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}_${eff.amountIsX ? 'X' : Math.sign(eff.amount)}`;
    }
    if (eff.type === 'MODIFY_RESOURCE') {
        return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}_${eff.amountIsX ? 'X' : Math.sign(eff.amount)}`;
    }
    if (['BLOCK_ACT', 'BLOCK_ATTACK', 'BLOCK_RETALIATE'].includes(eff.type)) {
        return `BLOCKS_${eff.duration}_${eff.invertRoles}_${eff.isCost}`;
    }
    return `${eff.type}_${eff.duration}_${eff.invertRoles}_${eff.isCost}`;
}

export function groupPayloads(payloadsToGroup, formatCtx) {
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
    return result.map(effs => formatCombinedPayloads(effs, formatCtx));
}

export function finalizeString(arr, isCost, formatCtx) {
    const { tracker, groupId, targetStr, isPlural } = formatCtx;
    if(arr.length === 0) return null;
    
    let combined = '';
    if (isCost) {
        combined = joinWithAnd(arr);
    } else {
        if (arr[0] === 'Instead') {
            combined = arr.length > 1 ? arr[0] + ', ' + arr.slice(1).join(', then ') : arr[0];
        } else {
            combined = arr.join(', then ');
        }
    }
    
    if (!tracker.hasMentioned(groupId)) {
        if (combined.includes(' for each ')) {
            combined = combined.replace(' for each ', ` to ${tracker.mention(groupId, targetStr, isPlural)} for each `);
        } else if (combined !== 'Instead') {
            combined += ` to ${tracker.mention(groupId, targetStr, isPlural)}`;
        }
    }
    return combined;
}