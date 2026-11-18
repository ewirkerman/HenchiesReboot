import { Action, ACTION_REGISTRY, registerEffect } from './core.js';
import { findEntityLocation, moveEntity, instantiateEntity } from '../utils.js';
import { shuffleArray } from '../prandom.js';

export class SummonAction extends Action {
    emitOnEvents(engine) {
        const summoner = this.payload.target || this.payload.source;
        for (const summoned of this.summonedInstances) {
            const eventPayload = {
                ...this.payload,
                source: summoner,
                target: summoned
            };
            engine.emit(`ON_${this.type}`, eventPayload);
            if (this.passiveType) engine.emit(`ON_${this.passiveType}`, eventPayload);
        }
    }

    execute(engine) {
        this.summonedInstances = [];

        const targetName = (this.payload.cardId || '').toLowerCase();
        const card = engine.state.catalog ? engine.state.catalog.find(c => c.id === this.payload.cardId || (c.name && c.name.toLowerCase() === targetName)) : null;
        if (!card) return;

        const destZone = String(this.payload.zone || 'back').toLowerCase();
        const actingPlayerId = this.payload.actingPlayerId || this.payload.ownerId || engine.state.activePlayerId;
        const summoner = this.payload.target || this.payload.source;

        let fallbackOwner = actingPlayerId;
        if (this.payload.zoneOwner === 'TARGET' && this.payload.target) {
            const targetLoc = findEntityLocation(engine, this.payload.target);
            if (targetLoc && targetLoc.playerId) fallbackOwner = targetLoc.playerId;
            else if (this.payload.target.ownerId) fallbackOwner = this.payload.target.ownerId;
        }

        const ownerId = fallbackOwner;

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
            this.summonedInstances.push(instance);

            if (this.payload.duration && !['INSTANT', 'PERMANENT', 'INDEFINITE'].includes(this.payload.duration)) {
                registerEffect(engine, instance, this.payload);
            }

            engine.state.history_log.push({ text: `✨ Summoned ${instance.name} [instanceId=${instance.instanceId}].`, depth: this.getLogDepth(engine) });

            if (instance.type !== 'spell' && engine.utils.isFieldZone(actualDest)) {
                engine.emit('FIELD', { source: summoner, target: instance, eventContext: this.payload.eventContext });
                engine.emit('BE_FIELDED', { source: summoner, target: instance, eventContext: this.payload.eventContext });
                engine.emit('ON_FIELD', { source: summoner, target: instance, eventContext: this.payload.eventContext });
                engine.emit('ON_BE_FIELDED', { source: summoner, target: instance, eventContext: this.payload.eventContext });
            }
        }

        if (this.payload.nestedGroup && this.payload.nestedGroup.payloads && this.payload.nestedGroup.payloads.length > 0) {
            const ng = this.payload.nestedGroup;
            let targets = [];
            if (ng.targetMethod === 'AUTO_ALL') targets = this.summonedInstances;
            else if (ng.targetMethod === 'AUTO_RANDOM') {
                if (this.summonedInstances.length > 1) {
                    engine.state._irreversibleActionOccurred = true;
                    targets = shuffleArray(engine.state, [...this.summonedInstances]).slice(0, ng.targetCount || 1);
                } else {
                    targets = this.summonedInstances;
                }
            }
            else if (ng.targetMethod === 'AUTO_FIRST') targets = this.summonedInstances.slice(0, ng.targetCount || 1);
            else if (ng.targetMethod === 'AUTO_LAST') targets = this.summonedInstances.slice(-(ng.targetCount || 1));

            for (const np of ng.payloads) {
                const ActionClass = ACTION_REGISTRY[np.type];
                if (ActionClass) {
                    for (const target of targets) {
                        const actionPayload = {
                            ...np,
                            eventContext: this.payload.eventContext,
                            sourceAbilityId: this.payload.sourceAbilityId,
                            paramX: this.payload.paramX
                        };

                        if (np.invertRoles) {
                            actionPayload.source = target;
                            actionPayload.target = summoner;
                        } else {
                            actionPayload.source = summoner;
                            actionPayload.target = target;
                        }
                        new ActionClass(actionPayload).run(engine);
                    }
                }
            }
        }
    }
}