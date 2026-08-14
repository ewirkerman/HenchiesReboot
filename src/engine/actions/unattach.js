import { Action, findEntityLocation, moveEntity, revertEffect } from './core.js';

export class UnattachAction extends Action {
    execute(engine) {
        const loc = findEntityLocation(engine, this.payload.target);
        if (loc && loc.zone === 'attachment') {
            const host = loc.host;
            loc.array.splice(loc.index, 1);
            
            if (host && host.activeEffects) {
                for (let i = host.activeEffects.length - 1; i >= 0; i--) {
                    const eff = host.activeEffects[i];
                    if (eff.duration === 'WHILE_ATTACHED' && eff.sourceId === this.payload.target.instanceId) {
                        host.activeEffects.splice(i, 1);
                        revertEffect(engine, host, eff);
                    }
                }
            }
            
            const target = this.payload.target;
            const ownerId = target.originalOwnerId || target.ownerId || loc.playerId || engine.state.activePlayerId;
            target.ownerId = ownerId;
            
            if (target.type === 'buff') {
                moveEntity(engine, target, ownerId, 'discard');
                engine.state.history_log.push({ text: `🔓 '${target.name}' unattached and was trashed to discard.`, depth: this.getLogDepth(engine) });
            } else if (target.type === 'unit') {
                const destLine = target.line || target.defaultLine || 'mid';
                moveEntity(engine, target, ownerId, destLine);
                engine.state.history_log.push({ text: `🔓 '${target.name}' unattached and fell to the ${destLine} line.`, depth: this.getLogDepth(engine) });
            } else {
                target.readiness = 0;
                moveEntity(engine, target, ownerId, 'equator');
                engine.state.history_log.push({ text: `🔓 '${target.name}' unattached and fell to the Equator.`, depth: this.getLogDepth(engine) });
            }
        } else if (this.payload.target && ['equipment', 'artifact'].includes(this.payload.target.type)) {
            this.payload.target.readiness = 0;
            moveEntity(engine, this.payload.target, this.payload.target.ownerId || this.payload.target.originalOwnerId || engine.state.activePlayerId, 'equator');
        }
    }
}