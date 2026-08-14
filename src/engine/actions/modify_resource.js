import { Action, findEntityLocation, registerEffect } from './core.js';
import { resolveResourceKey } from '../index.js';

export class ModifyResourceAction extends Action {
    execute(engine) {
        const loc = findEntityLocation(engine, this.payload.target) || findEntityLocation(engine, this.payload.source);
        const pId = loc ? loc.playerId : engine.state.activePlayerId;
        const p = engine.state.players[pId];
        if (!p) return;

        const res = this.payload.resource || 'Carnie';
        const amt = this.payload.amount || 0;

        let actualKey = res === 'maxCarnie' ? 'maxCarnie' : resolveResourceKey(engine.state, p, res);

        if (actualKey === 'maxCarnie') {
            if (!p.resources['Carnie']) p.resources['Carnie'] = { current: 0, max: 0 };
            p.resources['Carnie'].max += amt;
        } else {
            if (!p.resources[actualKey]) {
                p.resources[actualKey] = { current: 0, max: 0 };
            }
            p.resources[actualKey].current += amt;
        }

        let avatar = null;
        for (const line in p.lines) {
            avatar = p.lines[line]?.find(u => u.type === 'avatar');
            if (avatar) break;
        }

        if (avatar && this.payload.duration && this.payload.duration !== 'INSTANT') {
            registerEffect(engine, avatar, this.payload, { delta: amt, resourceKey: actualKey });
        }
    }
}