/**
 * src/engine.js
 * Henchies 2 Game Engine Core
 * Implements a LIFO Event Bus with APNAP resolution, WOULD_ replacement effects, 
 * and infinite-loop self-trigger prevention. Refactored for modularity.
 */

export const CARD_CATALOG = []; // Will be hydrated by deckbuilder/firebase

export function getResKey(tribeStr) {
    if (!tribeStr) return 'Generic';
    const t = tribeStr.toLowerCase();
    if (t === 'carnie' || t === 'tribe_carnie') return 'Carnie';
    if (t === 'generic' || t === 'tribe_generic') return 'Generic';
    return tribeStr; 
}

export function resolveResourceKey(player, tribeKey) {
    const baseKey = getResKey(tribeKey);
    if (baseKey === 'Carnie') return 'Carnie';
    if (player && player.resources[baseKey]) return baseKey;
    
    if (player) {
        const tkLower = baseKey.toLowerCase();
        for (const key in player.resources) {
            const kLower = key.toLowerCase();
            if (kLower === tkLower || kLower === `tribe_${tkLower}` || tkLower === `tribe_${kLower}`) {
                return key;
            }
        }
    }
    return baseKey;
}

import { nextRandom, randomInt, generateId, shuffleArray as prandomShuffle } from './prandom.js';
import { ACTION_REGISTRY, ACTION_MANIFEST, HarvestAction, PlayAction, KillAction, UnfieldAction, sweepTurnEffects } from './actions.js';

export const TRAITS = [];
export const LINES = ['taunt', 'bodyguard', 'avatar', 'front', 'mid', 'back', 'sheltered', 'sideline'];
export class Card {}
export class UnitInstance {}
export class Avatar {}

// ==========================================
// CORE UTILITIES & HELPERS
// ==========================================

export function log(state, msg) {
    if (!state?.isReconstructing) console.log(msg);
}

export function warn(state, msg) {
    if (!state?.isReconstructing) console.warn(msg);
}

export function hasEngineFlag(state, entity, flagName, consume = false) {
    if (!entity) return false;
    
    if (flagName.startsWith('BLOCK_')) {
        const overrideFlag = `IGNORE_${flagName}`;
        if (hasEngineFlag(state, entity, overrideFlag)) return false;
    }

    let found = false;

    if (flagName === 'STRIKE_FAST' && entity.fast > 0) {
        if (consume) entity.fast--;
        found = true;
    }
    if (flagName === 'STRIKE_SLOW' && entity.slow > 0) {
        if (consume) entity.slow--;
        found = true;
    }
    if (found) return true;

    if (entity.activeEffects) {
        for (const e of entity.activeEffects) {
            if (e.type === flagName) found = true;
            if (found) return true;
        }
    }

    const checkAbility = (ability) => {
        if (ability.passiveFlags && ability.passiveFlags.includes(flagName)) {
            if (ability.triggerLimit && ability.triggerLimit !== 'UNLIMITED') {
                const abilityKey = `${entity.instanceId}_${ability.abilityId}`;
                const uses = state.abilityUses?.[abilityKey] || 0;
                if (ability.triggerLimit === 'ONCE_PER_ROUND' && uses >= 1) return false;
                if (ability.triggerLimit === 'TWICE_PER_ROUND' && uses >= 2) return false;
                
                if (consume) {
                    if (!state.abilityUses) state.abilityUses = {};
                    state.abilityUses[abilityKey] = uses + 1;
                }
            }
            return true;
        }
        
        const name = (ability.name || '').toLowerCase();
        if (flagName === 'BLOCK_ACT' && (name === 'dazed' || name === 'stunned' || name === 'stun')) return true;
        if (flagName === 'BLOCK_ATTACK' && name === 'unaggressive') return true;
        if (flagName === 'BLOCK_RETALIATE' && (name === 'dazed' || name === 'stunned' || name === 'stun')) return true;
        if (flagName === 'BLOCK_TARGETING' && name === 'hidden') return true;
        if (flagName === 'BLOCK_TARGET_AVATAR' && name === 'timid') return true;
        if (flagName === 'IGNORE_BLOCK_TARGETING' && name === 'perception') return true;
        if (flagName === 'STRIKE_FAST' && (name === 'swift' || name === 'first strike' || name === 'fast')) return true;
        if (flagName === 'STRIKE_SLOW' && name === 'slow') return true;

        return false;
    };

    if (entity.abilities) {
        for (const a of entity.abilities) {
            if (typeof a === 'string') {
                const catAb = state.abilityCatalog?.find(ca => ca.abilityId === a);
                if (catAb && checkAbility(catAb)) return true;
            } else {
                if (checkAbility(a)) return true;
            }
        }
    }

    if (entity.activeEffects) {
        for (const e of entity.activeEffects) {
            if (e.type === 'GRANT_ABILITY' && e.grantedAbilityId) {
                let catAb = state.abilityCatalog?.find(ca => ca.abilityId === e.grantedAbilityId);
                if (!catAb) catAb = state.abilityCatalog?.find(ca => ca.name === e.grantedAbilityId);
                if (catAb && checkAbility(catAb)) return true;
            }
        }
    }

    return false;
}

export function getOwnerId(state, ent) {
    if (!ent) return null;
    if (ent.ownerId) return ent.ownerId;
    for (const pId of ['player1', 'player2']) {
        const p = state.players[pId];
        if (['hand', 'deck', 'discard', 'banish'].some(z => p[z].some(c => c.instanceId === ent.instanceId))) return pId;
        for (const line of LINES) {
            if (p.lines[line] && p.lines[line].some(c => c.instanceId === ent.instanceId)) return pId;
            if (p.lines[line] && p.lines[line].some(u => u.attachments && u.attachments.some(a => a.instanceId === ent.instanceId))) return pId;
        }
    }
    return null;
}

export function getAvatar(state, playerId) {
    const p = state.players[playerId];
    if (!p) return null;
    for (const line in p.lines) {
        const avatar = p.lines[line]?.find(u => u.type === 'avatar');
        if (avatar) return avatar;
    }
    return null;
}

// ==========================================
// STATE DEFINITION
// ==========================================

export class GameState {
    constructor() {
        this.status = 'active';
        this.activePlayerId = 'player1';
        this.turnNumber = 1;
        this.turnPhase = 'SACRIFICE_DECISION'; 
        this.abilityUses = {};
        this.players = {
            player1: { 
                id: 'player1', name: 'Player 1', 
                lines: { taunt: [], bodyguard: [], avatar: [], front: [], mid: [], back: [], sheltered: [], sideline: [] }, 
                hand: [], deck: [], discard: [], banish: [], 
                resources: { 'Carnie': { current: 2, max: 2 }, 'Mythic': { current: 1, max: 1 } }
            },
            player2: { 
                id: 'player2', name: 'Player 2', 
                lines: { taunt: [], bodyguard: [], avatar: [], front: [], mid: [], back: [], sheltered: [], sideline: [] }, 
                hand: [], deck: [], discard: [], banish: [], 
                resources: { 'Carnie': { current: 2, max: 2 }, 'Robot': { current: 1, max: 1 } }
            }
        };
        this.equator = [];
        this.history_log = [];
    }
}

// ==========================================
// GAME ENGINE
// ==========================================

