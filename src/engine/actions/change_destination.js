import { Action } from './core.js';

export class ChangeDestinationAction extends Action {
    execute(engine) {
        if (this.payload.eventContext && this.payload.eventContext.destination !== undefined) {
            this.payload.eventContext.destination = this.payload.zone || 'discard';
        }
    }
}