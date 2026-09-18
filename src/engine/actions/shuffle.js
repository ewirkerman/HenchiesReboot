import { Action, ACTION_REGISTRY } from './core.js';
import { findEntityLocation } from '../utils.js';
import { moveEntity } from '../utils.js';
import { shuffleArray } from '../prandom.js';

export class ShuffleAction extends Action {
    execute(engine) {
        const loc = findEntityLocation(engine, this.payload.target);
        if (loc) {
            if (['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(loc.zone)) {
                const UnfieldAction = ACTION_REGISTRY['UNFIELD'];
                if (UnfieldAction) new UnfieldAction({ target: this.payload.target, destination: 'deck' }).run(engine);
            } else {
                moveEntity(engine, this.payload.target, loc.playerId, 'deck');
                shuffleArray(engine.state, engine.state.players[loc.playerId].deck);
            }
        }
    }
}