export class GameEngine {
    constructor(state) {
        this.state = state;
        this.stack = [];
        this.processingDepth = 0;
        this.activeChainAbilities = new Set(); // Loop prevention
        
        this.utils = {
            randomInt,
            shuffleArray: prandomShuffle,
            getEntityAvailableActions,
            getValidAttackTargets,
            hasEngineFlag
        };
    }

    emit(eventType, payload) {
        // 1. Interceptors (WOULD_)
        if (!eventType.startsWith('WOULD_') && !eventType.startsWith('MODIFY_') && !eventType.startsWith('ON_')) {
            const wouldEvent = `WOULD_${eventType}`;
            const addedTriggers = this.queueTriggers(wouldEvent, payload);
            if (addedTriggers > 0) {
                log(this.state, `[EVENT BUS] ⚡ Stack resolved immediately for ${wouldEvent} due to interceptors.`);
                this.processStack(addedTriggers, wouldEvent);
            }
            if (payload && payload.cancelled) {
                log(this.state, `[EVENT BUS] 🛑 Event ${eventType} was CANCELLED.`);
                return { cancelled: true };
            }
        }
        
        // 2. Exact Event Triggers
        const addedTriggers = this.queueTriggers(eventType, payload);
        let rootEventCancelled = false;

        if (addedTriggers > 0) {
            log(this.state, `[EVENT BUS] ⚡ Stack resolved immediately for ${eventType}.`);
            rootEventCancelled = this.processStack(addedTriggers, eventType);
        }
        
        const isCancelled = rootEventCancelled || !!(payload && payload.cancelled);
        if (isCancelled && payload) payload.cancelled = true; 
        if (isCancelled) log(this.state, `[EVENT BUS] 🛑 Event ${eventType} was CANCELLED.`);
        
        return { cancelled: isCancelled };
    }

    queueTriggers(eventType, payload) {
        const triggers = [];
        const checkedEntities = new Set();

        // 1. Force-check transit entities in the payload
        if (payload) {
            if (payload.source) this._evaluateTriggerMatch(payload.source, getOwnerId(this.state, payload.source), eventType, payload, checkedEntities, triggers);
            if (payload.target) this._evaluateTriggerMatch(payload.target, getOwnerId(this.state, payload.target), eventType, payload, checkedEntities, triggers);
        }
        
        // 2. Scan Board
        for (const pId of ['player1', 'player2']) {
            const player = this.state.players[pId];
            for (const line of LINES) {
                if (!player.lines[line]) continue;
                for (const unit of player.lines[line]) {
                    this._evaluateTriggerMatch(unit, pId, eventType, payload, checkedEntities, triggers);
                    if (unit.attachments) {
                        unit.attachments.forEach(att => this._evaluateTriggerMatch(att, pId, eventType, payload, checkedEntities, triggers));
                    }
                }
            }
        }
        
        // 3. Scan Equator
        if (this.state.equator) {
            for (const item of this.state.equator) {
                this._evaluateTriggerMatch(item, item.ownerId || this.state.activePlayerId, eventType, payload, checkedEntities, triggers);
            }
        }

        if (triggers.length === 0) return 0;

        // APNAP Sorting
        triggers.sort((a, b) => {
            if (a.owner === this.state.activePlayerId && b.owner !== this.state.activePlayerId) return -1;
            if (a.owner !== this.state.activePlayerId && b.owner === this.state.activePlayerId) return 1;
            return 0; 
        });

        let addedCount = 0;
        triggers.reverse().forEach(t => {
            this.stack.push(t);
            addedCount++;
        });

        return addedCount;
    }

    _evaluateTriggerMatch(ent, ownerId, eventType, payload, checkedEntities, triggers) {
        if (!ent || !ent.instanceId || checkedEntities.has(ent.instanceId)) return;
        checkedEntities.add(ent.instanceId);
        
        let abilitiesToCheck = ent.abilities || [];
        if (payload) {
            if (payload.source && payload.source.instanceId === ent.instanceId && payload._lkiSourceAbilities) {
                abilitiesToCheck = payload._lkiSourceAbilities;
            }
            if (payload.target && payload.target.instanceId === ent.instanceId && payload._lkiTargetAbilities) {
                abilitiesToCheck = payload._lkiTargetAbilities;
            }
        }
        
        if (!abilitiesToCheck || abilitiesToCheck.length === 0) return;

        for (const ability of abilitiesToCheck) {
            const allTriggers = [ability.trigger, ...(ability.additionalTriggers || [])];
            if (allTriggers.includes(eventType) && !this.activeChainAbilities.has(ability.abilityId)) {
                
                let isValid = true;
                const scope = ability.triggerScope || 'PERSONAL';
                
                let isPassive = false;
                let isActive = false;

                for (const actionKey in ACTION_MANIFEST) {
                    const manifest = ACTION_MANIFEST[actionKey];
                    if (eventType === actionKey || eventType.endsWith(`_${actionKey}`)) isActive = true;
                    if (manifest.passiveType && (eventType === manifest.passiveType || eventType.endsWith(`_${manifest.passiveType}`))) isPassive = true;
                }
                
                let eventEntity = null;
                if (payload) {
                    if (isPassive) eventEntity = payload.target;
                    if (isActive && !eventEntity) eventEntity = payload.source;
                }

                if (payload) {
                    if (scope === 'PERSONAL') {
                        if (isPassive && (!payload.target || payload.target.instanceId !== ent.instanceId)) isValid = false;
                        if (isActive && (!payload.source || payload.source.instanceId !== ent.instanceId)) isValid = false;
                        if (['TURN_STARTING', 'TURN_STARTED', 'TURN_ENDING', 'TURN_ENDED'].includes(eventType)) {
                            if (payload.playerId && payload.playerId !== ownerId) isValid = false;
                        }
                    } else if (scope === 'GLOBAL') {
                        if (!eventEntity) {
                            isValid = false;
                        } else {
                            const qt = ability.activation?.quickTargeting;
                            const pool = this.findEntitiesInScope(qt, ownerId);
                            if (!pool.some(p => p.instanceId === eventEntity?.instanceId)) isValid = false;
                        }
                    }
                }

                if (isValid && ability.activation?.logicTree) {
                    const evalEntity = (scope === 'GLOBAL' && eventEntity) ? eventEntity : ent;
                    let evalLKI = null;
                    if (payload) {
                         if (payload.source?.instanceId === evalEntity.instanceId) evalLKI = payload._lkiSourceAbilities;
                         if (payload.target?.instanceId === evalEntity.instanceId) evalLKI = payload._lkiTargetAbilities;
                    }
                    if (!this.evaluateLogicTree(ability.activation.logicTree, evalEntity, ent, payload, evalLKI)) {
                        isValid = false;
                    }
                }

                if (isValid) {
                    const eId = ent.instanceId || ent.id || 'none';
                    log(this.state, `    ↳ 🎯 Triggered '${ability.name}' on '${ent.name} (${eId})' for ${eventType}`);
                    triggers.push({ owner: ownerId || this.state.activePlayerId, source: ent, ability, payload });
                }
            }
        }
    }

