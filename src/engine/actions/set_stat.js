import { Action, registerEffect } from './core.js';
import { findEntityLocation, getReadinessFloor, LINES, moveEntity } from '../utils.js';

const UNRESTRICTED_LINES = ['avatar', 'taunt', 'front', 'mid', 'back', 'sheltered'];

export class SetStatAction extends Action {
    execute(engine) {
        const { target, stat, amount, eventContext } = this.payload;
        if (amount === undefined) return;
        if (stat === 'acts' || stat === 'maxActs') return;

        // Route in-flight event stat modifications (e.g. Parrying setting damage to 0)
        if (stat === 'amount') {
            const eventTarget = eventContext || target?._eventContext;
            if (eventTarget) {
                eventTarget.amount = Math.max(0, Number(amount) || 0);
                if (engine.state?.history_log) {
                    engine.state.history_log.push({
                        text: `🛡️ Event amount set to ${eventTarget.amount}.`,
                        depth: this.getLogDepth ? this.getLogDepth(engine) : 0
                    });
                }
            }
            return;
        }

        if (target && stat) {
            if (stat === 'line') {
                const loc = findEntityLocation(engine, target);

                if (loc) {
                    const isInnateSelf = this.payload.targetMethod === 'SELF' && this.payload.sourceAbilityOrigin === 'innate';
                    const allowedDestinations = UNRESTRICTED_LINES.includes(loc.zone)
                        ? LINES
                        : loc.zone === 'bodyguard' ? ['taunt', 'sideline'] : [];

                    if (!isInnateSelf && !allowedDestinations.includes(amount)) {
                        if (loc.zone === 'sideline' && !engine.state.isReconstructing) {
                            console.log(`[Engine] ${target.name} is locked in the sideline.`);
                        }
                        return;
                    }
                }
            }

            if (target.activeEffects) {
                for (let i = target.activeEffects.length - 1; i >= 0; i--) {
                    const eff = target.activeEffects[i];
                    if (eff.type === 'MODIFY_STAT' && eff.stat === stat) {
                        target.activeEffects.splice(i, 1);
                    }
                }
            }
            if (target.statSources && target.statSources[stat]) {
                delete target.statSources[stat];
            }

            let oldVal = target[stat];
            if (oldVal === undefined) {
                if (stat === 'line') oldVal = target.type === 'avatar' ? 'avatar' : (target.defaultLine || 'mid');
                else oldVal = typeof amount === 'number' ? 0 : null;
            }

            let trueOriginal = oldVal;
            if (target.activeEffects) {
                const existingEffects = target.activeEffects.filter(e => e.type === 'SET_STAT' && e.stat === stat);
                if (existingEffects.length > 0) {
                    trueOriginal = existingEffects[0].originalValue;
                }
            }

            let finalAmount = amount;
            if (stat === 'readiness') finalAmount = Math.max(getReadinessFloor(engine.state, target), finalAmount);
            target[stat] = finalAmount;

            let delta = 0;
            if (typeof oldVal === 'number' && typeof finalAmount === 'number') {
                delta = finalAmount - oldVal;
            }

            if (stat === 'maxHealth') {
                if (delta > 0) {
                    target.health = (target.health || 0) + delta;
                } else if (target.health > target.maxHealth) {
                    target.health = Math.max(0, target.maxHealth);
                }
            } else if (stat === 'cost') {
                target.cost = Math.max(0, target.cost);
            }

            registerEffect(engine, target, this.payload, { originalValue: trueOriginal, delta: delta });

            if (stat === 'line') {
                const loc = findEntityLocation(engine, target);
                if (loc && loc.playerId && loc.zone !== amount) {
                    moveEntity(engine, target, loc.playerId, amount);
                }
            }
        }
    }
}