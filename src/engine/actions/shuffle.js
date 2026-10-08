import { Action, ACTION_REGISTRY } from './core.js';
import { findEntityLocation, getOwnerId, moveEntity } from '../utils.js';
import { shuffleArray } from '../prandom.js';

export class ShuffleAction extends Action {
    execute(engine) {
        const target = this.payload.target;
        const loc = findEntityLocation(engine, target);
        
        if (loc) {
            // If it's on the field, UnfieldAction will route it correctly (and it also triggers leaves-play logic)
            if (['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(loc.zone)) {
                const UnfieldAction = ACTION_REGISTRY['UNFIELD'];
                if (UnfieldAction) new UnfieldAction({ target: target, destination: 'deck' }).run(engine);
            } else {
                // The base Action class already ran processLeavesPlay() which reverted
                // all temporary control effects and reset the ownerId to the true owner!
                const trueOwnerId = target.ownerId || getOwnerId(engine.state, target) || loc.playerId;
                
                if (trueOwnerId && engine.state.players[trueOwnerId]) {
                    moveEntity(engine, target, trueOwnerId, 'deck');
                    shuffleArray(engine.state, engine.state.players[trueOwnerId].deck);
                }
            }
        }
    }
}