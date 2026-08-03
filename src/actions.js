/**
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

    /**
     * Pushes the action through the 4-phase resolution pipeline.
     * @param {GameEngine} engine The active event bus
     * @returns {boolean} True if the action resolved, false if it was cancelled
     */
    run(engine) {
        // 1. Interrupt Phase (Gatekeeper)
        // Listeners can return { cancelled: true } to abort the entire action.
        if (engine.emit(`WOULD_${this.type}`, this.payload).cancelled) return false;
        if (this.passiveType && engine.emit(`WOULD_${this.passiveType}`, this.payload).cancelled) return false;

        // 2. Modification Phase (Mutation)
        // Listeners intercept the payload by reference and alter its values (e.g., reduce damage).
        engine.emit(`MODIFY_${this.type}`, this.payload);
        if (this.passiveType) engine.emit(`MODIFY_${this.passiveType}`, this.payload);

        // 3. Execution Phase (Atomic State Change)
        // The pure function altering the actual game state based on the final payload.
        this.execute(engine);

        // 4. Reaction Phase (Past-Tense Factual Occurrence)
        // Triggers listeners reacting to the action completing successfully.
        engine.emit(`ON_${this.type}`, this.payload);
        if (this.passiveType) engine.emit(`ON_${this.passiveType}`, this.payload);

        return true;
    }

    execute(engine) {
        console.warn(`Base Action execute called for ${this.type}. Missing subclass implementation.`);
    }
}

// ==========================================
// ACTION HELPERS
// ==========================================

