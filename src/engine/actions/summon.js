import { Action, ACTION_REGISTRY, findEntityLocation, moveEntity, registerEffect } from './core.js';
import { generateId, shuffleArray } from '../prandom.js';

export class SummonAction extends Action {
    execute(engine) {
        const targetName = (this.payload.cardId || '').toLowerCase();
        const card = engine.state.catalog ? engine.state.catalog.find(c => c.id === this.payload.cardId || (c.name && c.name.toLowerCase() === targetName)) : null;
        if (!card) return;
        
        const destZone = String(this.payload.zone || 'back').toLowerCase();
        let fallbackOwner = engine.state.activePlayerId;
        if (this.payload.source) {
            const loc = findEntityLocation(engine, this.payload.source);
            if (loc && loc.playerId) fallbackOwner = loc.playerId;
            else if (this.payload.source.ownerId) fallbackOwner = this.payload.source.ownerId;
        }

        const ownerId = this.payload.zoneOwner === 'TARGET' && this.payload.target ? 
            findEntityLocation(engine, this.payload.target)?.playerId || fallbackOwner : fallbackOwner;
            
        const summonedInstances = [];
        
        for (let i = 0; i < (this.payload.amount || 1); i++) {
            const instance = JSON.parse(JSON.stringify(card));
            instance.instanceId = 'sum_' + generateId(engine.state, 8) + '_' + i;
            instance.isToken = true;
            
            if (instance.abilities && engine.state.abilityCatalog) {
                instance.abilities = instance.abilities.map(ab => {
                    const abId = typeof ab === 'string' ? ab : (ab.abilityId || ab.id);
                    const match = engine.state.abilityCatalog.find(a => a.abilityId === abId);
                    return match ? JSON.parse(JSON.stringify(match)) : ab;
                });
            }

            instance.maxHealth = instance.maxHealth || instance.health || 1;
            if (instance.health === undefined || instance.health <= 0) instance.health = instance.maxHealth;
            instance.readiness = 0; 
            instance.acts = instance.maxActs !== undefined ? instance.maxActs : 1;
            
            instance.originalOwnerId = ownerId;
            instance.ownerId = ownerId;
            instance.originalPower = instance.power || 0;
            instance.originalStrength = instance.strength !== undefined ? instance.strength : null;
            
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
                        const actionPayload = { ...np, source: this.payload.source, target: target, eventContext: this.payload.eventContext };
                        new ActionClass(actionPayload).run(engine);
                    }
                }
            }
        }
    }
}