    processStack(count, originatingEvent = null) {
        this.processingDepth = (this.processingDepth || 0) + 1;
        let rootEventCancelled = false;
        
        while (count > 0 && this.stack.length > 0) {
            const frame = this.stack.pop();
            count--;
            
            if (frame.payload && (frame.payload.cancelled || frame.payload.eventContext?.cancelled)) {
                log(this.state, `[Engine] Skipping trigger '${frame.ability.name}' because event cancelled.`);
                rootEventCancelled = true;
                continue; 
            }
            
            this.activeChainAbilities.add(frame.ability.abilityId);
            
            // Directly pass the reference so modifiers (like Fire! or Resilient) can mutate the parent event!
            const livePayload = frame.payload;
            
            if (livePayload?.eventContext && rootEventCancelled) {
                 livePayload.eventContext.cancelled = true;
                 livePayload.cancelled = true;
                 continue;
            }

            this.executeAbility(frame.ability, frame.source, livePayload, frame.owner, originatingEvent);
            this.activeChainAbilities.delete(frame.ability.abilityId);
            
            if (livePayload && (livePayload.cancelled || livePayload.eventContext?.cancelled)) {
                rootEventCancelled = true;
            }
        }
        
        this.processingDepth--;
        if (this.processingDepth <= 0) {
            this.activeChainAbilities.clear();
            this.processingDepth = 0;
        }
        
        return rootEventCancelled;
    }

    executeAbility(ability, source, eventPayload, ownerId, originatingEvent = null) {
        const sId = source?.instanceId || source?.id || 'none';
        log(this.state, `  ▶ [ABILITY] '${ability.name}' from source '${source?.name} (${sId})'`);
        try {
            this.state.history_log.push(`✨ ${source.name || 'Entity'} activated '${ability.name}'`);
            
            if (!ability.effects || !Array.isArray(ability.effects)) {
                warn(this.state, `[Engine] Ability '${ability.name}' has no effects array. Skipping.`);
                return;
            }

            ownerId = ownerId || this.state.activePlayerId;
            if (!this._checkAndPayCost(ability, source, ownerId, eventPayload)) return;

            const lockedTargets = this._acquireTargets(ability, source, eventPayload, ownerId);
            this._resolvePayloads(ability, source, eventPayload, ownerId, lockedTargets, originatingEvent);
            
        } catch (error) {
            console.error(`[Engine] CRITICAL ERROR executing ability '${ability?.name}':`, error);
        }
    }

    _checkAndPayCost(ability, source, ownerId, eventPayload) {
        const abilityKey = `${source.instanceId}_${ability.abilityId}`;
        const limit = ability.triggerLimit || 'UNLIMITED';
        
        if (limit === 'ONCE_PER_ROUND' && (this.state.abilityUses?.[abilityKey] || 0) >= 1) return false;
        if (limit === 'TWICE_PER_ROUND' && (this.state.abilityUses?.[abilityKey] || 0) >= 2) return false;

        const p = this.state.players[ownerId];
        const cost = ability.cost || {};
        let canAfford = true;
        
        let currentReadiness = Number(source.readiness);
        if (isNaN(currentReadiness)) currentReadiness = 0;
        
        let requiresReadiness = true; // All manual actions natively require readiness
        if (cost.readinessCost && cost.readinessCost !== 'NONE' && cost.reuseIgnoresReadiness && (this.state.abilityUses?.[abilityKey] || 0) > 0) {
            requiresReadiness = false;
        }
        if (ability.trigger === 'MANUAL' && requiresReadiness && currentReadiness < 1) canAfford = false;
        
        let cCost = cost.carnie || cost.tent || 0;
        if (cCost > 0 && (p.resources['Carnie']?.current || 0) < cCost) canAfford = false;
        if (cost.power > 0 && (source.power || 0) < cost.power) canAfford = false;
        
        let tribeResKey = null;
        if (cost.tribeAmount > 0) {
            const entityTribe = resolveResourceKey(p, source.tribe);
            if (entityTribe === 'Carnie') {
                if ((p.resources['Carnie']?.current || 0) < cost.tribeAmount) canAfford = false;
            } else {
                tribeResKey = entityTribe;
                if (!p.resources[tribeResKey] || p.resources[tribeResKey].current < cost.tribeAmount) canAfford = false;
            }
        }

        if (!canAfford) {
            log(this.state, `[Engine] Could not afford trigger cost for '${ability.name}'.`);
            if (ability.trigger !== 'MANUAL') this.state.history_log.push(`⚠️ ${source.name} tried to trigger '${ability.name}', but lacked resources.`);
            return false;
        }

        if (!this.state.abilityUses) this.state.abilityUses = {};
        this.state.abilityUses[abilityKey] = (this.state.abilityUses[abilityKey] || 0) + 1;

        if (requiresReadiness && !cost.freeAction) {
            if (cost.readinessCost === 'EXHAUSTS') source.readiness -= 2;
            else if (cost.readinessCost === 'UNREADIES') source.readiness -= 1;
        }
        
        if (cCost > 0 && p.resources['Carnie']) p.resources['Carnie'].current -= cCost;
        if (cost.power > 0) source.power -= cost.power;
        
        if (cost.tribeAmount > 0) {
            const entityTribe = resolveResourceKey(p, source.tribe);
            if (entityTribe === 'Carnie') {
                p.resources['Carnie'].current -= cost.tribeAmount;
            } else if (tribeResKey) {
                p.resources[tribeResKey].current -= cost.tribeAmount;
            }
        }

        return true;
    }

    _acquireTargets(ability, source, eventPayload, ownerId) {
        return ability.effects.map((group, index) => {
            if (!group) return [];
            let targets = [];
            
            if (group.targetMethod === 'SELF') targets = [source];
            else if (group.targetMethod === 'EVENT_SOURCE') targets = eventPayload?.source ? [eventPayload.source] : [];
            else if (group.targetMethod === 'EVENT_TARGET') targets = eventPayload?.target ? [eventPayload.target] : [];
            else if (group.targetMethod === 'AVATAR') {
                const av = getAvatar(this.state, ownerId);
                targets = av ? [av] : [];
            }
            else if (group.targetMethod === 'ENEMY_AVATAR') {
                const oppId = ownerId === 'player1' ? 'player2' : 'player1';
                const av = getAvatar(this.state, oppId);
                targets = av ? [av] : [];
            }
            else if (group.targetMethod === 'SAME_AS_ACTIVATION') {
                const tunneledTargetId = eventPayload?.abilityTargetId || eventPayload?.eventContext?.abilityTargetId;
                if (tunneledTargetId) {
                    const p1 = this.state.players.player1;
                    const p2 = this.state.players.player2;
                    const allEntities = [
                        ...Object.values(p1.lines).flat(), ...Object.values(p2.lines).flat(),
                        ...(this.state.equator || []),
                        ...p1.hand, ...p1.deck, ...p1.discard, ...p1.banish,
                        ...p2.hand, ...p2.deck, ...p2.discard, ...p2.banish
                    ].filter(Boolean);
                    const resolvedTarget = allEntities.find(e => e.id === tunneledTargetId || e.instanceId === tunneledTargetId);
                    targets = [resolvedTarget || eventPayload.target || source];
                } else if (eventPayload) {
                    if (eventPayload.target?.instanceId === source.instanceId && eventPayload.source) targets = [eventPayload.source];
                    else targets = [eventPayload.target || source];
                } else {
                    targets = [source];
                }
            }
            else if (group.targetMethod?.startsWith('AUTO_')) {
                return []; // Deferred to phase 2
            }
            
            if (targets.length === 0 && group.targetMethod === 'SAME_AS_ACTIVATION' && eventPayload?.target) targets = [eventPayload.target];
            return targets;
        });
    }

