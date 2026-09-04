/**
 * src/language/grouping.js
 * Sorts and chunks payloads by Similarity Key so they can be merged linguistically.
 */

import { formatCombinedPayloads } from './format_payload.js';
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
    
    // Deduplicate common trailing duration/condition modifiers
    if (arr.length > 1) {
        const suffixes = [' this turn', ' this round', ' for the current action', ' this action', ' while attached'];
        for (const suffix of suffixes) {
            // Check for the suffix at the end of the string, preserving any trailing format tokens
            const regexStr = `${suffix}((?: instead)?(?:\\{OMIT_TARGET\\})?(?:\\{PER_TARGET\\})?)$`;
            const regex = new RegExp(regexStr);
            
            const allHaveSuffix = arr.every(s => regex.test(s));
            
            if (allHaveSuffix) {
                arr = arr.map((s, idx) => {
                    if (idx === arr.length - 1) return s; // Keep the suffix on the final item
                    return s.replace(regex, '$1'); // Strip it from the others but keep format tokens
                });
            }
        }
    }
    
    let combined = '';
    if (isCost) {
        combined = joinWithAnd(arr);
    } else {
        let parts = arr.map((f, i) => i > 0 && f !== 'Instead' ? f.charAt(0).toLowerCase() + f.slice(1) : f);

        if (parts[0] === 'Instead') {
            if (parts.length === 1) combined = parts[0];
            else if (parts.length === 2) combined = parts[0] + ', ' + parts[1];
            else {
                const last = parts.pop();
                combined = parts[0] + ', ' + parts.slice(1).join(', ') + ', then ' + last;
            }
        } else {
            if (parts.length === 1) combined = parts[0];
            else if (parts.length === 2) combined = parts[0] + ', then ' + parts[1];
            else {
                const last = parts.pop();
                combined = parts.join(', ') + ', then ' + last;
            }
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