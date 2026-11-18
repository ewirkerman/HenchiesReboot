import { Action, registerEffect } from './core.js';
import { getReadinessFloor } from '../utils.js';

const NON_NEGATIVE_STATS = new Set(['strength', 'health', 'power', 'cost', 'armor', 'maxHealth']);

export class ModifyStatAction extends Action {
    execute(engine) {
        const { target, stat, amount, sourceAbilityId, maxStacks, eventContext } = this.payload;
        if (!stat || amount === undefined || amount === 0) return;
        if (stat === 'acts' || stat === 'maxActs') return;

        // Route in-flight event stat modifications (e.g. Parrying reducing damage by X)
        if (stat === 'amount') {
            const eventTarget = eventContext || target?._eventContext;
            if (eventTarget) {
                const current = Number(eventTarget.amount ?? 0);
                eventTarget.amount = Math.max(0, current + (Number(amount) || 0));
                if (engine.state?.history_log) {
                    engine.state.history_log.push({
                        text: `🛡️ Event amount modified by ${amount >= 0 ? '+' : ''}${amount} (now ${eventTarget.amount}).`,
                        depth: this.getLogDepth ? this.getLogDepth(engine) : 0
                    });
                }
            }
            return;
        }

        if (!target) return;

        if (stat === 'strength' && typeof target.strength !== 'number') {
            return;
        }

        const currentStatValue = NON_NEGATIVE_STATS.has(stat)
            ? Math.max(0, Number(target[stat]) || 0)
            : target[stat] || 0;
        let actualDelta = amount;

        if (amount > 0 && sourceAbilityId && maxStacks && maxStacks > 0) {
            if (!target.statSources) target.statSources = {};
            if (!target.statSources[stat]) target.statSources[stat] = [];

            const currentStacks = target.statSources[stat].filter(id => id === sourceAbilityId).length;
            actualDelta = Math.min(amount, maxStacks - currentStacks);
            if (actualDelta <= 0) return;
        }

        if (NON_NEGATIVE_STATS.has(stat) && actualDelta < 0) {
            actualDelta = Math.max(actualDelta, -currentStatValue);
        }

        if (actualDelta === 0) {
            if (NON_NEGATIVE_STATS.has(stat) && target[stat] < 0) target[stat] = 0;
            return;
        }

        target[stat] = currentStatValue + actualDelta;

        if (stat === 'maxHealth') {
            if (actualDelta > 0) {
                target.health = (target.health || 0) + actualDelta;
            } else if (target.health > target.maxHealth) {
                target.health = Math.max(0, target.maxHealth);
            }
        } else if (stat === 'cost') {
            target.cost = Math.max(0, target.cost);
        } else if (stat === 'readiness' && target[stat] < getReadinessFloor(engine.state, target)) {
            target[stat] = getReadinessFloor(engine.state, target);
        }

        if (actualDelta > 0 && sourceAbilityId) {
            if (!target.statSources) target.statSources = {};
            if (!target.statSources[stat]) target.statSources[stat] = [];
            for (let i = 0; i < actualDelta; i++) target.statSources[stat].push(sourceAbilityId);
        } else if (actualDelta < 0 && target.statSources && target.statSources[stat]) {
            for (let i = 0; i < Math.abs(actualDelta); i++) {
                if (target.statSources[stat].length > 0) {
                    target.statSources[stat].shift();
                }
            }
        }

        registerEffect(engine, target, this.payload, { delta: actualDelta });
    }
}