    _resolvePayloads(ability, source, eventPayload, ownerId, lockedTargets, originatingEvent) {
        ability.effects.forEach((group, index) => {
            if (!group || !Array.isArray(group.payloads)) return;
            
            let targets = lockedTargets[index] || [];
            
            if (group.targetMethod?.startsWith('AUTO_')) {
                let pool = this.findEntitiesInScope(group.quickTargeting, ownerId);
                pool = pool.filter(ent => this.evaluateLogicTree(group.logicTree, ent, source, eventPayload));
                
                if (group.targetMethod === 'AUTO_ALL') targets = pool;
                else if (group.targetMethod === 'AUTO_RANDOM') targets = prandomShuffle(this.state, [...pool]).slice(0, group.targetCount || 1);
                else if (group.targetMethod === 'AUTO_FIRST') targets = pool.slice(0, group.targetCount || 1);
                else if (group.targetMethod === 'AUTO_LAST') targets = pool.slice(-(group.targetCount || 1));
            }

            for (const payload of group.payloads) {
                const ActionClass = ACTION_REGISTRY[payload.type];
                if (ActionClass) {
                    for (const target of targets) {
                        let currentTarget = target;
                        
                        // Interceptor for tunneled ATTACH actions
                        if (['ATTACH', 'ATTACH_TO'].includes(payload.type) && currentTarget.instanceId === source.instanceId) {
                            if (eventPayload?.abilityTargetId) {
                                const p1 = this.state.players.player1;
                                const p2 = this.state.players.player2;
                                const allEntities = [
                                    ...Object.values(p1.lines).flat(), ...Object.values(p2.lines).flat(),
                                    ...(this.state.equator || []),
                                    ...p1.hand, ...p1.deck, ...p1.discard, ...p1.banish,
                                    ...p2.hand, ...p2.deck, ...p2.discard, ...p2.banish
                                ].filter(Boolean);
                                const altTarget = allEntities.find(e => e.id === eventPayload.abilityTargetId || e.instanceId === eventPayload.abilityTargetId);
                                if (altTarget) currentTarget = altTarget;
                            }
                            if (currentTarget.instanceId === source.instanceId) continue; // Abort self-attach
                        }
                        
                        const actionPayload = { ...payload };
                        if (payload.invertRoles) {
                            actionPayload.source = currentTarget; actionPayload.target = source;
                        } else {
                            actionPayload.source = source; actionPayload.target = currentTarget;
                        }

                        actionPayload.eventContext = eventPayload;
                        actionPayload.sourceAbilityId = ability.abilityId; 
                        
                        const action = new ActionClass(actionPayload);
                        action.run(this);
                    }
                }
            }
        });
    }

    findEntitiesInScope(qt, callingPlayerId) {
        const pool = [];
        const oppId = callingPlayerId === 'player1' ? 'player2' : 'player1';
        
        const alignments = qt?.alignment || ['ENEMY'];
        const zones = qt?.zones || ['FIELD'];
        const types = qt?.entityType || [];
        
        const playersToCheck = [];
        if (alignments.includes('FRIENDLY')) playersToCheck.push(callingPlayerId);
        if (alignments.includes('ENEMY')) playersToCheck.push(oppId);
        
        playersToCheck.forEach(pId => {
            const p = this.state.players[pId];
            if (zones.includes('FIELD')) {
                for (const line of LINES) {
                    if (p.lines[line]) {
                        pool.push(...p.lines[line]);
                        p.lines[line].forEach(u => { if (u.attachments) pool.push(...u.attachments); });
                    }
                }
            }
            ['hand', 'deck', 'discard', 'banish'].forEach(z => {
                if (zones.includes(z.toUpperCase())) pool.push(...p[z]);
            });
        });

        return pool.filter(ent => {
            if (!types || types.length === 0) return true;
            let entType = 'UNIT';
            if (ent.type === 'avatar') entType = 'AVATAR';
            else if (ent.type === 'equipment' || ent.type === 'artifact') entType = 'EQUIPMENT';
            else if (ent.type === 'spell') entType = 'SPELL';
            else if (ent.type === 'boon') entType = 'BOON';
            return types.includes(entType);
        });
    }

    evaluateLogicTree(node, entity, source, eventPayload, lkiAbilities = null) {
        if (!node) return true;
        if (node.type === 'group') {
            if (!node.children || node.children.length === 0) return true;
            if (node.logicalOperator === 'OR') return node.children.some(child => this.evaluateLogicTree(child, entity, source, eventPayload, lkiAbilities));
            else return node.children.every(child => this.evaluateLogicTree(child, entity, source, eventPayload, lkiAbilities));
        } else if (node.type === 'condition') {
            let entVal;
            if (node.attribute === 'entity') {
                if (node.value === 'SELF') return entity.instanceId === source.instanceId;
                if (node.value === 'AVATAR') return entity.type === 'avatar';
                if (node.value === 'UNIT') return entity.type === 'unit';
                if (node.value === 'BOON') return entity.type === 'boon';
                return false;
            }
            else if (node.attribute === 'tribe') entVal = entity.tribe || 'Generic';
            else if (node.attribute === 'family') entVal = entity.family || '';
            else if (node.attribute === 'genus') entVal = entity.genus || '';
            else if (node.attribute === 'cost') entVal = typeof entity.cost === 'object' ? (entity.cost.tribeAmount || entity.cost.carnie || entity.cost.tent || 0) : (entity.cost || 0);
            else if (node.attribute === 'power') entVal = entity.power || 0;
            else if (node.attribute === 'health') entVal = entity.health || 0;
            else if (node.attribute === 'maxHealth') entVal = entity.maxHealth || 0;
            else if (node.attribute === 'strength') entVal = entity.strength || 0;
            else if (node.attribute === 'armor') entVal = entity.armor || 0;
            else if (node.attribute === 'readiness') entVal = entity.readiness || 0;
            else if (node.attribute === 'acts') entVal = entity.acts || 0;
            else if (node.attribute === 'maxActs') entVal = entity.maxActs || 0;
            else if (node.attribute === 'isCombat') entVal = (eventPayload?.isCombat || eventPayload?.eventContext?.isCombat) ? 'true' : 'false';
            else if (node.attribute === 'isAttacking') entVal = (eventPayload?.eventContext?.combatAttackerId === entity.instanceId) ? 'true' : 'false';
            else if (node.attribute === 'alignment') {
                const entOwner = getOwnerId(this.state, entity);
                const sourceOwner = getOwnerId(this.state, source) || this.state.activePlayerId;
                entVal = entOwner === sourceOwner ? 'FRIENDLY' : 'ENEMY';
            }
            else if (node.attribute === 'hasAbility') {
                const searchVal = String(node.value).toLowerCase();
                const abs = lkiAbilities || entity.abilities || [];
                const hasAb = abs.some(a => {
                    if (typeof a === 'string') {
                        if (a.toLowerCase() === searchVal) return true;
                        const catAb = this.state.abilityCatalog?.find(ca => ca.abilityId === a);
                        return catAb && catAb.name && catAb.name.toLowerCase() === searchVal;
                    }
                    return a.abilityId === node.value || (a.name && a.name.toLowerCase() === searchVal);
                });

                const hasEffect = entity.activeEffects?.some(e => 
                    e.type === 'GRANT_ABILITY' && 
                    (e.grantedAbilityId === node.value || 
                    (e.grantedAbilityId && e.grantedAbilityId.toLowerCase() === searchVal))
                );
                
                entVal = !!(hasAb || hasEffect);
                return node.operator === '==' ? entVal : !entVal;
            }
            
            if (typeof entVal === 'string') {
                const cmp = entVal.toLowerCase() === String(node.value).toLowerCase();
                return node.operator === '==' ? cmp : !cmp;
            } else {
                const val = Number(node.value);
                if (node.operator === '==') return entVal === val;
                if (node.operator === '!=') return entVal !== val;
                if (node.operator === '>=') return entVal >= val;
                if (node.operator === '<=') return entVal <= val;
                if (node.operator === '>') return entVal > val;
                if (node.operator === '<') return entVal < val;
            }
        }
        return true;
    }
}

