/**
 * src/engine/actions/mill.js
 * Moves cards directly from the deck to the discard pile.
 */

import { Action } from './core.js';

export class MillAction extends Action {
    execute(engine) {
        this.executeZoneMovement(engine, 'discard');
    }
}