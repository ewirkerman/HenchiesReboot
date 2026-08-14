import { Action, findEntityLocation, moveEntity } from './core.js';

export class DrawCardAction extends Action {
    execute(engine) {
        const target = this.payload.target;
        if (target) {
            const loc = findEntityLocation(engine, target);
            if (loc && loc.zone === 'deck') {
                moveEntity(engine, target, loc.playerId, 'hand');
                target.readiness = 0; 
            }
        }
    }
}