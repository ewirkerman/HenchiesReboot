import { Action, ACTION_REGISTRY, registerEffect } from './core.js';
import { findEntityLocation, normalizeEntityCooldownGroups } from '../utils.js';
import { moveEntity } from '../utils.js';

export function isTransformNoOp(target, cardId, catalog) {
    if (!target || !cardId) return false;
    if (target.id === cardId) return true;

    const newCardTemplate = catalog?.find(c =>
        c.id === cardId || (c.name && c.name.toLowerCase() === cardId.toLowerCase())
    );
    if (!newCardTemplate) return false;

    if (target.id && newCardTemplate.id) return target.id === newCardTemplate.id;
    return !!target.name && target.name.toLowerCase() === newCardTemplate.name?.toLowerCase();
}

export class TransformAction extends Action {
    run(engine) {
        if (isTransformNoOp(this.payload.target, this.payload.cardId, engine.state.catalog)) return false;
        return super.run(engine);
    }

    execute(engine) {
        const target = this.payload.target;
        const cardId = this.payload.cardId;
        if (!target || !cardId || !engine.state.catalog) return;

        const newCardTemplate = engine.state.catalog.find(c =>
            c.id === cardId || (c.name && c.name.toLowerCase() === cardId.toLowerCase())
        );
        if (!newCardTemplate) return;
        if (isTransformNoOp(target, cardId, engine.state.catalog)) return;

        const originalCardId = target.id;
        normalizeEntityCooldownGroups(target);

        // 1. Identify which attachments to keep (the source of the transformation)
        const keptAttachments = [];
        const sourceId = this.payload.source ? this.payload.source.instanceId : null;

        if (target.attachments && target.attachments.length > 0) {
            const atts = [...target.attachments];
            const UnattachClass = ACTION_REGISTRY['UNATTACH'];

            for (const att of atts) {
                if (sourceId && att.instanceId === sourceId) {
                    // Preserve the entity that is actively causing the transformation!
                    keptAttachments.push(att);
                } else if (UnattachClass) {
                    new UnattachClass({ target: att }).run(engine);
                }
            }
        }

        target.activeEffects = [];

        const preserved = {
            instanceId: target.instanceId,
            ownerId: target.ownerId,
            originalOwnerId: target.originalOwnerId,
            readiness: target.readiness,
            acts: target.acts,
            isToken: target.isToken
        };

        // Only re-apply the attachments array if we actually kept something
        if (keptAttachments.length > 0) {
            preserved.attachments = keptAttachments;
        }

        const loc = findEntityLocation(engine, target);

        for (const key in target) {
            if (target.hasOwnProperty(key)) delete target[key];
        }

        const newInstance = JSON.parse(JSON.stringify(newCardTemplate));
        if (newInstance.abilities && engine.state.abilityCatalog) {
            newInstance.abilities = newInstance.abilities.map(ab => {
                const abId = typeof ab === 'string' ? ab : (ab.abilityId || ab.id);
                const match = engine.state.abilityCatalog.find(a => a.abilityId === abId);
                return match ? JSON.parse(JSON.stringify(match)) : ab;
            });
        }

        Object.assign(target, newInstance);
        Object.assign(target, preserved);
        delete target.maxActs;

        target.health = target.maxHealth || 1;
        target.originalPower = target.power || 0;
        target.originalStrength = target.strength !== undefined ? target.strength : null;

        let destZone = loc ? loc.zone : null;
        const activeZones = ['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar', 'equator'];

        // 2. Safely re-route unattached entities to their proper zones
        if (loc && activeZones.includes(loc.zone)) {
            if (target.type === 'unit') {
                target.defaultLine = target.defaultLine || 'mid';
                // If it was in the equator, move it to defaultLine. Otherwise keep it in its current line.
                destZone = loc.zone === 'equator' ? target.defaultLine : loc.zone;
                target.line = destZone;
            } else if (target.type === 'equipment' || target.type === 'artifact') {
                destZone = 'equator';
            } else if (target.type === 'boon') {
                destZone = 'avatar';
            }

            if (loc.zone !== destZone) {
                const movePlayerId = loc.playerId || target.ownerId || engine.state.activePlayerId;
                moveEntity(engine, target, movePlayerId, destZone);
            }
        } else if (target.type === 'unit') {
            target.defaultLine = target.defaultLine || 'mid';
            target.line = target.defaultLine;
        }

        engine.state.history_log.push({ text: `✨ An entity transformed into ${target.name}!`, depth: this.getLogDepth(engine) });

        if (this.payload.duration && !['INSTANT', 'PERMANENT', 'INDEFINITE'].includes(this.payload.duration)) {
            registerEffect(engine, target, this.payload, { originalCardId });
        }
    }
}