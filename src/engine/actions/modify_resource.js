import { Action, registerEffect } from './core.js';
import { findEntityLocation } from '../utils.js';
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

        // Resolve legacy 'maxCarnie' vs standard keys
        let actualKey = resolveResourceKey(engine.state, p, res === 'maxCarnie' ? 'Carnie' : res);

        // Determine target pool with legacy fallback. 
        // If the new UI toggle isn't present, we infer from old resource names to prevent breaking existing cards.
        let targetPool = this.payload.targetPool;
        if (!targetPool) {
            targetPool = (res === 'maxCarnie') ? 'MAX' : 'CURRENT';
        }

        if (!p.resources[actualKey]) {
            p.resources[actualKey] = { current: 0, max: 0 };
        }

        if (targetPool === 'MAX') {
            p.resources[actualKey].max += amt;
            // Standard CCG logic: gaining max mana also gives you that mana to spend this turn
            if (amt > 0) p.resources[actualKey].current += amt; 
        } else if (targetPool === 'CURRENT') {
            p.resources[actualKey].current += amt;
            
            // Toggle to respect current max when modifying current
            if (this.payload.respectMax) {
                p.resources[actualKey].current = Math.min(p.resources[actualKey].current, p.resources[actualKey].max);
            }
        }
        
        // Log the resource modification so the user can verify it's working
        if (amt !== 0) {
            const sign = amt > 0 ? '+' : '';
            const poolStr = targetPool === 'MAX' ? 'Max ' : '';
            engine.state.history_log.push({ text: `✨ ${p.name} received ${sign}${amt} ${poolStr}${actualKey}.`, depth: this.getLogDepth(engine) });
        }

        let avatar = null;
        for (const line in p.lines) {
            avatar = p.lines[line]?.find(u => u.type === 'avatar');
            if (avatar) break;
        }

        if (avatar && this.payload.duration && this.payload.duration !== 'INSTANT') {
            // Passed targetPool into the registration context so cleanup logic knows which pool to revert
            registerEffect(engine, avatar, this.payload, { delta: amt, resourceKey: actualKey, targetPool });
        }
    }
}