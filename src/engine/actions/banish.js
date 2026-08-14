import { Action, ACTION_REGISTRY, findEntityLocation, moveEntity } from './core.js';

export class BanishAction extends Action {
    execute(engine) {
        const loc = findEntityLocation(engine, this.payload.target);
        if (loc) {
            if (['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(loc.zone)) {
                const UnfieldAction = ACTION_REGISTRY['UNFIELD'];
                if (UnfieldAction) new UnfieldAction({ target: this.payload.target, destination: 'banish' }).run(engine);
            } else {
                moveEntity(engine, this.payload.target, loc.playerId, 'banish');
            }
        }
    }
}