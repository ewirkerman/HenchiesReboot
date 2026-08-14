import { Action, registerEffect } from './core.js';

export class BlockActAction extends Action {
    execute(engine) {
        registerEffect(engine, this.payload.target, this.payload);
    }
}