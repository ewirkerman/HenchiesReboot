/**
 * src/actions.js
 * Henchies 2 Actions Architecture
 * Standardizes the 4-Phase Action Pipeline for all engine state changes.
 */

export class Action {
    constructor(payload) {
        // Automatically derive the type from the class name (e.g., DealDamageAction -> DEAL_DAMAGE)
        this.type = this.constructor.name.replace(/Action$/, '').replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
        this.passiveType = DUAL_PREDICATE_ACTIONS[this.type] || null;
        this.payload = payload; // { source, target, amount, stat, etc. }
    }

    run(engine) {
        // 1. Interrupt Phase
        if (engine.emit(`WOULD_${this.type}`, this.payload).cancelled) return false;
        if (this.passiveType && engine.emit(`WOULD_${this.passiveType}`, this.payload).cancelled) return false;

        // 2. Modification Phase
        engine.emit(`MODIFY_${this.type}`, this.payload);
        if (this.passiveType) engine.emit(`MODIFY_${this.passiveType}`, this.payload);

        // 3. Execution Phase
        this.execute(engine);

        // 4. Reaction Phase
        engine.emit(`ON_${this.type}`, this.payload);
        if (this.passiveType) engine.emit(`ON_${this.passiveType}`, this.payload);

        return true;
    }

    execute(engine) {
        console.warn(`Base Action execute called for ${this.type}. Missing subclass implementation.`);
    }
}

export function findEntityLocation(engine, target) {
    if (!target) return null;
    for (const pId of ['player1', 'player2']) {
        const p = engine.state.players[pId];
        if (p.avatar) {
            if (p.avatar.instanceId === target.instanceId) return { playerId: pId, zone: 'avatar', array: null, index: -1 };
            if (p.avatar.attachments) {
                const aIdx = p.avatar.attachments.findIndex(a => a.instanceId === target.instanceId);
                if (aIdx > -1) return { playerId: pId, zone: 'attachment', array: p.avatar.attachments, index: aIdx, host: p.avatar };
            }
        }
        
        const zones = ['hand', 'deck', 'discard', 'banish'];
        for (const z of zones) {
            const idx = p[z].findIndex(c => c.instanceId === target.instanceId);
            if (idx > -1) return { playerId: pId, zone: z, array: p[z], index: idx };
        }
        
        for (const line in p.lines) {
            const idx = p.lines[line].findIndex(c => c.instanceId === target.instanceId);
            if (idx > -1) return { playerId: pId, zone: line, array: p.lines[line], index: idx };
            
            if (p.lines[line]) {
                for (const u of p.lines[line]) {
                    if (u.attachments) {
                        const aIdx = u.attachments.findIndex(a => a.instanceId === target.instanceId);
                        if (aIdx > -1) return { playerId: pId, zone: 'attachment', array: u.attachments, index: aIdx, host: u };
                    }
                }
            }
        }
    }
    if (engine.state.equator) {
        const idx = engine.state.equator.findIndex(c => c.instanceId === target.instanceId);
        if (idx > -1) return { playerId: null, zone: 'equator', array: engine.state.equator, index: idx };
    }
    return null;
}

export function moveEntity(engine, target, destPlayerId, destZone) {
    const loc = findEntityLocation(engine, target);
    if (loc && loc.array) loc.array.splice(loc.index, 1);
    
    if (['hand', 'deck', 'back', 'front', 'mid', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'equator', 'attachment'].includes(destZone)) {
        target._isDying = false;
        if (target.health !== undefined && target.health <= 0) {
            target.health = target.maxHealth || 1;
        }
    }
    
    // Wipes readiness ONLY when going to deck or banish.
    // Discard and Hand fully preserve readiness.
    if (['deck', 'banish'].includes(destZone)) {
        target.readiness = 0;
    }
    
    if (destZone === 'equator') {
        if (!engine.state.equator) engine.state.equator = [];
        engine.state.equator.push(target);
        return;
    }

    const p = engine.state.players[destPlayerId];
    if (!p) return;

    if (['hand', 'deck', 'discard', 'banish'].includes(destZone)) {
        p[destZone].push(target);
    } else if (p.lines[destZone]) {
        p.lines[destZone].push(target);
    } else {
        if (!p.lines['back']) p.lines['back'] = [];
        p.lines['back'].push(target);
    }
}

