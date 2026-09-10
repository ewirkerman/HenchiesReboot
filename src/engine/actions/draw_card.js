import { Action, findEntityLocation, moveEntity } from './core.js';

export class DrawCardAction extends Action {
    execute(engine) {
        const target = this.payload.target;
        if (!target) return;

        const loc = findEntityLocation(engine, target);
        
        // This is the universal chokepoint for drawing a card.
        // Whether tutored or top-decked, the card goes through here!
        if (loc && loc.zone === 'deck') {
            moveEntity(engine, target, loc.playerId, 'hand');
            target.readiness = 0; 
            
            engine.state.history_log.push({ 
                text: `🃏 ${engine.state.players[loc.playerId].name} drew a card.`, 
                depth: this.getLogDepth(engine) 
            });

            // Future-proofing: If you ever add an ON_BE_DRAWN event, 
            // you only have to emit it right here!
        } 
    }
}