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

        // Architecturally flag granted abilities with the tribe of the source card
        const sourceTribe = this.payload.source?.tribe;
        if (sourceTribe !== undefined && sourceTribe !== null) {
            fullAb.tribe = sourceTribe;
            if (fullAb.cost && typeof fullAb.cost === 'object') {
                fullAb.cost.tribe = sourceTribe;
            }
        }

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

        // Force array reallocation for frontend UI reactivity
        this.payload.target.abilities = [...this.payload.target.abilities, fullAb];

        const describeEntity = entity => entity
            ? `${entity.name || 'Unknown'}#${entity.instanceId || entity.id || 'no-id'}`
            : 'none';
        const eventContext = this.payload.eventContext;
        const sourceAbilityId = this.payload.sourceAbilityId || eventContext?.abilityId || 'unknown';
        engine.utils.log(
            engine.state,
            `[ABILITY GRANT] granted=${fullAb.name || fullAb.abilityId} abilityId=${fullAb.abilityId} abilityInstanceId=${fullAb.instanceId || 'none'} target=${describeEntity(this.payload.target)} source=${describeEntity(this.payload.source)} sourceAbilityId=${sourceAbilityId} eventSource=${describeEntity(eventContext?.source)} eventTarget=${describeEntity(eventContext?.target)}`
        );

        // Register effect without leaking parameter or definition state; link directly via instanceId
        const {
            grantedAbility: _unusedGrantedAbility,
            ...cleanEffectPayload
        } = this.payload;

        cleanEffectPayload.grantedAbilityId = fullAb.abilityId;
        cleanEffectPayload.grantedAbilityInstanceId = fullAb.instanceId;

        // FIX: Ensure paramX is tracked in the active effect for cleanup and stacking scripts
        if (fullAb.paramX !== undefined && fullAb.paramX !== null) {
            cleanEffectPayload.grantedAbilityParamX = fullAb.paramX;
        }

        registerEffect(engine, this.payload.target, cleanEffectPayload);

        // FIX: registerEffect strictly filters payload keys. We must manually inject paramX
        // and tribe into the generated effect object, and CLONE it so it is visible to frontend UI frameworks!
        if ((fullAb.paramX !== undefined && fullAb.paramX !== null) || fullAb.tribe) {
            if (this.payload.target.activeEffects) {
                const effectsCopy = [...this.payload.target.activeEffects];
                const lastIdx = effectsCopy.length - 1;
                if (effectsCopy[lastIdx] && effectsCopy[lastIdx].grantedAbilityId === fullAb.abilityId) {
                    effectsCopy[lastIdx] = {
                        ...effectsCopy[lastIdx],
                        grantedAbilityParamX: fullAb.paramX,
                        paramX: fullAb.paramX,
                        grantedAbilityTribe: fullAb.tribe,
                        tribe: fullAb.tribe
                    };
                    this.payload.target.activeEffects = effectsCopy;
                }
            }
        }
    }
}