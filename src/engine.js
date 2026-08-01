/**
 * Henchies 2 Game Engine Core
 * Implements a LIFO Event Bus with APNAP resolution, WOULD_ replacement effects, 
 * and infinite-loop self-trigger prevention.
 */

export const CARD_CATALOG = []; // Will be hydrated by deckbuilder/firebase

export const LINES = ['hero', 'bodyguard', 'back', 'mid', 'front', 'taunt'];
export class Card {}
export class UnitInstance {}
export class Avatar {}

export class GameState {
    constructor() {
        this.activePlayerId = 'player1';
        this.turnNumber = 1;
        this.turnPhase = 'DRAW_DECISION'; // DRAW_DECISION, SACRIFICE_DECISION, ACTION_PHASE
        this.players = {
            player1: { 
                id: 'player1', name: 'Player 1', 
                lines: { hero: [], bodyguard: [], back: [], mid: [], front: [], taunt: [] }, 
                hand: [], deck: [], discard: [], banish: [], 
                avatar: { id: 'p1_avatar', name: 'Warlord', health: 30, maxHealth: 30, power: 0, tribe: 'Mythic', type: 'avatar', readiness: 1 },
                tents: 1, maxTents: 1, tribeResource: 0, maxTribeResource: 0
            },
            player2: { 
                id: 'player2', name: 'Player 2', 
                lines: { hero: [], bodyguard: [], back: [], mid: [], front: [], taunt: [] }, 
                hand: [], deck: [], discard: [], banish: [], 
                avatar: { id: 'p2_avatar', name: 'Opponent', health: 30, maxHealth: 30, power: 0, tribe: 'Robot', type: 'avatar', readiness: 1 },
                tents: 1, maxTents: 1, tribeResource: 0, maxTribeResource: 0
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
                    if (payload.target.health <= 0) {
                        // Immediately emit a KILL event if health drops to 0
                        this.emit('KILL', { source: payload.source, target: payload.target });
                    }
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
            for (const unit of player.lines.field) {
                if (!unit.abilities) continue;
                for (const ability of unit.abilities) {
                    // Do not queue if this exact ability already fired in the current chain
                    if (ability.trigger === eventType && !this.activeChainAbilities.has(ability.abilityId)) {
                        triggers.push({ owner: pId, source: unit, ability, payload });
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
        }
        
        // Chain complete. Clear the loop-prevention set for the next distinct action.
        this.activeChainAbilities.clear();
        this.processing = false;
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
    
    // 1. Harvesting: Replenish resources based on max caps
    player.tents = player.maxTents;
    player.tribeResource = player.maxTribeResource;
    
    // 2. Ready all entities
    if (player.avatar) player.avatar.readiness = 1;
    for (const line of LINES) {
        player.lines[line].forEach(u => u.readiness = 1);
    }

    state.turnPhase = 'DRAW_DECISION';
    state.history_log.push(`🌅 Turn ${state.turnNumber} begins for ${player.name}. Harvesting complete.`);
    
    engine.emit('TURN_STARTING', { playerId: pId });
    engine.emit('TURN_STARTED', { playerId: pId });
}

/**
 * Executes Phase 1: Draw Decision
 */
export function executeDrawDecision(state, option) {
    if (state.turnPhase !== 'DRAW_DECISION') return;
    const engine = new GameEngine(state);
    const player = state.players[state.activePlayerId];

    if (option === 'OPTION_A') {
        engine.emit('DRAW_CARD', { playerId: state.activePlayerId, amount: 2 });
        state.history_log.push(`🃏 ${player.name} chose Option A: Drew 2 cards.`);
        state.turnPhase = 'SACRIFICE_DECISION';
    } else if (option === 'OPTION_B') {
        engine.emit('DRAW_CARD', { playerId: state.activePlayerId, amount: 4 });
        state.history_log.push(`⚡ ${player.name} chose Option B: Drew 4 cards and skipped turn!`);
        endTurn(state);
    }
}

/**
 * Executes Phase 2: Sacrifice Decision
 */
export function executeSacrificeDecision(state, option, cardId) {
    if (state.turnPhase !== 'SACRIFICE_DECISION') return;
    const player = state.players[state.activePlayerId];

    if (option === 'OPTION_A' && cardId) {
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex > -1) {
            const sacCard = player.hand.splice(cardIndex, 1)[0];
            player.banish.push(sacCard);
            
            player.maxTents += 1;
            player.maxTribeResource += 1;
            player.tents += 1; // Available immediately this turn
            player.tribeResource += 1;
            
            state.history_log.push(`🔥 ${player.name} banished '${sacCard.name || 'a card'}' to increase Max Resources!`);
        }
    } else {
        state.history_log.push(`⏭️ ${player.name} skipped the Sacrifice Phase.`);
    }
    
    state.turnPhase = 'ACTION_PHASE';
}

// ==========================================
// STUB EXPORTS (To prevent UI import crashes)
// ==========================================

export function initGame(roomCode, hostName, hostDeck) { 
    const state = new GameState();
    if (hostName) state.players.player1.name = hostName;
    state.history_log.push(`Game initialized in room ${roomCode}`);
    return state;
}

export function joinGame(state, playerName, playerDeck) {
    if (playerName) state.players.player2.name = playerName;
    state.history_log.push(`${playerName || 'Player 2'} joined the game.`);
    return state;
}

export function playCard() { return { success: false, reason: "Not implemented" }; }
export function resolveCombat() {}
export function useBodyguardAbility() { return false; }
export function equipFromEquator() {}
export function getValidAttackTargets() { return []; }
export function cloneGameState(state) { return JSON.parse(JSON.stringify(state)); }
export function getEntityAvailableActions() { return []; }
export function executeEntityAction() { return { success: false, reason: "Not implemented" }; }
export function generate40CardDeck() { return []; }