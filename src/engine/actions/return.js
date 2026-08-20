import { Action } from './core.js';

export class ReturnAction extends Action {
    execute(engine) {
        this.executeZoneMovement(engine, 'hand');
    }
}