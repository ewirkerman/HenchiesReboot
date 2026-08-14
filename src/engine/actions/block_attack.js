import { Action, registerEffect } from './core.js';

export class BlockAttackAction extends Action {
    execute(engine) {
        registerEffect(engine, this.payload.target, this.payload);
    }
}