import { Action } from './core.js';

export class ChangeDestinationAction extends Action {
    execute(engine) {
        if (!this.payload.eventContext) this.payload.eventContext = {};
        this.payload.eventContext.destination = (this.payload.zone || 'discard').toLowerCase();
        engine.state.history_log.push({ text: `🔀 Destination changed to ${this.payload.eventContext.destination}.`, depth: this.getLogDepth(engine) });
    }
}