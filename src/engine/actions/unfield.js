import { Action } from './core.js';
import { findEntityLocation } from '../utils.js';
import { moveEntity } from '../utils.js';

export class UnfieldAction extends Action {
    execute(engine) {
        const dest = this.payload.eventContext?.destination || this.payload.destination || 'discard';
        const loc = findEntityLocation(engine, this.payload.target);
        if (loc && loc.array) loc.array.splice(loc.index, 1);
        if (this.payload.target.isToken) return;
        moveEntity(engine, this.payload.target, this.payload.target.ownerId || (loc ? loc.playerId : engine.state.activePlayerId), dest);
    }
}