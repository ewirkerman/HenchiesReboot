import { Action, ACTION_REGISTRY, registerEffect } from './core.js';
import { findEntityLocation, moveEntity, instantiateEntity } from '../utils.js';
import { shuffleArray } from '../prandom.js';

export class SummonAction extends Action {
    execute(engine) {
        const targetName = (this.payload.cardId || '').toLowerCase();
        const card = engine.state.catalog ? engine.state.catalog.find(c => c.id === this.payload.cardId || (c.name && c.name.toLowerCase() === targetName)) : null;
        if (!card) return;
        
        const destZone = String(this.payload.zone || 'back').toLowerCase();
        const actingPlayerId = this.payload.actingPlayerId || this.payload.ownerId || engine.state.activePlayerId;

        let fallbackOwner = actingPlayerId;
        if (this.payload.zoneOwner === 'TARGET' && this.payload.target) {
            const targetLoc = findEntityLocation(engine, this.payload.target);
            if (targetLoc && targetLoc.playerId) fallbackOwner = targetLoc.playerId;
            else if (this.payload.target.ownerId) fallbackOwner = this.payload.target.ownerId;
        }

        const ownerId = fallbackOwner;
            
        const summonedInstances = [];
        const cardToSummon = { ...card, isToken: true };
        
        for (let i = 0; i < (this.payload.amount || 1); i++) {
            const instance = instantiateEntity(cardToSummon, engine.state.abilityCatalog, engine.state, ownerId);
            
            let actualDest = destZone;
            if (actualDest === 'field' || actualDest === 'board') {
                 actualDest = instance.defaultLine || 'mid';
            }

            if (instance.type === 'unit') {
                 instance.defaultLine = instance.defaultLine || 'mid';
                 if (actualDest === 'back' && instance.defaultLine !== 'mid') actualDest = instance.defaultLine;
                 instance.line = actualDest;
            }
            
            moveEntity(engine, instance, ownerId, actualDest);
            summonedInstances.push(instance);
            
            if (this.payload.duration && !['INSTANT', 'PERMANENT', 'INDEFINITE'].includes(this.payload.duration)) {
                registerEffect(engine, instance, this.payload);
            }
            
            engine.state.history_log.push({ text: `✨ Summoned ${instance.name}.`, depth: this.getLogDepth(engine) });
            
            // INTENTIONAL DESIGN: Summon bypasses FIELD and UNFIELD lifecycle events. 
            // It strictly emits SUMMON-related triggers. Do not add ON_FIELD / ON_BE_FIELDED emits here.
        }
        
        if (this.payload.nestedGroup && this.payload.nestedGroup.payloads && this.payload.nestedGroup.payloads.length > 0) {
            const ng = this.payload.nestedGroup;
            let targets = [];
            if (ng.targetMethod === 'AUTO_ALL') targets = summonedInstances;
            else if (ng.targetMethod === 'AUTO_RANDOM') targets = shuffleArray(engine.state, [...summonedInstances]).slice(0, ng.targetCount || 1);
            else if (ng.targetMethod === 'AUTO_FIRST') targets = summonedInstances.slice(0, ng.targetCount || 1);
            else if (ng.targetMethod === 'AUTO_LAST') targets = summonedInstances.slice(-(ng.targetCount || 1));
            
            for (const np of ng.payloads) {
                const ActionClass = ACTION_REGISTRY[np.type];
                if (ActionClass) {
                    for (const target of targets) {
                        const actionPayload = { ...np, eventContext: this.payload.eventContext };
                        if (np.invertRoles) {
                            actionPayload.source = target;
                            actionPayload.target = this.payload.source;
                        } else {
                            actionPayload.source = this.payload.source;
                            actionPayload.target = target;
                        }
                        new ActionClass(actionPayload).run(engine);
                    }
                }
            }
        }
    }
}