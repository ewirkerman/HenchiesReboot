import { Action, findEntityLocation, moveEntity } from './core.js';
import { resolveResourceKey } from '../index.js';

export class HarvestAction extends Action {
    execute(engine) {
        const loc = findEntityLocation(engine, this.payload.target);
        if (loc && ['hand'].includes(loc.zone)) {
            const player = engine.state.players[loc.playerId];
            moveEntity(engine, this.payload.target, loc.playerId, 'banish');
            
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