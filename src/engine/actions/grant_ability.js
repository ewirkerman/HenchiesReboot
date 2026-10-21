import { Action, registerEffect } from './core.js';
import { instantiateAbility } from '../utils.js';

export class GrantAbilityAction extends Action {
    execute(engine) {
        if (!this.payload.target) {
            if (!engine.state.isReconstructing) {
                console.warn(`[Engine] GRANT_ABILITY Action failed. Missing required payload property: 'target'. Payload received:`, this.payload);
            }
            return;
        }

        let abRef = null;

        if (this.payload.grantedAbility) {
            const ga = this.payload.grantedAbility;

            // Validation for fully-formed custom object
            if (typeof ga !== 'object' || Array.isArray(ga)) {
                if (!engine.state.isReconstructing) console.warn(`[Engine] GRANT_ABILITY Action failed. 'grantedAbility' must be an object. Payload received:`, this.payload);
                return;
            }
            if (!ga.abilityId) {
                if (!engine.state.isReconstructing) console.warn(`[Engine] GRANT_ABILITY Action failed. 'grantedAbility' object is missing 'abilityId'. Payload received:`, this.payload);
                return;
            }
            if (!ga.trigger) {
                if (!engine.state.isReconstructing) console.warn(`[Engine] GRANT_ABILITY Action failed. 'grantedAbility' object is missing 'trigger'. Payload received:`, this.payload);
                return;
            }

            abRef = { ...ga };

            // Dynamic abilities MUST have an instanceId to bypass the catalog lookup in instantiateAbility
            if (!abRef.instanceId) {
                const randStr = Math.random().toString(36).substring(2, 11);
                abRef.instanceId = 'dyn_grant_' + randStr;
            }

        } else if (this.payload.grantedAbilityId) {
            abRef = { abilityId: this.payload.grantedAbilityId };
        } else {
            if (!engine.state.isReconstructing) {
                console.warn(`[Engine] GRANT_ABILITY Action failed. Missing required payload property: 'grantedAbilityId' or 'grantedAbility'. Payload received:`, this.payload);
            }
            return;
        }

        if (this.payload.grantedAbilityParamX !== undefined && this.payload.grantedAbilityParamX !== null) {
            abRef.paramX = this.payload.grantedAbilityParamX;
        }

        let fullAb = instantiateAbility(abRef, engine.state.abilityCatalog || [], engine.state);
        fullAb.origin = this.payload.targetMethod === 'SELF' ? 'innate' : 'bonus';

        if (this.payload.blockDuplicates) {
            const hasAb = this.payload.target.abilities?.some(a => (a.abilityId || a) === fullAb.abilityId || (a.name && a.name === fullAb.name));
            // Check active effects: accommodate both ID references and embedded object structures
            const hasEffect = this.payload.target.activeEffects?.some(e =>
                e.type === 'GRANT_ABILITY' &&
                (e.grantedAbilityId === fullAb.abilityId || e.grantedAbility?.abilityId === fullAb.abilityId || e.grantedAbilityId === fullAb.name)
            );

            if (hasAb || hasEffect) {
                if (!engine.state.isReconstructing) console.log(`[Engine] ${this.payload.target.name} already has ${fullAb.name || fullAb.abilityId}, duplicate prevented.`);
                return;
            }
        }

        if (!this.payload.target.abilities) this.payload.target.abilities = [];

        this.payload.target.abilities.push(fullAb);
        registerEffect(engine, this.payload.target, this.payload);
    }
}