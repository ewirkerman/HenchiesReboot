import { Action, findEntityLocation, registerEffect } from './core.js';
import { resolveResourceKey, getOwnerId } from '../utils.js';

export class ModifyResourceAction extends Action {
    execute(engine) {
        let pId = null;
        
        // 1. Try to apply to the explicit target's owner
        if (this.payload.target) {
            pId = getOwnerId(engine.state, this.payload.target);
        }
        
        // 2. Fall back to the source's owner (the caster)
        if (!pId && this.payload.source) {
            pId = getOwnerId(engine.state, this.payload.source);
        }
        
        // 3. Absolute fallback
        if (!pId) pId = engine.state.activePlayerId;

        const p = engine.state.players[pId];
        if (!p) return;

        const res = this.payload.resource || 'Carnie';
        const amt = Number(this.payload.amount) || 0;

        let actualKey = res === 'maxCarnie' ? 'maxCarnie' : resolveResourceKey(engine.state, p, res);

        if (actualKey === 'maxCarnie') {
            if (!p.resources['Carnie']) p.resources['Carnie'] = { current: 0, max: 0 };
            p.resources['Carnie'].max += amt;
            if (amt > 0) p.resources['Carnie'].current += amt; // Ensure they can spend it this turn
        } else {
            if (!p.resources[actualKey]) {
                p.resources[actualKey] = { current: 0, max: 0 };
            }
            p.resources[actualKey].current += amt;
        }
        
        // Log the resource modification so the user can verify it's working
        if (amt !== 0) {
            const sign = amt > 0 ? '+' : '';
            engine.state.history_log.push({ text: `✨ ${p.name} received ${sign}${amt} ${actualKey}.`, depth: this.getLogDepth(engine) });
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