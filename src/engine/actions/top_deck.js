import { Action } from './core.js';
import { DrawCardAction } from './draw_card.js';
import { getOwnerId } from '../utils.js';

export class TopDeckAction extends Action {
    execute(engine) {
        let ownerId = null;

        // 1. Try to get the owner of the target
        if (this.payload.target) {
            ownerId = getOwnerId(engine.state, this.payload.target);
        }

        // 2. Fall back to the source (e.g., the catalyst artifact)
        if (!ownerId && this.payload.source) {
            ownerId = getOwnerId(engine.state, this.payload.source);
        }

        // 3. Absolute fallback to the acting player
        if (!ownerId) {
            ownerId = this.payload.actingPlayerId;
        }

        if (!ownerId) return;

        const player = engine.state.players[ownerId];
        const amount = this.payload.amount || 1;

        if (player && player.deck) {
            for (let i = 0; i < amount; i++) {
                if (player.deck.length > 0) {
                    const topCard = player.deck[player.deck.length - 1]; 
                    
                    const drawAction = new DrawCardAction({
                        source: this.payload.source,
                        target: topCard,
                        actingPlayerId: ownerId,
                        eventContext: this.payload.eventContext
                    });
                    
                    drawAction.run(engine);
                }
            }
        }
    }
}