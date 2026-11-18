import { Action, registerEffect } from './core.js';
import { updateAbilityLevel } from '../utils.js';

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export class UpdateAbilityLevelAction extends Action {
    execute(engine) {
        const { target, abilityId, amount, modify } = this.payload;
        if (!target || !abilityId || amount === undefined || amount === null) {
            console.warn('[Engine] UPDATE_ABILITY_LEVEL requires target, abilityId, and amount.');
            return;
        }

        const ability = target.abilities?.find(entry =>
            entry && typeof entry === 'object' && entry.abilityId === abilityId
        );
        if (!ability) {
            console.warn(`[Engine] UPDATE_ABILITY_LEVEL could not find ${abilityId} on the target.`);
            return;
        }

        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount)) {
            console.warn(`[Engine] UPDATE_ABILITY_LEVEL amount must be a finite number. Received: ${amount}`);
            return;
        }

        const previousValue = Number(ability.paramX);
        const currentValue = Number.isFinite(previousValue) ? previousValue : 0;
        const newParamX = modify ? currentValue + numericAmount : numericAmount;
        const matchingEffects = target.activeEffects?.filter(effect =>
            effect.type === 'UPDATE_ABILITY_LEVEL' &&
            effect.abilityId === abilityId &&
            effect.abilityInstanceId === ability.instanceId
        ) || [];
        const previousGrantEffect = target.activeEffects?.find(effect =>
            effect.type === 'GRANT_ABILITY' &&
            (effect.grantedAbilityInstanceId === ability.instanceId || effect.grantedAbilityId === abilityId)
        );

        const originalAbility = matchingEffects[0]?.originalAbility || clone(ability);
        const originalGrantEffect = matchingEffects[0]?.originalGrantEffect || clone(previousGrantEffect);

        if (!updateAbilityLevel(engine.state, target, abilityId, newParamX)) {
            console.warn(`[Engine] UPDATE_ABILITY_LEVEL failed to update ${abilityId} on the target.`);
            return;
        }

        registerEffect(engine, target, this.payload, {
            abilityInstanceId: ability.instanceId,
            newParamX,
            originalAbility,
            originalGrantEffect
        });
    }
}
