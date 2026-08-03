/**
 * Henchies 2 Game Engine Core
 * Implements a LIFO Event Bus with APNAP resolution, WOULD_ replacement effects, 
 * and infinite-loop self-trigger prevention.
 */

export const CARD_CATALOG = []; // Will be hydrated by deckbuilder/firebase

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
        this.players = {
            player1: { 
                id: 'player1', name: 'Player 1', 
                lines: { taunt: [], bodyguard: [], front: [], mid: [], back: [], sheltered: [], sideline: [] }, 
                hand: [], deck: [], discard: [], banish: [], 
                avatar: { id: 'p1_avatar', name: 'Warlord', health: 30, maxHealth: 30, power: 0, tribe: 'Mythic', type: 'avatar', readiness: 1 },
                tents: 2, maxTents: 2, resources: { 'Mythic': { current: 1, max: 1 } }
            },
            player2: { 
                id: 'player2', name: 'Player 2', 
                lines: { taunt: [], bodyguard: [], front: [], mid: [], back: [], sheltered: [], sideline: [] }, 
                hand: [], deck: [], discard: [], banish: [], 
                avatar: { id: 'p2_avatar', name: 'Opponent', health: 30, maxHealth: 30, power: 0, tribe: 'Robot', type: 'avatar', readiness: 1 },
                tents: 2, maxTents: 2, resources: { 'Robot': { current: 1, max: 1 } }
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
        
        // Scan all entities on the board for matching triggers
        for (const pId of ['player1', 'player2']) {
            const player = this.state.players[pId];
            
            // Check Avatar abilities
            if (player.avatar && player.avatar.abilities) {
                for (const ability of player.avatar.abilities) {
                    if (ability.trigger === eventType && !this.activeChainAbilities.has(ability.abilityId)) {
                        triggers.push({ owner: pId, source: player.avatar, ability, payload });
                    }
                }
            }

            // Check Unit abilities
            for (const line of LINES) {
                if (line === 'avatar' || !player.lines[line]) continue;
                for (const unit of player.lines[line]) {
                    if (!unit.abilities) continue;
                    for (const ability of unit.abilities) {
                        // Do not queue if this exact ability already fired in the current chain
                        if (ability.trigger === eventType && !this.activeChainAbilities.has(ability.abilityId)) {
                            triggers.push({ owner: pId, source: unit, ability, payload });
                        }
                    }
                }
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
                if (line === 'avatar') continue;
                if (!player.lines[line]) continue;
                
                // Iterate backwards for safe splicing
                for (let i = player.lines[line].length - 1; i >= 0; i--) {
                    const u = player.lines[line][i];
                    if (u.health <= 0 && !u._isDying) {
                        new KillAction({ target: u }).run(this);
                    }
                }
            }
        }
    }

    executeAbility(ability, source, eventPayload, ownerId) {
        // Log the execution
        this.state.history_log.push(`✨ ${source.name || 'Entity'} activated '${ability.name}'`);
        
        if (!ability.effects) return;

        ownerId = ownerId || this.state.activePlayerId;

        // Phase 1: Target Acquisition (Lock in targets based on board state BEFORE costs/effects resolve)
        const lockedTargets = ability.effects.map(group => {
            let targets = [];
            if (group.targetMethod === 'SELF') targets = [source];
            else if (group.targetMethod === 'AVATAR') targets = [this.state.players[ownerId].avatar];
            else if (group.targetMethod === 'ENEMY_AVATAR') targets = [this.state.players[ownerId === 'player1' ? 'player2' : 'player1'].avatar];
            else if (group.targetMethod === 'SAME_AS_ACTIVATION') targets = [eventPayload.target || source];
            else if (group.targetMethod && group.targetMethod.startsWith('AUTO_')) {
                let pool = this.findEntitiesInScope(group.quickTargeting, ownerId);
                pool = pool.filter(ent => this.evaluateLogicTree(group.logicTree, ent, source));
                
                if (group.targetMethod === 'AUTO_ALL') targets = pool;
                else if (group.targetMethod === 'AUTO_RANDOM') {
                    const shuffled = [...pool].sort(() => 0.5 - Math.random());
                    targets = shuffled.slice(0, group.targetCount || 1);
                }
                else if (group.targetMethod === 'AUTO_FIRST') targets = pool.slice(0, group.targetCount || 1);
                else if (group.targetMethod === 'AUTO_LAST') targets = pool.slice(-(group.targetCount || 1));
            }
            
            // Fallback safe defaults if no target acquired
            if (targets.length === 0 && group.targetMethod === 'SAME_AS_ACTIVATION' && eventPayload.target) targets = [eventPayload.target];
            
            return targets;
        });

        // Phase 2: Sequential Execution
        ability.effects.forEach((group, index) => {
            const targets = lockedTargets[index];
            for (const payload of group.payloads) {
                const ActionClass = ACTION_REGISTRY[payload.type];
                if (ActionClass) {
                    for (const target of targets) {
                        const actionPayload = { ...payload, source, target };
                        const action = new ActionClass(actionPayload);
                        action.run(this);
                    }
                }
            }
        });
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
        const types = qt?.entityType || ['UNIT'];
        
        const playersToCheck = [];
        if (alignments.includes('FRIENDLY')) playersToCheck.push(callingPlayerId);
        if (alignments.includes('ENEMY')) playersToCheck.push(oppId);
        
        playersToCheck.forEach(pId => {
            const p = this.state.players[pId];
            
            if (zones.includes('FIELD')) {
                if (types.includes('AVATAR') && p.avatar && p.setupComplete) pool.push(p.avatar);
                if (types.includes('UNIT')) {
                    for (const line of LINES) {
                        if (line === 'avatar') continue;
                        if (p.lines[line]) pool.push(...p.lines[line]);
                    }
                }
            }
            if (zones.includes('HAND')) pool.push(...p.hand);
            if (zones.includes('DECK')) pool.push(...p.deck);
            if (zones.includes('DISCARD')) pool.push(...p.discard);
            if (zones.includes('BANISH')) pool.push(...p.banish);
        });
        
        return pool.filter(ent => {
            const entType = ent.type === 'avatar' ? 'AVATAR' : (ent.type === 'equipment' || ent.type === 'artifact' ? 'EQUIPMENT' : 'UNIT');
            return types.includes(entType);
        });
    }

    evaluateLogicTree(node, entity, source) {
        if (!node) return true;
        if (node.type === 'group') {
            if (!node.children || node.children.length === 0) return true;
            if (node.logicalOperator === 'OR') {
                return node.children.some(child => this.evaluateLogicTree(child, entity, source));
            } else {
                return node.children.every(child => this.evaluateLogicTree(child, entity, source));
            }
        } else if (node.type === 'condition') {
            let entVal;
            if (node.attribute === 'entity') {
                if (node.value === 'SELF') return entity.instanceId === source.instanceId;
                if (node.value === 'AVATAR') return entity.type === 'avatar';
                if (node.value === 'UNIT') return entity.type === 'unit';
                return false;
            }
            else if (node.attribute === 'tribe') entVal = entity.tribe || 'Generic';
            else if (node.attribute === 'family') entVal = entity.family || '';
            else if (node.attribute === 'genus') entVal = entity.genus || '';
            else if (node.attribute === 'health') entVal = entity.health || 0;
            else if (node.attribute === 'strength') entVal = entity.strength || 0;
            else if (node.attribute === 'hasAbility') {
                entVal = entity.abilities ? entity.abilities.some(a => a.abilityId === node.value) : false;
                return node.operator === '==' ? entVal : !entVal;
            }
            
            if (typeof entVal === 'string') {
                const cmp = entVal.toLowerCase() === String(node.value).toLowerCase();
                return node.operator === '==' ? cmp : !cmp;
            } else {
                const val = Number(node.value);
                if (node.operator === '==') return entVal === val;
                if (node.operator === '!=') return entVal !== val;
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
    
    if (!player.setupComplete) {
        player.setupComplete = true;
        if (player.avatar) player.avatar.isDeployed = true;
        
        if (pId === 'player2' && player.isDummy) {
            const dummy = {
                id: 'target_dummy', instanceId: 'inst_' + Math.random().toString(36).substr(2, 9),
                name: 'Target Dummy', type: 'unit', tribe: 'Robot', health: 10, maxHealth: 10, strength: 0, readiness: 0, abilities: []
            };
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
    player.tents = player.maxTents;
    if (player.resources) {
        for (const tribe in player.resources) {
            player.resources[tribe].current = player.resources[tribe].max;
        }
    }
    
    // 2. Ready all entities
    if (player.avatar) {
        let currentReadiness = Number(player.avatar.readiness);
        if (isNaN(currentReadiness)) currentReadiness = 0;
        if (currentReadiness < 1) player.avatar.readiness = currentReadiness + 1;
    }
    for (const line of LINES) {
        if (line === 'avatar') continue;
        if (player.lines[line]) {
            player.lines[line].forEach(u => {
                let currentReadiness = Number(u.readiness);
                if (isNaN(currentReadiness)) currentReadiness = 0;
                if (currentReadiness < 1) u.readiness = currentReadiness + 1;
            });
        }
    }

    // 2.5 Ready Equator items
    if (state.equator) {
        state.equator.forEach(item => {
            let currentReadiness = Number(item.readiness);
            if (isNaN(currentReadiness)) currentReadiness = 0;
            if (currentReadiness < 1) item.readiness = currentReadiness + 1;
        });
    }

    // 3. Draw 2 cards automatically
    let drawn = 0;
    for(let i=0; i<2; i++) {
        if (player.deck.length > 0) {
            player.hand.push(player.deck.pop());
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
            const harvest = new HarvestAction({ source: player.avatar, target: sacCard });
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
        baseCost = card.cost.tribeAmount > 0 ? card.cost.tribeAmount : (card.cost.tents || 0);
    } else {
        baseCost = card.cost || 0;
    }

    let cTribe = card.tribe || 'Generic';
    let resKey = Object.keys(player.resources || {}).find(k => k.toLowerCase() === cTribe.toLowerCase());

    if (baseCost > 0) {
        if (cTribe.toLowerCase() === 'carnie') {
            if (player.tents < baseCost) return false;
        } else {
            const tribeRes = resKey ? player.resources[resKey].current : 0;
            if (tribeRes < 1) return false;
            
            const maxTentConversion = Math.floor(player.tents / 3);
            if (tribeRes + maxTentConversion < baseCost) return false;
        }
    }

    if (card.abilities) {
        for (const ab of card.abilities) {
            if ((ab.trigger === 'PLAY' || ab.trigger === 'PLAY_OPTIONAL') && ab.activation?.method === 'PLAYER_CHOICE') {
                const qt = ab.activation.quickTargeting;
                if (qt && qt.zones && qt.zones.includes('FIELD')) {
                    const oppId = playerId === 'player1' ? 'player2' : 'player1';
                    const alignments = qt.alignment || [];
                    const types = qt.entityType || [];
                    let targetFound = false;
                    
                    if (alignments.includes('FRIENDLY')) {
                        if (types.includes('AVATAR')) targetFound = true;
                        else if (types.includes('UNIT') && LINES.some(l => l !== 'hero' && state.players[playerId].lines[l]?.length > 0)) targetFound = true;
                    }
                    if (alignments.includes('ENEMY') && !targetFound) {
                        if (types.includes('AVATAR')) targetFound = true;
                        else if (types.includes('UNIT') && LINES.some(l => l !== 'hero' && state.players[oppId].lines[l]?.length > 0)) targetFound = true;
                    }
                    
                    if (!targetFound) return false;
                }
            }
        }
    }

    return true;
}

export function playCard(state, playerId, cardId) {
    const player = state.players[playerId];
    const cardIdx = player.hand.findIndex(c => c.instanceId === cardId || c.id === cardId);
    if (cardIdx === -1) return { success: false, reason: "Card not in hand" };
    const card = player.hand[cardIdx];

    let baseCost = 0;
    if (typeof card.cost === 'object') {
        baseCost = card.cost.tribeAmount > 0 ? card.cost.tribeAmount : (card.cost.tents || 0);
    } else {
        baseCost = card.cost || 0;
    }

    let cTribe = card.tribe || 'Generic';
    let resKey = Object.keys(player.resources || {}).find(k => k.toLowerCase() === cTribe.toLowerCase());

    if (baseCost > 0) {
        if (cTribe.toLowerCase() === 'carnie') {
            if (player.tents < baseCost) return { success: false, reason: `Not enough Tents (Cost: ${baseCost})` };
            player.tents -= baseCost;
        } else {
            const tribeRes = resKey ? player.resources[resKey].current : 0;
            if (tribeRes < 1) return { success: false, reason: `Must use at least 1 ${cTribe} Resource` };
            
            const maxTentConversion = Math.floor(player.tents / 3);
            if (tribeRes + maxTentConversion < baseCost) return { success: false, reason: `Not enough resources (Cost: ${baseCost})` };
            
            let costRemaining = baseCost;
            let tribeResToUse = Math.min(tribeRes, costRemaining);
            costRemaining -= tribeResToUse;
            
            if (costRemaining > 0) {
                player.tents -= (costRemaining * 3);
            }
            player.resources[resKey].current -= tribeResToUse;
        }
    }

    const engine = new GameEngine(state);
    const play = new PlayAction({ source: player.avatar, target: card });
    play.run(engine);

    return { success: true };
}

export function getValidAttackTargets(state, attackerOwnerId) {
    const defenderOwnerId = attackerOwnerId === 'player1' ? 'player2' : 'player1';
    const defPlayer = state.players[defenderOwnerId];
    let targets = [];

    // 1. Taunt absorbs all attacks
    if (defPlayer.lines['taunt'] && defPlayer.lines['taunt'].length > 0) {
        defPlayer.lines['taunt'].forEach(u => targets.push({ id: u.instanceId, line: 'taunt' }));
        return targets;
    }

    // 2. Left Column
    if (defPlayer.lines['bodyguard'] && defPlayer.lines['bodyguard'].length > 0) {
        defPlayer.lines['bodyguard'].forEach(u => targets.push({ id: u.instanceId, line: 'bodyguard' }));
    } else if (defPlayer.avatar && defPlayer.setupComplete) {
        targets.push({ id: defPlayer.avatar.id, line: 'avatar' });
    }

    // 3. Center Column
    const centerLines = ['front', 'mid', 'back', 'sheltered'];
    for (const line of centerLines) {
        if (defPlayer.lines[line] && defPlayer.lines[line].length > 0) {
            defPlayer.lines[line].forEach(u => targets.push({ id: u.instanceId, line: line }));
            break;
        }
    }

    // 4. Right Column
    if (defPlayer.lines['sideline'] && defPlayer.lines['sideline'].length > 0) {
        defPlayer.lines['sideline'].forEach(u => targets.push({ id: u.instanceId, line: 'sideline' }));
    }
    
    return targets;
}

export function cloneGameState(state) { return JSON.parse(JSON.stringify(state)); }

export function getValidAbilityTargets(state, playerId, entityId, abilityId) {
    let entity = null;
    const eqItem = state.equator?.find(i => i.instanceId === entityId);
    if (eqItem) {
        entity = eqItem;
    } else if (state.players[playerId].avatar.id === entityId) {
        entity = state.players[playerId].avatar;
    } else {
        for (const line of LINES) {
            if (line === 'avatar') continue;
            const u = state.players[playerId].lines[line]?.find(u => u.instanceId === entityId);
            if (u) { entity = u; break; }
        }
    }
    
    if (!entity) return [];

    const ability = entity.abilities?.find(a => a.abilityId === abilityId);
    if (!ability) return [];

    const qt = ability.activation?.quickTargeting;
    if (!qt || ability.activation.method !== 'PLAYER_CHOICE') return [];

    let targets = [];
    const oppId = playerId === 'player1' ? 'player2' : 'player1';

    if (qt.zones?.includes('FIELD')) {
        const checkPlayer = (pId, isFriendly) => {
            if ((isFriendly && !qt.alignment.includes('FRIENDLY')) || (!isFriendly && !qt.alignment.includes('ENEMY'))) return;
            
            const p = state.players[pId];
            if (qt.entityType.includes('AVATAR') && p.avatar && p.setupComplete) {
                targets.push({ id: p.avatar.id, line: 'avatar' });
            }
            if (qt.entityType.includes('UNIT')) {
                for (const line of LINES) {
                    if (line === 'avatar') continue;
                    if (p.lines[line]) {
                        p.lines[line].forEach(u => targets.push({ id: u.instanceId, line: line }));
                    }
                }
            }
        };
        
        checkPlayer(playerId, true);
        checkPlayer(oppId, false);
        
        if (!qt.ignoreBattlelines && !qt.alignment.includes('FRIENDLY') && qt.alignment.includes('ENEMY')) {
            const atkTargets = getValidAttackTargets(state, playerId);
            targets = targets.filter(t => atkTargets.some(at => at.id === t.id));
        }
    }
    
    return targets;
}

export function getEntityAvailableActions(state, playerId, entityId) {
    const actions = [];
    let entity = null;
    
    const eqItem = state.equator?.find(i => i.instanceId === entityId);
    if (eqItem) {
        entity = eqItem;
    } else if (state.players[playerId].avatar.id === entityId) {
        entity = state.players[playerId].avatar;
    } else {
        for (const line of LINES) {
            if (line === 'avatar') continue;
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
                    
                    if (cost.readinessCost && cost.readinessCost !== 'NONE' && currentReadiness < 1) {
                        canAfford = false;
                    }
                    
                    const reqCost = cost.tribeAmount > 0 ? cost.tribeAmount : (cost.tent || 0);
                    if (canAfford && reqCost > 0) {
                        const player = state.players[playerId];
                        const entityTribe = entity.tribe || 'Generic';
                        const resKey = Object.keys(player.resources || {}).find(k => k.toLowerCase() === entityTribe.toLowerCase());
                        
                        if (entityTribe.toLowerCase() === 'carnie') {
                            if (player.tents < reqCost) canAfford = false;
                        } else {
                            const tribeRes = resKey ? player.resources[resKey].current : 0;
                            if (cost.tribeAmount > 0 && tribeRes < 1) canAfford = false;
                            const maxTentConversion = Math.floor(player.tents / 3);
                            if (tribeRes + maxTentConversion < reqCost) canAfford = false;
                        }
                    }
                    
                    if (canAfford) {
                        let isAttack = false;
                        if (ab.effects) {
                            isAttack = ab.effects.some(g => g.payloads && g.payloads.some(p => p.type === 'ATTACK'));
                        }
                        actions.push({ type: isAttack ? 'ATTACK' : 'ABILITY', name: ab.name, abilityId: ab.abilityId });
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
        } else if (state.players[playerId].avatar.id === entityId) {
            entity = state.players[playerId].avatar;
        } else {
            for (const line of LINES) {
                if (line === 'avatar') continue;
                const u = state.players[playerId].lines[line]?.find(u => u.instanceId === entityId);
                if (u) { entity = u; break; }
            }
        }
        
        if (!entity) return { success: false, reason: "Entity not found" };
        
        const ability = entity.abilities?.find(a => a.abilityId === abilityId);
        if (!ability) return { success: false, reason: "Ability not found" };

        // 1. Deduct Cost
        const cost = ability.cost || {};
        if (cost.readinessCost === 'EXHAUSTS' || cost.readinessCost === 'UNREADIES') {
            entity.readiness = 0;
        }
        const reqCost = cost.tribeAmount > 0 ? cost.tribeAmount : (cost.tent || 0);
        if (reqCost > 0) {
            const p = state.players[playerId];
            const entityTribe = entity.tribe || 'Generic';
            const resKey = Object.keys(p.resources || {}).find(k => k.toLowerCase() === entityTribe.toLowerCase());
            
            if (entityTribe.toLowerCase() === 'carnie') {
                p.tents -= reqCost;
            } else {
                let tribeRes = resKey ? p.resources[resKey].current : 0;
                let costRemaining = reqCost;
                let tribeResToUse = Math.min(tribeRes, costRemaining);
                costRemaining -= tribeResToUse;
                if (costRemaining > 0) p.tents -= (costRemaining * 3);
                if (resKey) p.resources[resKey].current -= tribeResToUse;
            }
        }

        // 2. Resolve Target Reference
        let targetEntity = null;
        if (targetId) {
            const allEntities = [
                state.players.player1.avatar, state.players.player2.avatar,
                ...Object.values(state.players.player1.lines).flat(),
                ...Object.values(state.players.player2.lines).flat(),
                ...(state.equator || [])
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

export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

export function initGame(roomId, p1Name, p1Deck) {
    const state = new GameState();
    state.gameId = roomId;
    state.roomId = roomId;
    state.players.player1.name = p1Name;
    
    // Deep clone the deck to prevent reference collisions and stamp unique instance IDs
    const rawP1Deck = p1Deck || [];
    state.players.player1.deck = JSON.parse(JSON.stringify(rawP1Deck));
    state.players.player1.deck.forEach((c, idx) => {
        // Unconditionally overwrite to destroy any fixed IDs inadvertently saved in custom cards
        c.instanceId = 'inst_p1_' + Math.random().toString(36).substr(2, 9) + '_' + idx;
    });
    
    const p1AvatarIdx = state.players.player1.deck.findIndex(c => c.type === 'avatar');
    if (p1AvatarIdx > -1) {
        const av = state.players.player1.deck.splice(p1AvatarIdx, 1)[0];
        av.id = 'p1_avatar';
        av.instanceId = 'p1_avatar';
        av.health = av.health || 30;
        av.maxHealth = av.health;
        av.type = 'avatar';
        av.readiness = 1;
        state.players.player1.avatar = av;
    }

    state.players.player1.tents = 2;
    state.players.player1.maxTents = 2;
    
    let p1Tribe = state.players.player1.avatar?.tribe || 'Generic';
    state.players.player1.resources = { [p1Tribe]: { current: 1, max: 1 } };
    
    // Setup dummy Player 2 for immediate local testing support
    state.players.player2.deck = [];
    state.players.player2.avatar = {
        id: 'p2_dummy_avatar', instanceId: 'p2_dummy_avatar',
        name: 'Waiting for Player 2...', health: 30, maxHealth: 30,
        type: 'avatar', tribe: 'Robot', readiness: 1
    };

    state.players.player2.tents = 2;
    state.players.player2.maxTents = 2;
    state.players.player2.resources = { 'Robot': { current: 1, max: 1 } };
    state.players.player2.isDummy = true;
    
    // Shuffle decks before drawing
    shuffleArray(state.players.player1.deck);
    shuffleArray(state.players.player2.deck);
    
    // Draw 4 starting cards for both players
    for(let i = 0; i < 4; i++) {
        if (state.players.player1.deck.length > 0) state.players.player1.hand.push(state.players.player1.deck.pop());
        if (state.players.player2.deck.length > 0) state.players.player2.hand.push(state.players.player2.deck.pop());
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
        c.instanceId = 'inst_p2_' + Math.random().toString(36).substr(2, 9) + '_' + idx;
    });
    
    const p2AvatarIdx = state.players.player2.deck.findIndex(c => c.type === 'avatar');
    if (p2AvatarIdx > -1) {
        const av = state.players.player2.deck.splice(p2AvatarIdx, 1)[0];
        av.id = 'p2_avatar';
        av.instanceId = 'p2_avatar';
        av.health = av.health || 30;
        av.maxHealth = av.health;
        av.type = 'avatar';
        av.readiness = 1;
        state.players.player2.avatar = av;
    }

    state.players.player2.tents = 2;
    state.players.player2.maxTents = 2;
    
    let p2Tribe = state.players.player2.avatar.tribe || 'Generic';
    state.players.player2.resources = { [p2Tribe]: { current: 1, max: 1 } };
    
    // Shuffle joining player's deck
    shuffleArray(state.players.player2.deck);
    
    // Replace dummy hand with actual starting hand for joining player
    state.players.player2.hand = [];
    for(let i = 0; i < 4; i++) {
        if (state.players.player2.deck.length > 0) state.players.player2.hand.push(state.players.player2.deck.pop());
    }
    
    state.history_log.push(`${p2Name} joined the match.`);
    
    return state;
}