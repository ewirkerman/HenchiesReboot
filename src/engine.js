/**
 * Henchies 2 Game Engine Core
 * Implements a LIFO Event Bus with APNAP resolution, WOULD_ replacement effects, 
 * and infinite-loop self-trigger prevention.
 */

export const CARD_CATALOG = []; // Will be hydrated by deckbuilder/firebase

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
        
        // If a WOULD_ event is triggered, it PREVENTS the base event.
        if (hasWouldTriggers) {
            this.startStackProcessing();
            return { cancelled: true };
        }

        // 2. If not prevented, execute the base game logic for the event
        this.executeBaseLogic(eventType, payload);

        // 3. Queue standard post-event triggers (e.g., DAMAGED, KILLED)
        const pastTenseEvent = this.getPastTenseEvent(eventType);
        if (pastTenseEvent) {
            this.queueTriggers(pastTenseEvent, payload);
        } else {
            this.queueTriggers(eventType, payload);
        }

        // 4. Resolve the stack if we aren't already deep inside a chain
        this.startStackProcessing();
        
        return { cancelled: false };
    }

    /**
     * Executes the hardcoded base logic for specific core events.
     */
    executeBaseLogic(eventType, payload) {
        switch (eventType) {
            case 'DAMAGE':
                if (payload.target && payload.amount) {
                    payload.target.health -= payload.amount;
                }
                break;
            case 'KILL':
                if (!payload.target) break;
                const targetId = payload.target.instanceId;
                let foundOwner = null;
                let foundLine = null;
                let foundIndex = -1;
                let deadUnit = null;

                for (const pId of ['player1', 'player2']) {
                    const p = this.state.players[pId];
                    for (const line of LINES) {
                        if (line === 'avatar') continue;
                        if (p.lines[line]) {
                            const idx = p.lines[line].findIndex(u => u.instanceId === targetId);
                            if (idx > -1) {
                                foundOwner = pId;
                                foundLine = line;
                                foundIndex = idx;
                                deadUnit = p.lines[line][idx];
                                break;
                            }
                        }
                    }
                    if (foundOwner) break;
                }

                if (foundOwner && foundIndex > -1) {
                    // Remove from board
                    this.state.players[foundOwner].lines[foundLine].splice(foundIndex, 1);
                    delete deadUnit._isDying;
                    
                    // Trigger UNFIELD replacement effects before formal discard
                    this.emit('UNFIELD', { target: deadUnit, ownerId: foundOwner });
                    
                    // Move to discard pile
                    this.state.players[foundOwner].discard.push(deadUnit);
                    this.state.history_log.push(`💀 ${deadUnit.name} died and was sent to discard.`);
                }
                break;
            case 'HEAL':
                if (payload.target && payload.amount) {
                    payload.target.health += payload.amount;
                    // Cap at max health if applicable
                    if (payload.target.maxHealth && payload.target.health > payload.target.maxHealth) {
                        payload.target.health = payload.target.maxHealth;
                    }
                }
                break;
            case 'DRAW_CARD':
                const p = this.state.players[payload.playerId];
                if (p && p.deck.length > 0) {
                    for(let i=0; i<(payload.amount || 1); i++) {
                        if(p.deck.length > 0) p.hand.push(p.deck.pop());
                    }
                }
                break;
            // ... additional base logic cases to be expanded as engine grows
        }
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
            
            this.executeAbility(frame.ability, frame.source, frame.payload);
            
            this.sweepDeadEntities();
        }
        
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
                        u._isDying = true;
                        this.emit('KILL', { target: u, targetLine: line, ownerId: pId });
                    }
                }
            }
        }
    }

    executeAbility(ability, source, eventPayload) {
        // Log the execution
        this.state.history_log.push(`✨ ${source.name || 'Entity'} activated '${ability.name}'`);
        
        // This is where we interpret the JSON effect payloads
        if (!ability.effects) return;

        for (const group of ability.effects) {
            // Target acquisition logic goes here based on group.targetMethod and group.logicTree
            // ...
            
            for (const payload of group.payloads) {
                // Emitter translates the abstract JSON payload into actual game events
                // E.g., if payload.type === 'DEAL_DAMAGE', we emit('DAMAGE', { amount: payload.amount })
                // This recursive emit ensures nested triggers hit the stack appropriately
                if (payload.type === 'DEAL_DAMAGE') {
                    this.emit('DAMAGE', { source: source, target: null /* acquired target */, amount: payload.amount });
                }
                // ... map other payload types
            }
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
    
    if (pId === 'player2' && player.isDummy) {
        state.history_log.push(`⏭️ Player 2 auto-skipped (Waiting for opponent to join).`);
        endTurn(state);
        return;
    }

    if (pId === 'player2' && !player.setupComplete) {
        player.setupComplete = true;
        if (player.avatar) player.avatar.isDeployed = true;
        const dummy = {
            id: 'target_dummy', instanceId: 'inst_' + Math.random().toString(36).substr(2, 9),
            name: 'Target Dummy', type: 'unit', tribe: 'Robot', health: 10, maxHealth: 10, strength: 0, readiness: 0, abilities: []
        };
        if (!player.lines['front']) player.lines['front'] = [];
        player.lines['front'].push(dummy);
        state.history_log.push(`🤖 Player 2 deployed Avatar and summoned Target Dummy.`);
    } else if (pId === 'player1' && !player.setupComplete) {
        player.setupComplete = true;
        if (player.avatar) player.avatar.isDeployed = true;
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

    if (pId === 'player2') {
        state.history_log.push(`⏭️ Player 2 auto-skipped for testing.`);
        endTurn(state);
        return;
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
            const sacCard = player.hand.splice(cardIndex, 1)[0];
            player.banish.push(sacCard);
            
            if (!player.resources) player.resources = {};

            let sTribe = sacCard.tribe || 'Generic';
            let resKey = Object.keys(player.resources).find(k => k.toLowerCase() === sTribe.toLowerCase());
            if (!resKey) {
                resKey = sTribe.charAt(0).toUpperCase() + sTribe.slice(1).toLowerCase();
                player.resources[resKey] = { current: 0, max: 0 };
            }

            if (sTribe.toLowerCase() === 'carnie') {
                player.maxTents += 2;
                player.tents += 2;
                state.history_log.push(`🔥 ${player.name} harvested '${sacCard.name}' (Carnie) to gain +2 Max Tents!`);
            } else {
                player.maxTents += 1;
                player.tents += 1;
                
                player.resources[resKey].max += 1;
                player.resources[resKey].current += 1;
                
                state.history_log.push(`🔥 ${player.name} harvested '${sacCard.name}' to gain +1 Max Tent & +1 Max ${resKey} Res!`);
            }
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

    player.hand.splice(cardIdx, 1);

    const instance = JSON.parse(JSON.stringify(card));
    // DO NOT reassign instanceId! It retains its unique ID from the deck, securing action replays.
    instance.health = instance.health || 1;
    instance.maxHealth = instance.health;
    instance.readiness = 0;

    if (instance.type === 'artifact') {
        if (!state.equator) state.equator = [];
        state.equator.push(instance);
        state.history_log.push(`🃏 ${player.name} deployed artifact ${instance.name} to the Equator.`);
    } else {
        let targetLine = 'back';
        if (!player.lines[targetLine]) player.lines[targetLine] = [];
        player.lines[targetLine].push(instance);
        state.history_log.push(`🃏 ${player.name} played ${instance.name} into the BACK line.`);
    }

    return { success: true };
}

export function resolveCombat(state, attackerOwnerId, attackerId, targetLine, targetId) {
    const engine = new GameEngine(state);
    const defenderOwnerId = attackerOwnerId === 'player1' ? 'player2' : 'player1';
    
    // Find attacker
    let attacker = null;
    if (state.players[attackerOwnerId].avatar && state.players[attackerOwnerId].avatar.id === attackerId) {
        attacker = state.players[attackerOwnerId].avatar;
    } else {
        for (const line of LINES) {
            if (line === 'avatar') continue;
            attacker = state.players[attackerOwnerId].lines[line]?.find(u => u.instanceId === attackerId);
            if (attacker) break;
        }
    }
    if (!attacker) return { success: false, reason: "Attacker not found" };
    
    // Find defender
    let defender = null;
    if (targetLine === 'avatar') {
        defender = state.players[defenderOwnerId].avatar;
    } else {
        defender = state.players[defenderOwnerId].lines[targetLine]?.find(u => u.instanceId === targetId);
    }
    if (!defender) return { success: false, reason: "Defender not found" };

    // Determine speeds
    const getSpeed = (entity) => {
        if (!entity.abilities) return 0;
        const hasFast = entity.abilities.some(a => a.name && a.name.toUpperCase() === 'FAST');
        const hasSlow = entity.abilities.some(a => a.name && a.name.toUpperCase() === 'SLOW');
        if (hasFast && !hasSlow) return 1;
        if (hasSlow && !hasFast) return -1;
        return 0;
    };

    const atkSpeed = getSpeed(attacker);
    const defSpeed = getSpeed(defender);
    const atkDmg = attacker.strength || 0;
    const defDmg = defender.strength || 0;

    state.history_log.push(`⚔️ ${attacker.name || 'Unit'} attacks ${defender.name || 'Unit'}!`);
    
    if (attacker.type !== 'avatar') {
        attacker.readiness = 0; 
    }
    engine.emit('ATTACK', { source: attacker, target: defender });

    // Phase 1 & 2: Speed Advantage Resolution
    if (atkSpeed > defSpeed) {
        if (atkDmg > 0) engine.emit('DAMAGE', { source: attacker, target: defender, amount: atkDmg });
        if (defender.health > 0 && defDmg > 0) {
            engine.emit('DAMAGE', { source: defender, target: attacker, amount: defDmg });
        }
    } else if (defSpeed > atkSpeed) {
        if (defDmg > 0) engine.emit('DAMAGE', { source: defender, target: attacker, amount: defDmg });
        if (attacker.health > 0 && atkDmg > 0) {
            engine.emit('DAMAGE', { source: attacker, target: defender, amount: atkDmg });
        }
    } else {
        // Simultaneous execution (Both same speed)
        if (atkDmg > 0) engine.emit('DAMAGE', { source: attacker, target: defender, amount: atkDmg });
        if (defDmg > 0) engine.emit('DAMAGE', { source: defender, target: attacker, amount: defDmg });
    }
    
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

    if (entity.type !== 'artifact' && entity.readiness > 0) {
        actions.push({ type: 'ATTACK', name: 'Basic Attack' });
    }

    if (entity.abilities) {
        entity.abilities.forEach(ab => {
            if (ab.trigger === 'MANUAL' && entity.readiness > 0) {
                actions.push({ type: 'ABILITY', name: ab.name, abilityId: ab.abilityId });
            }
        });
    }
    return actions;
}

export function executeEntityAction(state, playerId, entityId, actionType, abilityId, targetId, targetLine) {
    if (actionType === 'ATTACK') return resolveCombat(state, playerId, entityId, targetLine, targetId);
    if (actionType === 'ABILITY') {
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
        
        if (entity && entity.type !== 'avatar') entity.readiness = 0;
        state.history_log.push(`✨ ${entity ? entity.name : 'Unit'} used an ability.`);
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