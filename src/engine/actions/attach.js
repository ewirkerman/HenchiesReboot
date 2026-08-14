import { Action, findEntityLocation, registerEffect } from './core.js';

export class AttachAction extends Action {
    execute(engine) {
        const source = this.payload.source;
        const target = this.payload.target;
        
        let host = source;
        let attachment = target;
        
        if (!host || !attachment) return;

        if (host.attachments && host.attachments.some(a => a.instanceId === attachment.instanceId)) return;

        const loc = findEntityLocation(engine, attachment);
        if (loc && loc.array) loc.array.splice(loc.index, 1);

        if (!host.attachments) host.attachments = [];
        host.attachments.push(attachment);

        const hostLoc = findEntityLocation(engine, host);
        if (hostLoc && hostLoc.playerId) attachment.ownerId = hostLoc.playerId;

        registerEffect(engine, host, this.payload, { sourceId: attachment.instanceId });
        
        engine.state.history_log.push({ text: `🔗 '${attachment.name}' attached to '${host.name}'.`, depth: this.getLogDepth(engine) });
    }
}