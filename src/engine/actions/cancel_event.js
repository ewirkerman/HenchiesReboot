import { Action } from './core.js';

export class CancelEventAction extends Action {
    execute(engine) {
        if (this.payload.eventContext) {
            this.payload.eventContext.cancelled = true;
        } else {
            this.payload.cancelled = true;
        }
    }
}