export function registerEffect(engine, target, payload, extraData = {}) {
    const { duration, type, source } = payload;
    if (!duration || duration === 'INSTANT' || duration === 'PERMANENT') return;
    
    if (!target.activeEffects) target.activeEffects = [];
    
    let expiresAt = null;
    if (duration === 'BRIEF') expiresAt = engine.state.activePlayerId;
    if (duration === 'TEMPORARY') expiresAt = (engine.state.activePlayerId === 'player1' ? 'player2' : 'player1');
    
    const safePayload = { ...payload };
    delete safePayload.source;
    delete safePayload.target;
    
    target.activeEffects.push({
        id: 'eff_' + Math.random().toString(36).substr(2, 9),
        type, duration, expiresAt,
        sourceId: source ? source.instanceId : null,
        ...safePayload,
        ...extraData
    });
}

export function revertEffect(engine, target, effect) {
    if (effect.type === 'MODIFY_STAT') {
        target[effect.stat] -= effect.delta;
    } else if (effect.type === 'MODIFY_RESOURCE') {
        const loc = findEntityLocation(engine, target);
        const pId = loc ? loc.playerId : null;
        if (pId) {
            const p = engine.state.players[pId];
            if (p.resources[effect.resourceKey]) {
                p.resources[effect.resourceKey].current -= effect.delta;
            }
        }
    } else if (effect.type === 'SET_STAT') {
        if (effect.stat === 'health') {
            target.health = Math.min(target.health, effect.originalValue);
        } else if (effect.stat === 'line') {
             target.line = effect.originalValue;
             target._needsLineReconciliation = true;
        } else if (typeof effect.originalValue === 'number' && typeof effect.delta === 'number') {
            target[effect.stat] -= effect.delta;
        } else {
            target[effect.stat] = effect.originalValue;
        }
    } else if (effect.type === 'GRANT_ABILITY') {
        if (target.abilities) {
            const idx = target.abilities.findIndex(a => a.abilityId === effect.grantedAbilityId);
            if (idx > -1) target.abilities.splice(idx, 1);
        }
    } else if (effect.type === 'SUMMON') {
        new UnfieldAction({ target: target }).run(engine);
    } else if (effect.type === 'ATTACH') {
        if (target.attachments) {
            const attIdx = target.attachments.findIndex(a => a.instanceId === effect.sourceId);
            if (attIdx > -1) {
                const att = target.attachments[attIdx];
                new UnattachAction({ target: att }).run(engine);
            }
        }
    }
}

export function sweepTurnEffects(engine, endingPlayerId) {
    for (const pId of ['player1', 'player2']) {
        const p = engine.state.players[pId];
        const sweepList = (entity) => {
            if (!entity || !entity.activeEffects) return;
            for (let i = entity.activeEffects.length - 1; i >= 0; i--) {
                const eff = entity.activeEffects[i];
                if (eff.expiresAt === endingPlayerId) {
                    revertEffect(engine, entity, eff);
                    entity.activeEffects.splice(i, 1);
                }
            }
        };
        if (p.avatar) sweepList(p.avatar);
        for (const line in p.lines) {
            if (p.lines[line]) {
                p.lines[line].forEach(sweepList);
            }
        }
    }
}


export class DealDamageAction extends Action {
    execute(engine) {
        const { target, amount } = this.payload;
        if (target && amount) {
            target.health = Math.max(0, (target.health || 0) - amount);
            engine.state.history_log.push(`💥 ${target.name || 'Target'} took ${amount} damage.`);
            
            if (target.type === 'avatar' && target.health <= 0) {
                engine.state.status = 'finished';
                engine.state.winner = engine.state.activePlayerId === 'player1' ? 'player2' : 'player1';
                engine.state.history_log.push(`☠️ Avatar ${target.name} has fallen! Match finished.`);
            }
            if (target.health <= 0 && target.type !== 'avatar' && !target._isDying) {
                new KillAction({ target }).run(engine);
            }
        }
    }
}

export class HealAction extends Action {
    execute(engine) {
        const { target, amount } = this.payload;
        if (target && amount) {
            const max = target.maxHealth || 30;
            const healed = Math.min(max - target.health, amount);
            target.health = Math.min(max, (target.health || 0) + amount);
            engine.state.history_log.push(`💚 ${target.name || 'Target'} was healed for ${healed} HP.`);
        }
    }
}

