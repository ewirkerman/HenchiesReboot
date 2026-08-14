import { Action, findEntityLocation, moveEntity, registerEffect } from './core.js';

export class RebelAction extends Action {
    execute(engine) {
        const { target, source } = this.payload;
        const loc = findEntityLocation(engine, target);
        
        let sourceOwnerId = engine.state.activePlayerId;
        if (source) {
            const sourceLoc = findEntityLocation(engine, source);
            if (sourceLoc && sourceLoc.playerId) sourceOwnerId = sourceLoc.playerId;
            else if (source.ownerId) sourceOwnerId = source.ownerId;
        }
        
        if (loc && loc.playerId && loc.playerId !== sourceOwnerId) {
            const originalOwnerId = loc.playerId;
            moveEntity(engine, target, sourceOwnerId, loc.zone);
            target.ownerId = sourceOwnerId;
            
            engine.state.history_log.push({ text: `🤝 '${target.name}' changed sides and joined ${engine.state.players[sourceOwnerId].name}!`, depth: this.getLogDepth(engine) });
            registerEffect(engine, target, this.payload, { originalOwnerId: originalOwnerId });
        }
    }
}