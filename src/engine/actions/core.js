import { isUndoable } from '../utils.js';

export const ACTION_MANIFEST = {
    'DEAL_DAMAGE': { passiveType: 'BE_DAMAGED', canInvert: true, canBeCost: true, requiresAmount: true, validZones: ['FIELD'], validDurations: ['INSTANT'] },
    'HEAL': { passiveType: 'BE_HEALED', canInvert: true, canBeCost: false, requiresAmount: true, validZones: ['FIELD'], validDurations: ['INSTANT'] },
    'KILL': { passiveType: 'BE_KILLED', canInvert: true, canBeCost: true, validZones: ['FIELD'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'GRANT_ABILITY': { passiveType: 'BE_GRANTED_ABILITY', canInvert: true, canBeCost: false, requiresGrantedAbility: true, canBlockDuplicates: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'MODIFY_STAT': { passiveType: 'BE_STAT_MODIFIED', canInvert: true, canBeCost: true, requiresAmount: true, requiresStat: true, canLimitStacks: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'SET_STAT': { passiveType: 'BE_STAT_SET', canInvert: true, canBeCost: true, requiresAmount: true, requiresStat: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'MODIFY_RESOURCE': { passiveType: 'BE_RESOURCE_MODIFIED', canInvert: true, canBeCost: true, requiresAmount: true, requiresResource: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'DRAW_CARD': { passiveType: 'BE_DRAWN', canInvert: true, canBeCost: false, requiresAmount: false, validZones: ['DECK'], endZone: ['HAND'], validDurations: ['INSTANT'] },
    'SUMMON': { passiveType: 'BE_SUMMONED', canInvert: false, canBeCost: false, requiresAmount: true, requiresCardId: true, requiresZone: true, requiresZoneOwner: true, hasNestedGroup: true, validZones: 'ALL', endZone: ['FIELD'], validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'BRIEF', 'INDEFINITE'] },
    'PLAY': { passiveType: 'BE_PLAYED', canInvert: true, canBeCost: false, validZones: ['HAND'], endZone: ['FIELD'], validDurations: ['INSTANT'] },
    'ATTACK': { passiveType: 'BE_ATTACKED', canInvert: true, canBeCost: false, validZones: ['FIELD'], validDurations: ['INSTANT'] },
    'HARVEST': { passiveType: 'BE_HARVESTED', canInvert: true, canBeCost: false, requiresAmount: true, requiresResource: true, validZones: 'ALL', endZone: ['BANISH'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'BLOCK_ACT': { deprecated: true, passiveType: null, canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'BLOCK_ATTACK': { deprecated: true, passiveType: null, canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'BLOCK_RETALIATE': { deprecated: true, passiveType: null, canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'BLOCK_TARGETING': { deprecated: true, passiveType: null, canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'CANCEL_EVENT': { passiveType: null, canInvert: false, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT'] },
    'CLEANSE': { passiveType: 'BE_CLEANSED', canInvert: true, canBeCost: false, validZones: 'ALL', validDurations: ['INSTANT'] },
    'CHANGE_DESTINATION': { passiveType: null, canInvert: false, canBeCost: false, requiresZone: true, validZones: 'ALL', validDurations: ['INSTANT'] },
    'REMOVE_ABILITY': { passiveType: null, canInvert: true, canBeCost: false, requiresGrantedAbility: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'MODIFY_EVENT': { passiveType: null, canInvert: false, canBeCost: false, requiresAmount: true, requiresStat: true, validZones: 'ALL', validDurations: ['INSTANT'] },
    'CUSTOM_SCRIPT': { passiveType: null, canInvert: true, canBeCost: true, requiresScript: true, validZones: 'ALL', validDurations: ['INSTANT'] },
    'TRANSFORM': { passiveType: 'BE_TRANSFORMED', canInvert: false, canBeCost: true, requiresCardId: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'DISCARD': { passiveType: 'BE_DISCARDED', canInvert: true, canBeCost: true, requiresAmount: false, validZones: ['HAND'], endZone: ['DISCARD'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'DISCARD_CARD': { passiveType: 'BE_DISCARDED', canInvert: true, canBeCost: true, requiresAmount: false, validZones: ['HAND'], endZone: ['DISCARD'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'MILL': { passiveType: 'BE_DISCARDED', canInvert: true, canBeCost: true, requiresAmount: false, validZones: ['DECK'], endZone: ['DISCARD'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'SHUFFLE': { passiveType: 'BE_SHUFFLED', canInvert: true, canBeCost: true, validZones: 'ALL', validDurations: ['INSTANT'], isLeavesPlay: true },
    'RETURN': { passiveType: 'BE_RETURNED', canInvert: true, canBeCost: true, validZones: ['FIELD'], endZone: ['HAND'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'RECOVER': { passiveType: 'BE_RECOVERED', canInvert: true, canBeCost: false, requiresAmount: false, validZones: ['DISCARD'], endZone: ['HAND'], validDurations: ['INSTANT'] },
    'REVIVE': { passiveType: 'BE_REVIVED', canInvert: true, canBeCost: false, requiresAmount: false, validZones: ['DISCARD'], endZone: ['FIELD'], validDurations: ['INSTANT'] },
    'ATTACH': { passiveType: 'BE_ATTACHED', canInvert: true, canBeCost: false, validZones: ['FIELD'], validDurations: ['WHILE_ATTACHED', 'INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'BRIEF', 'INDEFINITE'] },
    'REBEL': { passiveType: 'BE_REBELLED', canInvert: true, canBeCost: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] },
    'UNATTACH': { passiveType: 'BE_UNATTACHED', canInvert: true, canBeCost: true, validZones: ['FIELD'], validDurations: ['INSTANT'], isLeavesPlay: false },
    'UNFIELD': { passiveType: 'BE_UNFIELDED', canInvert: true, canBeCost: true, validZones: ['FIELD'], endZone: ['DISCARD'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'TRASH': { passiveType: 'BE_TRASHED', canInvert: true, canBeCost: true, requiresAmount: false, validZones: ['FIELD', 'HAND', 'DECK'], endZone: ['DISCARD'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'FIELD': { passiveType: 'BE_FIELDED', canInvert: true, canBeCost: false, validZones: ['HAND', 'DISCARD'], endZone: ['FIELD'], validDurations: ['INSTANT'] },
    'BANISH': { passiveType: 'BE_BANISHED', canInvert: true, canBeCost: true, validZones: 'ALL', endZone: ['BANISH'], validDurations: ['INSTANT'], isLeavesPlay: true },
    'DONATE': { passiveType: 'BE_DONATED', canInvert: false, canBeCost: true, validZones: 'ALL', validDurations: ['INSTANT', 'ACTION', 'TEMPORARY', 'PERMANENT', 'WHILE_ATTACHED', 'BRIEF', 'INDEFINITE'] }
};

export const ACTION_REGISTRY = {};

export class Action {
    constructor(payload) {
        this.type = payload.type || this.resolveActionType();
        if (!this.type) console.warn(`[Action] Could not determine action type for constructor!`, this);
        
        const manifest = ACTION_MANIFEST[this.type];
        this.passiveType = manifest ? manifest.passiveType : null;
        this.payload = payload; 
        this.payload.type = this.type; 
    }

    resolveActionType() {
        return Object.keys(ACTION_REGISTRY).find(k => ACTION_REGISTRY[k] === this.constructor);
    }

    getLogDepth(engine) {
        return Math.max(0, (engine.state._actionDepth || 0) + (engine.processingDepth || 0) - 1);
    }

    run(engine) {
        this.incrementDepth(engine);
        this.recordPreRunOwners();
        this.evaluateUndoSafety(engine);
        this.logExecution(engine);

        try {
            if (this.emitWouldEvents(engine)) return false;
            
            this.emitModifyEvents(engine);
            this.processLeavesPlay(engine);

            if (this.payload.cancelled) return false;

            this.execute(engine);

            if (!this.payload.preventReaction) {
                this.emitOnEvents(engine);
            }

            return true;
        } finally {
            this.decrementDepth(engine);
        }
    }

    incrementDepth(engine) {
        if (!engine.state._actionDepth) engine.state._actionDepth = 0;
        engine.state._actionDepth++;
    }

    decrementDepth(engine) {
        engine.state._actionDepth--;
        if (engine.state._actionDepth <= 0) {
            engine.state._actionDepth = 0;
            this.sweepActionEffects(engine);
        }
    }

    recordPreRunOwners() {
        if (this.payload.source) this.payload._preRunSourceOwner = this.payload.source.ownerId;
        if (this.payload.target) this.payload._preRunTargetOwner = this.payload.target.ownerId;
    }

    evaluateUndoSafety(engine) {
        const abilityId = this.payload.sourceAbilityId || this.payload.eventContext?.abilityId;
        if (abilityId) {
            this.checkAbilityUndoSafety(engine, abilityId);
        } else {
            this.checkNativeUndoSafety(engine);
        }
    }

    checkAbilityUndoSafety(engine, abilityId) {
        let catAb = engine.state.abilityCatalog?.find(ca => ca.abilityId === abilityId);
        if (!catAb && this.payload.source?.abilities) {
             catAb = this.payload.source.abilities.find(a => a.abilityId === abilityId);
        }
        if (catAb && !isUndoable(engine.state, catAb)) {
            engine.state._irreversibleActionOccurred = true;
        }
    }

    checkNativeUndoSafety(engine) {
        if (['SHUFFLE', 'MILL', 'CUSTOM_SCRIPT'].includes(this.type)) {
            engine.state._irreversibleActionOccurred = true;
        }
        if (this.type === 'DRAW_CARD') {
            const ctxTarget = this.payload.eventContext?.abilityTargetId || this.payload.eventContext?.eventContext?.abilityTargetId;
            if (!ctxTarget) {
                engine.state._irreversibleActionOccurred = true;
            }
        }
    }

    logExecution(engine) {
        if (engine.state.isReconstructing) return;
        const sId = this.payload.source?.instanceId || this.payload.source?.id || 'none';
        const tId = this.payload.target?.instanceId || this.payload.target?.id || 'none';
        const sName = this.payload.source ? `${this.payload.source.name || 'Unknown'} (${sId})` : `System (${sId})`;
        const tName = this.payload.target ? `${this.payload.target.name || 'Unknown'} (${tId})` : `None (${tId})`;
        let extra = '';
        if (['DEAL_DAMAGE', 'HEAL', 'MODIFY_STAT', 'SET_STAT', 'MODIFY_RESOURCE', 'MODIFY_EVENT'].includes(this.type)) {
            extra = `(${this.payload.stat ? this.payload.stat + ': ' : ''}${this.payload.amount !== undefined ? this.payload.amount : 0}) `;
        }
        const indent = '  '.repeat(engine.state._actionDepth - 1);
        //console.log(`${indent}⚡ [ACTION] ${this.type} ${extra}| Src: ${sName} -> Tgt: ${tName}`);
    }

    emitWouldEvents(engine) {
        if (engine.emit(`WOULD_${this.type}`, this.payload).cancelled) return true;
        if (this.passiveType && engine.emit(`WOULD_${this.passiveType}`, this.payload).cancelled) return true;
        return false;
    }

    emitModifyEvents(engine) {
        engine.emit(`MODIFY_${this.type}`, this.payload);
        if (this.passiveType) engine.emit(`MODIFY_${this.passiveType}`, this.payload);
    }

    emitOnEvents(engine) {
        engine.emit(`ON_${this.type}`, this.payload);
        if (this.passiveType) engine.emit(`ON_${this.passiveType}`, this.payload);
    }

    processLeavesPlay(engine) {
        const manifest = ACTION_MANIFEST[this.type];
        if (!manifest || !manifest.isLeavesPlay || !this.payload.target) return;

        const target = this.payload.target;
        if (this.isDeferringToUnfield(engine, target)) return;

        this.unattachChildren(engine, target);
        this.revertTemporaryEffects(engine, target);
        this.resetBaseStats(target);
    }

    isDeferringToUnfield(engine, target) {
        const loc = findEntityLocation(engine, target);
        const isOnField = loc && ['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(loc.zone);
        return isOnField && this.type !== 'UNFIELD';
    }

    unattachChildren(engine, target) {
        if (!target.attachments || target.attachments.length === 0) return;
        const atts = [...target.attachments];
        const UnattachClass = ACTION_REGISTRY['UNATTACH'];
        if (UnattachClass) {
            for (const att of atts) new UnattachClass({ target: att }).run(engine);
        }
    }

    revertTemporaryEffects(engine, target) {
        if (!target.activeEffects) return;
        const effectsToRevert = [];
        for (let i = target.activeEffects.length - 1; i >= 0; i--) {
            const eff = target.activeEffects[i];
            if (eff.duration !== 'PERMANENT') {
                effectsToRevert.push(eff);
                target.activeEffects.splice(i, 1);
            }
        }
        for (const eff of effectsToRevert) {
            if (eff.type !== 'SUMMON') revertEffect(engine, target, eff, true);
        }
    }

    resetBaseStats(target) {
        target.lifetimeAbilityUses = {}; 
        if (target.originalOwnerId && target.ownerId !== target.originalOwnerId) target.ownerId = target.originalOwnerId;
        if (target.maxHealth !== undefined && target.maxHealth !== null) target.health = target.maxHealth;
        if (target.originalPower !== undefined && target.originalPower !== null) target.power = target.originalPower;
        if (target.originalStrength !== undefined && target.originalStrength !== null) target.strength = target.originalStrength;
    }

    sweepActionEffects(engine) {
        for (const pId of ['player1', 'player2']) {
            const p = engine.state.players[pId];
            if (p && p.lines) {
                for (const line in p.lines) {
                    if (p.lines[line]) p.lines[line].forEach(ent => this.cleanseEntityEffects(engine, ent));
                }
            }
            if (p) {
                ['hand', 'deck', 'discard', 'banish'].forEach(z => {
                    if (p[z]) p[z].forEach(ent => this.cleanseEntityEffects(engine, ent));
                });
            }
        }
        if (engine.state.equator) engine.state.equator.forEach(ent => this.cleanseEntityEffects(engine, ent));
    }

    cleanseEntityEffects(engine, ent) {
        if (!ent) return;
        if (ent.attachments && ent.attachments.length > 0) {
            [...ent.attachments].forEach(att => this.cleanseEntityEffects(engine, att));
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
    }

    execute(engine) {
        console.warn(`Base Action execute called for ${this.type}. Missing subclass implementation.`);
    }

    executeZoneMovement(engine, defaultDestination) {
        const loc = findEntityLocation(engine, this.payload.target);
        if (!loc) return;
        const dest = this.payload.eventContext?.destination || defaultDestination;
        if (['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(loc.zone)) {
            const UnfieldAction = ACTION_REGISTRY['UNFIELD'];
            if (UnfieldAction) new UnfieldAction({ target: this.payload.target, destination: dest, eventContext: this.payload.eventContext }).run(engine);
        } else {
            moveEntity(engine, this.payload.target, this.payload.target.ownerId || loc.playerId, dest);
        }
    }
}

export function findEntityLocation(engine, target) {
    if (!target || !target.instanceId) return null;

    let result = searchPlayerZones(engine, target);
    if (result) return result;

    result = searchEquator(engine, target);
    return result;
}

function searchPlayerZones(engine, target) {
    for (const pId of ['player1', 'player2']) {
        const p = engine.state.players[pId];
        
        let result = searchPlayerLines(p, pId, target);
        if (result) return result;
        
        result = searchPlayerPiles(p, pId, target);
        if (result) return result;
    }
    return null;
}

function searchPlayerLines(player, playerId, target) {
    for (const line in player.lines) {
        if (!player.lines[line]) continue;
        
        const idx = player.lines[line].findIndex(c => c.instanceId === target.instanceId);
        if (idx > -1) return { playerId, zone: line, array: player.lines[line], index: idx };
        
        for (const host of player.lines[line]) {
            const found = searchAttachments(host, playerId, target);
            if (found) return found;
        }
    }
    return null;
}

function searchPlayerPiles(player, playerId, target) {
    const zones = ['hand', 'deck', 'discard', 'banish'];
    for (const z of zones) {
        const idx = player[z].findIndex(c => c.instanceId === target.instanceId);
        if (idx > -1) return { playerId, zone: z, array: player[z], index: idx };
        
        for (const host of player[z]) {
            const found = searchAttachments(host, playerId, target);
            if (found) return found;
        }
    }
    return null;
}

function searchEquator(engine, target) {
    if (!engine.state.equator) return null;
    
    const idx = engine.state.equator.findIndex(c => c.instanceId === target.instanceId);
    if (idx > -1) return { playerId: null, zone: 'equator', array: engine.state.equator, index: idx };
    
    for (const host of engine.state.equator) {
        const found = searchAttachments(host, null, target);
        if (found) return found;
    }
    return null;
}

function searchAttachments(host, playerId, target) {
    if (!host.attachments) return null;
    
    const aIdx = host.attachments.findIndex(a => a.instanceId === target.instanceId);
    if (aIdx > -1) return { playerId, zone: 'attachment', array: host.attachments, index: aIdx, host: host };
    
    for (const att of host.attachments) {
        const found = searchAttachments(att, playerId, target);
        if (found) return found;
    }
    return null;
}

export function moveEntity(engine, target, destPlayerId, destZone) {
    destZone = String(destZone || 'discard').toLowerCase();
    
    removeFromCurrentLocation(engine, target);
    resetEntityStateForBoard(target, destZone);
    resetEntityReadinessForPile(target, destZone);
    addToDestination(engine, target, destPlayerId, destZone);
}

function removeFromCurrentLocation(engine, target) {
    const loc = findEntityLocation(engine, target);
    if (loc && loc.array) loc.array.splice(loc.index, 1);
}

function resetEntityStateForBoard(target, destZone) {
    const boardZones = ['hand', 'deck', 'back', 'front', 'mid', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'equator', 'attachment'];
    if (boardZones.includes(destZone)) {
        target._isDying = false;
        if (target.health !== undefined && target.health !== null && target.health <= 0) {
            target.health = target.maxHealth || 1;
        }
    }
}

function resetEntityReadinessForPile(target, destZone) {
    if (['deck', 'banish'].includes(destZone)) {
        target.readiness = 0;
    }
}

function addToDestination(engine, target, destPlayerId, destZone) {
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
    
    initializeActiveEffects(target);
    const expiresAt = calculateExpiration(engine, duration);
    const safePayload = createSafePayload(payload);
    
    appendEffect(engine, target, type, duration, expiresAt, source, safePayload, extraData);
}

function initializeActiveEffects(target) {
    if (!target.activeEffects) target.activeEffects = [];
}

function calculateExpiration(engine, duration) {
    if (duration === 'BRIEF') return engine.state.activePlayerId;
    if (duration === 'TEMPORARY') return engine.state.activePlayerId === 'player1' ? 'player2' : 'player1';
    return null;
}

function createSafePayload(payload) {
    const safePayload = { ...payload };
    delete safePayload.source;
    delete safePayload.target;
    delete safePayload.eventContext;
    return safePayload;
}

function appendEffect(engine, target, type, duration, expiresAt, source, safePayload, extraData) {
    target.activeEffects.push({
        id: 'eff_' + engine.state.history_log.length + '_' + target.activeEffects.length,
        type, duration, expiresAt,
        sourceId: source ? source.instanceId : null,
        ...safePayload,
        ...extraData
    });
}

export function revertEffect(engine, target, effect, isLeavingPlay = false) {
    if (effect.type === 'MODIFY_STAT') revertModifyStat(target, effect);
    else if (effect.type === 'MODIFY_RESOURCE') revertModifyResource(engine, target, effect);
    else if (effect.type === 'SET_STAT') revertSetStat(engine, target, effect, isLeavingPlay);
    else if (effect.type === 'GRANT_ABILITY') revertGrantAbility(target, effect);
    else if (effect.type === 'REMOVE_ABILITY') revertRemoveAbility(target, effect);
    else if (effect.type === 'SUMMON') revertSummon(engine, target);
    else if (effect.type === 'ATTACH') revertAttach(engine, target, effect);
    else if (effect.type === 'REBEL' || effect.type === 'DONATE') revertControlChange(engine, target, effect);
    else if (effect.type === 'TRANSFORM') revertTransform(engine, target, effect);
}

function revertModifyStat(target, effect) {
    target[effect.stat] -= effect.delta;
    if (effect.stat === 'maxHealth') {
        if (effect.delta < 0) {
            target.health = (target.health || 0) + Math.abs(effect.delta);
        } else if (target.maxHealth !== undefined && target.maxHealth !== null && target.health > target.maxHealth) {
            target.health = Math.max(0, target.maxHealth);
        }
    } else if (effect.stat === 'health' && target.maxHealth !== undefined && target.maxHealth !== null) {
        target.health = Math.min(target.health, target.maxHealth);
    }
}

function revertModifyResource(engine, target, effect) {
    const loc = findEntityLocation(engine, target);
    const pId = loc ? loc.playerId : null;
    if (pId) {
        const p = engine.state.players[pId];
        if (p.resources[effect.resourceKey]) {
            p.resources[effect.resourceKey].current -= effect.delta;
        }
    }
}

function revertSetStat(engine, target, effect, isLeavingPlay) {
    if (effect.stat === 'health') {
        target.health = Math.min(target.health, effect.originalValue);
    } else if (effect.stat === 'line') {
        revertLineChange(engine, target, effect, isLeavingPlay);
    } else if (typeof effect.originalValue === 'number' && typeof effect.delta === 'number') {
        revertNumericSetStat(target, effect);
    } else {
        revertGenericSetStat(target, effect);
    }
}

function revertLineChange(engine, target, effect, isLeavingPlay) {
    let remainingEffect = findRemainingSetStatEffect(target, effect);
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
}

function revertNumericSetStat(target, effect) {
    target[effect.stat] -= effect.delta;
    if (effect.stat === 'maxHealth') {
        if (effect.delta < 0) {
            target.health = (target.health || 0) + Math.abs(effect.delta);
        } else if (target.maxHealth !== undefined && target.maxHealth !== null && target.health > target.maxHealth) {
            target.health = Math.max(0, target.maxHealth);
        }
    }
}

function revertGenericSetStat(target, effect) {
    let remainingEffect = findRemainingSetStatEffect(target, effect);
    const oldVal = target[effect.stat];
    target[effect.stat] = remainingEffect ? remainingEffect.amount : effect.originalValue;
    
    if (effect.stat === 'maxHealth') {
        const revertedDelta = target[effect.stat] - oldVal;
        if (revertedDelta > 0) {
            target.health = (target.health || 0) + revertedDelta;
        } else if (target.maxHealth !== undefined && target.maxHealth !== null && target.health > target.maxHealth) {
            target.health = Math.max(0, target.maxHealth);
        }
    }
}

function findRemainingSetStatEffect(target, effect) {
    if (!target.activeEffects) return null;
    const others = target.activeEffects.filter(e => e.type === 'SET_STAT' && e.stat === effect.stat && e.id !== effect.id);
    return others.length > 0 ? others[others.length - 1] : null;
}

function revertGrantAbility(target, effect) {
    if (target.abilities) {
        const idx = target.abilities.findIndex(a => a.abilityId === effect.grantedAbilityId);
        if (idx > -1) target.abilities.splice(idx, 1);
    }
}

function revertRemoveAbility(target, effect) {
    if (effect.restoredAbilities && effect.restoredAbilities.length > 0) {
        if (!target.abilities) target.abilities = [];
        effect.restoredAbilities.forEach(ab => target.abilities.push(ab));
    }
    if (effect.restoredEffects && effect.restoredEffects.length > 0) {
        if (!target.activeEffects) target.activeEffects = [];
        effect.restoredEffects.forEach(e => target.activeEffects.push(e));
    }
}

function revertSummon(engine, target) {
    const UnfieldAction = ACTION_REGISTRY['UNFIELD'];
    if (UnfieldAction) new UnfieldAction({ target: target }).run(engine);
}

function revertAttach(engine, target, effect) {
    if (target.attachments) {
        const attIdx = target.attachments.findIndex(a => a.instanceId === effect.sourceId);
        if (attIdx > -1) {
            const att = target.attachments[attIdx];
            const UnattachAction = ACTION_REGISTRY['UNATTACH'];
            if (UnattachAction) new UnattachAction({ target: att }).run(engine);
        }
    }
}

function revertControlChange(engine, target, effect) {
    const loc = findEntityLocation(engine, target);
    if (loc && effect.originalOwnerId && loc.playerId !== effect.originalOwnerId) {
        moveEntity(engine, target, effect.originalOwnerId, loc.zone);
        target.ownerId = effect.originalOwnerId;
        engine.state.history_log.push({ text: `🔄 '${target.name}' returned to its original owner.`, depth: Math.max(0, (engine.state._actionDepth || 0) - 1) });
    }
}

function revertTransform(engine, target, effect) {
    const TransformActionClass = ACTION_REGISTRY['TRANSFORM'];
    if (TransformActionClass && effect.originalCardId) {
        engine.state.history_log.push({ text: `🔄 '${target.name}' reverted to its original form.`, depth: Math.max(0, (engine.state._actionDepth || 0) + (engine.processingDepth || 0) - 1) });
        new TransformActionClass({ target: target, cardId: effect.originalCardId, duration: 'INSTANT' }).run(engine);
    }
}

export function sweepTurnEffects(engine, endingPlayerId) {
    for (const pId of ['player1', 'player2']) {
        const p = engine.state.players[pId];
        for (const line in p.lines) {
            if (p.lines[line]) {
                [...p.lines[line]].forEach(u => cleanseRecursive(engine, u, endingPlayerId));
            }
        }
    }
    if (engine.state.equator) {
        engine.state.equator.forEach(u => cleanseRecursive(engine, u, endingPlayerId));
    }
}

function cleanseRecursive(engine, ent, endingPlayerId) {
    if (!ent) return;
    
    if (ent.attachments && ent.attachments.length > 0) {
        [...ent.attachments].forEach(att => cleanseRecursive(engine, att, endingPlayerId));
    }

    const CleanseAction = ACTION_REGISTRY['CLEANSE'];
    if (CleanseAction) new CleanseAction({ target: ent, endingPlayerId }).run(engine);
}