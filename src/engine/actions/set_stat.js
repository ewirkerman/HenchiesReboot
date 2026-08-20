import { Action, findEntityLocation, moveEntity, registerEffect } from './core.js';

export class SetStatAction extends Action {
    execute(engine) {
        const { target, stat, amount } = this.payload;
        if (target && stat && amount !== undefined) {
            if (stat === 'line') {
                const loc = findEntityLocation(engine, target);
                if (loc && loc.zone === 'sideline') {
                    if (!engine.state.isReconstructing) console.log(`[Engine] ${target.name} is locked in the sideline.`);
                    return;
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
            if (stat === 'readiness' && finalAmount < -1) finalAmount = -1;
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