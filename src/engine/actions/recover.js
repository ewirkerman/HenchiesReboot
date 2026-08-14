import { Action, findEntityLocation, moveEntity } from './core.js';

export class RecoverAction extends Action {
    execute(engine) {
        const loc = findEntityLocation(engine, this.payload.target);
        if (loc && loc.zone === 'discard') {
            moveEntity(engine, this.payload.target, loc.playerId, 'hand');
            engine.state.history_log.push({ text: `♻️ Recovered '${this.payload.target.name}' from discard to hand.`, depth: this.getLogDepth(engine) });
        }
    }
}