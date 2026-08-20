import { Action } from './core.js';

export class DiscardAction extends Action {
    execute(engine) {
        this.executeZoneMovement(engine, 'discard');
    }
}