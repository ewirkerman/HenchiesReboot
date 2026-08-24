import { Action } from './core.js';

export class BanishAction extends Action {
    execute(engine) {
        this.executeZoneMovement(engine, 'banish');
    }
}