// ==========================================
// GAME FLOW & PHASE MANAGEMENT
// ==========================================

export function endTurn(state) {
    const engine = new GameEngine(state);
    const prevPlayer = state.activePlayerId;
    
    engine.emit('TURN_ENDING', { playerId: prevPlayer });
    state.history_log.push(`🏁 ${state.players[prevPlayer].name} ended their turn.`);

    sweepTurnEffects(engine, prevPlayer);

    engine.emit('TURN_ENDED', { playerId: prevPlayer });

    state.activePlayerId = state.activePlayerId === 'player1' ? 'player2' : 'player1';
    if (state.activePlayerId === 'player1') state.turnNumber++;

    startTurn(state, engine);
}

export function startTurn(state, engine) {
    const pId = state.activePlayerId;
    const player = state.players[pId];
    
    state.abilityUses = {}; 
    
    if (!player.setupComplete) {
        player.setupComplete = true;
        const avatar = getAvatar(state, pId);
        if (avatar) avatar.isDeployed = true;
        
        if (pId === 'player2' && player.isDummy) {
            const catalogDummy = CARD_CATALOG.find(c => c.id === 'target_dummy' || c.name === 'Target Dummy');
            let dummy = catalogDummy ? JSON.parse(JSON.stringify(catalogDummy)) : {
                id: 'target_dummy', name: 'Target Dummy', type: 'unit', tribe: 'Robot', health: 1, maxHealth: 1, strength: 1, readiness: 0, abilities: []
            };
            dummy.instanceId = 'inst_' + generateId(state, 9);
            dummy.readiness = 0;
            if (dummy.health === undefined) dummy.health = dummy.maxHealth;
            if (!player.lines['front']) player.lines['front'] = [];
            player.lines['front'].push(dummy);
            state.history_log.push(`🤖 Dummy opponent deployed Avatar and summoned Target Dummy.`);
        } else {
            state.history_log.push(`👤 ${player.name} deployed their Avatar.`);
        }
    }

    if (pId === 'player2' && player.isDummy) {
        state.history_log.push(`⏭️ Player 2 auto-skipped (Waiting for opponent to join).`);
        if (engine) {
            engine.emit('TURN_STARTING', { playerId: pId });
            engine.emit('TURN_STARTED', { playerId: pId });
        }
        endTurn(state);
        return;
    }

    if (player.resources) {
        for (const tribe in player.resources) {
            player.resources[tribe].current = player.resources[tribe].max;
        }
    }
    
    for (const line of LINES) {
        if (player.lines[line]) {
            player.lines[line].forEach(u => {
                let currentReadiness = Number(u.readiness);
                if (isNaN(currentReadiness)) currentReadiness = 0;
                if (currentReadiness < 1) u.readiness = currentReadiness + 1;
                u.acts = u.maxActs !== undefined ? u.maxActs : 1;

                if (u.attachments) {
                    u.attachments.forEach(item => {
                        let ir = Number(item.readiness);
                        if (isNaN(ir)) ir = 0;
                        if (ir < 1) item.readiness = ir + 1;
                        item.acts = item.maxActs !== undefined ? item.maxActs : 1;
                    });
                }
            });
        }
    }

    if (state.equator) {
        state.equator.forEach(item => {
            if (item.ownerId === pId || item.type === 'artifact') {
                let currentReadiness = Number(item.readiness);
                if (isNaN(currentReadiness)) currentReadiness = 0;
                if (currentReadiness < 1) item.readiness = currentReadiness + 1;
                item.acts = item.maxActs !== undefined ? item.maxActs : 1;
            }
        });
    }
    
    if (player.discard) {
        player.discard.forEach(card => {
            if (card.type === 'unit' || card.type === 'equipment' || card.type === 'artifact') {
                card.acts = card.maxActs !== undefined ? card.maxActs : 1;
            }
        });
    }

    let drawn = 0;
    for(let i=0; i<2; i++) {
        if (player.deck.length > 0) {
            const card = player.deck.pop();
            card.readiness = 0;
            player.hand.push(card);
            drawn++;
        }
    }

    state.turnPhase = 'SACRIFICE_DECISION';
    state.history_log.push(`🌅 Turn ${state.turnNumber} begins for ${player.name}. Drew ${drawn} cards.`);
    
    if (engine) {
        engine.emit('TURN_STARTING', { playerId: pId });
        engine.emit('TURN_STARTED', { playerId: pId });
    }
}

export function executeSacrificeDecision(state, option, cardId) {
    if (state.turnPhase !== 'SACRIFICE_DECISION') return;
    const player = state.players[state.activePlayerId];

    if (option === 'OPTION_A' && cardId) {
        const cardIndex = player.hand.findIndex(c => c.instanceId === cardId || c.id === cardId);
        if (cardIndex > -1) {
            const sacCard = player.hand[cardIndex];
            const engine = new GameEngine(state);
            const avatar = getAvatar(state, state.activePlayerId);
            const harvest = new HarvestAction({ source: avatar, target: sacCard });
            harvest.run(engine);
        }
    } else {
        state.history_log.push(`⏭️ ${player.name} skipped the Sacrifice Phase.`);
    }
    state.turnPhase = 'ACTION_PHASE';
}

export function canPlayCard(state, playerId, card) {
    const player = state.players[playerId];
    if (!player) return false;

    let baseCost = typeof card.cost === 'object' ? (card.cost.tribeAmount > 0 ? card.cost.tribeAmount : (card.cost.carnie || card.cost.tent || 0)) : (card.cost || 0);
    let cTribe = resolveResourceKey(player, card.tribe);
    let carnieRes = player.resources['Carnie'] ? player.resources['Carnie'].current : 0;

    if (baseCost > 0) {
        if (cTribe === 'Carnie') {
            if (carnieRes < baseCost) return false;
        } else {
            const tribeRes = player.resources[cTribe] ? player.resources[cTribe].current : 0;
            if (tribeRes < 1) return false;
            const maxCarnieConversion = Math.floor(carnieRes / 3);
            if (tribeRes + maxCarnieConversion < baseCost) return false;
        }
    }

    if (card.abilities) {
        for (const ab of card.abilities) {
            if (['PLAY', 'PLAY_OPTIONAL', 'MODIFY_PLAY', 'ON_BE_PLAYED', 'PLAYED'].includes(ab.trigger) && ab.activation?.method === 'PLAYER_CHOICE') {
                const qt = ab.activation.quickTargeting;
                if (qt && qt.zones && qt.zones.includes('FIELD')) {
                    const oppId = playerId === 'player1' ? 'player2' : 'player1';
                    let targetFound = false;
                    if (qt.alignment?.includes('FRIENDLY') && LINES.some(l => state.players[playerId].lines[l]?.length > 0)) targetFound = true;
                    if (qt.alignment?.includes('ENEMY') && !targetFound && LINES.some(l => state.players[oppId].lines[l]?.length > 0)) targetFound = true;
                    if (!targetFound) return false;
                }
            }
        }
    }
    return true;
}

