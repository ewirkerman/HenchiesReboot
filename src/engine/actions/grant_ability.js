import { Action, registerEffect } from './core.js';
import { hydrateAbility } from '../utils.js';

export class GrantAbilityAction extends Action {
    execute(engine) {
        if (this.payload.target && this.payload.grantedAbilityId) {
            let fullAb = null;
            
            if (this.payload.grantedAbilityParamX !== undefined && this.payload.grantedAbilityParamX !== null) {
                fullAb = hydrateAbility({
                    abilityId: this.payload.grantedAbilityId,
                    paramX: this.payload.grantedAbilityParamX
                }, engine.state.abilityCatalog || []);
            } else if (engine.state.abilityCatalog) {
                fullAb = engine.state.abilityCatalog.find(a => 
                    a.abilityId === this.payload.grantedAbilityId || 
                    (a.name && a.name.toLowerCase() === String(this.payload.grantedAbilityId).toLowerCase())
                );
            }
            
            if (!fullAb) fullAb = { 
                abilityId: this.payload.grantedAbilityId,
                name: "Unresolved Ability",
                trigger: "MANUAL",
                description: "Failed to load ability data from catalog."
            };
            
            if (this.payload.blockDuplicates) {
                const hasAb = this.payload.target.abilities?.some(a => (a.abilityId || a) === fullAb.abilityId || (a.name && a.name === fullAb.name));
                const hasEffect = this.payload.target.activeEffects?.some(e => e.type === 'GRANT_ABILITY' && (e.grantedAbilityId === fullAb.abilityId || e.grantedAbilityId === fullAb.name));
                
                if (hasAb || hasEffect) {
                    if (!engine.state.isReconstructing) console.log(`[Engine] ${this.payload.target.name} already has ${fullAb.name}, duplicate prevented.`);
                    return;
                }
            }
            
            if (!this.payload.target.abilities) this.payload.target.abilities = [];
            let abilityToPush = this.payload.grantedAbilityParamX !== undefined && this.payload.grantedAbilityParamX !== null ? fullAb : JSON.parse(JSON.stringify(fullAb));
            
            this.payload.target.abilities.push(abilityToPush);
            registerEffect(engine, this.payload.target, this.payload);
        }
    }
}