export class KillAction extends Action {
    execute(engine) {
        if (this.payload.target) {
            this.payload.target.health = 0; 
            if (!this.payload.target._isDying) {
                this.payload.target._isDying = true;
                new UnfieldAction({ target: this.payload.target, destination: 'discard' }).run(engine);
            }
        }
    }
}

export class ModifyStatAction extends Action {
    execute(engine) {
        const { target, stat, amount } = this.payload;
        if (target && stat && amount) {
            target[stat] = (target[stat] || 0) + amount;
            registerEffect(engine, target, this.payload, { delta: amount });
        }
    }
}

export class ModifyResourceAction extends Action {
    execute(engine) {
        const loc = findEntityLocation(engine, this.payload.target) || findEntityLocation(engine, this.payload.source);
        const pId = loc ? loc.playerId : engine.state.activePlayerId;
        const p = engine.state.players[pId];
        if (!p) return;

        const res = this.payload.resource || 'Carnie';
        const amt = this.payload.amount || 0;

        let actualKey = res;
        actualKey = Object.keys(p.resources).find(k => k.toLowerCase() === res.toLowerCase());
        if (!actualKey) {
            actualKey = res.charAt(0).toUpperCase() + res.slice(1).toLowerCase();
            p.resources[actualKey] = { current: 0, max: 0 };
        }
        p.resources[actualKey].current += amt;

        if (p.avatar && this.payload.duration && this.payload.duration !== 'INSTANT') {
            registerEffect(engine, p.avatar, this.payload, { delta: amt, resourceKey: actualKey });
        }
    }
}

export class SetStatAction extends Action {
    execute(engine) {
        const { target, stat, amount } = this.payload;
        if (target && stat && amount !== undefined) {
            const oldVal = target[stat] !== undefined ? target[stat] : (typeof amount === 'number' ? 0 : null);
            target[stat] = amount;
            let delta = 0;
            if (typeof oldVal === 'number' && typeof amount === 'number') {
                delta = amount - oldVal;
            }
            registerEffect(engine, target, this.payload, { originalValue: oldVal, delta: delta });
            
            if (stat === 'line') {
                const loc = findEntityLocation(engine, target);
                if (loc && loc.playerId && loc.zone !== amount) {
                    moveEntity(engine, target, loc.playerId, amount);
                }
            }
        }
    }
}

export class GrantAbilityAction extends Action {
    execute(engine) {
        if (this.payload.target && this.payload.grantedAbilityId) {
            let fullAb = null;
            if (engine.state.abilityCatalog) {
                fullAb = engine.state.abilityCatalog.find(a => a.abilityId === this.payload.grantedAbilityId);
            }
            if (!fullAb) fullAb = { abilityId: this.payload.grantedAbilityId };
            
            if (!this.payload.target.abilities) this.payload.target.abilities = [];
            this.payload.target.abilities.push(JSON.parse(JSON.stringify(fullAb)));
            registerEffect(engine, this.payload.target, this.payload);
        }
    }
}

export class DrawCardAction extends Action {
    execute(engine) {
        const p = engine.state.players[this.payload.target?.owner || engine.state.activePlayerId];
        if (p && p.deck.length > 0) {
            for(let i=0; i<(this.payload.amount || 1); i++) {
                if(p.deck.length > 0) {
                    const drawnCard = p.deck.pop();
                    drawnCard.readiness = 0; // Drawn cards natively enter hand unready
                    p.hand.push(drawnCard);
                }
            }
        }
    }
}

export class PlayAction extends Action {
    execute(engine) {
        const instance = JSON.parse(JSON.stringify(this.payload.target));
        instance.health = instance.health || 1;
        instance.maxHealth = instance.health;
        instance.readiness = 0; // "Summoning Sickness" when explicitly played
        instance.acts = instance.maxActs !== undefined ? instance.maxActs : 1;
        
        const destZone = (instance.type === 'artifact' || instance.type === 'equipment') ? 'equator' : (this.payload.targetLine || 'back');
        const loc = findEntityLocation(engine, this.payload.target);
        if (loc && loc.array) loc.array.splice(loc.index, 1);
        
        const ownerId = loc ? loc.playerId : engine.state.activePlayerId;
        moveEntity(engine, instance, ownerId, destZone);
        
        // Ensure subsequent ON_PLAY triggers reference the live board instance, not the dead hand proxy!
        this.payload.target = instance; 
        
        if (instance.type === 'unit') {
             const defaultLine = instance.defaultLine || 'mid';
             instance.line = defaultLine;
             
             if (destZone !== defaultLine) {
                 const tempEffect = new SetStatAction({
                     source: instance,
                     target: instance,
                     stat: 'line',
                     amount: destZone,
                     duration: 'BRIEF'
                 });
                 tempEffect.execute(engine);
             }
        }
        
        engine.state.history_log.push(`🃏 Played ${instance.name}.`);
    }
}