export function playCard(state, playerId, cardId, targetLine = 'back', abilityTargetId = null) {
    const player = state.players[playerId];
    const cardIdx = player.hand.findIndex(c => c.instanceId === cardId || c.id === cardId);
    if (cardIdx === -1) return { success: false, reason: "Card not in hand" };
    const card = player.hand[cardIdx];

    let baseCost = typeof card.cost === 'object' ? (card.cost.tribeAmount > 0 ? card.cost.tribeAmount : (card.cost.carnie || card.cost.tent || 0)) : (card.cost || 0);
    let cTribe = resolveResourceKey(player, card.tribe);
    let carnieRes = player.resources['Carnie'] ? player.resources['Carnie'].current : 0;

    if (baseCost > 0) {
        if (cTribe === 'Carnie') {
            if (carnieRes < baseCost) return { success: false, reason: `Not enough Carnie (Cost: ${baseCost})` };
            player.resources['Carnie'].current -= baseCost;
        } else {
            const tribeRes = player.resources[cTribe] ? player.resources[cTribe].current : 0;
            if (tribeRes < 1) return { success: false, reason: `Must use at least 1 Tribe Resource` };
            const maxCarnieConversion = Math.floor(carnieRes / 3);
            if (tribeRes + maxCarnieConversion < baseCost) return { success: false, reason: `Not enough resources (Cost: ${baseCost})` };
            
            let costRemaining = baseCost;
            let tribeResToUse = Math.min(tribeRes, costRemaining);
            costRemaining -= tribeResToUse;
            if (costRemaining > 0) player.resources['Carnie'].current -= (costRemaining * 3);
            if (cTribe) player.resources[cTribe].current -= tribeResToUse;
        }
    }

    const engine = new GameEngine(state);
    const action = new PlayAction({
        source: getAvatar(state, playerId),
        target: card,
        targetLine: targetLine,
        eventContext: { abilityTargetId }
    });
    action.run(engine);
    return { success: true };
}

export function getValidAttackTargets(state, attackerOwnerId, attackerEntity = null) {
    const defenderOwnerId = attackerOwnerId === 'player1' ? 'player2' : 'player1';
    const defPlayer = state.players[defenderOwnerId];
    let targets = [];

    const hasPerception = hasEngineFlag(state, attackerEntity, 'IGNORE_BLOCK_TARGETING');
    const isTimid = hasEngineFlag(state, attackerEntity, 'BLOCK_TARGET_AVATAR');

    const isValidTarget = (u) => {
        if (u.type === 'boon') return false;
        if (isTimid && u.type === 'avatar') return false;
        const isTargetHidden = hasEngineFlag(state, u, 'BLOCK_TARGETING');
        return !isTargetHidden || hasPerception;
    };

    // Group by logical line in case of physical array desync (e.g. from SET_STAT)
    const logicalLines = { taunt: [], bodyguard: [], avatar: [], front: [], mid: [], back: [], sheltered: [], sideline: [] };
    for (const line of ['taunt', 'bodyguard', 'avatar', 'front', 'mid', 'back', 'sheltered', 'sideline']) {
        if (defPlayer.lines[line]) {
            defPlayer.lines[line].forEach(u => {
                const currentLine = u.line || line;
                if (logicalLines[currentLine]) logicalLines[currentLine].push(u);
            });
        }
    }

    if (logicalLines['taunt'].length > 0) {
        logicalLines['taunt'].filter(isValidTarget).forEach(u => targets.push({ id: u.instanceId, line: 'taunt' }));
        return targets;
    }

    if (logicalLines['bodyguard'].length > 0) {
        logicalLines['bodyguard'].filter(isValidTarget).forEach(u => targets.push({ id: u.instanceId, line: 'bodyguard' }));
    } else if (logicalLines['avatar'].length > 0) {
        logicalLines['avatar'].filter(isValidTarget).forEach(u => targets.push({ id: u.instanceId, line: 'avatar' }));
    }

    for (const line of ['front', 'mid', 'back', 'sheltered']) {
        if (logicalLines[line].length > 0) {
            const valid = logicalLines[line].filter(isValidTarget);
            if (valid.length > 0) {
                valid.forEach(u => targets.push({ id: u.instanceId, line: line }));
                break;
            }
        }
    }

    if (logicalLines['sideline'].length > 0) {
        logicalLines['sideline'].filter(isValidTarget).forEach(u => targets.push({ id: u.instanceId, line: 'sideline' }));
    }
    
    return targets;
}

export function cloneGameState(state) {
    const clone = JSON.parse(JSON.stringify(state));
    if (state.abilityCatalog) Object.defineProperty(clone, 'abilityCatalog', { value: state.abilityCatalog, enumerable: false, configurable: true });
    if (state.catalog) Object.defineProperty(clone, 'catalog', { value: state.catalog, enumerable: false, configurable: true });
    return clone;
}

