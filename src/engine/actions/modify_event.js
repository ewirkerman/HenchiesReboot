import { Action } from './core.js';

export class ModifyEventAction extends Action {
    execute(engine) {
        if (this.payload.eventContext && this.payload.stat && this.payload.amount !== undefined) {
            const eventTarget = this.payload.eventContext;
            const currentValue = eventTarget[this.payload.stat] ?? 0;
            const nextValue = currentValue + this.payload.amount;

            eventTarget[this.payload.stat] = nextValue;

            engine.state.history_log.push({ text: `⚡ Event ${this.payload.stat} modified by ${this.payload.amount > 0 ? '+' : ''}${this.payload.amount}.`, depth: this.getLogDepth(engine) });
        }
    }
}