export class AttackAction extends Action {
    execute(engine) {
        const attacker = this.payload.source;
        const defender = this.payload.target;
        
        engine.state.history_log.push(`⚔️ ${attacker.name || 'Unit'} attacks ${defender.name || 'Unit'}!`);
        
        if (attacker.type !== 'avatar') attacker.readiness = 0; 
        
        const atkDmg = attacker.strength !== null && attacker.strength !== undefined ? attacker.strength : null;
        const defBlockRetaliate = defender.activeEffects?.some(e => e.type === 'BLOCK_RETALIATE' || e.type === 'BLOCK_ACT');
        const defDmg = defBlockRetaliate ? null : (defender.strength !== null && defender.strength !== undefined ? defender.strength : null);
        
        if (atkDmg !== null && atkDmg >= 0) new DealDamageAction({ source: attacker, target: defender, amount: atkDmg }).run(engine);
        if (defDmg !== null && defDmg >= 0) new DealDamageAction({ source: defender, target: attacker, amount: defDmg }).run(engine);
    }
}

export class HarvestAction extends Action {
    execute(engine) {
        const loc = findEntityLocation(engine, this.payload.target);
        if (loc) {
            const player = engine.state.players[loc.playerId];
            moveEntity(engine, this.payload.target, loc.playerId, 'banish');
            
            let sTribe = this.payload.target.tribe || 'Generic';
            let resKey = Object.keys(player.resources).find(k => k.toLowerCase() === sTribe.toLowerCase());
            if (!resKey) {
                resKey = sTribe.charAt(0).toUpperCase() + sTribe.slice(1).toLowerCase();
                player.resources[resKey] = { current: 0, max: 0 };
            }
            if (!player.resources['Carnie']) player.resources['Carnie'] = { current: 0, max: 0 };

            if (sTribe.toLowerCase() === 'carnie') {
                player.resources['Carnie'].max += 2;
                player.resources['Carnie'].current += 2;
                engine.state.history_log.push(`🔥 ${player.name} harvested '${this.payload.target.name}' (Carnie) for +2 Max Carnie!`);
            } else {
                player.resources['Carnie'].max += 1;
                player.resources['Carnie'].current += 1;
                player.resources[resKey].max += 1;
                player.resources[resKey].current += 1;
                engine.state.history_log.push(`🔥 ${player.name} harvested '${this.payload.target.name}' for +1 Max Carnie & +1 Max ${resKey} Res!`);
            }
        }
    }
}

export class SummonAction extends Action {
    execute(engine) {
        const card = engine.state.catalog ? engine.state.catalog.find(c => c.id === this.payload.cardId) : null;
        if (!card) return;
        
        const destZone = this.payload.zone || 'back';
        const ownerId = this.payload.zoneOwner === 'TARGET' && this.payload.target ? 
            findEntityLocation(engine, this.payload.target)?.playerId || engine.state.activePlayerId : 
            engine.state.activePlayerId;
        
        for (let i = 0; i < (this.payload.amount || 1); i++) {
            const instance = JSON.parse(JSON.stringify(card));
            instance.instanceId = 'sum_' + Math.random().toString(36).substr(2, 9);
            instance.isToken = true;
            instance.health = instance.health || 1;
            instance.maxHealth = instance.health;
            instance.readiness = 0;
            instance.acts = instance.maxActs !== undefined ? instance.maxActs : 1;
            
            moveEntity(engine, instance, ownerId, destZone);
            registerEffect(engine, instance, this.payload);
        }
    }
}