export function getValidAbilityTargets(state, playerId, entityId, abilityId) {
    let entity = state.equator?.find(i => i.instanceId === entityId);
    if (!entity) {
        const p = state.players[playerId];
        for (const line of LINES) {
            entity = p.lines[line]?.find(u => u.instanceId === entityId);
            if (entity) break;
        }
        if (!entity) entity = p.hand.find(c => c.instanceId === entityId || c.id === entityId);
    }
    if (!entity) return [];

    const ability = entity.abilities?.find(a => a.abilityId === abilityId);
    const qt = ability?.activation?.quickTargeting;
    if (!qt || ability.activation?.method !== 'PLAYER_CHOICE') return [];

    let targets = [];
    const oppId = playerId === 'player1' ? 'player2' : 'player1';
    const isAttack = ability.effects?.some(g => g.payloads?.some(p => p.type === 'ATTACK'));

    if (qt.zones) {
        const checkPlayer = (pId, isFriendly) => {
            if ((isFriendly && !qt.alignment.includes('FRIENDLY')) || (!isFriendly && !qt.alignment.includes('ENEMY'))) return;
            const p = state.players[pId];
            const hasPerception = hasEngineFlag(state, entity, 'IGNORE_BLOCK_TARGETING');

            const checkEntity = (ent, line) => {
                let entType = 'UNIT';
                if (ent.type === 'avatar') entType = 'AVATAR';
                else if (['equipment', 'artifact'].includes(ent.type)) entType = 'EQUIPMENT';
                else if (ent.type === 'spell') entType = 'SPELL';
                else if (ent.type === 'boon') entType = 'BOON';
                
                if (!isFriendly) {
                    const isTargetHidden = hasEngineFlag(state, ent, 'BLOCK_TARGETING');
                    if (isTargetHidden && !hasPerception) return;
                }
                if (qt.entityType.includes(entType) || (isAttack && entType === 'AVATAR')) targets.push({ id: ent.instanceId || ent.id, line: line, playerId: pId });
            };

            if (qt.zones.includes('FIELD')) {
                for (const line of LINES) {
                    if (p.lines[line]) p.lines[line].forEach(u => { if (u.type !== 'boon') checkEntity(u, u.line || line); });
                }
            }
            ['hand', 'discard', 'deck', 'banish'].forEach(z => {
                if (qt.zones.includes(z.toUpperCase())) p[z].forEach(c => checkEntity(c, z));
            });
        };
        
        checkPlayer(playerId, true);
        checkPlayer(oppId, false);
        
        if (qt.zones.includes('FIELD') && !qt.ignoreBattlelines) {
            const atkTargets = getValidAttackTargets(state, playerId, entity);
            targets = targets.filter(t => t.playerId === playerId || !['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(t.line) || atkTargets.some(at => at.id === t.id));
        }
    }
    
    const engine = new GameEngine(state);
    const p1 = state.players.player1;
    const p2 = state.players.player2;
    const allEntities = [
        ...Object.values(p1.lines).flat(), ...Object.values(p2.lines).flat(), ...(state.equator || []),
        ...p1.hand, ...p1.deck, ...p1.discard, ...p1.banish,
        ...p2.hand, ...p2.deck, ...p2.discard, ...p2.banish
    ].filter(Boolean);
    
    targets = targets.filter(t => {
        const targetEntity = allEntities.find(e => e.id === t.id || e.instanceId === t.id);
        if (!targetEntity) return false;
        
        if (ability.activation?.logicTree && !engine.evaluateLogicTree(ability.activation.logicTree, targetEntity, entity)) return false;

        if (ability.effects) {
            for (const group of ability.effects) {
                if (group.targetMethod === 'SAME_AS_ACTIVATION' && group.payloads) {
                    for (const p of group.payloads) {
                        if (p.isCost && p.type === 'MODIFY_STAT' && p.amount < 0) {
                            if (p.stat === 'readiness') {
                                const costAmt = Math.abs(p.amount);
                                let currentVal = Number(targetEntity[p.stat]);
                                if (isNaN(currentVal)) currentVal = 0;
                                if (currentVal - costAmt < -1) return false;
                            }
                        }
                    }
                }
            }
        }
        return true;
    });
    
    return targets.filter((t, index, self) => index === self.findIndex(o => o.id === t.id));
}

export function getEntityAvailableActions(state, playerId, entityId) {
    const actions = [];
    let entity = state.equator?.find(i => i.instanceId === entityId);
    if (!entity) {
        for (const line of LINES) {
            entity = state.players[playerId].lines[line]?.find(u => u.instanceId === entityId);
            if (entity) break;
        }
    }
    if (!entity) return actions;

    const hasBlockAct = hasEngineFlag(state, entity, 'BLOCK_ACT');
    const hasBlockAttack = hasEngineFlag(state, entity, 'BLOCK_ATTACK') || hasBlockAct;

    if (entity.abilities) {
        entity.abilities.forEach(ab => {
            if (ab.trigger === 'MANUAL') {
                const isAttack = ab.effects && ab.effects.some(g => g.payloads && g.payloads.some(p => p.type === 'ATTACK'));
                if (isAttack && hasBlockAttack) return;
                if (!isAttack && hasBlockAct) return;

                const cost = ab.cost || {};
                let canAfford = true;
                
                let currentReadiness = Number(entity.readiness);
                if (isNaN(currentReadiness)) currentReadiness = 0;
                
                const abilityKey = `${entity.instanceId}_${ab.abilityId}`;
                let requiresReadiness = true; // All manual actions natively require readiness
                if (cost.readinessCost && cost.readinessCost !== 'NONE' && cost.reuseIgnoresReadiness && (state.abilityUses?.[abilityKey] || 0) > 0) {
                    requiresReadiness = false;
                }
                if (requiresReadiness && currentReadiness < 1) canAfford = false;
                
                if (canAfford) {
                    const player = state.players[playerId];
                    if ((cost.carnie || cost.tent) > 0 && (player.resources['Carnie']?.current || 0) < (cost.carnie || cost.tent)) canAfford = false;
                    if (cost.power > 0 && (entity.power || 0) < cost.power) canAfford = false;
                    
                    if (canAfford && cost.tribeAmount > 0) {
                        const entityTribe = resolveResourceKey(player, entity.tribe);
                        const tribeRes = player.resources[entityTribe] ? player.resources[entityTribe].current : 0;
                        if (entityTribe === 'Carnie') {
                            if ((player.resources['Carnie']?.current || 0) < cost.tribeAmount) canAfford = false;
                        } else {
                            if (tribeRes < 1) canAfford = false;
                            else {
                                const carnieRes = player.resources['Carnie'] ? player.resources['Carnie'].current : 0;
                                if (tribeRes + Math.floor(carnieRes / 3) < cost.tribeAmount) canAfford = false;
                            }
                        }
                    }
                    
                    if (canAfford) {
                        const limit = ab.triggerLimit || 'UNLIMITED';
                        if (limit === 'ONCE_PER_ROUND' && (state.abilityUses?.[abilityKey] || 0) >= 1) canAfford = false;
                        if (limit === 'TWICE_PER_ROUND' && (state.abilityUses?.[abilityKey] || 0) >= 2) canAfford = false;
                    }
                    
                    if (canAfford && !cost.freeAction && !isAttack) {
                        let currentActs = Number(entity.acts);
                        if (isNaN(currentActs)) currentActs = 0;
                        if (currentActs < 1) canAfford = false;
                    }

                    if (canAfford && ab.effects) {
                        for (const group of ab.effects) {
                            if (group.targetMethod === 'SELF' && group.payloads) {
                                for (const p of group.payloads) {
                                    if (p.isCost && p.type === 'MODIFY_STAT' && p.amount < 0) {
                                        if (p.stat === 'readiness') {
                                            const costAmt = Math.abs(p.amount);
                                            let currentVal = Number(entity[p.stat]);
                                            if (isNaN(currentVal)) currentVal = 0;
                                            
                                            if (currentVal - costAmt < -1) {
                                                canAfford = false;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            if (!canAfford) break;
                        }
                    }
                }
                
                if (canAfford) actions.push({ type: isAttack ? 'ATTACK' : 'ABILITY', name: ab.name, abilityId: ab.abilityId });
            }
        });
    }
    return actions;
}

export function executeEntityAction(state, playerId, entityId, actionType, abilityId, targetId, targetLine) {
    if (actionType === 'ABILITY' || actionType === 'ATTACK') {
        let entity = state.equator?.find(i => i.instanceId === entityId);
        if (!entity) {
            for (const line of LINES) {
                entity = state.players[playerId].lines[line]?.find(u => u.instanceId === entityId);
                if (entity) break;
            }
        }
        if (!entity) return { success: false, reason: "Entity not found" };
        
        const ability = entity.abilities?.find(a => a.abilityId === abilityId);
        if (!ability) return { success: false, reason: "Ability not found" };

        if (actionType === 'ABILITY' && !ability.cost?.freeAction) {
            let currentActs = Number(entity.acts);
            if (isNaN(currentActs)) currentActs = 0;
            entity.acts = Math.max(0, currentActs - 1);
        }

        let targetEntity = null;
        if (targetId) {
            const p1 = state.players.player1;
            const p2 = state.players.player2;
            const allEntities = [
                ...Object.values(p1.lines).flat(), ...Object.values(p2.lines).flat(), ...(state.equator || []),
                ...p1.hand, ...p1.deck, ...p1.discard, ...p1.banish,
                ...p2.hand, ...p2.deck, ...p2.discard, ...p2.banish
            ].filter(Boolean);
            targetEntity = allEntities.find(e => e.id === targetId || e.instanceId === targetId);
        }

        const engine = new GameEngine(state);
        engine.executeAbility(ability, entity, { target: targetEntity });
        return { success: true };
    }
    return { success: false, reason: "Unknown action" };
}

export function shuffleArray(state, array) {
    return prandomShuffle(state, array);
}

export function initGame(roomId, p1Name, p1Deck, abilityCatalog = null, cardCatalog = null) {
    const state = new GameState();
    state.rngSeed = Math.floor(Math.random() * 4294967296);
    if (abilityCatalog) Object.defineProperty(state, 'abilityCatalog', { value: abilityCatalog, enumerable: false, configurable: true });
    if (cardCatalog) Object.defineProperty(state, 'catalog', { value: cardCatalog, enumerable: false, configurable: true });
    state.gameId = roomId;
    state.roomId = roomId;
    state.players.player1.name = p1Name;
    
    state.players.player1.deck = JSON.parse(JSON.stringify(p1Deck || []));
    state.players.player1.deck.forEach((c, idx) => {
        c.instanceId = 'inst_p1_' + generateId(state, 9) + '_' + idx;
        c.originalOwnerId = 'player1';
        c.ownerId = 'player1';
        c.originalPower = c.power || 0;
        c.originalStrength = c.strength !== undefined ? c.strength : null;
    });
    
    const p1AvatarIdx = state.players.player1.deck.findIndex(c => c.type === 'avatar');
    if (p1AvatarIdx > -1) {
        const av = state.players.player1.deck.splice(p1AvatarIdx, 1)[0];
        av.id = 'p1_avatar'; av.instanceId = 'p1_avatar';
        av.health = av.health || 30; av.maxHealth = av.health;
        av.type = 'avatar'; av.defaultLine = 'avatar'; av.line = 'avatar';
        av.readiness = 1; av.acts = 1; av.maxActs = 1;
        av.originalOwnerId = 'player1'; av.ownerId = 'player1';
        av.originalPower = av.power || 0; av.originalStrength = av.strength !== undefined ? av.strength : null;
        state.players.player1.lines.avatar = [av];
    }

    state.players.player1.tents = 2; state.players.player1.maxTents = 2;
    state.players.player1.resources = { 'Carnie': { current: 2, max: 2 } };
    let p1Tribe = getResKey(state.players.player1.lines.avatar[0]?.tribe);
    if (p1Tribe === 'Carnie' || p1Tribe === 'Generic') {
        state.players.player1.resources['Carnie'].current = 3;
        state.players.player1.resources['Carnie'].max = 3;
    } else {
        state.players.player1.resources[p1Tribe] = { current: 1, max: 1 };
    }
    
    state.players.player2.deck = [];
    state.players.player2.lines.avatar = [{
        id: 'p2_dummy_avatar', instanceId: 'p2_dummy_avatar', name: 'Waiting for Player 2...', health: 30, maxHealth: 30,
        type: 'avatar', tribe: 'Robot', defaultLine: 'avatar', line: 'avatar', readiness: 1
    }];

    state.players.player2.tents = 2; state.players.player2.maxTents = 2;
    state.players.player2.resources = { 'Carnie': { current: 2, max: 2 } };
    let p2DummyTribe = state.players.player2.lines.avatar[0]?.tribe || 'Robot';
    if (p2DummyTribe.toLowerCase() === 'carnie') {
        state.players.player2.resources['Carnie'].current = 3;
        state.players.player2.resources['Carnie'].max = 3;
    } else {
        state.players.player2.resources[p2DummyTribe] = { current: 1, max: 1 };
    }
    state.players.player2.isDummy = true;
    
    shuffleArray(state, state.players.player1.deck);
    shuffleArray(state, state.players.player2.deck);
    
    for(let i = 0; i < 4; i++) {
        if (state.players.player1.deck.length > 0) {
            const c = state.players.player1.deck.pop();
            c.readiness = 0; state.players.player1.hand.push(c);
        }
    }

    for(let i = 0; i < 5; i++) {
        if (state.players.player2.deck.length > 0) {
            const c = state.players.player2.deck.pop();
            c.readiness = 0; state.players.player2.hand.push(c);
        }
    }
    
    state.history_log.push(`Match initialized. Players drew starting hands.`);
    startTurn(state, null);
    return state;
}

export function joinGame(state, p2Name, p2Deck) {
    state.players.player2.name = p2Name;
    state.players.player2.isDummy = false;
    state.players.player2.lines = { taunt: [], bodyguard: [], front: [], mid: [], back: [], sheltered: [], sideline: [] };
    state.players.player2.setupComplete = false;
    
    state.players.player2.deck = JSON.parse(JSON.stringify(p2Deck || []));
    state.players.player2.deck.forEach((c, idx) => {
        c.instanceId = 'inst_p2_' + generateId(state, 9) + '_' + idx;
        c.originalOwnerId = 'player2'; c.ownerId = 'player2';
        c.originalPower = c.power || 0; c.originalStrength = c.strength !== undefined ? c.strength : null;
    });
    
    const p2AvatarIdx = state.players.player2.deck.findIndex(c => c.type === 'avatar');
    if (p2AvatarIdx > -1) {
        const av = state.players.player2.deck.splice(p2AvatarIdx, 1)[0];
        av.id = 'p2_avatar'; av.instanceId = 'p2_avatar';
        av.health = av.health || 30; av.maxHealth = av.health;
        av.type = 'avatar'; av.defaultLine = 'avatar'; av.line = 'avatar';
        av.readiness = 1; av.acts = 1; av.maxActs = 1;
        av.originalOwnerId = 'player2'; av.ownerId = 'player2';
        av.originalPower = av.power || 0; av.originalStrength = av.strength !== undefined ? av.strength : null;
        state.players.player2.lines.avatar = [av];
    }

    state.players.player2.tents = 2; state.players.player2.maxTents = 2;
    state.players.player2.resources = { 'Carnie': { current: 2, max: 2 } };
    let p2Tribe = getResKey(state.players.player2.lines.avatar[0]?.tribe);
    if (p2Tribe === 'Carnie' || p2Tribe === 'Generic') {
        state.players.player2.resources['Carnie'].current = 3;
        state.players.player2.resources['Carnie'].max = 3;
    } else {
        state.players.player2.resources[p2Tribe] = { current: 1, max: 1 };
    }
    
    shuffleArray(state, state.players.player2.deck);
    
    state.players.player2.hand = [];
    for(let i = 0; i < 5; i++) {
        if (state.players.player2.deck.length > 0) {
            const c = state.players.player2.deck.pop();
            c.readiness = 0; state.players.player2.hand.push(c);
        }
    }
    
    state.history_log.push(`${p2Name} joined the match.`);
    return state;
}