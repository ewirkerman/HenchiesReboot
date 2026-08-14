import { Action, registerEffect } from './core.js';

export class RemoveAbilityAction extends Action {
    execute(engine) {
        if (this.payload.target && this.payload.grantedAbilityId) {
            const targetId = this.payload.grantedAbilityId;
            
            let removedAbs = [];
            let removedEffects = [];
            
            if (this.payload.target.abilities) {
                removedAbs = this.payload.target.abilities.filter(a => a.abilityId === targetId || a.name === targetId);
                this.payload.target.abilities = this.payload.target.abilities.filter(a => a.abilityId !== targetId && a.name !== targetId);
            }
            
            if (this.payload.target.activeEffects) {
                removedEffects = this.payload.target.activeEffects.filter(e => e.type === 'GRANT_ABILITY' && (e.grantedAbilityId === targetId || e.traitId === targetId));
                this.payload.target.activeEffects = this.payload.target.activeEffects.filter(e => !(e.type === 'GRANT_ABILITY' && (e.grantedAbilityId === targetId || e.traitId === targetId)));
            }
            
            if (this.payload.duration && !['INSTANT', 'PERMANENT'].includes(this.payload.duration)) {
                registerEffect(engine, this.payload.target, this.payload, { restoredAbilities: removedAbs, restoredEffects: removedEffects });
            }
        }
    }
}