export function findEntityLocation(engine, target) {
    if (!target) return null;
    for (const pId of ['player1', 'player2']) {
        const p = engine.state.players[pId];
        if (p.avatar && p.avatar.instanceId === target.instanceId) return { playerId: pId, zone: 'avatar', array: null, index: -1 };
        
        const zones = ['hand', 'deck', 'discard', 'banish'];
        for (const z of zones) {
            const idx = p[z].findIndex(c => c.instanceId === target.instanceId);
            if (idx > -1) return { playerId: pId, zone: z, array: p[z], index: idx };
        }
        
        for (const line in p.lines) {
            const idx = p.lines[line].findIndex(c => c.instanceId === target.instanceId);
            if (idx > -1) return { playerId: pId, zone: line, array: p.lines[line], index: idx };
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
    
    // Clean up physical state when moving into a "living" zone
    if (['hand', 'deck', 'back', 'front', 'mid', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'equator'].includes(destZone)) {
        target._isDying = false;
        if (target.health !== undefined && target.health <= 0) {
            target.health = target.maxHealth || 1;
        }
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
    
    target.activeEffects.push({
        id: 'eff_' + Math.random().toString(36).substr(2, 9),
        type, duration, expiresAt,
        sourceId: source ? source.instanceId : null,
        ...payload,
        ...extraData
    });
}

export function revertEffect(engine, target, effect) {
    if (effect.type === 'MODIFY_STAT') {
        target[effect.stat] -= effect.delta;
    } else if (effect.type === 'SET_STAT') {
        if (effect.stat === 'health') {
            target.health = Math.min(target.health, effect.originalValue);
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
        new UnattachAction({ target: target }).run(engine);
    }
}

export function sweepTurnEffects(engine, endingPlayerId) {
    const entities = [];
    for (const pId of ['player1', 'player2']) {
        const p = engine.state.players[pId];
        if (p.avatar) entities.push(p.avatar);
        for (const line in p.lines) {
            if (line === 'avatar') continue;
            if (p.lines[line]) entities.push(...p.lines[line]);
        }
    }
    if (engine.state.equator) entities.push(...engine.state.equator);
    
    for (const target of entities) {
        if (!target.activeEffects) continue;
        for (let i = target.activeEffects.length - 1; i >= 0; i--) {
            const eff = target.activeEffects[i];
            if ((eff.duration === 'BRIEF' || eff.duration === 'TEMPORARY') && eff.expiresAt === endingPlayerId) {
                revertEffect(engine, target, eff);
                target.activeEffects.splice(i, 1);
            }
        }
    }
}

// ==========================================
// ACTION SUBCLASSES
// ==========================================
import { CARD_CATALOG } from './engine.js';

export class DealDamageAction extends Action {
    execute(engine) {
        if (this.payload.target && this.payload.amount >= 0) {
            this.payload.target.health -= this.payload.amount;
        }
    }
}

export class HealAction extends Action {
    execute(engine) {
        if (this.payload.target && this.payload.amount > 0) {
            this.payload.target.health += this.payload.amount;
            if (this.payload.target.maxHealth && this.payload.target.health > this.payload.target.maxHealth) {
                this.payload.target.health = this.payload.target.maxHealth;
            }
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
        }
    }
}

export class GrantAbilityAction extends Action {
    execute(engine) {
        if (this.payload.target && this.payload.grantedAbilityId) {
            if (!this.payload.target.abilities) this.payload.target.abilities = [];
            this.payload.target.abilities.push({ abilityId: this.payload.grantedAbilityId });
            registerEffect(engine, this.payload.target, this.payload);
        }
    }
}

export class DrawCardAction extends Action {
    execute(engine) {
        const p = engine.state.players[this.payload.target?.owner || engine.state.activePlayerId];
        if (p && p.deck.length > 0) {
            for(let i=0; i<(this.payload.amount || 1); i++) {
                if(p.deck.length > 0) p.hand.push(p.deck.pop());
            }
        }
    }
}

export class PlayAction extends Action {
    execute(engine) {
        const instance = JSON.parse(JSON.stringify(this.payload.target));
        instance.health = instance.health || 1;
        instance.maxHealth = instance.health;
        instance.readiness = 0;
        
        const destZone = instance.type === 'artifact' ? 'equator' : 'back';
        const loc = findEntityLocation(engine, this.payload.target);
        if (loc && loc.array) loc.array.splice(loc.index, 1); // Remove from hand
        
        const ownerId = loc ? loc.playerId : engine.state.activePlayerId;
        moveEntity(engine, instance, ownerId, destZone);
        
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
        
        // Simplified simultaneous combat logic for execution (Speed checks will wrap this later)
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

            if (sTribe.toLowerCase() === 'carnie') {
                player.maxTents += 2;
                player.tents += 2;
                engine.state.history_log.push(`🔥 ${player.name} harvested '${this.payload.target.name}' (Carnie) for +2 Max Tents!`);
            } else {
                player.maxTents += 1;
                player.tents += 1;
                player.resources[resKey].max += 1;
                player.resources[resKey].current += 1;
                engine.state.history_log.push(`🔥 ${player.name} harvested '${this.payload.target.name}' for +1 Max Tent & +1 Max ${resKey} Res!`);
            }
        }
    }
}

export class SummonAction extends Action {
    execute(engine) {
        const card = CARD_CATALOG.find(c => c.id === this.payload.cardId);
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
            
            moveEntity(engine, instance, ownerId, destZone);
            registerEffect(engine, instance, this.payload);
        }
    }
}

export class DiscardAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) moveEntity(engine, this.payload.target, loc.playerId, 'discard'); } }
export class ShuffleAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) { moveEntity(engine, this.payload.target, loc.playerId, 'deck'); /* Needs shuffle util */ } } }
export class ReturnAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) moveEntity(engine, this.payload.target, loc.playerId, 'hand'); } }
export class RecoverAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) moveEntity(engine, this.payload.target, loc.playerId, 'hand'); } }
export class TrashAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) moveEntity(engine, this.payload.target, loc.playerId, 'banish'); } }
export class BanishAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) moveEntity(engine, this.payload.target, loc.playerId, 'banish'); } }
export class FieldAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) moveEntity(engine, this.payload.target, loc.playerId, 'back'); } }
export class AttachAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) moveEntity(engine, this.payload.target, loc.playerId, 'equator'); registerEffect(engine, this.payload.target, this.payload); } }
export class UnattachAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) moveEntity(engine, this.payload.target, loc.playerId, 'equator'); } }

export class UnfieldAction extends Action {
    execute(engine) {
        const dest = this.payload.destination || 'discard';
        const loc = findEntityLocation(engine, this.payload.target);
        const ownerId = loc ? loc.playerId : engine.state.activePlayerId;
        
        if (this.payload.target.activeEffects) {
            for (let i = this.payload.target.activeEffects.length - 1; i >= 0; i--) {
                revertEffect(engine, this.payload.target, this.payload.target.activeEffects[i]);
            }
            this.payload.target.activeEffects = [];
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
        // Execution of arbitrary user-defined script blocks
    } 
}

// ==========================================
// REGISTRY & EXPORTS
// ==========================================

export const ACTION_REGISTRY = {
    'DEAL_DAMAGE': DealDamageAction,
    'HEAL': HealAction,
    'GRANT_ABILITY': GrantAbilityAction,
    'MODIFY_STAT': ModifyStatAction,
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

/**
 * Generates the dynamic lifecycle triggers for every action (WOULD_, MODIFY_, ON_)
 * @returns {Array<string>} Flattened array of all possible action lifecycle events
 */
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