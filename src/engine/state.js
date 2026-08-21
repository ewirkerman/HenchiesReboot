// filepath: src/engine/state.js
/**
 * src/state.js
 * State definitions and match initialization for the Henchies 2 Game Engine.
 */

import { generateId, shuffleArray } from './prandom.js';

export class GameState {
    constructor() {
        this.status = 'active';
        this.activePlayerId = 'player1';
        this.turnNumber = 1;
        this.turnPhase = 'SACRIFICE_DECISION'; 
        this.abilityUses = {};
        this.rules = { allowUndo: true };
        this.players = {
            player1: { 
                id: 'player1', name: 'Player 1', 
                lines: { taunt: [], bodyguard: [], avatar: [], front: [], mid: [], back: [], sheltered: [], sideline: [] }, 
                hand: [], deck: [], discard: [], banish: [], 
                resources: { 'Carnie': { current: 2, max: 2 } },
                setupComplete: false
            },
            player2: { 
                id: 'player2', name: 'Player 2', isDummy: true,
                lines: { taunt: [], bodyguard: [], avatar: [], front: [], mid: [], back: [], sheltered: [], sideline: [] }, 
                hand: [], deck: [], discard: [], banish: [], 
                resources: { 'Carnie': { current: 2, max: 2 } },
                setupComplete: false
            }
        };
        this.equator = [];
        this.history_log = [];
    }
}

export function initGame(roomId, p1Name, p1Deck, abilityCatalog, cardCatalog, tribeCatalog) {
    const state = new GameState();
    state.gameId = roomId;
    state.rngSeed = Math.floor(Math.random() * 4294967296);
    
    // Catalogs (non-enumerable so they don't bloat Firebase syncs)
    Object.defineProperty(state, 'abilityCatalog', { value: abilityCatalog, enumerable: false, configurable: true });
    Object.defineProperty(state, 'catalog', { value: cardCatalog, enumerable: false, configurable: true });
    Object.defineProperty(state, 'tribeCatalog', { value: tribeCatalog, enumerable: false, configurable: true });

    const p1 = state.players.player1;
    p1.name = p1Name;

    // Initialize Deck
    const deckClone = JSON.parse(JSON.stringify(p1Deck));
    
    // Find avatar
    const avatarIdx = deckClone.findIndex(c => c.type === 'avatar');
    if (avatarIdx > -1) {
        const avatar = deckClone.splice(avatarIdx, 1)[0];
        avatar.instanceId = 'p1_av_' + generateId(state, 6);
        avatar.ownerId = 'player1';
        avatar.originalOwnerId = 'player1';
        avatar.readiness = 1;
        p1.unplayedAvatar = avatar;
    }

    // Shuffle deck
    shuffleArray(state, deckClone);
    
    deckClone.forEach((c, idx) => {
        c.instanceId = 'p1_deck_' + generateId(state, 6) + '_' + idx;
        c.ownerId = 'player1';
        c.originalOwnerId = 'player1';
        c.readiness = 0;
        p1.deck.push(c);
    });
    
    // Draw 4 initial cards
    for (let i = 0; i < 4; i++) {
        if (p1.deck.length > 0) p1.hand.push(p1.deck.pop());
    }

    // Set up player 2 as dummy waiting for opponent
    state.players.player2.name = "Waiting for Opponent...";
    state.players.player2.isDummy = true;
    
    state.history_log.push({ text: `Match initialized in room ${roomId}.`, depth: 0 });
    
    return state;
}

export function joinGame(state, p2Name, p2Deck) {
    const p2 = state.players.player2;
    p2.name = p2Name;
    p2.isDummy = false;
    p2.setupComplete = false;
    
    // Clear out dummy targets generated in test mode
    p2.lines.front = [];
    
    // Initialize Deck
    const deckClone = JSON.parse(JSON.stringify(p2Deck));
    
    // Find avatar
    const avatarIdx = deckClone.findIndex(c => c.type === 'avatar');
    if (avatarIdx > -1) {
        const avatar = deckClone.splice(avatarIdx, 1)[0];
        avatar.instanceId = 'p2_av_' + generateId(state, 6);
        avatar.ownerId = 'player2';
        avatar.originalOwnerId = 'player2';
        avatar.readiness = 1;
        p2.unplayedAvatar = avatar;
    } else {
        p2.unplayedAvatar = null;
        p2.lines.avatar = [];
    }

    // Shuffle deck
    shuffleArray(state, deckClone);
    
    p2.deck = [];
    deckClone.forEach((c, idx) => {
        c.instanceId = 'p2_deck_' + generateId(state, 6) + '_' + idx;
        c.ownerId = 'player2';
        c.originalOwnerId = 'player2';
        c.readiness = 0;
        p2.deck.push(c);
    });
    
    p2.hand = [];
    // Draw 5 cards
    for (let i = 0; i < 5; i++) {
        if (p2.deck.length > 0) p2.hand.push(p2.deck.pop());
    }
    
    state.history_log.push({ text: `${p2Name} joined the match.`, depth: 0 });
    
    return state;
}