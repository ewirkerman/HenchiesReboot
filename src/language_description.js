/**
 * src/language_description.js
 * The Main Orchestrator for the Language Generator Pipeline.
 * Preserves the exact export signature to avoid breaking external imports.
 */

import { ReferenceTracker } from './language/utils.js';
import { parseTriggers } from './language/triggers.js';
import { processTargetGroups } from './language/payloads.js';

export function generateAbilityDescription(ability, allAbilities = null, allCards = null, allTribes = null) {
    if (ability.description && ability.description.trim() !== '') {
        return ability.description;
    }

    const tracker = new ReferenceTracker();
    let descriptionParts = [];

    // 1. PASSIVE FLAGS
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

    // 2. TRIGGER
    const { triggerText, globalTargetNoun } = parseTriggers(ability, allTribes);

    // 3. COSTS (Symbols & Readiness Strings)
    const cost = ability.cost || {};
    let triggerAndCostStr = "";
    
    if (ability.trigger !== 'UNTRIGGERABLE') {
        if (cost.reuseIgnoresReadiness && cost.readinessCost !== 'NONE') {
             triggerAndCostStr += `(Subsequent uses this round ignore readiness cost) `;
        }
        
        if (triggerText) {
             triggerAndCostStr += triggerText;
             if (triggerText.endsWith('may')) {
                 triggerAndCostStr += " ";
             } else if (ability.trigger !== 'MANUAL') {
                 triggerAndCostStr += ", ";
             } else {
                 triggerAndCostStr += " ";
             }
        }

        if (triggerAndCostStr.trim() !== '') {
            descriptionParts.push(triggerAndCostStr.trim());
        }

        if (triggerText) {
             let tLower = triggerText.toLowerCase();
             if (tLower.includes('this card')) tracker.mention('self', 'this card', false);
             if (tLower.includes('the targeted card')) tracker.mention('targeted_card', 'the targeted card', false);
             if (tLower.includes('the attacker')) tracker.mention('attacker', 'the attacker', false);
             if (tLower.includes('the defender')) tracker.mention('defender', 'the defender', false);
             if (tLower.includes('the damaged character')) tracker.mention('damaged_character', 'the damaged character', false);
             if (tLower.includes('the damage source')) tracker.mention('damage_source', 'the damage source', false);
             if (tLower.includes('the healed character')) tracker.mention('healed_character', 'the healed character', false);
             
             if (ability.triggerScope === 'GLOBAL' && globalTargetNoun) {
                 let isPl = /(allies|enemies|cards|characters|entities|all\b)/i.test(globalTargetNoun) || globalTargetNoun.endsWith('s');
                 tracker.activeEntities['global_target'] = { isPlural: isPl, mentions: 1 };
                 tracker.lastMentionedId[isPl ? 'plural' : 'singular'] = 'global_target';
             }
        }
    } else {
        if (triggerText && triggerText.trim() !== '') {
            descriptionParts.push(triggerText.trim());
        }
    }

    // 4. LIMITS
    let limitSuffix = '';
    if (ability.triggerLimit === 'ONCE_PER_ROUND') limitSuffix = ", once per round";
    else if (ability.triggerLimit === 'TWICE_PER_ROUND') limitSuffix = ", twice per round";

    // 5. EFFECTS
    const targetGroups = ability.effects || [];
    if (targetGroups.length === 0) {
        if (ability.trigger !== 'UNTRIGGERABLE') descriptionParts.push("do nothing.");
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

    // 6. FINAL STRING FORMATTING
    let finalStr = descriptionParts.join(' ').trim();
    if (finalStr.length > 0) {
        if (limitSuffix) {
            if (finalStr.endsWith('.')) finalStr = finalStr.slice(0, -1);
            finalStr += limitSuffix + '.';
        }
        finalStr = finalStr.replace(/^([^a-zA-Z]*)([a-zA-Z])/i, (match, p1, p2) => p1 + p2.toUpperCase());
        finalStr = finalStr.replace(/\.\s+([a-z])/g, (match, p1) => '. ' + p1.toUpperCase());
    }

    return finalStr;
}