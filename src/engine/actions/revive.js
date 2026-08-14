import { Action, findEntityLocation, moveEntity } from './core.js';

export class ReviveAction extends Action {
    execute(engine) {
        const loc = findEntityLocation(engine, this.payload.target);
        if (loc && loc.zone === 'discard') {
            const target = this.payload.target;
            let destZone = (target.type === 'artifact' || target.type === 'equipment') ? 'equator' : (target.type === 'boon' ? 'avatar' : 'back');
            
            if (target.type === 'unit') {
                target.defaultLine = target.defaultLine || 'mid';
                destZone = target.defaultLine;
                target.line = destZone;
            }
            
            moveEntity(engine, target, loc.playerId, destZone);
            engine.state.history_log.push({ text: `🧟 '${target.name}' was revived from the discard pile.`, depth: this.getLogDepth(engine) });
            
            if (target.type !== 'spell') {
                engine.emit('ON_FIELD', { source: this.payload.source, target: target, eventContext: this.payload.eventContext });
                engine.emit('ON_BE_FIELDED', { source: this.payload.source, target: target, eventContext: this.payload.eventContext });
            }
        }
    }
}