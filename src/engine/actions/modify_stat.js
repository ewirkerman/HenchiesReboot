import { Action, registerEffect } from './core.js';

export class ModifyStatAction extends Action {
    execute(engine) {
        const { target, stat, amount, sourceAbilityId, maxStacks } = this.payload;
        if (!target || !stat || amount === undefined || amount === 0) return;
        
        let actualDelta = amount;

        if (amount > 0 && sourceAbilityId && maxStacks && maxStacks > 0) {
            if (!target.statSources) target.statSources = {};
            if (!target.statSources[stat]) target.statSources[stat] = [];
            
            const currentStacks = target.statSources[stat].filter(id => id === sourceAbilityId).length;
            actualDelta = Math.min(amount, maxStacks - currentStacks);
            if (actualDelta <= 0) return; 
        }

        target[stat] = (target[stat] || 0) + actualDelta;

        if (stat === 'maxHealth') {
            if (target.health > target.maxHealth) {
                target.health = Math.max(0, target.maxHealth);
            }
        } else if (stat === 'cost') {
            target.cost = Math.max(0, target.cost);
        } else if (stat === 'readiness' && target[stat] < -1) {
            target[stat] = -1;
        }

        if (actualDelta > 0 && sourceAbilityId) {
            if (!target.statSources) target.statSources = {};
            if (!target.statSources[stat]) target.statSources[stat] = [];
            for (let i = 0; i < actualDelta; i++) target.statSources[stat].push(sourceAbilityId);
        } 
        else if (actualDelta < 0 && target.statSources && target.statSources[stat]) {
            for(let i = 0; i < Math.abs(actualDelta); i++) {
                if (target.statSources[stat].length > 0) {
                    target.statSources[stat].shift(); 
                }
            }
        }

        registerEffect(engine, target, this.payload, { delta: actualDelta });
    }
}