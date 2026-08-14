import { Action } from './core.js';

export class ModifyEventAction extends Action {
    execute(engine) {
        if (this.payload.eventContext && this.payload.stat && this.payload.amount !== undefined) {
            this.payload.eventContext[this.payload.stat] = (this.payload.eventContext[this.payload.stat] || 0) + this.payload.amount;
            engine.state.history_log.push({ text: `⚡ Event ${this.payload.stat} modified by ${this.payload.amount > 0 ? '+' : ''}${this.payload.amount}.`, depth: this.getLogDepth(engine) });
        }
    }
}