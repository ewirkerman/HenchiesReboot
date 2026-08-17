export const ACTION_MANIFEST = {
    'DEAL_DAMAGE': { passiveType: 'BE_DAMAGED', canInvert: true, canBeCost: true, requiresAmount: true, validZones: ['FIELD'], validDurations: ['INSTANT'] },
    'HEAL': { passiveType: 'BE_HEALED', canInvert: true, canBeCost: false, requiresAmount: true, validZones: ['FIELD'], validDurations: ['INSTANT'] },
    'KILL': { passiveType: 'BE_KILLED', canInvert: true, canBeCost: true, validZones: ['FIELD'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'GRANT_ABILITY': { passiveType: 'BE_GRANTED_ABILITY', canInvert: true, canBeCost: false, requiresGrantedAbility: true, canBlockDuplicates: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'MODIFY_STAT': { passiveType: 'BE_STAT_MODIFIED', canInvert: true, canBeCost: true, requiresAmount: true, requiresStat: true, canLimitStacks: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'SET_STAT': { passiveType: 'BE_STAT_SET', canInvert: true, canBeCost: true, requiresAmount: true, requiresStat: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'MODIFY_RESOURCE': { passiveType: 'BE_RESOURCE_MODIFIED', canInvert: true, canBeCost: true, requiresAmount: true, requiresResource: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'DRAW_CARD': { passiveType: 'BE_DRAWN', canInvert: true, canBeCost: false, requiresAmount: false, validZones: ['DECK'], endZone: ['HAND'], validDurations: ['INSTANT'], breaksUndo: true },
    'SUMMON': { passiveType: 'BE_SUMMONED', canInvert: false, canBeCost: false, requiresAmount: true, requiresCardId: true, requiresZone: true, requiresZoneOwner: true, hasNestedGroup: true, validZones: 'ALL', endZone: ['FIELD'], validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'BRIEF', 'INDEFINITE'] },
    'PLAY': { passiveType: 'BE_PLAYED', canInvert: true, canBeCost: false, validZones: ['HAND'], endZone: ['FIELD'], validDurations: ['INSTANT'] },
    'ATTACK': { passiveType: 'BE_ATTACKED', canInvert: true, canBeCost: false, validZones: ['FIELD'], validDurations: ['INSTANT'] },
    'HARVEST': { passiveType: 'BE_HARVESTED', canInvert: true, canBeCost: false, validZones: ['HAND'], endZone: ['BANISH'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'BLOCK_ACT': { deprecated: true, passiveType: null, canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'BLOCK_ATTACK': { deprecated: true, passiveType: null, canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'BLOCK_RETALIATE': { deprecated: true, passiveType: null, canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'BLOCK_TARGETING': { deprecated: true, passiveType: null, canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'CANCEL_EVENT': { passiveType: null, canInvert: false, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT'] },
    'CLEANSE': { passiveType: 'BE_CLEANSED', canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT'] },
    'CHANGE_DESTINATION': { passiveType: null, canInvert: false, canBeCost: false, requiresZone: true, validZones: 'ALL', validDurations: ['INSTANT'] },
    'REMOVE_ABILITY': { passiveType: null, canInvert: true, canBeCost: false, requiresGrantedAbility: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'MODIFY_EVENT': { passiveType: null, canInvert: false, canBeCost: false, requiresAmount: true, requiresStat: true, validZones: 'ALL', validDurations: ['INSTANT'] },
    'CUSTOM_SCRIPT': { passiveType: null, canInvert: true, canBeCost: true, requiresScript: true, validZones: 'ALL', validDurations: ['INSTANT'], breaksUndo: true },
    'TRANSFORM': { passiveType: 'BE_TRANSFORMED', canInvert: false, canBeCost: true, requiresCardId: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'DISCARD': { passiveType: 'BE_DISCARDED', canInvert: true, canBeCost: true, requiresAmount: false, validZones: ['HAND', 'DECK'], endZone: ['DISCARD'], validDurations: ['INSTANT'], isLeavesPlay: true, breaksUndo: true },
    'DISCARD_CARD': { passiveType: 'BE_DISCARDED', canInvert: true, canBeCost: true, requiresAmount: false, validZones: ['HAND', 'DECK'], endZone: ['DISCARD'], validDurations: ['INSTANT'], isLeavesPlay: true, breaksUndo: true },
    'SHUFFLE': { passiveType: 'BE_SHUFFLED', canInvert: true, canBeCost: true, validZones: 'ALL', validDurations: ['INSTANT'], isLeavesPlay: true, breaksUndo: true },
    'RETURN': { passiveType: 'BE_RETURNED', canInvert: true, canBeCost: true, validZones: ['FIELD'], endZone: ['HAND'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'RECOVER': { passiveType: 'BE_RECOVERED', canInvert: true, canBeCost: false, requiresAmount: false, validZones: ['DISCARD'], endZone: ['HAND'], validDurations: ['INSTANT'] },
    'REVIVE': { passiveType: 'BE_REVIVED', canInvert: true, canBeCost: false, requiresAmount: false, validZones: ['DISCARD'], endZone: ['FIELD'], validDurations: ['INSTANT'] },
    'ATTACH': { passiveType: 'BE_ATTACHED', canInvert: true, canBeCost: false, validZones: ['FIELD'], validDurations: ['WHILE_ATTACHED', 'INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'BRIEF', 'INDEFINITE'] },
    'REBEL': { passiveType: 'BE_REBELLED', canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'UNATTACH': { passiveType: 'BE_UNATTACHED', canInvert: true, canBeCost: true, validZones: ['FIELD'], validDurations: ['INSTANT'], isLeavesPlay: false },
    'UNFIELD': { passiveType: 'BE_UNFIELDED', canInvert: true, canBeCost: true, validZones: ['FIELD'], endZone: ['DISCARD'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'TRASH': { passiveType: 'BE_TRASHED', canInvert: true, canBeCost: true, requiresAmount: false, validZones: ['FIELD', 'HAND', 'DECK'], endZone: ['DISCARD'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'FIELD': { passiveType: 'BE_FIELDED', canInvert: true, canBeCost: false, validZones: ['HAND', 'DISCARD'], endZone: ['FIELD'], validDurations: ['INSTANT'] },
    'BANISH': { passiveType: 'BE_BANISHED', canInvert: true, canBeCost: true, validZones: 'ALL', endZone: ['BANISH'], validDurations: ['INSTANT'], isLeavesPlay: true }
};

export const ACTION_REGISTRY = {};

export class Action {
    constructor(payload) {
        this.type = payload.type || Object.keys(ACTION_REGISTRY).find(k => ACTION_REGISTRY[k] === this.constructor);
        if (!this.type) console.warn(`[Action] Could not determine action type for constructor!`, this);
        
        const manifest = ACTION_MANIFEST[this.type];
        this.passiveType = manifest ? manifest.passiveType : null;
        this.payload = payload; 
        this.payload.type = this.type; 
    }

    getLogDepth(engine) {
        return Math.max(0, (engine.state._actionDepth || 0) + (engine.processingDepth || 0) - 1);
    }

    run(engine) {
        if (!engine.state._actionDepth) engine.state._actionDepth = 0;
        engine.state._actionDepth++;
        
        const manifest = ACTION_MANIFEST[this.type];
        if (manifest && manifest.breaksUndo) {
            engine.state._irreversibleActionOccurred = true;
        }

        if (!engine.state.isReconstructing) {
            const sId = this.payload.source?.instanceId || this.payload.source?.id || 'none';
            const tId = this.payload.target?.instanceId || this.payload.target?.id || 'none';
            const sName = this.payload.source ? `${this.payload.source.name || 'Unknown'} (${sId})` : `System (${sId})`;
            const tName = this.payload.target ? `${this.payload.target.name || 'Unknown'} (${tId})` : `None (${tId})`;
            let extra = '';
            if (['DEAL_DAMAGE', 'HEAL', 'MODIFY_STAT', 'SET_STAT', 'MODIFY_RESOURCE', 'MODIFY_EVENT'].includes(this.type)) {
                extra = `(${this.payload.stat ? this.payload.stat + ': ' : ''}${this.payload.amount !== undefined ? this.payload.amount : 0}) `;
            }
            const indent = '  '.repeat(engine.state._actionDepth - 1);
            console.log(`${indent}⚡ [ACTION] ${this.type} ${extra}| Src: ${sName} -> Tgt: ${tName}`);
        }
        
        try {
            if (engine.emit(`WOULD_${this.type}`, this.payload).cancelled) return false;
            if (this.passiveType && engine.emit(`WOULD_${this.passiveType}`, this.payload).cancelled) return false;

            engine.emit(`MODIFY_${this.type}`, this.payload);
            if (this.passiveType) engine.emit(`MODIFY_${this.passiveType}`, this.payload);

            const manifest = ACTION_MANIFEST[this.type];
            if (manifest && manifest.isLeavesPlay && this.payload.target) {
                const t = this.payload.target;
                
                if (t.attachments && t.attachments.length > 0) {
                    const atts = [...t.attachments];
                    const UnattachClass = ACTION_REGISTRY['UNATTACH'];
                    if (UnattachClass) {
                        for (const att of atts) new UnattachClass({ target: att }).run(engine);
                    }
                }
                
                if (t.activeEffects) {
                    const effectsToRevert = [];
                    for (let i = t.activeEffects.length - 1; i >= 0; i--) {
                        const eff = t.activeEffects[i];
                        if (eff.duration !== 'PERMANENT') {
                            effectsToRevert.push(eff);
                            t.activeEffects.splice(i, 1);
                        }
                    }
                    for (const eff of effectsToRevert) {
                        if (eff.type !== 'SUMMON') revertEffect(engine, t, eff, true);
                    }
                }
                
                if (t.originalOwnerId && t.ownerId !== t.originalOwnerId) t.ownerId = t.originalOwnerId;
                if (t.maxHealth !== undefined) t.health = t.maxHealth;
                if (t.originalPower !== undefined) t.power = t.originalPower;
                if (t.originalStrength !== undefined) t.strength = t.originalStrength;
            }

            if (this.payload.cancelled) return false;

            this.execute(engine);

            if (!this.payload.preventReaction) {
                engine.emit(`ON_${this.type}`, this.payload);
                if (this.passiveType) engine.emit(`ON_${this.passiveType}`, this.payload);
            }

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
            if (!ent) return;
            
            // Bottom-up: Clean children first in case they are unattached by the host's cleanse
            if (ent.attachments && ent.attachments.length > 0) {
                [...ent.attachments].forEach(att => checkAndClean(att));
            }

            if (ent.activeEffects) {
                for (let i = ent.activeEffects.length - 1; i >= 0; i--) {
                    if (ent.activeEffects[i].duration === 'ACTION') {
                        const eff = ent.activeEffects[i];
                        ent.activeEffects.splice(i, 1);
                        revertEffect(engine, ent, eff);
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
    
    const searchAttachments = (host, pId, zoneName) => {
        if (host.attachments) {
            const aIdx = host.attachments.findIndex(a => a.instanceId === target.instanceId);
            if (aIdx > -1) return { playerId: pId, zone: 'attachment', array: host.attachments, index: aIdx, host: host };
            for (const att of host.attachments) {
                const found = searchAttachments(att, pId, 'attachment');
                if (found) return found;
            }
        }
        return null;
    };

    for (const pId of ['player1', 'player2']) {
        const p = engine.state.players[pId];
        
        for (const line in p.lines) {
            if (p.lines[line]) {
                const idx = p.lines[line].findIndex(c => c.instanceId === target.instanceId);
                if (idx > -1) return { playerId: pId, zone: line, array: p.lines[line], index: idx };
                
                for (const u of p.lines[line]) {
                    const found = searchAttachments(u, pId, line);
                    if (found) return found;
                }
            }
        }
        
        const zones = ['hand', 'deck', 'discard', 'banish'];
        for (const z of zones) {
            const idx = p[z].findIndex(c => c.instanceId === target.instanceId);
            if (idx > -1) return { playerId: pId, zone: z, array: p[z], index: idx };
            
            for (const u of p[z]) {
                const found = searchAttachments(u, pId, z);
                if (found) return found;
            }
        }
    }
    if (engine.state.equator) {
        const idx = engine.state.equator.findIndex(c => c.instanceId === target.instanceId);
        if (idx > -1) return { playerId: null, zone: 'equator', array: engine.state.equator, index: idx };
        
        for (const u of engine.state.equator) {
            const found = searchAttachments(u, null, 'equator');
            if (found) return found;
        }
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
    
    target.activeEffects.push({
        id: 'eff_' + engine.state.history_log.length + '_' + target.activeEffects.length,
        type, duration, expiresAt,
        sourceId: source ? source.instanceId : null,
        ...safePayload,
        ...extraData
    });
}

export function revertEffect(engine, target, effect, isLeavingPlay = false) {
    if (effect.type === 'MODIFY_STAT') {
        target[effect.stat] -= effect.delta;
        if (effect.stat === 'health' && target.maxHealth !== undefined) {
            target.health = Math.min(target.health, target.maxHealth);
        }
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
            let remainingEffect = null;
            if (target.activeEffects) {
                const others = target.activeEffects.filter(e => e.type === 'SET_STAT' && e.stat === 'line' && e.id !== effect.id);
                if (others.length > 0) remainingEffect = others[others.length - 1];
            }
            const defaultLine = target.defaultLine || 'mid';
            const dest = remainingEffect ? remainingEffect.amount : (effect.originalValue || defaultLine);
            
            if (target.line !== dest) {
                target.line = dest;
                if (!isLeavingPlay) {
                    const loc = findEntityLocation(engine, target);
                    if (loc && loc.playerId && loc.zone !== dest && loc.zone !== 'sideline' && loc.zone !== 'attachment') {
                        moveEntity(engine, target, loc.playerId, dest);
                        engine.state.history_log.push({ text: `🔄 '${target.name}' returned to ${dest} line.`, depth: Math.max(0, (engine.state._actionDepth || 0) + (engine.processingDepth || 0) - 1) });
                    }
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
    } else if (effect.type === 'REMOVE_ABILITY') {
        if (effect.restoredAbilities && effect.restoredAbilities.length > 0) {
            if (!target.abilities) target.abilities = [];
            effect.restoredAbilities.forEach(ab => target.abilities.push(ab));
        }
        if (effect.restoredEffects && effect.restoredEffects.length > 0) {
            if (!target.activeEffects) target.activeEffects = [];
            effect.restoredEffects.forEach(e => target.activeEffects.push(e));
        }
    } else if (effect.type === 'SUMMON') {
        const UnfieldAction = ACTION_REGISTRY['UNFIELD'];
        if (UnfieldAction) new UnfieldAction({ target: target }).run(engine);
    } else if (effect.type === 'ATTACH') {
        if (target.attachments) {
            const attIdx = target.attachments.findIndex(a => a.instanceId === effect.sourceId);
            if (attIdx > -1) {
                const att = target.attachments[attIdx];
                const UnattachAction = ACTION_REGISTRY['UNATTACH'];
                if (UnattachAction) new UnattachAction({ target: att }).run(engine);
            }
        }
    } else if (effect.type === 'REBEL') {
        const loc = findEntityLocation(engine, target);
        if (loc && effect.originalOwnerId && loc.playerId !== effect.originalOwnerId) {
            moveEntity(engine, target, effect.originalOwnerId, loc.zone);
            target.ownerId = effect.originalOwnerId;
            engine.state.history_log.push({ text: `🔄 '${target.name}' returned to its original owner.`, depth: Math.max(0, (engine.state._actionDepth || 0) - 1) });
        }
    } else if (effect.type === 'TRANSFORM') {
        const TransformActionClass = ACTION_REGISTRY['TRANSFORM'];
        if (TransformActionClass && effect.originalCardId) {
            engine.state.history_log.push({ text: `🔄 '${target.name}' reverted to its original form.`, depth: Math.max(0, (engine.state._actionDepth || 0) + (engine.processingDepth || 0) - 1) });
            new TransformActionClass({ target: target, cardId: effect.originalCardId, duration: 'INSTANT' }).run(engine);
        }
    }
}

export function sweepTurnEffects(engine, endingPlayerId) {
    const cleanseRecursive = (ent) => {
        if (!ent) return;
        
        // Bottom-up: Clean children first in case the host's cleanse un-attaches them
        if (ent.attachments && ent.attachments.length > 0) {
            [...ent.attachments].forEach(att => cleanseRecursive(att));
        }

        const CleanseAction = ACTION_REGISTRY['CLEANSE'];
        if (CleanseAction) new CleanseAction({ target: ent, endingPlayerId }).run(engine);
    };

    for (const pId of ['player1', 'player2']) {
        const p = engine.state.players[pId];
        for (const line in p.lines) {
            if (p.lines[line]) {
                [...p.lines[line]].forEach(u => cleanseRecursive(u));
            }
        }
    }
    if (engine.state.equator) {
        engine.state.equator.forEach(u => cleanseRecursive(u));
    }
}