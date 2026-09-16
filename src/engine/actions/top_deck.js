import { Action } from './core.js';
import { DrawCardAction } from './draw_card.js';

export class TopDeckAction extends Action {
    execute(engine) {
        // Find the owner of the catalyst (e.g., the Compost Pixie in the discard)
        let ownerId = this.payload.actingPlayerId;
        if (!ownerId && this.payload.source) ownerId = this.payload.source.ownerId || this.payload.source.originalOwnerId;
        if (!ownerId) return;

        const player = engine.state.players[ownerId];
        const amount = this.payload.amount || 1;

        if (player && player.deck) {
            for (let i = 0; i < amount; i++) {
                if (player.deck.length > 0) {
                    // Identify the top card
                    const topCard = player.deck[player.deck.length - 1]; 
                    
                    // Delegate the actual movement to the unified DrawCardAction
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