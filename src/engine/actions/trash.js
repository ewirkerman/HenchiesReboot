import { Action } from './core.js';

export class TrashAction extends Action {
    execute(engine) {
        this.executeZoneMovement(engine, 'discard');
    }
}