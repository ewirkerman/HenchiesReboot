import { Action, findEntityLocation, moveEntity, registerEffect } from './core.js';

export class DonateAction extends Action {
    execute(engine) {
        const { target, source } = this.payload;
        const loc = findEntityLocation(engine, target);
        
        let sourceOwnerId = engine.state.activePlayerId;
        if (source) {
            const sourceLoc = findEntityLocation(engine, source);
            if (sourceLoc && sourceLoc.playerId) sourceOwnerId = sourceLoc.playerId;
            else if (source.ownerId) sourceOwnerId = source.ownerId;
        }

        const oppId = sourceOwnerId === 'player1' ? 'player2' : 'player1';
        
        if (loc && loc.playerId && loc.playerId !== oppId) {
            const originalOwnerId = loc.playerId;
            moveEntity(engine, target, oppId, loc.zone);
            target.ownerId = oppId;
            
            engine.state.history_log.push({ text: `🎁 '${target.name}' was donated to ${engine.state.players[oppId].name}!`, depth: this.getLogDepth(engine) });
            registerEffect(engine, target, this.payload, { originalOwnerId: originalOwnerId });
        }
    }
}