import { Action, findEntityLocation, moveEntity } from './core.js';
import { resolveResourceKey } from '../utils.js';

export class HarvestAction extends Action {
    execute(engine) {
        const loc = findEntityLocation(engine, this.payload.target);
        if (loc) {
            // Determine who gets the resources (the person doing the harvesting)
            // We use the pre-run owner to ensure that stolen cards give resources to the thief, 
            // even though the isLeavesPlay cleanup returns the card to the original owner's banish pile.
            let harvesterId = engine.state.activePlayerId;
            if (this.payload._preRunSourceOwner) {
                harvesterId = this.payload._preRunSourceOwner;
            } else if (this.payload.source && this.payload.source.ownerId) {
                harvesterId = this.payload.source.ownerId;
            }

            const player = engine.state.players[harvesterId];
            
            // Move the target to the banish zone of whoever originally owned it
            moveEntity(engine, this.payload.target, loc.playerId || harvesterId, 'banish');
            
            let sTribe = resolveResourceKey(engine.state, player, this.payload.target.tribe);
            
            if (!player.resources['Carnie']) player.resources['Carnie'] = { current: 0, max: 0 };

            if (sTribe === 'Carnie' || sTribe === 'Generic') {
                player.resources['Carnie'].max += 2;
                player.resources['Carnie'].current += 2;
                engine.state.history_log.push({ text: `🔥 ${player.name} harvested '${this.payload.target.name}' (Carnie) for +2 Max Carnie!`, depth: this.getLogDepth(engine) });
            } else {
                if (!player.resources[sTribe]) player.resources[sTribe] = { current: 0, max: 0 };
                player.resources['Carnie'].max += 1;
                player.resources['Carnie'].current += 1;
                player.resources[sTribe].max += 1;
                player.resources[sTribe].current += 1;
                engine.state.history_log.push({ text: `🔥 ${player.name} harvested '${this.payload.target.name}' for +1 Max Carnie & +1 Max Tribe Res!`, depth: this.getLogDepth(engine) });
            }
        }
    }
}