export class DiscardAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) moveEntity(engine, this.payload.target, loc.playerId, 'discard'); } }
export class ShuffleAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) { moveEntity(engine, this.payload.target, loc.playerId, 'deck'); } } }
export class ReturnAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) moveEntity(engine, this.payload.target, loc.playerId, 'hand'); } }
export class RecoverAction extends Action { 
    execute(engine) { 
        const loc = findEntityLocation(engine, this.payload.target); 
        if (loc) {
            moveEntity(engine, this.payload.target, loc.playerId, 'hand'); 
            engine.state.history_log.push(`♻️ Recovered '${this.payload.target.name}' from discard to hand.`);
        }
    } 
}
export class TrashAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) moveEntity(engine, this.payload.target, loc.playerId, 'discard'); } }
export class BanishAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) moveEntity(engine, this.payload.target, loc.playerId, 'banish'); } }
export class FieldAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) moveEntity(engine, this.payload.target, loc.playerId, 'back'); } }

export class AttachAction extends Action { 
    execute(engine) { 
        const source = this.payload.source;
        const target = this.payload.target;
        
        let host = [source, target].find(e => e && (['unit', 'avatar'].includes((e.type || '').toLowerCase())));
        let attachment = [source, target].find(e => e && (['equipment', 'artifact', 'buff'].includes((e.type || '').toLowerCase())));
        
        if (!host || !attachment) {
            console.warn(`[AttachAction] Failed. Source: ${source?.name} (${source?.type}), Target: ${target?.name} (${target?.type})`);
            return;
        }

        // Prevent duplicates
        if (host.attachments && host.attachments.some(a => a.instanceId === attachment.instanceId)) return;

        const loc = findEntityLocation(engine, attachment);
        if (loc && loc.array) loc.array.splice(loc.index, 1);

        if (!host.attachments) host.attachments = [];
        host.attachments.push(attachment);

        const hostLoc = findEntityLocation(engine, host);
        if (hostLoc && hostLoc.playerId) attachment.ownerId = hostLoc.playerId;

        registerEffect(engine, host, this.payload, { sourceId: attachment.instanceId });
        
        engine.state.history_log.push(`🔗 '${attachment.name}' attached to '${host.name}'.`);
    } 
}

export class UnattachAction extends Action { 
    execute(engine) { 
        const loc = findEntityLocation(engine, this.payload.target);
        if (loc && loc.zone === 'attachment') {
            const host = loc.host;
            loc.array.splice(loc.index, 1);
            
            // CLEANUP WHILE_ATTACHED EFFECTS ON HOST
            if (host && host.activeEffects) {
                for (let i = host.activeEffects.length - 1; i >= 0; i--) {
                    const eff = host.activeEffects[i];
                    if (eff.duration === 'WHILE_ATTACHED' && eff.sourceId === this.payload.target.instanceId) {
                        revertEffect(engine, host, eff);
                        host.activeEffects.splice(i, 1);
                    }
                }
            }
            
            const target = this.payload.target;
            const ownerId = loc.playerId || engine.state.activePlayerId;
            
            if (target.type === 'buff') {
                moveEntity(engine, target, ownerId, 'discard');
                engine.state.history_log.push(`🔓 '${target.name}' unattached and was trashed to discard.`);
            } else if (target.type === 'unit') {
                const destLine = target.line || target.defaultLine || 'mid';
                moveEntity(engine, target, ownerId, destLine);
                engine.state.history_log.push(`🔓 '${target.name}' unattached and fell to the ${destLine} line.`);
            } else {
                moveEntity(engine, target, ownerId, 'equator');
                engine.state.history_log.push(`🔓 '${target.name}' unattached and fell to the Equator.`);
            }
        } else if (this.payload.target && ['equipment', 'artifact'].includes(this.payload.target.type)) {
            moveEntity(engine, this.payload.target, engine.state.activePlayerId, 'equator');
        }
    } 
}

export class UnfieldAction extends Action {
    execute(engine) {
        const dest = this.payload.destination || 'discard';
        const loc = findEntityLocation(engine, this.payload.target);
        const ownerId = loc && loc.playerId ? loc.playerId : engine.state.activePlayerId;
        
        if (this.payload.target.activeEffects) {
            for (let i = this.payload.target.activeEffects.length - 1; i >= 0; i--) {
                revertEffect(engine, this.payload.target, this.payload.target.activeEffects[i]);
            }
            this.payload.target.activeEffects = [];
        }

        if (this.payload.target.attachments) {
            const atts = [...this.payload.target.attachments];
            for (const att of atts) {
                new UnattachAction({ target: att }).run(engine);
            }
        }

        if (this.payload.target.isToken) { 
            if (loc && loc.array) loc.array.splice(loc.index, 1);
            return;
        }
        
        moveEntity(engine, this.payload.target, ownerId, dest);
    }
}

