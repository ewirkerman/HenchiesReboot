import { Action, ACTION_REGISTRY } from './core.js';

export class KillAction extends Action {
    execute(engine) {
        if (this.payload.target) {
            this.payload.target.health = 0; 
            if (!this.payload.target._isDying) {
                this.payload.target._isDying = true;
                const UnfieldAction = ACTION_REGISTRY['UNFIELD'];
                if (UnfieldAction) {
                    new UnfieldAction({ target: this.payload.target, destination: 'discard' }).run(engine);
                }
            }
        }
    }
}