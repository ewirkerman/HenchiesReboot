/**
 * src/engine.js
 * Henchies 2 Game Engine Core
 * Implements a LIFO Event Bus with APNAP resolution, WOULD_ replacement effects, 
 * and infinite-loop self-trigger prevention.
 */

export const CARD_CATALOG = []; // Will be hydrated by deckbuilder/firebase

import { nextRandom, randomInt, generateId, shuffleArray as prandomShuffle } from './prandom.js';
import { ACTION_REGISTRY, HarvestAction, PlayAction, AttackAction, DealDamageAction, KillAction, UnfieldAction, sweepTurnEffects } from './actions.js';

export const TRAITS = [];
export const LINES = ['taunt', 'bodyguard', 'avatar', 'front', 'mid', 'back', 'sheltered', 'sideline'];
export class Card {}
export class UnitInstance {}
export class Avatar {}

export class GameState {
    constructor() {
        this.status = 'active';
        this.activePlayerId = 'player1';
        this.turnNumber = 1;
        this.turnPhase = 'SACRIFICE_DECISION'; // SACRIFICE_DECISION, ACTION_PHASE
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

export class GameEngine {
    constructor(state) {
        this.state = state;
        this.stack = [];
        this.processing = false;
        
        // Prevents actions from retriggering themselves in the same action chain
        this.activeChainAbilities = new Set();
    }

    /**
     * Core Event Bus Emitter
     * @param {string} eventType e.g., 'DAMAGE', 'SUMMON', 'KILL'
     * @param {object} payload Contextual data (source, target, amount, etc.)
     */
    emit(eventType, payload) {
        // 1. Check for WOULD_ replacement events
        const wouldEvent = `WOULD_${eventType}`;
        const hasWouldTriggers = this.queueTriggers(wouldEvent, payload);
        
        // 2. Queue standard post-event triggers
        const pastTenseEvent = this.getPastTenseEvent(eventType);
        if (pastTenseEvent) {
            this.queueTriggers(pastTenseEvent, payload);
        } else {
            this.queueTriggers(eventType, payload);
        }

        // 3. Resolve the stack immediately if triggers were added 
        // so WOULD_ and MODIFY_ apply synchronously to the active reference.
        if (hasWouldTriggers || this.stack.length > 0) {
            this.startStackProcessing();
        }
        
        return { cancelled: !!payload.cancelled };
    }

    /**
     * Scans the board for abilities matching the event, sorts by APNAP, and pushes to LIFO Stack.
     * @returns {boolean} True if triggers were added to the stack.
     */
    queueTriggers(eventType, payload) {
        let triggersFound = false;
        const triggers = [];
        const checkedEntities = new Set();
        
        // Helper to guarantee we don't double-trigger and can safely scan any entity
        const checkEntity = (ent, ownerId) => {
            if (!ent || !ent.abilities || !ent.instanceId || checkedEntities.has(ent.instanceId)) return;
            checkedEntities.add(ent.instanceId);
            for (const ability of ent.abilities) {
                const allTriggers = [ability.trigger, ...(ability.additionalTriggers || [])];
                if (allTriggers.includes(eventType) && !this.activeChainAbilities.has(ability.abilityId)) {
                    
                    let isValid = true;
                    if (payload) {
                        const passiveStrings = ['BE_DAMAGED', 'BE_HEALED', 'BE_KILLED', 'BE_GRANTED_ABILITY', 'BE_STAT_MODIFIED', 'BE_RESOURCE_MODIFIED', 'BE_STAT_SET', 'BE_DRAWN', 'BE_SUMMONED', 'BE_PLAYED', 'BE_ATTACKED', 'BE_HARVESTED', 'BE_DISCARDED', 'BE_SHUFFLED', 'BE_RETURNED', 'BE_RECOVERED', 'BE_TRASHED', 'BE_BANISHED', 'BE_FIELDED', 'BE_UNFIELDED', 'BE_ATTACHED', 'BE_UNATTACHED'];
                        const activeStrings = ['DEAL_DAMAGE', 'HEAL', 'KILL', 'GRANT_ABILITY', 'MODIFY_STAT', 'MODIFY_RESOURCE', 'SET_STAT', 'DRAW_CARD', 'SUMMON', 'PLAY', 'ATTACK', 'HARVEST', 'DISCARD', 'SHUFFLE', 'RETURN', 'RECOVER', 'TRASH', 'BANISH', 'FIELD', 'UNFIELD', 'ATTACH', 'UNATTACH'];
                        
                        const isPassive = passiveStrings.some(p => eventType.includes(p));
                        if (isPassive) {
                            if (payload.target && payload.target.instanceId !== ent.instanceId) isValid = false;
                        } else {
                            const isActive = activeStrings.some(a => eventType.includes(a));
                            if (isActive) {
                                if (payload.source && payload.source.instanceId !== ent.instanceId) isValid = false;
                            }
                        }
                    } else if (scope === 'GLOBAL') {
                        let eventEntity = null;
                        if (isPassive) eventEntity = payload.target;
                        else {
                            const isActive = activeStrings.some(a => eventType.includes(a));
                            if (isActive) eventEntity = payload.source;
                        }

                        if (!eventEntity) {
                            isValid = false;
                        } else {
                            const qt = ability.activation?.quickTargeting;
                            const lt = ability.activation?.logicTree;
                            const pool = this.findEntitiesInScope(qt, ownerId);
                            
                            if (!pool.some(p => p.instanceId === eventEntity.instanceId)) {
                                isValid = false;
                            } else if (!this.evaluateLogicTree(lt, eventEntity, ent, payload)) {
                                isValid = false;
                            }
                        }
                    }

                    if (isValid) {
                        triggers.push({ owner: ownerId || this.state.activePlayerId, source: ent, ability, payload });
                    }
                }
            }
        };

        // 1. Force-check transit entities in the payload (crucial for MODIFY_PLAY / ON_BE_PLAYED)
        if (payload) {
            const getOwner = (ent) => {
                if (ent.ownerId) return ent.ownerId;
                for (const pId of ['player1', 'player2']) {
                    const p = this.state.players[pId];
                    if (['hand', 'deck', 'discard', 'banish'].some(z => p[z].some(c => c.instanceId === ent.instanceId))) return pId;
                    for (const line of LINES) {
                        if (p.lines[line] && p.lines[line].some(c => c.instanceId === ent.instanceId)) return pId;
                        if (p.lines[line] && p.lines[line].some(u => u.attachments && u.attachments.some(a => a.instanceId === ent.instanceId))) return pId;
                    }
                }
                return null;
            };
            if (payload.source) checkEntity(payload.source, getOwner(payload.source));
            if (payload.target) checkEntity(payload.target, getOwner(payload.target));
        }
        
        // 2. Scan all entities on the board for matching triggers
        for (const pId of ['player1', 'player2']) {
            const player = this.state.players[pId];
            
            // Check Unit abilities
            for (const line of LINES) {
                if (!player.lines[line]) continue;
                for (const unit of player.lines[line]) {
                    checkEntity(unit, pId);
                    if (unit.attachments) {
                        unit.attachments.forEach(att => checkEntity(att, pId));
                    }
                }
            }
        }
        
        // 3. Check Equator abilities (OUTSIDE the player loop to prevent duplication)
        if (this.state.equator) {
            for (const item of this.state.equator) {
                checkEntity(item, item.ownerId || this.state.activePlayerId);
            }
        }

        if (triggers.length === 0) return false;

        // APNAP Sorting (Active Player, then Non-Active Player)
        triggers.sort((a, b) => {
            if (a.owner === this.state.activePlayerId && b.owner !== this.state.activePlayerId) return -1;
            if (a.owner !== this.state.activePlayerId && b.owner === this.state.activePlayerId) return 1;
            return 0; 
        });

        // LIFO: Active Player triggers go on stack first (so they are at the bottom).
        // Non-Active Player triggers go on stack last (so they resolve first at the top).
        triggers.reverse().forEach(t => this.stack.push(t));

        return true;
    }

    startStackProcessing() {
        if (this.processing) return; // Prevent recursive loop running if already unspooling stack
        
        this.processing = true;
        
        while (this.stack.length > 0) {
            const frame = this.stack.pop();
            
            // Lock this ability from re-triggering itself during this specific chain
            this.activeChainAbilities.add(frame.ability.abilityId);
            
            this.executeAbility(frame.ability, frame.source, frame.payload, frame.owner);
        }
        
        // Only sweep when the ENTIRE nested chain has resolved
        this.sweepDeadEntities();
        
        // Chain complete. Clear the loop-prevention set for the next distinct action.
        this.activeChainAbilities.clear();
        this.processing = false;
    }

    sweepDeadEntities() {
        for (const pId of ['player1', 'player2']) {
            const player = this.state.players[pId];
            for (const line of LINES) {
                if (!player.lines[line]) continue;
                
                // Iterate backwards for safe splicing
                for (let i = player.lines[line].length - 1; i >= 0; i--) {
                    const u = player.lines[line][i];
                    if (u.type === 'avatar') continue; // Avatars end the game, they don't die via normal sweep
                    if (u.health <= 0 && !u._isDying) {
                        new KillAction({ target: u }).run(this);
                    }
                }
            }
        }
    }

    executeAbility(ability, source, eventPayload, ownerId) {
        const DEBUG_ABILITIES = true;
        try {
            if (DEBUG_ABILITIES) console.log(`[DEBUG ENGINE] executeAbility START: '${ability.name}' on source '${source?.name}'`);
            // Log the execution
            this.state.history_log.push(`✨ ${source.name || 'Entity'} activated '${ability.name}'`);
            
            if (!ability.effects || !Array.isArray(ability.effects)) {
                console.warn(`[Engine] Ability '${ability.name}' (${ability.abilityId}) has no valid effects array. Skipping.`);
                return;
            }

            ownerId = ownerId || this.state.activePlayerId;
            const p = this.state.players[ownerId];

            const abilityKey = `${source.instanceId}_${ability.abilityId}`;
            const limit = ability.triggerLimit || 'UNLIMITED';
            
            if (limit === 'ONCE_PER_ROUND' && (this.state.abilityUses?.[abilityKey] || 0) >= 1) return;
            if (limit === 'TWICE_PER_ROUND' && (this.state.abilityUses?.[abilityKey] || 0) >= 2) return;

            const cost = ability.cost || {};
            let canAfford = true;
            
            let currentReadiness = Number(source.readiness);
            if (isNaN(currentReadiness)) currentReadiness = 0;
            
            let requiresReadiness = cost.readinessCost && cost.readinessCost !== 'NONE';
            if (requiresReadiness && cost.reuseIgnoresReadiness && (this.state.abilityUses?.[abilityKey] || 0) > 0) {
                requiresReadiness = false;
            }
            if (requiresReadiness && currentReadiness < 1) canAfford = false;
            
            let avatar = null;
            for (const line in p.lines) {
                avatar = p.lines[line]?.find(u => u.type === 'avatar');
                if (avatar) break;
            }

            let cCost = cost.carnie || cost.tent || 0;
            if (cCost > 0 && (p.resources['Carnie']?.current || 0) < cCost) canAfford = false;
            if (cost.power > 0 && (source.power || 0) < cost.power) canAfford = false;
            
            let tribeResKey = null;
            if (cost.tribeAmount > 0) {
                const entityTribe = source.tribe || 'Generic';
                tribeResKey = Object.keys(p.resources || {}).find(k => k.toLowerCase() === entityTribe.toLowerCase());
                if (!tribeResKey || p.resources[tribeResKey].current < cost.tribeAmount) canAfford = false;
            }

            if (!canAfford) {
                console.log(`[Engine] Could not afford trigger cost for '${ability.name}'.`);
                return;
            }

            if (!this.state.abilityUses) this.state.abilityUses = {};
            this.state.abilityUses[abilityKey] = (this.state.abilityUses[abilityKey] || 0) + 1;

            if (requiresReadiness) {
                if (cost.readinessCost === 'EXHAUSTS') source.readiness -= 2;
                else if (cost.readinessCost === 'UNREADIES') source.readiness -= 1;
            }
            
            if (cCost > 0 && p.resources['Carnie']) p.resources['Carnie'].current -= cCost;
            if (cost.power > 0) source.power -= cost.power;
            if (cost.tribeAmount > 0 && tribeResKey) p.resources[tribeResKey].current -= cost.tribeAmount;

            // Phase 1: Target Acquisition (Lock in targets based on board state BEFORE costs/effects resolve)
            const lockedTargets = ability.effects.map((group, index) => {
                if (DEBUG_ABILITIES) console.log(`[DEBUG ENGINE] Target Acquisition - Group ${index} Method: ${group?.targetMethod}`);
                if (!group) {
                    console.warn(`[Engine] Ability '${ability.name}' (${ability.abilityId}) has a null target group at index ${index}.`);
                    return [];
                }
                let targets = [];
                if (group.targetMethod === 'SELF') targets = [source];
                else if (group.targetMethod === 'EVENT_SOURCE') targets = eventPayload?.source ? [eventPayload.source] : [];
                else if (group.targetMethod === 'EVENT_TARGET') targets = eventPayload?.target ? [eventPayload.target] : [];
                else if (group.targetMethod === 'AVATAR') {
                    const av = Object.values(this.state.players[ownerId].lines).flat().find(u => u.type === 'avatar');
                    targets = av ? [av] : [];
                }
                else if (group.targetMethod === 'ENEMY_AVATAR') {
                    const oppId = ownerId === 'player1' ? 'player2' : 'player1';
                    const av = Object.values(this.state.players[oppId].lines).flat().find(u => u.type === 'avatar');
                    targets = av ? [av] : [];
                }
                else if (group.targetMethod === 'SAME_AS_ACTIVATION') {
                    // Check if a specific target ID was tunneled through the payload (e.g. from PlayAction targeted equip)
                    if (eventPayload && eventPayload.abilityTargetId) {
                        const p1 = this.state.players.player1;
                        const p2 = this.state.players.player2;
                        const allEntities = [
                            ...Object.values(p1.lines).flat(),
                            ...Object.values(p2.lines).flat(),
                            ...(this.state.equator || []),
                            ...p1.hand, ...p1.deck, ...p1.discard, ...p1.banish,
                            ...p2.hand, ...p2.deck, ...p2.discard, ...p2.banish
                        ].filter(Boolean);
                        const resolvedTarget = allEntities.find(e => e.id === eventPayload.abilityTargetId || e.instanceId === eventPayload.abilityTargetId);
                        
                        if (!resolvedTarget) console.warn(`[Engine] SAME_AS_ACTIVATION could not find entity with ID: ${eventPayload.abilityTargetId}`);
                        
                        targets = [resolvedTarget || eventPayload.target || source];
                    } else if (eventPayload) {
                        // Smart Reaction Targeting: If the event payload's target is ME, return the source of the event (the instigator)
                        if (eventPayload.target && eventPayload.target.instanceId === source.instanceId && eventPayload.source) {
                            targets = [eventPayload.source];
                        } else {
                            targets = [eventPayload.target || source];
                        }
                    } else {
                        targets = [source];
                    }
                }
                else if (group.targetMethod && group.targetMethod.startsWith('AUTO_')) {
                    let pool = this.findEntitiesInScope(group.quickTargeting, ownerId);
                    pool = pool.filter(ent => this.evaluateLogicTree(group.logicTree, ent, source, eventPayload));
                    
                    if (group.targetMethod === 'AUTO_ALL') targets = pool;
                else if (group.targetMethod === 'AUTO_RANDOM') {
                    targets = prandomShuffle(this.state, [...pool]).slice(0, group.targetCount || 1);
                } else if (group.targetMethod === 'AUTO_FIRST') {
                    targets = pool.slice(0, group.targetCount || 1);
                    } else if (group.targetMethod === 'AUTO_LAST') {
                        targets = pool.slice(-(group.targetCount || 1));
                    }
                }
                
                // Fallback safe defaults if no target acquired
                if (targets.length === 0 && group.targetMethod === 'SAME_AS_ACTIVATION' && eventPayload.target) targets = [eventPayload.target];
                
                if (DEBUG_ABILITIES) console.log(`[DEBUG ENGINE] Target Acquisition - Group ${index} acquired ${targets.length} targets:`, targets.map(t => t.name));
                return targets;
            });

            // Phase 2: Sequential Execution
            ability.effects.forEach((group, index) => {
                if (DEBUG_ABILITIES) console.log(`[DEBUG ENGINE] Execution Phase - Group ${index}`);
                if (!group) return;
                if (!group.payloads || !Array.isArray(group.payloads)) {
                    console.warn(`[Engine] Ability '${ability.name}' (${ability.abilityId}) - Target Group ${index} has missing or invalid payloads array. Skipping.`);
                    return;
                }
                
                const targets = lockedTargets[index] || [];
                for (const payload of group.payloads) {
                    if (DEBUG_ABILITIES) console.log(`[DEBUG ENGINE] Executing Payload Type: ${payload.type} on ${targets.length} targets.`);
                    const ActionClass = ACTION_REGISTRY[payload.type];
                    if (ActionClass) {
                        for (const target of targets) {
                            let currentTarget = target;
                            
                            // Last-ditch interceptor to catch any failing self-attachments if a tunneled target exists
                            if ((payload.type === 'ATTACH' || payload.type === 'ATTACH_TO') && currentTarget.instanceId === source.instanceId) {
                                if (eventPayload && eventPayload.abilityTargetId) {
                                    const allEntities = [
                                        this.state.players.player1.avatar, this.state.players.player2.avatar,
                                        ...Object.values(this.state.players.player1.lines).flat(),
                                        ...Object.values(this.state.players.player2.lines).flat(),
                                        ...(this.state.equator || [])
                                    ].filter(Boolean);
                                    const altTarget = allEntities.find(e => e.id === eventPayload.abilityTargetId || e.instanceId === eventPayload.abilityTargetId);
                                    if (altTarget) {
                                        console.log(`[Engine] Intercepted self-attachment, redirecting to tunneled target: ${altTarget.name}`);
                                        currentTarget = altTarget;
                                    }
                                }
                                
                                if (currentTarget.instanceId === source.instanceId) {
                                    console.warn(`[Engine] Aborted self-attachment for ${source.name}.`);
                                    continue;
                                }
                            }
                            
                            const actionPayload = { ...payload };
                            if (payload.invertRoles) {
                                actionPayload.source = currentTarget;
                                actionPayload.target = source;
                            } else {
                                actionPayload.source = source;
                                actionPayload.target = currentTarget;
                            }
                            actionPayload.eventContext = eventPayload; // Inject context for replacement effects
                            actionPayload.sourceAbilityId = ability.abilityId; // Track source for stacking limits
                            const action = new ActionClass(actionPayload);
                            action.run(this);
                        }
                    } else {
                        console.warn(`[Engine] Unknown action type '${payload.type}' in ability '${ability.name}' (${ability.abilityId}).`);
                    }
                }
            });
        } catch (error) {
            console.error(`[Engine] CRITICAL ERROR executing ability '${ability?.name}' (${ability?.abilityId}) from source '${source?.name}':`, error);
        }
    }

    getPastTenseEvent(eventType) {
        const pastMap = {
            'PLAY': 'PLAYED',
            'SUMMON': 'SUMMONED',
            'KILL': 'KILLED',
            'ATTACK': 'ATTACKED',
            'DAMAGE': 'DAMAGED',
            'FIELD': 'FIELDED',
            'ATTACH': 'ATTACHED',
            'UNATTACH': 'UNATTACHED'
        };
        return pastMap[eventType] || null;
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
                        p.lines[line].forEach(u => {
                            if (u.attachments) pool.push(...u.attachments);
                        });
                    }
                }
            }
            if (zones.includes('HAND')) pool.push(...p.hand);
            if (zones.includes('DECK')) pool.push(...p.deck);
            if (zones.includes('DISCARD')) pool.push(...p.discard);
            if (zones.includes('BANISH')) pool.push(...p.banish);
        });

        if (zones.includes('FIELD') && this.state.equator) {
            pool.push(...this.state.equator);
        }
        
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

    evaluateLogicTree(node, entity, source, eventPayload) {
        if (!node) return true;
        if (node.type === 'group') {
            if (!node.children || node.children.length === 0) return true;
            if (node.logicalOperator === 'OR') {
                return node.children.some(child => this.evaluateLogicTree(child, entity, source, eventPayload));
            } else {
                return node.children.every(child => this.evaluateLogicTree(child, entity, source, eventPayload));
            }
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
            else if (node.attribute === 'health') entVal = entity.health || 0;
            else if (node.attribute === 'strength') entVal = entity.strength || 0;
            else if (node.attribute === 'armor') entVal = entity.armor || 0;
            else if (node.attribute === 'isCombat') entVal = eventPayload?.isCombat ? 'true' : 'false';
            else if (node.attribute === 'alignment') {
                const getOwner = (ent) => {
                    if (ent?.ownerId) return ent.ownerId;
                    for (const pId of ['player1', 'player2']) {
                        const p = this.state.players[pId];
                        if (['hand', 'deck', 'discard', 'banish'].some(z => p[z].some(c => c.instanceId === ent?.instanceId))) return pId;
                        for (const line of LINES) {
                            if (p.lines[line] && p.lines[line].some(c => c.instanceId === ent?.instanceId)) return pId;
                            if (p.lines[line] && p.lines[line].some(u => u.attachments && u.attachments.some(a => a.instanceId === ent?.instanceId))) return pId;
                        }
                    }
                    return null;
                };
                const entOwner = getOwner(entity);
                const sourceOwner = getOwner(source) || this.state.activePlayerId;
                entVal = entOwner === sourceOwner ? 'FRIENDLY' : 'ENEMY';
            }
            else if (node.attribute === 'hasAbility') {
                const searchVal = String(node.value).toLowerCase();
                const hasAb = entity.abilities?.some(a => a.abilityId === node.value || (a.name && a.name.toLowerCase() === searchVal));
                const hasEffect = entity.activeEffects?.some(e => e.type === 'GRANT_ABILITY' && (e.grantedAbilityId === node.value || (e.grantedAbilityId && e.grantedAbilityId.toLowerCase() === searchVal)));
                const hasTrait = entity.traits?.some(t => t.toLowerCase() === searchVal);
                entVal = !!(hasAb || hasEffect || hasTrait);
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

/**
 * Ends the current player's turn, switches active player, and triggers harvesting.
 */
export function endTurn(state) {
    const engine = new GameEngine(state);
    const prevPlayer = state.activePlayerId;
    
    engine.emit('TURN_ENDING', { playerId: prevPlayer });
    state.history_log.push(`🏁 ${state.players[prevPlayer].name} ended their turn.`);

    sweepTurnEffects(engine, prevPlayer);

    // Switch Player
    state.activePlayerId = state.activePlayerId === 'player1' ? 'player2' : 'player1';
    if (state.activePlayerId === 'player1') {
        state.turnNumber++;
    }

    startTurn(state, engine);
}

/**
 * Initializes a turn: Harvests resources, readies units, and sets up Draw Decision.
 */
export function startTurn(state, engine) {
    const pId = state.activePlayerId;
    const player = state.players[pId];
    
    state.abilityUses = {}; // Clear round limits
    
    if (!player.setupComplete) {
        player.setupComplete = true;
        
        let avatar = null;
        for (const line in player.lines) {
            avatar = player.lines[line]?.find(u => u.type === 'avatar');
            if (avatar) break;
        }
        if (avatar) avatar.isDeployed = true;
        
        if (pId === 'player2' && player.isDummy) {
            const catalogDummy = CARD_CATALOG.find(c => c.id === 'target_dummy' || c.name === 'Target Dummy');
            let dummy;
            
            if (catalogDummy) {
                dummy = JSON.parse(JSON.stringify(catalogDummy));
                dummy.instanceId = 'inst_' + generateId(state, 9);
                dummy.readiness = 0;
                if (dummy.health === undefined) dummy.health = dummy.maxHealth;
            } else {
                dummy = {
                    id: 'target_dummy', instanceId: 'inst_' + generateId(state, 9),
                    name: 'Target Dummy', type: 'unit', tribe: 'Robot', health: 1, maxHealth: 1, strength: 1, readiness: 0, abilities: []
                };
            }
            if (!player.lines['front']) player.lines['front'] = [];
            player.lines['front'].push(dummy);
            state.history_log.push(`🤖 Dummy opponent deployed Avatar and summoned Target Dummy.`);
        } else {
            state.history_log.push(`👤 ${player.name} deployed their Avatar.`);
        }
    }

    if (pId === 'player2' && player.isDummy) {
        state.history_log.push(`⏭️ Player 2 auto-skipped (Waiting for opponent to join).`);
        endTurn(state);
        return;
    }

    // 1. Harvesting: Replenish resources based on max caps
    if (player.resources) {
        for (const tribe in player.resources) {
            player.resources[tribe].current = player.resources[tribe].max;
        }
    }
    
    // 2. Ready all entities
    for (const line of LINES) {
        if (player.lines[line]) {
            player.lines[line].forEach(u => {
                let currentReadiness = Number(u.readiness);
                if (isNaN(currentReadiness)) currentReadiness = 0;
                if (currentReadiness < 1) u.readiness = currentReadiness + 1;
                u.acts = u.maxActs !== undefined ? u.maxActs : 1;

                if (u.attachments) {
                    u.attachments.forEach(item => {
                        let currentReadiness = Number(item.readiness);
                        if (isNaN(currentReadiness)) currentReadiness = 0;
                        if (currentReadiness < 1) item.readiness = currentReadiness + 1;
                        item.acts = item.maxActs !== undefined ? item.maxActs : 1;
                    });
                }
            });
        }
    }

    // 2.5 Ready Equator items
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

    // 3. Draw 2 cards automatically
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

/**
 * Executes Phase 2: Sacrifice Decision
 */
export function executeSacrificeDecision(state, option, cardId) {
    if (state.turnPhase !== 'SACRIFICE_DECISION') return;
    const player = state.players[state.activePlayerId];

    if (option === 'OPTION_A' && cardId) {
        const cardIndex = player.hand.findIndex(c => c.instanceId === cardId || c.id === cardId);
        if (cardIndex > -1) {
            const sacCard = player.hand[cardIndex];
            const engine = new GameEngine(state);
            
            let avatar = null;
            for (const line in player.lines) {
                avatar = player.lines[line]?.find(u => u.type === 'avatar');
                if (avatar) break;
            }

            const harvest = new HarvestAction({ source: avatar, target: sacCard });
            harvest.run(engine);
        }
    } else {
        state.history_log.push(`⏭️ ${player.name} skipped the Sacrifice Phase.`);
    }
    
    state.turnPhase = 'ACTION_PHASE';
}

// ==========================================
// STUB EXPORTS (To prevent UI import crashes)
// ==========================================

export function canPlayCard(state, playerId, card) {
    const player = state.players[playerId];
    if (!player) return false;

    let baseCost = 0;
    if (typeof card.cost === 'object') {
        baseCost = card.cost.tribeAmount > 0 ? card.cost.tribeAmount : (card.cost.carnie || card.cost.tent || 0);
    } else {
        baseCost = card.cost || 0;
    }

    let cTribe = card.tribe || 'Generic';
    let resKey = Object.keys(player.resources || {}).find(k => k.toLowerCase() === cTribe.toLowerCase());
    let carnieRes = player.resources['Carnie'] ? player.resources['Carnie'].current : 0;

    if (baseCost > 0) {
        if (cTribe.toLowerCase() === 'carnie' || cTribe.toLowerCase() === 'generic') {
            if (carnieRes < baseCost) return false;
        } else {
            const tribeRes = resKey ? player.resources[resKey].current : 0;
            if (tribeRes < 1) return false;
            
            const maxCarnieConversion = Math.floor(carnieRes / 3);
            if (tribeRes + maxCarnieConversion < baseCost) return false;
        }
    }

    if (card.abilities) {
        for (const ab of card.abilities) {
            if ((ab.trigger === 'PLAY' || ab.trigger === 'PLAY_OPTIONAL' || ab.trigger === 'MODIFY_PLAY' || ab.trigger === 'ON_BE_PLAYED' || ab.trigger === 'PLAYED') && ab.activation?.method === 'PLAYER_CHOICE') {
                const qt = ab.activation.quickTargeting;
                if (qt && qt.zones && qt.zones.includes('FIELD')) {
                    const oppId = playerId === 'player1' ? 'player2' : 'player1';
                    const alignments = qt.alignment || [];
                    const types = qt.entityType || [];
                    let targetFound = false;
                    
                    if (alignments.includes('FRIENDLY')) {
                        if (LINES.some(l => state.players[playerId].lines[l]?.length > 0)) targetFound = true;
                    }
                    if (alignments.includes('ENEMY') && !targetFound) {
                        if (LINES.some(l => state.players[oppId].lines[l]?.length > 0)) targetFound = true;
                    }
                    
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

    let baseCost = 0;
    if (typeof card.cost === 'object') {
        baseCost = card.cost.tribeAmount > 0 ? card.cost.tribeAmount : (card.cost.carnie || card.cost.tent || 0);
    } else {
        baseCost = card.cost || 0;
    }

    let cTribe = card.tribe || 'Generic';
    let resKey = Object.keys(player.resources || {}).find(k => k.toLowerCase() === cTribe.toLowerCase());
    let carnieRes = player.resources['Carnie'] ? player.resources['Carnie'].current : 0;

    if (baseCost > 0) {
        if (cTribe.toLowerCase() === 'carnie' || cTribe.toLowerCase() === 'generic') {
            if (carnieRes < baseCost) return { success: false, reason: `Not enough Carnie (Cost: ${baseCost})` };
            player.resources['Carnie'].current -= baseCost;
        } else {
            const tribeRes = resKey ? player.resources[resKey].current : 0;
            if (tribeRes < 1) return { success: false, reason: `Must use at least 1 ${cTribe} Resource` };
            
            const maxCarnieConversion = Math.floor(carnieRes / 3);
            if (tribeRes + maxCarnieConversion < baseCost) return { success: false, reason: `Not enough resources (Cost: ${baseCost})` };
            
            let costRemaining = baseCost;
            let tribeResToUse = Math.min(tribeRes, costRemaining);
            costRemaining -= tribeResToUse;
            
            if (costRemaining > 0) {
                player.resources['Carnie'].current -= (costRemaining * 3);
            }
            if (resKey) player.resources[resKey].current -= tribeResToUse;
        }
    }

    console.log(`[Engine] Executing playCard. abilityTargetId: ${abilityTargetId}`);
    const engine = new GameEngine(state);
    
    let avatar = null;
    for (const line in player.lines) {
        avatar = player.lines[line]?.find(u => u.type === 'avatar');
        if (avatar) break;
    }

    // Tunnel the explicit target down through the payload so ON_BE_PLAYED triggers can resolve it
    const play = new PlayAction({ source: avatar, target: card, targetLine: targetLine, line: targetLine, abilityTargetId: abilityTargetId });
    play.run(engine);

    return { success: true };
}

export function getValidAttackTargets(state, attackerOwnerId) {
    const defenderOwnerId = attackerOwnerId === 'player1' ? 'player2' : 'player1';
    const defPlayer = state.players[defenderOwnerId];
    let targets = [];

    // 1. Taunt absorbs all attacks
    if (defPlayer.lines['taunt'] && defPlayer.lines['taunt'].length > 0) {
        defPlayer.lines['taunt'].filter(u => u.type !== 'boon').forEach(u => targets.push({ id: u.instanceId, line: 'taunt' }));
        if (targets.some(t => t.line === 'taunt')) return targets;
    }

    // 2. Left Column
    if (defPlayer.lines['bodyguard'] && defPlayer.lines['bodyguard'].length > 0) {
        defPlayer.lines['bodyguard'].filter(u => u.type !== 'boon').forEach(u => targets.push({ id: u.instanceId, line: 'bodyguard' }));
    } else if (defPlayer.lines['avatar'] && defPlayer.lines['avatar'].length > 0) {
        defPlayer.lines['avatar'].filter(u => u.type !== 'boon').forEach(u => targets.push({ id: u.instanceId, line: 'avatar' }));
    }

    // 3. Center Column
    const centerLines = ['front', 'mid', 'back', 'sheltered'];
    for (const line of centerLines) {
        if (defPlayer.lines[line] && defPlayer.lines[line].length > 0) {
            const valid = defPlayer.lines[line].filter(u => u.type !== 'boon');
            if (valid.length > 0) {
                valid.forEach(u => targets.push({ id: u.instanceId, line: line }));
                break;
            }
        }
    }

    // 4. Right Column
    if (defPlayer.lines['sideline'] && defPlayer.lines['sideline'].length > 0) {
        defPlayer.lines['sideline'].filter(u => u.type !== 'boon').forEach(u => targets.push({ id: u.instanceId, line: 'sideline' }));
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
    let entity = null;
    const eqItem = state.equator?.find(i => i.instanceId === entityId);
    if (eqItem) {
        entity = eqItem;
    } else {
        for (const line of LINES) {
            const u = state.players[playerId].lines[line]?.find(u => u.instanceId === entityId);
            if (u) { entity = u; break; }
        }
    }
    
    // Check hand for unplayed cards (crucial for targeted Play abilities)
    if (!entity) {
        const handCard = state.players[playerId].hand.find(c => c.instanceId === entityId || c.id === entityId);
        if (handCard) entity = handCard;
    }
    
    if (!entity) return [];

    const ability = entity.abilities?.find(a => a.abilityId === abilityId);
    if (!ability) return [];

    let qt = ability.activation?.quickTargeting;
    let method = ability.activation?.method;

    if (!qt || method !== 'PLAYER_CHOICE') return [];

    let targets = [];
    const oppId = playerId === 'player1' ? 'player2' : 'player1';

    if (qt.zones) {
        const checkPlayer = (pId, isFriendly) => {
            if ((isFriendly && !qt.alignment.includes('FRIENDLY')) || (!isFriendly && !qt.alignment.includes('ENEMY'))) return;
            
            const p = state.players[pId];
            
            const checkEntity = (ent, line) => {
                let entType = 'UNIT';
                if (ent.type === 'avatar') entType = 'AVATAR';
                else if (ent.type === 'equipment' || ent.type === 'artifact') entType = 'EQUIPMENT';
                else if (ent.type === 'spell') entType = 'SPELL';
                else if (ent.type === 'boon') entType = 'BOON';
                
                if (qt.entityType.includes(entType)) {
                    targets.push({ id: ent.instanceId || ent.id, line: line, playerId: pId });
                }
            };

            if (qt.zones.includes('FIELD')) {
                if (p.lines['avatar']) p.lines['avatar'].forEach(u => checkEntity(u, 'avatar'));
                for (const line of LINES) {
                    if (p.lines[line]) p.lines[line].forEach(u => {
                        if (u.type !== 'avatar' && u.type !== 'boon') checkEntity(u, line);
                    });
                }
            }
            
            if (qt.zones.includes('HAND')) p.hand.forEach(c => checkEntity(c, 'hand'));
            if (qt.zones.includes('DISCARD')) p.discard.forEach(c => checkEntity(c, 'discard'));
            if (qt.zones.includes('DECK')) p.deck.forEach(c => checkEntity(c, 'deck'));
            if (qt.zones.includes('BANISH')) p.banish.forEach(c => checkEntity(c, 'banish'));
        };
        
        checkPlayer(playerId, true);
        checkPlayer(oppId, false);
        
        if (qt.zones.includes('FIELD') && !qt.ignoreBattlelines) {
            const atkTargets = getValidAttackTargets(state, playerId);
            targets = targets.filter(t => {
                if (t.playerId === playerId) return true; // Friendly targets ignore battlelines
                return !['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(t.line) || atkTargets.some(at => at.id === t.id);
            });
        }
    }
    
    if (ability.activation?.logicTree) {
        const engine = new GameEngine(state);
        targets = targets.filter(t => {
            const targetEntity = [
                ...Object.values(state.players.player1.lines).flat(),
                ...Object.values(state.players.player2.lines).flat(),
                ...(state.equator || []),
                ...state.players.player1.hand, ...state.players.player1.deck, ...state.players.player1.discard, ...state.players.player1.banish,
                ...state.players.player2.hand, ...state.players.player2.deck, ...state.players.player2.discard, ...state.players.player2.banish
            ].filter(Boolean).find(e => e.id === t.id || e.instanceId === t.id);
            
            return targetEntity ? engine.evaluateLogicTree(ability.activation.logicTree, targetEntity, entity) : false;
        });
    }
    
    return targets.filter((t, index, self) => index === self.findIndex(o => o.id === t.id));
}

export function getEntityAvailableActions(state, playerId, entityId) {
    const actions = [];
    let entity = null;
    
    const eqItem = state.equator?.find(i => i.instanceId === entityId);
    if (eqItem) {
        entity = eqItem;
    } else {
        for (const line of LINES) {
            const u = state.players[playerId].lines[line]?.find(u => u.instanceId === entityId);
            if (u) { entity = u; break; }
        }
    }
    
    if (!entity) return actions;

    const hasBlockAct = entity.activeEffects?.some(e => e.type === 'BLOCK_ACT');

    if (!hasBlockAct) {
        if (entity.abilities) {
            entity.abilities.forEach(ab => {
                if (ab.trigger === 'MANUAL') {
                    const cost = ab.cost || {};
                    let canAfford = true;
                    
                    let currentReadiness = Number(entity.readiness);
                    if (isNaN(currentReadiness)) currentReadiness = 0;
                    
                    const abilityKey = `${entity.instanceId}_${ab.abilityId}`;
                    let requiresReadiness = cost.readinessCost && cost.readinessCost !== 'NONE';
                    if (requiresReadiness && cost.reuseIgnoresReadiness && (state.abilityUses?.[abilityKey] || 0) > 0) {
                        requiresReadiness = false;
                    }
                    
                    if (requiresReadiness && currentReadiness < 1) {
                        canAfford = false;
                    }
                    
                    if (canAfford) {
                        const player = state.players[playerId];
                        
                        let avatar = null;
                        for (const line in player.lines) {
                            avatar = player.lines[line]?.find(u => u.type === 'avatar');
                            if (avatar) break;
                        }

                        if ((cost.carnie || cost.tent) > 0 && (player.resources['Carnie']?.current || 0) < (cost.carnie || cost.tent)) canAfford = false;
                        if (cost.power > 0 && (entity.power || 0) < cost.power) canAfford = false;
                        
                        if (canAfford && cost.tribeAmount > 0) {
                            const entityTribe = entity.tribe || 'Generic';
                            const resKey = Object.keys(player.resources || {}).find(k => k.toLowerCase() === entityTribe.toLowerCase());
                            const tribeRes = resKey ? player.resources[resKey].current : 0;
                            if (tribeRes < cost.tribeAmount) canAfford = false;
                        }
                    }
                    
                    if (canAfford) {
                        let isAttack = false;
                        if (ab.effects) {
                            isAttack = ab.effects.some(g => g.payloads && g.payloads.some(p => p.type === 'ATTACK'));
                        }

                        if (isAttack) {
                            if (entity.activeEffects?.some(e => e.type === 'BLOCK_ATTACK')) canAfford = false;
                        } else {
                            if (!cost.freeAction) {
                                let currentActs = Number(entity.acts);
                                if (isNaN(currentActs)) currentActs = 0;
                                if (currentActs < 1) canAfford = false;
                            }
                        }

                        if (canAfford) {
                            actions.push({ type: isAttack ? 'ATTACK' : 'ABILITY', name: ab.name, abilityId: ab.abilityId });
                        }
                    }
                }
            });
        }
    }

    return actions;
}

export function executeEntityAction(state, playerId, entityId, actionType, abilityId, targetId, targetLine) {
    if (actionType === 'ABILITY' || actionType === 'ATTACK') {
        let entity = null;
        
        const eqItem = state.equator?.find(i => i.instanceId === entityId);
        if (eqItem) {
            entity = eqItem;
        } else {
            for (const line of LINES) {
                const u = state.players[playerId].lines[line]?.find(u => u.instanceId === entityId);
                if (u) { entity = u; break; }
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

        // 2. Resolve Target Reference
        let targetEntity = null;
        if (targetId) {
            const p1 = state.players.player1;
            const p2 = state.players.player2;
            const allEntities = [
                ...Object.values(p1.lines).flat(),
                ...Object.values(p2.lines).flat(),
                ...(state.equator || []),
                ...p1.hand, ...p1.deck, ...p1.discard, ...p1.banish,
                ...p2.hand, ...p2.deck, ...p2.discard, ...p2.banish
            ].filter(Boolean);
            targetEntity = allEntities.find(e => e.id === targetId || e.instanceId === targetId);
        }

        // 3. Fire Engine with dynamic target
        const engine = new GameEngine(state);
        engine.executeAbility(ability, entity, { target: targetEntity });
        engine.sweepDeadEntities();
        
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
    
    // Deep clone the deck to prevent reference collisions and stamp unique instance IDs
    const rawP1Deck = p1Deck || [];
    state.players.player1.deck = JSON.parse(JSON.stringify(rawP1Deck));
    state.players.player1.deck.forEach((c, idx) => {
        // Unconditionally overwrite to destroy any fixed IDs inadvertently saved in custom cards
        c.instanceId = 'inst_p1_' + generateId(state, 9) + '_' + idx;
    });
    
    const p1AvatarIdx = state.players.player1.deck.findIndex(c => c.type === 'avatar');
    if (p1AvatarIdx > -1) {
        const av = state.players.player1.deck.splice(p1AvatarIdx, 1)[0];
        av.id = 'p1_avatar';
        av.instanceId = 'p1_avatar';
        av.health = av.health || 30;
        av.maxHealth = av.health;
        av.type = 'avatar';
        av.defaultLine = 'avatar';
        av.line = 'avatar';
        av.readiness = 1;
        av.acts = 1;
        av.maxActs = 1;
        state.players.player1.lines.avatar = [av];
    }

    state.players.player1.tents = 2;
    state.players.player1.maxTents = 2;
    
    state.players.player1.resources = { 'Carnie': { current: 2, max: 2 } };
    let p1Tribe = state.players.player1.lines.avatar[0]?.tribe || 'Generic';
    if (p1Tribe.toLowerCase() === 'carnie') {
        state.players.player1.resources['Carnie'].current = 3;
        state.players.player1.resources['Carnie'].max = 3;
    } else {
        state.players.player1.resources[p1Tribe] = { current: 1, max: 1 };
    }
    
    // Setup dummy Player 2 for immediate local testing support
    state.players.player2.deck = [];
    state.players.player2.lines.avatar = [{
        id: 'p2_dummy_avatar', instanceId: 'p2_dummy_avatar',
        name: 'Waiting for Player 2...', health: 30, maxHealth: 30,
        type: 'avatar', tribe: 'Robot', defaultLine: 'avatar', line: 'avatar', readiness: 1
    }];

    state.players.player2.tents = 2;
    state.players.player2.maxTents = 2;
    
    state.players.player2.resources = { 'Carnie': { current: 2, max: 2 } };
    let p2DummyTribe = state.players.player2.lines.avatar[0]?.tribe || 'Robot';
    if (p2DummyTribe.toLowerCase() === 'carnie') {
        state.players.player2.resources['Carnie'].current = 3;
        state.players.player2.resources['Carnie'].max = 3;
    } else {
        state.players.player2.resources[p2DummyTribe] = { current: 1, max: 1 };
    }
    state.players.player2.isDummy = true;
    
    // Shuffle decks before drawing
    shuffleArray(state, state.players.player1.deck);
    shuffleArray(state, state.players.player2.deck);
    
    // Draw 4 starting cards for both players
    for(let i = 0; i < 4; i++) {
        if (state.players.player1.deck.length > 0) {
            const c = state.players.player1.deck.pop();
            c.readiness = 0;
            state.players.player1.hand.push(c);
        }
        if (state.players.player2.deck.length > 0) {
            const c = state.players.player2.deck.pop();
            c.readiness = 0;
            state.players.player2.hand.push(c);
        }
    }
    
    state.history_log.push(`Match initialized. Players drew starting hands.`);
    
    startTurn(state, null);
    return state;
}

export function joinGame(state, p2Name, p2Deck) {
    state.players.player2.name = p2Name;
    state.players.player2.isDummy = false;
    
    // Wipe dummy board state so real player starts fresh
    state.players.player2.lines = { taunt: [], bodyguard: [], front: [], mid: [], back: [], sheltered: [], sideline: [] };
    state.players.player2.setupComplete = false;
    
    // Deep clone the deck to prevent reference collisions and stamp unique instance IDs
    const rawP2Deck = p2Deck || [];
    state.players.player2.deck = JSON.parse(JSON.stringify(rawP2Deck));
    state.players.player2.deck.forEach((c, idx) => {
        // Unconditionally overwrite to destroy any fixed IDs inadvertently saved in custom cards
        c.instanceId = 'inst_p2_' + generateId(state, 9) + '_' + idx;
    });
    
    const p2AvatarIdx = state.players.player2.deck.findIndex(c => c.type === 'avatar');
    if (p2AvatarIdx > -1) {
        const av = state.players.player2.deck.splice(p2AvatarIdx, 1)[0];
        av.id = 'p2_avatar';
        av.instanceId = 'p2_avatar';
        av.health = av.health || 30;
        av.maxHealth = av.health;
        av.type = 'avatar';
        av.defaultLine = 'avatar';
        av.line = 'avatar';
        av.readiness = 1;
        av.acts = 1;
        av.maxActs = 1;
        state.players.player2.lines.avatar = [av];
    }

    state.players.player2.tents = 2;
    state.players.player2.maxTents = 2;
    
    state.players.player2.resources = { 'Carnie': { current: 2, max: 2 } };
    let p2Tribe = state.players.player2.lines.avatar[0]?.tribe || 'Generic';
    if (p2Tribe.toLowerCase() === 'carnie') {
        state.players.player2.resources['Carnie'].current = 3;
        state.players.player2.resources['Carnie'].max = 3;
    } else {
        state.players.player2.resources[p2Tribe] = { current: 1, max: 1 };
    }
    
    // Shuffle joining player's deck
    shuffleArray(state, state.players.player2.deck);
    
    // Replace dummy hand with actual starting hand for joining player
    state.players.player2.hand = [];
    for(let i = 0; i < 4; i++) {
        if (state.players.player2.deck.length > 0) {
            const c = state.players.player2.deck.pop();
            c.readiness = 0;
            state.players.player2.hand.push(c);
        }
    }
    
    state.history_log.push(`${p2Name} joined the match.`);
    
    return state;
}