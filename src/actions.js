/**
 * src/actions.js
 * Henchies 2 Actions Architecture
 * Standardizes the 4-Phase Action Pipeline for all engine state changes.
 */

export const ACTION_MANIFEST = {
    'DEAL_DAMAGE': { passiveType: 'BE_DAMAGED', canInvert: true, canBeCost: true, requiresAmount: true, validZones: ['FIELD'], validDurations: ['INSTANT'] },
    'HEAL': { passiveType: 'BE_HEALED', canInvert: true, canBeCost: false, requiresAmount: true, validZones: ['FIELD'], validDurations: ['INSTANT'] },
    'KILL': { passiveType: 'BE_KILLED', canInvert: true, canBeCost: true, validZones: ['FIELD'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'GRANT_ABILITY': { passiveType: 'BE_GRANTED_ABILITY', canInvert: true, canBeCost: false, requiresGrantedAbility: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'MODIFY_STAT': { passiveType: 'BE_STAT_MODIFIED', canInvert: true, canBeCost: true, requiresAmount: true, requiresStat: true, canLimitStacks: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'SET_STAT': { passiveType: 'BE_STAT_SET', canInvert: true, canBeCost: true, requiresAmount: true, requiresStat: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'MODIFY_RESOURCE': { passiveType: 'BE_RESOURCE_MODIFIED', canInvert: true, canBeCost: true, requiresAmount: true, requiresResource: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'DRAW_CARD': { passiveType: 'BE_DRAWN', canInvert: true, canBeCost: false, requiresAmount: false, validZones: ['DECK'], validDurations: ['INSTANT'] },
    'SUMMON': { passiveType: 'BE_SUMMONED', canInvert: false, canBeCost: false, requiresAmount: true, requiresCardId: true, requiresZone: true, requiresZoneOwner: true, hasNestedGroup: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'PLAY': { passiveType: 'BE_PLAYED', canInvert: true, canBeCost: false, validZones: ['HAND'], validDurations: ['INSTANT'] },
    'ATTACK': { passiveType: 'BE_ATTACKED', canInvert: true, canBeCost: false, validZones: ['FIELD'], validDurations: ['INSTANT'] },
    'HARVEST': { passiveType: 'BE_HARVESTED', canInvert: true, canBeCost: false, validZones: ['HAND'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'BLOCK_ACT': { passiveType: null, canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'BLOCK_ATTACK': { passiveType: null, canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'BLOCK_RETALIATE': { passiveType: null, canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'CANCEL_EVENT': { passiveType: null, canInvert: false, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT'] },
    'CLEANSE': { passiveType: 'BE_CLEANSED', canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT'] },
    'CHANGE_DESTINATION': { passiveType: null, canInvert: false, canBeCost: false, requiresZone: true, validZones: 'ALL', validDurations: ['INSTANT'] },
    'REMOVE_ABILITY': { passiveType: null, canInvert: true, canBeCost: false, requiresGrantedAbility: true, validZones: 'ALL', validDurations: ['INSTANT'] },
    'MODIFY_EVENT': { passiveType: null, canInvert: false, canBeCost: false, requiresAmount: true, requiresStat: true, validZones: 'ALL', validDurations: ['INSTANT'] },
    'CUSTOM_SCRIPT': { passiveType: null, canInvert: true, canBeCost: true, requiresScript: true, validZones: 'ALL', validDurations: ['INSTANT'] },
    'DISCARD': { passiveType: 'BE_DISCARDED', canInvert: true, canBeCost: true, requiresAmount: false, validZones: ['HAND', 'DECK'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'DISCARD_CARD': { passiveType: 'BE_DISCARDED', canInvert: true, canBeCost: true, requiresAmount: false, validZones: ['HAND', 'DECK'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'SHUFFLE': { passiveType: 'BE_SHUFFLED', canInvert: true, canBeCost: true, validZones: 'ALL', validDurations: ['INSTANT'], isLeavesPlay: true },
    'RETURN': { passiveType: 'BE_RETURNED', canInvert: true, canBeCost: true, validZones: ['FIELD'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'RECOVER': { passiveType: 'BE_RECOVERED', canInvert: true, canBeCost: false, requiresAmount: false, validZones: ['DISCARD'], validDurations: ['INSTANT'] },
    'ATTACH': { passiveType: 'BE_ATTACHED', canInvert: true, canBeCost: false, validZones: ['FIELD'], validDurations: ['INSTANT'] },
    'ATTACH_TO': { passiveType: 'BE_ATTACHED', canInvert: true, canBeCost: false, validZones: ['FIELD'], validDurations: ['INSTANT'] },
    'REBEL': { passiveType: 'BE_REBELLED', canInvert: true, canBeCost: false, validZones: ['FIELD'], validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'UNATTACH': { passiveType: 'BE_UNATTACHED', canInvert: true, canBeCost: true, validZones: ['FIELD'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'UNFIELD': { passiveType: 'BE_UNFIELDED', canInvert: true, canBeCost: true, validZones: ['FIELD'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'TRASH': { passiveType: 'BE_TRASHED', canInvert: true, canBeCost: true, requiresAmount: false, validZones: ['FIELD', 'HAND', 'DECK'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'FIELD': { passiveType: 'BE_FIELDED', canInvert: true, canBeCost: false, validZones: ['HAND', 'DISCARD'], validDurations: ['INSTANT'] },
    'BANISH': { passiveType: 'BE_BANISHED', canInvert: true, canBeCost: true, validZones: 'ALL', validDurations: ['INSTANT'], isLeavesPlay: true }
};

import { shuffleArray, generateId } from './prandom.js';

export class Action {
    constructor(payload) {
        // Automatically derive the type via minification-safe registry lookup instead of regex parsing class names
        this.type = payload.type || Object.keys(ACTION_REGISTRY).find(k => ACTION_REGISTRY[k] === this.constructor);
        
        if (!this.type) console.warn(`[Action] Could not determine action type for constructor!`, this);
        
        const manifest = ACTION_MANIFEST[this.type];
        this.passiveType = manifest ? manifest.passiveType : null;
        this.payload = payload; // { source, target, amount, stat, etc. }
        this.payload.type = this.type; // Guarantee type exists in payload for safe effect registration
    }

    run(engine) {
        console.log(`[ACTION EXECUTION] Depth ${engine.state._actionDepth || 0} -> Running ${this.type} Action. Context available:`, !!this.payload.eventContext);
        if (!engine.state._actionDepth) engine.state._actionDepth = 0;
        engine.state._actionDepth++;
        
        try {
            // 1. Interrupt Phase
            if (engine.emit(`WOULD_${this.type}`, this.payload).cancelled) return false;
            if (this.passiveType && engine.emit(`WOULD_${this.passiveType}`, this.payload).cancelled) return false;

            // 2. Modification Phase
            engine.emit(`MODIFY_${this.type}`, this.payload);
            if (this.passiveType) engine.emit(`MODIFY_${this.passiveType}`, this.payload);

            const manifest = ACTION_MANIFEST[this.type];
            if (manifest && manifest.isLeavesPlay && this.payload.target && this.payload.target.attachments && this.payload.target.attachments.length > 0) {
                const atts = [...this.payload.target.attachments];
                const UnattachClass = ACTION_REGISTRY['UNATTACH'];
                if (UnattachClass) {
                    for (const att of atts) {
                        new UnattachClass({ target: att }).run(engine);
                    }
                }
            }

            // 3. Execution Phase
            this.execute(engine);

            // 4. Reaction Phase
            engine.emit(`ON_${this.type}`, this.payload);
            if (this.passiveType) engine.emit(`ON_${this.passiveType}`, this.payload);

            return true;
        } finally {
            engine.state._actionDepth--;
            if (engine.state._actionDepth <= 0) {
                engine.state._actionDepth = 0;
                this.sweepActionEffects(engine);
            }
        }
    }
    
    sweepActionEffects(engine) {
        const checkAndClean = (ent) => {
            if (ent && ent.activeEffects) {
                for (let i = ent.activeEffects.length - 1; i >= 0; i--) {
                    if (ent.activeEffects[i].duration === 'ACTION') {
                        revertEffect(engine, ent, ent.activeEffects[i]);
                        ent.activeEffects.splice(i, 1);
                    }
                }
            }
        };

        for (const pId of ['player1', 'player2']) {
            const p = engine.state.players[pId];
            if (p && p.lines) {
                for (const line in p.lines) {
                    if (p.lines[line]) p.lines[line].forEach(checkAndClean);
                }
            }
            if (p) {
                ['hand', 'deck', 'discard', 'banish'].forEach(z => {
                    if (p[z]) p[z].forEach(checkAndClean);
                });
            }
        }
        if (engine.state.equator) engine.state.equator.forEach(checkAndClean);
    }

    execute(engine) {
        console.warn(`Base Action execute called for ${this.type}. Missing subclass implementation.`);
    }
}

export function findEntityLocation(engine, target) {
    if (!target) return null;
    for (const pId of ['player1', 'player2']) {
        const p = engine.state.players[pId];
        
        for (const line in p.lines) {
            if (p.lines[line]) {
                const idx = p.lines[line].findIndex(c => c.instanceId === target.instanceId);
                if (idx > -1) return { playerId: pId, zone: line, array: p.lines[line], index: idx };
                
                for (const u of p.lines[line]) {
                    if (u.attachments) {
                        const aIdx = u.attachments.findIndex(a => a.instanceId === target.instanceId);
                        if (aIdx > -1) return { playerId: pId, zone: 'attachment', array: u.attachments, index: aIdx, host: u };
                    }
                }
            }
        }
        
        const zones = ['hand', 'deck', 'discard', 'banish'];
        for (const z of zones) {
            const idx = p[z].findIndex(c => c.instanceId === target.instanceId);
            if (idx > -1) return { playerId: pId, zone: z, array: p[z], index: idx };
        }
    }
    if (engine.state.equator) {
        const idx = engine.state.equator.findIndex(c => c.instanceId === target.instanceId);
        if (idx > -1) return { playerId: null, zone: 'equator', array: engine.state.equator, index: idx };
    }
    return null;
}

export function moveEntity(engine, target, destPlayerId, destZone) {
    destZone = String(destZone || 'discard').toLowerCase();
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
    delete safePayload.eventContext;
    
    // Use a deterministic ID based on the history log length to prevent replay desyncs
    target.activeEffects.push({
        id: 'eff_' + engine.state.history_log.length + '_' + target.activeEffects.length,
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
             let remainingLineEffect = null;
             if (target.activeEffects) {
                 const others = target.activeEffects.filter(e => e.type === 'SET_STAT' && e.stat === 'line' && e.id !== effect.id);
                 if (others.length > 0) {
                     remainingLineEffect = others[others.length - 1];
                 }
             }
             
             let dest;
             if (remainingLineEffect) {
                 dest = remainingLineEffect.amount;
             } else {
                 const defaultLine = target.defaultLine || 'mid';
                 dest = effect.originalValue || defaultLine;
             }
             
             if (target.line !== dest) {
                 target.line = dest;
                 const loc = findEntityLocation(engine, target);
                 if (loc && loc.playerId && loc.zone !== dest) {
                     moveEntity(engine, target, loc.playerId, dest);
                     engine.state.history_log.push(`🔄 '${target.name}' returned to ${dest} line.`);
                 }
             }
        } else if (typeof effect.originalValue === 'number' && typeof effect.delta === 'number') {
            target[effect.stat] -= effect.delta;
        } else {
            let remainingEffect = null;
            if (target.activeEffects) {
                const others = target.activeEffects.filter(e => e.type === 'SET_STAT' && e.stat === effect.stat && e.id !== effect.id);
                if (others.length > 0) remainingEffect = others[others.length - 1];
            }
            target[effect.stat] = remainingEffect ? remainingEffect.amount : effect.originalValue;
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
    } else if (effect.type === 'REBEL') {
        const loc = findEntityLocation(engine, target);
        if (loc && effect.originalOwnerId && loc.playerId !== effect.originalOwnerId) {
            moveEntity(engine, target, effect.originalOwnerId, loc.zone);
            target.ownerId = effect.originalOwnerId;
            engine.state.history_log.push(`🔄 '${target.name}' returned to its original owner.`);
        }
    }
}

export function sweepTurnEffects(engine, endingPlayerId) {
    for (const pId of ['player1', 'player2']) {
        const p = engine.state.players[pId];
        for (const line in p.lines) {
            if (p.lines[line]) {
                [...p.lines[line]].forEach(u => {
                    new CleanseAction({ target: u, endingPlayerId }).run(engine);
                });
            }
        }
    }
    if (engine.state.equator) {
        engine.state.equator.forEach(u => {
            new CleanseAction({ target: u, endingPlayerId }).run(engine);
        });
    }
}


export class DealDamageAction extends Action {
    execute(engine) {
        const { target, source, isCombat } = this.payload;
        let amount = this.payload.amount;
        if (target && amount !== undefined) {
            if (isCombat && target.armor && target.armor > 0 && amount > 0) {
                const blocked = Math.min(target.armor, amount);
                target.armor -= blocked;
                amount -= blocked;
                engine.state.history_log.push(`🛡️ ${target.name}'s Armor absorbed ${blocked} combat damage!`);
            }
            
            target.health = Math.max(0, (target.health || 0) - amount);
            engine.state.history_log.push(`💥 ${target.name || 'Target'} took ${amount} damage.`);
            
            const isDazed = target.abilities?.some(a => a.name && a.name.toLowerCase() === 'dazed') || 
                            target.activeEffects?.some(e => e.type === 'GRANT_ABILITY' && ((e.grantedAbilityId && e.grantedAbilityId.toLowerCase() === 'dazed') || (e.traitId && e.traitId.toLowerCase() === 'dazed'))) ||
                            target.traits?.some(t => t.toLowerCase() === 'dazed');

            if (isDazed) {
                if (target.abilities) target.abilities = target.abilities.filter(a => !(a.name && a.name.toLowerCase() === 'dazed'));
                if (target.activeEffects) {
                    target.activeEffects = target.activeEffects.filter(e => !(e.type === 'GRANT_ABILITY' && ((e.grantedAbilityId && e.grantedAbilityId.toLowerCase() === 'dazed') || (e.traitId && e.traitId.toLowerCase() === 'dazed'))));
                }
                if (target.traits) target.traits = target.traits.filter(t => t.toLowerCase() !== 'dazed');
                engine.state.history_log.push(`💫 ${target.name} snapped out of being Dazed!`);
            }

            if (target.type === 'avatar' && target.health <= 0) {
                const loc = findEntityLocation(engine, target);
                const loserId = loc ? loc.playerId : (engine.state.activePlayerId === 'player1' ? 'player2' : 'player1');
                engine.state.status = 'finished';
                engine.state.winner = loserId === 'player1' ? 'player2' : 'player1';
                engine.state.history_log.push(`☠️ Avatar ${target.name} has fallen! Match finished.`);
            }
            if (target.health <= 0 && target.type !== 'avatar' && !target._isDying && !this.payload.deferDeath) {
                new KillAction({ source, target, isCombat, eventContext: { isCombat } }).run(engine);
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
        const { target, stat, amount, sourceAbilityId, maxStacks } = this.payload;
        if (!target || !stat || amount === undefined || amount === 0) return;
        
        let actualDelta = amount;

        // Track stat increases for source-based caps (useful for stacking buffs or limits)
        if (amount > 0 && sourceAbilityId && maxStacks && maxStacks > 0) {
            if (!target.statSources) target.statSources = {};
            if (!target.statSources[stat]) target.statSources[stat] = [];
            
            const currentStacks = target.statSources[stat].filter(id => id === sourceAbilityId).length;
            actualDelta = Math.min(amount, maxStacks - currentStacks);
            if (actualDelta <= 0) return; // Hit the source cap
        }

        target[stat] = (target[stat] || 0) + actualDelta;

        // Push tracking entries (1 per +1 amount) to maintain limits across turns
        if (actualDelta > 0 && sourceAbilityId) {
            if (!target.statSources) target.statSources = {};
            if (!target.statSources[stat]) target.statSources[stat] = [];
            for (let i = 0; i < actualDelta; i++) target.statSources[stat].push(sourceAbilityId);
        } 
        // Remove tracking entries if stat decreases so sources can replenish consumable stats
        else if (actualDelta < 0 && target.statSources && target.statSources[stat]) {
            for(let i = 0; i < Math.abs(actualDelta); i++) {
                if (target.statSources[stat].length > 0) {
                    target.statSources[stat].shift(); // Remove oldest tracking entry
                }
            }
        }

        registerEffect(engine, target, this.payload, { delta: actualDelta });
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

export class SetStatAction extends Action {
    execute(engine) {
        const { target, stat, amount } = this.payload;
        if (target && stat && amount !== undefined) {
            let oldVal = target[stat];
            if (oldVal === undefined) {
                if (stat === 'line') oldVal = target.type === 'avatar' ? 'avatar' : (target.defaultLine || 'mid');
                else oldVal = typeof amount === 'number' ? 0 : null;
            }
            
            let trueOriginal = oldVal;
            if (target.activeEffects) {
                const existingEffects = target.activeEffects.filter(e => e.type === 'SET_STAT' && e.stat === stat);
                if (existingEffects.length > 0) {
                    trueOriginal = existingEffects[0].originalValue; 
                }
            }
            
            target[stat] = amount;
            let delta = 0;
            if (typeof oldVal === 'number' && typeof amount === 'number') {
                delta = amount - oldVal;
            }
            registerEffect(engine, target, this.payload, { originalValue: trueOriginal, delta: delta });
            
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
            if (!fullAb) fullAb = { 
                abilityId: this.payload.grantedAbilityId,
                name: "Unresolved Ability",
                trigger: "MANUAL",
                description: "Failed to load ability data from catalog."
            };
            
            if (!this.payload.target.abilities) this.payload.target.abilities = [];
            this.payload.target.abilities.push(JSON.parse(JSON.stringify(fullAb)));
            registerEffect(engine, this.payload.target, this.payload);
        }
    }
}

export class RemoveAbilityAction extends Action {
    execute(engine) {
        if (this.payload.target && this.payload.grantedAbilityId) {
            const targetId = this.payload.grantedAbilityId;
            if (this.payload.target.abilities) {
                this.payload.target.abilities = this.payload.target.abilities.filter(a => a.abilityId !== targetId && a.name !== targetId);
            }
            if (this.payload.target.activeEffects) {
                this.payload.target.activeEffects = this.payload.target.activeEffects.filter(e => !(e.type === 'GRANT_ABILITY' && (e.grantedAbilityId === targetId || e.traitId === targetId)));
            }
        }
    }
}

export class DrawCardAction extends Action {
    execute(engine) {
        const target = this.payload.target;
        if (target) {
            const loc = findEntityLocation(engine, target);
            if (loc && loc.zone === 'deck') {
                moveEntity(engine, target, loc.playerId, 'hand');
                target.readiness = 0; // Drawn cards natively enter hand unready
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
        
        let destZone = (instance.type === 'artifact' || instance.type === 'equipment') ? 'equator' : (instance.type === 'boon' ? 'avatar' : (instance.type === 'spell' ? 'discard' : (this.payload.targetLine || 'back')));
        
        if (instance.type === 'unit') {
             instance.defaultLine = instance.defaultLine || 'mid';
             if (instance.defaultLine !== 'mid') {
                 destZone = instance.defaultLine;
             }
        }

        const loc = findEntityLocation(engine, this.payload.target);
        if (loc && loc.array) loc.array.splice(loc.index, 1);
        
        const ownerId = loc ? loc.playerId : engine.state.activePlayerId;
        moveEntity(engine, instance, ownerId, destZone);
        
        // Ensure subsequent ON_PLAY triggers reference the live board instance, not the dead hand proxy!
        this.payload.target = instance; 
        
        if (instance.type === 'unit') {
             instance.line = instance.defaultLine || 'mid';
             
             if (destZone !== instance.line) {
                 const tempEffect = new SetStatAction({
                     source: instance,
                     target: instance,
                     stat: 'line',
                     amount: destZone,
                     duration: 'TEMPORARY'
                 });
                 tempEffect.execute(engine);
             } else {
                 instance.line = destZone;
             }
        }
        
        engine.state.history_log.push(`🃏 Played ${instance.name}.`);
        
        // Play is a physical movement to the field, making it a subset of Field events.
        // Summon bypasses this because tokens materialize natively on the board.
        if (instance.type !== 'spell') {
            engine.emit('ON_FIELD', { source: this.payload.source, target: instance, eventContext: this.payload.eventContext });
            engine.emit('ON_BE_FIELDED', { source: this.payload.source, target: instance, eventContext: this.payload.eventContext });
        }
    }
}

export class AttackAction extends Action {
    execute(engine) {
        const attacker = this.payload.source;
        const defender = this.payload.target;
        
        engine.state.history_log.push(`⚔️ ${attacker.name || 'Unit'} attacks ${defender.name || 'Unit'}!`);
        
        const atkDmg = attacker.strength !== null && attacker.strength !== undefined ? attacker.strength : null;
        const defBlockRetaliate = defender.activeEffects?.some(e => e.type === 'BLOCK_RETALIATE' || e.type === 'BLOCK_ACT');
        const defDmg = defBlockRetaliate ? null : (defender.strength !== null && defender.strength !== undefined ? defender.strength : null);
        
        const getSpeed = (ent) => {
            let speed = 0;
            if (ent.fast && ent.fast > 0) { 
                speed += 1; 
                ent.fast -= 1; 
                // Release the source tracker so the ability can replenish this charge next turn
                if (ent.statSources && ent.statSources.fast && ent.statSources.fast.length > 0) ent.statSources.fast.shift();
            }
            if (ent.slow && ent.slow > 0) { 
                speed -= 1; 
                ent.slow -= 1; 
                if (ent.statSources && ent.statSources.slow && ent.statSources.slow.length > 0) ent.statSources.slow.shift();
            }
            
            const hasFast = ent.abilities?.some(a => ['swift', 'first strike', 'fast'].includes(a.name.toLowerCase()));
            const hasSlow = ent.abilities?.some(a => a.name.toLowerCase() === 'slow');
            if (hasFast) speed += 1;
            if (hasSlow) speed -= 1;
            
            return Math.max(-1, Math.min(1, speed));
        };

        const atkSpeed = getSpeed(attacker);
        const defSpeed = getSpeed(defender);

        // Execute sequential combat phases: Fast (1) -> Normal (0) -> Slow (-1)
        for (const phase of [1, 0, -1]) {
            const atkStrikes = atkSpeed === phase && atkDmg !== null && atkDmg >= 0 && attacker.health > 0;
            const defStrikes = defSpeed === phase && defDmg !== null && defDmg >= 0 && defender.health > 0;

            if (atkStrikes) new DealDamageAction({ source: attacker, target: defender, amount: atkDmg, isCombat: true, deferDeath: true }).run(engine);
            if (defStrikes) new DealDamageAction({ source: defender, target: attacker, amount: defDmg, isCombat: true, deferDeath: true }).run(engine);
            
            // After simultaneous strikes resolve in this speed phase, evaluate deaths
            if (atkStrikes || defStrikes) {
                if (defender.health <= 0 && defender.type !== 'avatar' && !defender._isDying) {
                    new KillAction({ source: attacker, target: defender, isCombat: true, eventContext: { isCombat: true } }).run(engine);
                }
                if (attacker.health <= 0 && attacker.type !== 'avatar' && !attacker._isDying) {
                    new KillAction({ source: defender, target: attacker, isCombat: true, eventContext: { isCombat: true } }).run(engine);
                }
            }
        }
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

export class DiscardAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) { if (['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(loc.zone)) { new UnfieldAction({ target: this.payload.target, destination: 'discard' }).run(engine); } else { moveEntity(engine, this.payload.target, loc.playerId, 'discard'); } } } }
export class ShuffleAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) { if (['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(loc.zone)) { new UnfieldAction({ target: this.payload.target, destination: 'deck' }).run(engine); } else { moveEntity(engine, this.payload.target, loc.playerId, 'deck'); } } } }
export class ReturnAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) { if (['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(loc.zone)) { new UnfieldAction({ target: this.payload.target, destination: 'hand' }).run(engine); } else { moveEntity(engine, this.payload.target, loc.playerId, 'hand'); } } } }
export class RecoverAction extends Action { 
    execute(engine) { 
        const loc = findEntityLocation(engine, this.payload.target); 
        if (loc) {
            moveEntity(engine, this.payload.target, loc.playerId, 'hand'); 
            engine.state.history_log.push(`♻️ Recovered '${this.payload.target.name}' from discard to hand.`);
        }
    } 
}
export class TrashAction extends Action { 
    execute(engine) { 
        const DEBUG_ACTIONS = true;
        if (DEBUG_ACTIONS) console.log(`[DEBUG ACTIONS] TrashAction executing on target:`, this.payload.target?.name);
        const loc = findEntityLocation(engine, this.payload.target); 
        if (loc) { 
            if (DEBUG_ACTIONS) console.log(`[DEBUG ACTIONS] TrashAction found target '${this.payload.target?.name}' in zone: ${loc.zone}. Trashing...`);
            if (['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(loc.zone)) { 
                new UnfieldAction({ target: this.payload.target, destination: 'discard' }).run(engine); 
            } else { 
                moveEntity(engine, this.payload.target, loc.playerId, 'discard'); 
            } 
        } else {
            if (DEBUG_ACTIONS) console.warn(`[DEBUG ACTIONS] TrashAction FAILED: Could not find location for target:`, this.payload.target?.name);
        }
    } 
}
export class BanishAction extends Action { execute(engine) { const loc = findEntityLocation(engine, this.payload.target); if (loc) { if (['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(loc.zone)) { new UnfieldAction({ target: this.payload.target, destination: 'banish' }).run(engine); } else { moveEntity(engine, this.payload.target, loc.playerId, 'banish'); } } } }
export class FieldAction extends Action { 
    execute(engine) { 
        const loc = findEntityLocation(engine, this.payload.target); 
        if (loc) {
            const target = this.payload.target;
            let destZone = (target.type === 'artifact' || target.type === 'equipment') ? 'equator' : (target.type === 'boon' ? 'avatar' : 'back');
            
            if (target.type === 'unit') {
                target.defaultLine = target.defaultLine || 'mid';
                destZone = target.defaultLine;
                target.line = destZone;
                target.health = target.maxHealth || target.health || 1;
            }
            
            moveEntity(engine, target, loc.playerId, destZone); 
            engine.state.history_log.push(`✨ '${target.name}' was fielded.`);
        }
    } 
}

export class AttachAction extends Action { 
    execute(engine) { 
        const source = this.payload.source;
        const target = this.payload.target;
        
        let host = source;
        let attachment = target;
        
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
            
            target.readiness = 0;
            
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
        if (loc && loc.array) loc.array.splice(loc.index, 1);
        if (this.payload.target.isToken) return;
        moveEntity(engine, this.payload.target, loc ? loc.playerId : engine.state.activePlayerId, dest);
    }
}

export class RebelAction extends Action {
    execute(engine) {
        const { target } = this.payload;
        const loc = findEntityLocation(engine, target);
        
        if (loc && loc.playerId) {
            const newOwnerId = loc.playerId === 'player1' ? 'player2' : 'player1';
            
            // Move physically across arrays to the opponent's side
            moveEntity(engine, target, newOwnerId, loc.zone);
            target.ownerId = newOwnerId;
            
            engine.state.history_log.push(`🤝 '${target.name}' rebelled and joined ${engine.state.players[newOwnerId].name}!`);
            
            // Register duration-based reversions
            registerEffect(engine, target, this.payload, { originalOwnerId: loc.playerId });
        }
    }
}

export class SummonAction extends Action {
    execute(engine) {
        const DEBUG_ACTIONS = true;
        const targetName = (this.payload.cardId || '').toLowerCase();
        if (DEBUG_ACTIONS) console.log(`[DEBUG ACTIONS] SummonAction initiated. Looking for cardId: '${this.payload.cardId}' or name: '${targetName}'`);
        
        const card = engine.state.catalog ? engine.state.catalog.find(c => c.id === this.payload.cardId || (c.name && c.name.toLowerCase() === targetName)) : null;
        if (!card) {
            if (DEBUG_ACTIONS) console.warn(`[DEBUG ACTIONS] SummonAction FAILED: Could not find card '${targetName}' in engine catalog.`);
            return;
        }
        
        const destZone = String(this.payload.zone || 'back').toLowerCase();
        
        let fallbackOwner = engine.state.activePlayerId;
        if (this.payload.source) {
            const loc = findEntityLocation(engine, this.payload.source);
            if (loc && loc.playerId) fallbackOwner = loc.playerId;
            else if (this.payload.source.ownerId) fallbackOwner = this.payload.source.ownerId;
        }

        const ownerId = this.payload.zoneOwner === 'TARGET' && this.payload.target ? 
            findEntityLocation(engine, this.payload.target)?.playerId || fallbackOwner : 
            fallbackOwner;
            
        if (DEBUG_ACTIONS) console.log(`[DEBUG ACTIONS] SummonAction found card '${card.name}'. Summoning ${this.payload.amount || 1} copy(ies) to owner: ${ownerId}, zone: ${destZone}`);
            
        const summonedInstances = [];
        
        for (let i = 0; i < (this.payload.amount || 1); i++) {
            const instance = JSON.parse(JSON.stringify(card));
            instance.instanceId = 'sum_' + generateId(engine.state, 8) + '_' + i;
            instance.isToken = true;
            instance.health = instance.health || 1;
            instance.maxHealth = instance.health;
            instance.readiness = 0; // Tokens suffer summoning sickness
            instance.acts = instance.maxActs !== undefined ? instance.maxActs : 1;
            
            let actualDest = destZone;
            if (instance.type === 'unit') {
                 instance.defaultLine = instance.defaultLine || 'mid';
                 instance.line = instance.defaultLine;
                 if (actualDest === 'back' && instance.defaultLine !== 'mid') actualDest = instance.defaultLine;
            }
            
            moveEntity(engine, instance, ownerId, actualDest);
            summonedInstances.push(instance);
            engine.state.history_log.push(`✨ Summoned ${instance.name}.`);
        }
        
        if (this.payload.nestedGroup && this.payload.nestedGroup.payloads && this.payload.nestedGroup.payloads.length > 0) {
            const ng = this.payload.nestedGroup;
            let targets = [];
            if (ng.targetMethod === 'AUTO_ALL') targets = summonedInstances;
            else if (ng.targetMethod === 'AUTO_RANDOM') {
                targets = shuffleArray(engine.state, [...summonedInstances]).slice(0, ng.targetCount || 1);
            } else if (ng.targetMethod === 'AUTO_FIRST') {
                targets = summonedInstances.slice(0, ng.targetCount || 1);
            } else if (ng.targetMethod === 'AUTO_LAST') {
                targets = summonedInstances.slice(-(ng.targetCount || 1));
            }
            
            for (const np of ng.payloads) {
                const ActionClass = ACTION_REGISTRY[np.type];
                if (ActionClass) {
                    for (const target of targets) {
                        const actionPayload = { ...np };
                        actionPayload.source = this.payload.source; 
                        actionPayload.target = target;
                        actionPayload.eventContext = this.payload.eventContext;
                        const action = new ActionClass(actionPayload);
                        action.run(engine);
                    }
                }
            }
        }
    }
}

export class BlockActAction extends Action { execute(engine) { registerEffect(engine, this.payload.target, this.payload); } }
export class BlockAttackAction extends Action { execute(engine) { registerEffect(engine, this.payload.target, this.payload); } }
export class BlockRetaliateAction extends Action { execute(engine) { registerEffect(engine, this.payload.target, this.payload); } }

export class CancelEventAction extends Action {
    execute(engine) {
        if (this.payload.eventContext) this.payload.eventContext.cancelled = true;
        else this.payload.cancelled = true;
    }
}

export class CleanseAction extends Action {
    execute(engine) {
        const { target, endingPlayerId } = this.payload;
        if (!target || !target.activeEffects) return;

        let cleansedCount = 0;
        for (let i = target.activeEffects.length - 1; i >= 0; i--) {
            const eff = target.activeEffects[i];
            let shouldRemove = false;

            if (endingPlayerId) {
                // Natural turn-based sweep
                if (eff.expiresAt === endingPlayerId) shouldRemove = true;
            } else {
                // Manual dispel (from a card ability) clears transient buffs
                if (['TEMPORARY', 'BRIEF'].includes(eff.duration)) shouldRemove = true;
            }

            if (shouldRemove) {
                revertEffect(engine, target, eff);
                target.activeEffects.splice(i, 1);
                cleansedCount++;
            }
        }
        
        if (cleansedCount > 0 && !endingPlayerId) {
            engine.state.history_log.push(`✨ '${target.name || 'Target'}' was cleansed of temporary effects.`);
        }
    }
}

export class ChangeDestinationAction extends Action {
    execute(engine) {
        if (this.payload.eventContext && this.payload.eventContext.destination !== undefined) {
            this.payload.eventContext.destination = this.payload.zone || 'discard';
        }
    }
}

export class ModifyEventAction extends Action {
    execute(engine) {
        if (this.payload.eventContext && this.payload.stat && this.payload.amount !== undefined) {
            this.payload.eventContext[this.payload.stat] = (this.payload.eventContext[this.payload.stat] || 0) + this.payload.amount;
            engine.state.history_log.push(`⚡ Event ${this.payload.stat} modified by ${this.payload.amount > 0 ? '+' : ''}${this.payload.amount}.`);
        }
    }
}

export class CustomScriptAction extends Action { 
    execute(engine) {
        if (this.payload.script) {
            try {
                // Inject 'use strict' to prevent 'this' from leaking to the global Window object
                const fn = new Function('state', 'target', 'params', 'engine', '"use strict";\n' + this.payload.script);
                fn(engine.state, this.payload.target, this.payload, engine);
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
    'REMOVE_ABILITY': RemoveAbilityAction,
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
    'CANCEL_EVENT': CancelEventAction,
    'CLEANSE': CleanseAction,
    'CHANGE_DESTINATION': ChangeDestinationAction,
    'MODIFY_EVENT': ModifyEventAction,
    'CUSTOM_SCRIPT': CustomScriptAction,
    'DISCARD': DiscardAction,
    'SHUFFLE': ShuffleAction,
    'RETURN': ReturnAction,
    'RECOVER': RecoverAction,
    'ATTACH': AttachAction,
    'ATTACH_TO': AttachAction, // Safety fallback for legacy databases
    'REBEL': RebelAction,
    'UNATTACH': UnattachAction,
    'UNFIELD': UnfieldAction,
    'TRASH': TrashAction,
    'KILL': KillAction,
    'FIELD': FieldAction,
    'BANISH': BanishAction
};

export const ACTION_CATEGORIES = {
    'Combat & Stats': ['DEAL_DAMAGE', 'HEAL', 'KILL', 'ATTACK', 'MODIFY_STAT', 'SET_STAT', 'MODIFY_RESOURCE'],
    'Zone Movement': ['DRAW_CARD', 'PLAY', 'SUMMON', 'DISCARD', 'DISCARD_CARD', 'SHUFFLE', 'RETURN', 'RECOVER', 'TRASH', 'BANISH', 'FIELD', 'UNFIELD', 'CHANGE_DESTINATION'],
    'Attachments & Control': ['ATTACH', 'ATTACH_TO', 'UNATTACH', 'REBEL'],
    'Meta & Utility': ['BLOCK_ACT', 'BLOCK_ATTACK', 'BLOCK_RETALIATE', 'CANCEL_EVENT', 'MODIFY_EVENT', 'CLEANSE', 'GRANT_ABILITY', 'REMOVE_ABILITY', 'CUSTOM_SCRIPT', 'HARVEST']
};

export const EFFECT_TYPES = Object.keys(ACTION_MANIFEST);

export function getActionTriggers() {
    const triggers = [];
    Object.keys(ACTION_MANIFEST).forEach(action => {
        triggers.push(`WOULD_${action}`);
        triggers.push(`MODIFY_${action}`);
        triggers.push(`ON_${action}`);
        
        const pType = ACTION_MANIFEST[action].passiveType;
        if (pType) {
            triggers.push(`WOULD_${pType}`);
            triggers.push(`MODIFY_${pType}`);
            triggers.push(`ON_${pType}`);
        }
    });
    return triggers;
}