export class BlockActAction extends Action { execute(engine) { registerEffect(engine, this.payload.target, this.payload); } }
export class BlockAttackAction extends Action { execute(engine) { registerEffect(engine, this.payload.target, this.payload); } }
export class BlockRetaliateAction extends Action { execute(engine) { registerEffect(engine, this.payload.target, this.payload); } }

export class CustomScriptAction extends Action { 
    execute(engine) {
        if (this.payload.script) {
            try {
                const fn = new Function('state', 'target', 'params', this.payload.script);
                fn(engine.state, this.payload.target, this.payload);
            } catch(e) {
                console.error("Custom script execution error:", e);
            }
        }
    } 
}


export const ACTION_REGISTRY = {
    'DEAL_DAMAGE': DealDamageAction,
    'HEAL': HealAction,
    'GRANT_ABILITY': GrantAbilityAction,
    'MODIFY_STAT': ModifyStatAction,
    'MODIFY_RESOURCE': ModifyResourceAction,
    'SET_STAT': SetStatAction,
    'DRAW_CARD': DrawCardAction,
    'SUMMON': SummonAction,
    'PLAY': PlayAction,
    'ATTACK': AttackAction,
    'HARVEST': HarvestAction,
    'BLOCK_ACT': BlockActAction,
    'BLOCK_ATTACK': BlockAttackAction,
    'BLOCK_RETALIATE': BlockRetaliateAction,
    'CUSTOM_SCRIPT': CustomScriptAction,
    'DISCARD': DiscardAction,
    'SHUFFLE': ShuffleAction,
    'RETURN': ReturnAction,
    'RECOVER': RecoverAction,
    'ATTACH': AttachAction,
    'ATTACH_TO': AttachAction, // Safety fallback for legacy databases
    'UNATTACH': UnattachAction,
    'UNFIELD': UnfieldAction,
    'TRASH': TrashAction,
    'KILL': KillAction,
    'FIELD': FieldAction,
    'BANISH': BanishAction
};

export const EFFECT_TYPES = Object.keys(ACTION_REGISTRY);

export const DUAL_PREDICATE_ACTIONS = {
    'DEAL_DAMAGE': 'BE_DAMAGED',
    'HEAL': 'BE_HEALED',
    'KILL': 'BE_KILLED',
    'GRANT_ABILITY': 'BE_GRANTED_ABILITY',
    'MODIFY_STAT': 'BE_STAT_MODIFIED',
    'MODIFY_RESOURCE': 'BE_RESOURCE_MODIFIED',
    'SET_STAT': 'BE_STAT_SET',
    'DRAW_CARD': 'BE_DRAWN',
    'SUMMON': 'BE_SUMMONED',
    'PLAY': 'BE_PLAYED',
    'ATTACK': 'BE_ATTACKED',
    'HARVEST': 'BE_HARVESTED',
    'DISCARD': 'BE_DISCARDED',
    'SHUFFLE': 'BE_SHUFFLED',
    'RETURN': 'BE_RETURNED',
    'RECOVER': 'BE_RECOVERED',
    'TRASH': 'BE_TRASHED',
    'BANISH': 'BE_BANISHED',
    'FIELD': 'BE_FIELDED',
    'UNFIELD': 'BE_UNFIELDED',
    'ATTACH': 'BE_ATTACHED',
    'UNATTACH': 'BE_UNATTACHED'
};

export function getActionTriggers() {
    const triggers = [];
    EFFECT_TYPES.forEach(action => {
        triggers.push(`WOULD_${action}`);
        triggers.push(`MODIFY_${action}`);
        triggers.push(`ON_${action}`);
        
        if (DUAL_PREDICATE_ACTIONS[action]) {
            const pType = DUAL_PREDICATE_ACTIONS[action];
            triggers.push(`WOULD_${pType}`);
            triggers.push(`MODIFY_${pType}`);
            triggers.push(`ON_${pType}`);
        }
    });
    return triggers;
}