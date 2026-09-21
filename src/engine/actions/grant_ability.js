import { Action, registerEffect } from './core.js';
import { instantiateAbility } from '../utils.js';

export class GrantAbilityAction extends Action {
    execute(engine) {
        if (this.payload.target && this.payload.grantedAbilityId) {
            
            const abRef = { abilityId: this.payload.grantedAbilityId };
            if (this.payload.grantedAbilityParamX !== undefined && this.payload.grantedAbilityParamX !== null) {
                abRef.paramX = this.payload.grantedAbilityParamX;
            }
            
            let fullAb = instantiateAbility(abRef, engine.state.abilityCatalog || [], engine.state);
            
            if (this.payload.blockDuplicates) {
                const hasAb = this.payload.target.abilities?.some(a => (a.abilityId || a) === fullAb.abilityId || (a.name && a.name === fullAb.name));
                const hasEffect = this.payload.target.activeEffects?.some(e => e.type === 'GRANT_ABILITY' && (e.grantedAbilityId === fullAb.abilityId || e.grantedAbilityId === fullAb.name));
                
                if (hasAb || hasEffect) {
                    if (!engine.state.isReconstructing) console.log(`[Engine] ${this.payload.target.name} already has ${fullAb.name}, duplicate prevented.`);
                    return;
                }
            }
            
            if (!this.payload.target.abilities) this.payload.target.abilities = [];
            
            this.payload.target.abilities.push(fullAb);
            registerEffect(engine, this.payload.target, this.payload);
        }
    }
}