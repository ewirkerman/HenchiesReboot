import { Action } from './core.js';
import { findEntityLocation, moveEntity, resolveResourceKey } from '../utils.js';

export class HarvestAction extends Action {
    execute(engine) {
        const loc = findEntityLocation(engine, this.payload.target);
        if (!loc) return;

        // 1. Determine Harvester (prioritize pre-run owner to handle stolen cards correctly)
        const harvesterId = this.payload._preRunSourceOwner || this.payload.source?.ownerId || engine.state.activePlayerId;
        const player = engine.state.players[harvesterId];
        
        // 2. Move Target to Banish pile of the original owner
        moveEntity(engine, this.payload.target, loc.playerId || harvesterId, 'banish');
        
        // 4. Calculate Yields dynamically
        const yieldAmt = Number(this.payload.amount) || 0;
        const yields = {};

        if (yieldAmt <= 0) {
            // BASELINE HARVEST: +1 Carnie, +1 Tribe (naturally stacks to 2 if sTribe is Carnie)
            const sTribe = resolveResourceKey(engine.state, player, this.payload.target.tribe);
            yields['Carnie'] = 1;
            yields[sTribe] = (yields[sTribe] || 0) + 1;
        } else {
            // LITERAL HARVEST: Funnel the exact amount into the specified resource
            const sTribe = resolveResourceKey(engine.state, player, this.payload.resource);
            yields[sTribe] = yieldAmt;
        }

        // 5. Apply & Log Yields
        const logYields = [];
        
        for (const [res, amt] of Object.entries(yields)) {
            // Initialize pool if it doesn't exist yet
            if (!player.resources[res]) player.resources[res] = { current: 0, max: 0 };
            
            player.resources[res].max += amt;
            player.resources[res].current += amt;
            logYields.push(`+${amt} Max ${res}`);
        }
        
        engine.state.history_log.push({ 
            text: `🔥 ${player.name} harvested '${this.payload.target.name}' for ${logYields.join(' & ')}!`, 
            depth: this.getLogDepth(engine) 
        });
    }
}