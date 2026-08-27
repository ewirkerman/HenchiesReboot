/**
 * Concrete implementation of the AI Contract that chooses fully random actions.
 */


import { BaseAIEngine } from './base.js';
export class RandomAI extends BaseAIEngine {
    
    determineSacrifice(state) {
        const player = state.players[this.playerId];
        if (Math.random() > 0.5 && player.hand.length > 0) {
            const randomCard = player.hand[Math.floor(Math.random() * player.hand.length)];
            return { action: 'OPTION_A', cardId: randomCard.instanceId || randomCard.id, detail: randomCard.name };
        }
        return { action: 'SKIP', cardId: null, detail: 'Skipped' };
    }

    determineMove(state, legalActions) {
        if (!legalActions || legalActions.length === 0) return null;
        
        const action = legalActions[Math.floor(Math.random() * legalActions.length)];
        
        let targetId = null;
        let targetLine = null;
        
        if (action.targets && action.targets.length > 0) {
            const target = action.targets[Math.floor(Math.random() * action.targets.length)];
            targetId = target.id;
            targetLine = target.line;
        }

        return { action, targetId, targetLine };
    }
}