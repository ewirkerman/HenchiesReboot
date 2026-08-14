import { Action, findEntityLocation, moveEntity } from './core.js';

export class FieldAction extends Action {
    execute(engine) {
        const loc = findEntityLocation(engine, this.payload.target);
        if (loc && ['hand', 'discard'].includes(loc.zone)) {
            const target = this.payload.target;
            let destZone = (target.type === 'artifact' || target.type === 'equipment') ? 'equator' : (target.type === 'boon' ? 'avatar' : 'back');
            
            if (target.type === 'unit') {
                target.defaultLine = target.defaultLine || 'mid';
                destZone = target.defaultLine;
                target.line = destZone;
            }
            
            moveEntity(engine, target, loc.playerId, destZone);
            engine.state.history_log.push({ text: `✨ '${target.name}' was fielded.`, depth: this.getLogDepth(engine) });
        }
    }
}