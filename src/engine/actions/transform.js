import { Action, ACTION_REGISTRY, findEntityLocation, moveEntity } from './core.js';

export class TransformAction extends Action {
    execute(engine) {
        const target = this.payload.target;
        const cardId = this.payload.cardId;
        if (!target || !cardId || !engine.state.catalog) return;

        const newCardTemplate = engine.state.catalog.find(c => c.id === cardId || (c.name && c.name.toLowerCase() === cardId.toLowerCase()));
        if (!newCardTemplate) return;

        if (target.attachments && target.attachments.length > 0) {
            const atts = [...target.attachments];
            const UnattachClass = ACTION_REGISTRY['UNATTACH'];
            if (UnattachClass) {
                for (const att of atts) new UnattachClass({ target: att }).run(engine);
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

        target.health = target.maxHealth || 1;
        target.originalPower = target.power || 0;
        target.originalStrength = target.strength !== undefined ? target.strength : null;

        let destZone = loc ? loc.zone : null;
        
        if (loc && loc.playerId && ['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(loc.zone)) {
            if (target.type === 'unit') {
                target.defaultLine = target.defaultLine || 'mid';
                target.line = target.defaultLine;
                destZone = target.defaultLine;
            } else if (target.type === 'equipment' || target.type === 'artifact') {
                destZone = 'equator';
            } else if (target.type === 'boon') {
                destZone = 'avatar';
            }
            
            if (loc.zone !== destZone) {
                moveEntity(engine, target, loc.playerId, destZone);
            }
        } else if (target.type === 'unit') {
            target.defaultLine = target.defaultLine || 'mid';
            target.line = target.defaultLine;
        }

        engine.state.history_log.push({ text: `✨ A unit transformed into ${target.name}!`, depth: this.getLogDepth(engine) });
    }
}