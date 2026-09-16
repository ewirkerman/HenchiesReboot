/**
 * src/language_description.js
 * The Main Orchestrator for the Language Generator Pipeline.
 * Preserves the exact export signature to avoid breaking external imports.
 */

import { ReferenceTracker } from './language/utils.js';
import { parseTriggers } from './language/triggers.js';
import { processTargetGroups } from './language/payloads.js';
import anExclusions from './language/an_exclusions.js';

export function generateAbilityDescription(ability, allAbilities = null, allCards = null, allTribes = null) {
    if (ability.description && ability.description.trim() !== '') {
        return ability.description;
    }

    const tracker = new ReferenceTracker();
    let parts = [];

    // 1. PASSIVE FLAGS (Shortened)
    const flags = ability.passiveFlags || [];
    if (flags.includes('STRIKE_FAST')) parts.push("Fast.");
    if (flags.includes('STRIKE_SLOW')) parts.push("Slow.");
    if (flags.includes('BLOCK_ACT')) parts.push("Can't act.");
    if (flags.includes('BLOCK_ATTACK')) parts.push("Can't attack.");
    if (flags.includes('BLOCK_RETALIATE')) parts.push("Can't retaliate.");
    if (flags.includes('BLOCK_TARGETING')) parts.push("Stealth.");
    if (flags.includes('IGNORE_BLOCK_TARGETING')) parts.push("Pierce.");
    if (flags.includes('BLOCK_TARGET_AVATAR')) parts.push("Timid.");

    // 2. TRIGGER & CONDITIONS
    const { triggerText, globalTargetNoun, conditionsText } = parseTriggers(ability, allTribes);
    
    let header = '';
    if (triggerText) header += `**${triggerText}** `;
    if (conditionsText) header += `If ${conditionsText}, `;

    // 3. EFFECTS & COSTS
    const targetGroups = ability.effects || [];
    if (targetGroups.length === 0) {
        if (ability.trigger !== 'UNTRIGGERABLE') parts.push(header + "do nothing.");
    } else {
        const ctx = {
            allAbilities,
            allCards,
            allTribes,
            globalTargetNoun,
            tracker,
            trigger: ability.trigger || 'MANUAL'
        };
        
        const { allCostSentences, allEffectSentences } = processTargetGroups(ability, ctx);
        
        let sentence = header;

        if (allCostSentences.length > 0) {
             sentence += allCostSentences.join(' and ') + ' to ';
        }

        if (sentence !== '' && !sentence.endsWith(' ') && allEffectSentences.length > 0) {
            sentence += ' ';
        }

        if (allEffectSentences.length > 0) {
             let effectsStr = allEffectSentences.join(', then ');
             sentence += effectsStr + '.';
        } else if (allCostSentences.length > 0) {
             sentence = sentence.trim();
             if (sentence.endsWith('to')) sentence = sentence.slice(0, -2).trim();
             sentence += '.'; 
        }

        if (sentence.trim() !== '') {
             // Strip trailing commas left over from header joining
             sentence = sentence.replace(/\*\*,\s+/g, '** ');
             
             parts.push(sentence.trim());
        }
    }

    // 4. LIMITS & REUSE
    let limitSuffix = '';
    if (ability.triggerLimit === 'ONCE_PER_ROUND') limitSuffix = "(Once per round)";
    else if (ability.triggerLimit === 'TWICE_PER_ROUND') limitSuffix = "(Twice per round)";
    
    const cost = ability.cost || {};
    if (cost.reuseIgnoresReadiness && cost.readinessCost !== 'NONE') {
        parts.push(`(Reuses ignore readiness)`);
    }

    let finalStr = parts.join(' ').trim();
    if (finalStr.length > 0) {
        if (limitSuffix) {
            if (finalStr.endsWith('.')) finalStr = finalStr.slice(0, -1);
            finalStr += ' ' + limitSuffix + '.';
        }
        
        finalStr = finalStr.replace(/(^\W*\w|[\.;:]\s+\w)/g, m => m.toUpperCase());
    }

    return finalStr;
}