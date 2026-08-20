import { createGameRoom, fetchCustomAbilities, fetchCustomCards, fetchCustomTribes, fetchUserDecks } from './firebase.js';
import { CARD_CATALOG, GLOBAL_UNDO_POLICY, hydrateAbility } from './engine/index.js';

/*
 * =========================================================================================
 * ⚠️ CRITICAL WARNING FOR FUTURE DEVELOPMENT ⚠️
 * =========================================================================================
 * NEVER HARDCODE ABILITIES OR CARDS IN THIS FILE!
 * 
 * The sandbox environment MUST dynamically fetch the latest versions of cards and abilities
 * from the Firebase catalog. If you hardcode a JSON payload here, you bypass the 
 * Ability Studio / Card Studio entirely. This causes sandbox tests to silently test against 
 * outdated logic and creates maddening, untraceable bugs (e.g., testing typos that were 
 * already fixed in the actual database).
 * 
 * Always fetch by name from `customCards` and `allCards`. Only use the fallback `dummyCard` 
 * if the card literally does not exist in the database yet.
 * =========================================================================================
 */


// ============================================================================
// CONSTANTS & FALLBACK DATA
// ============================================================================

const FALLBACK_ATTACK = {"abilityId":"ability_dummy_attack","name":"Attack","trigger":"MANUAL","cost":{"readinessCost":"EXHAUSTS"},"activation":{"method":"PLAYER_CHOICE","quickTargeting":{"zones":["FIELD"],"alignment":["ENEMY"],"entityType":["UNIT","AVATAR"],"ignoreBattlelines":false}},"effects":[{"targetMethod":"SAME_AS_ACTIVATION","targetCount":1,"payloads":[{"type":"ATTACK","duration":"INSTANT"}]}]};
const FALLBACK_TAUNT_ABILITY = {"abilityId":"ability_taunting_call","name":"Taunting Call","trigger":"ON_BE_PLAYED","triggerScope":"PERSONAL","triggerLimit":"UNLIMITED","cost":{"readinessCost":"NONE"},"activation":{"method":"PLAYER_CHOICE","quickTargeting":{"zones":["FIELD"],"alignment":["FRIENDLY"],"entityType":["UNIT","AVATAR"],"ignoreBattlelines":true}},"effects":[{"targetMethod":"SAME_AS_ACTIVATION","targetCount":1,"payloads":[{"type":"CUSTOM_SCRIPT","script":"const oppId = target.ownerId === 'player1' ? 'player2' : 'player1'; const validEnemies = []; const opp = state.players[oppId]; for (const line of ['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard']) { if (opp.lines[line]) { for (const u of opp.lines[line]) { const acts = engine.utils.getEntityAvailableActions(state, oppId, u.instanceId); if (acts.some(a => a.type === 'ATTACK')) { validEnemies.push(u); } } } } if (validEnemies.length > 0) { const enemy = validEnemies[engine.utils.randomInt(state, 0, validEnemies.length)]; enemy.readiness = Math.max(0, (enemy.readiness || 0) - 1); state.history_log.push(`🎯 ${enemy.name} was provoked into attacking ${target.name}!`); engine.executeAbility({ abilityId: 'temp_provoked_attack', name: 'Provoked Attack', effects: [{ targetMethod: 'EVENT_TARGET', payloads: [{ type: 'ATTACK' }] }] }, enemy, { target: target }); }","duration":"INSTANT"}]}]};

const FALLBACK_DUMMY = {"id":"custom_1785272139394","name":"Target Dummy","tribe":"Carnie","type":"unit","genus":"Generic","cost":1,"health":1,"maxHealth":1,"strength":1,"description":"","artUrl":"","abilities":[FALLBACK_ATTACK],"defaultLine":"mid"};
const FALLBACK_SHOVEL = {"id":"card_1785786111173","name":"Skull Shovel","tribe":"Undead","type":"equipment","genus":"Generic","cost":1,"health":1,"maxHealth":1,"strength":null,"description":"","artUrl":"","abilities":[]};
const FALLBACK_TAUNT_CARD = {"id":"card_taunting_call_test","name":"Taunting Call","tribe":"Carnie","type":"spell","genus":"Generic","cost":1,"health":1,"maxHealth":1,"strength":null,"description":"","artUrl":"","abilities":[FALLBACK_TAUNT_ABILITY]};
const FALLBACK_ARRRMSMAN = {"id":"card_arrrmsman_test","name":"Arrrmsman","tribe":"tribe_pirate","type":"unit","genus":"Pirate","cost":2,"health":2,"maxHealth":2,"strength":2,"description":"","artUrl":"","abilities":[FALLBACK_ATTACK],"defaultLine":"mid"};


// ============================================================================
// HELPER: UI & NAVIGATION
// ============================================================================

/**
 * Opens a blank popup immediately to bypass browser popup blockers during async fetches.
 * @returns {Window} The opened popup window.
 */
function openLoadingPopup() {
    let popup = null;
    try {
        popup = window.open('about:blank', '_blank');
        if (popup) popup.document.write('<h2 style="font-family: sans-serif; padding: 20px; color: #333;">Loading Sandbox Environment...</h2>');
    } catch (e) {
        console.warn("Popup blocked or unavailable.", e);
    }
    return popup;
}

/**
 * Finalizes the sandbox creation by pushing to Firebase and redirecting the user.
 */
async function launchRoom(roomId, state, popup) {
    const isStudio = window.location.pathname.includes('/studios/');
    const gamePath = isStudio ? '../game.html' : 'game.html';
    const targetUrl = `${gamePath}#test_${roomId}`;

    // TIMEOUT GUARANTEE: Never hang infinitely on Firebase if offline
    const createTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error("Database write timeout")), 3000));
    try {
        await Promise.race([createGameRoom(roomId, state), createTimeout]);
    } catch (e) {
        console.warn("[SANDBOX] Firebase write timed out or failed. Falling back to local storage.", e);
    }
    
    if (popup) {
        popup.location.href = targetUrl;
    } else {
        window.location.href = targetUrl;
    }
}


// ============================================================================
// HELPER: DATA FETCHING & HYDRATION
// ============================================================================

/**
 * Fetches all necessary cloud data and cross-links abilities to cards.
 * @returns {Object} { abilities, cards, tribes }
 */
async function fetchSandboxData() {
    const abilities = await fetchCustomAbilities();
    const customTribes = await fetchCustomTribes();
    const rawCustomCards = await fetchCustomCards();

    // Hydrate cards with full ability objects instead of string IDs
    const hydratedCards = rawCustomCards.map(c => {
        if (c.abilities) {
            c.abilities = c.abilities.map(ab => hydrateAbility(ab, abilities)).filter(Boolean);
        }
        return c;
    });

    const cards = [...CARD_CATALOG, ...hydratedCards];

    return { abilities, cards, customTribes };
}

/**
 * Safely looks up an item in a catalog by Name or ID, injecting a fallback if missing.
 */
function getCatalogItem(catalog, nameOrId, fallback, isAbility = false) {
    const idKey = isAbility ? 'abilityId' : 'id';
    const found = catalog.find(item => item[idKey] === nameOrId || (item.name && item.name.toLowerCase() === nameOrId.toLowerCase()));
    if (!found) console.warn(`[SANDBOX] ⚠️ Item '${nameOrId}' not found in catalog. Using hardcoded fallback.`);
    return found ? JSON.parse(JSON.stringify(found)) : fallback;
}

/**
 * Auto-heals a card if its database links are broken (e.g. string IDs) to ensure tests run smoothly.
 */
function autoHealCard(card, targetLiveAbility) {
    if (!targetLiveAbility || !card.abilities) return;
    const hasExactId = card.abilities.some(a => (a.abilityId || a) === targetLiveAbility.abilityId);
    const hasNameMatch = card.abilities.some(a => a.name === targetLiveAbility.name);
    
    if (!hasExactId && !hasNameMatch) {
        console.warn(`[SANDBOX] 🩹 Auto-healing broken ability link on '${card.name}'. Injecting live ability: '${targetLiveAbility.name}'`);
        card.abilities = card.abilities.filter(a => typeof a === 'object'); // Clear dangling string references
        card.abilities.push(JSON.parse(JSON.stringify(targetLiveAbility)));
    } else if (hasNameMatch) {
        console.log(`[SANDBOX] 🔄 Overriding cached ability with live database version for '${targetLiveAbility.name}'`);
        card.abilities = card.abilities.map(a => a.name === targetLiveAbility.name ? JSON.parse(JSON.stringify(targetLiveAbility)) : a);
    }
}


// ============================================================================
// HELPER: STATE INITIALIZATION
// ============================================================================

/**
 * Generates the clean, baseline game state structure.
 */
function createInitialState(username, tribes) {
    const p1Res = { 'Carnie': {current: 10, max: 10} };
    tribes.forEach(t => {
        if (t.name !== 'Carnie' && t.name !== 'Generic') {
            p1Res[t.id] = {current: 10, max: 10};
        }
    });

    return {
        status: 'active',
        rules: { allowUndo: GLOBAL_UNDO_POLICY !== 'FORCED_OFF' },
        tribeCatalog: tribes,
        rngSeed: Math.floor(Math.random() * 4294967296),
        activePlayerId: 'player1',
        turnNumber: 1,
        turnPhase: 'ACTION_PHASE',
        actionIndex: 0,
        action_log: [],
        abilityUses: {},
        equator: [],
        history_log: ['Test match started.'],
        players: {
            player1: {
                id: 'player1', name: username,
                lines: { taunt: [], bodyguard: [], avatar: [], front: [], mid: [], back: [], sheltered: [], sideline: [] },
                hand: [], deck: [], discard: [], banish: [],
                resources: p1Res,
                setupComplete: true
            },
            player2: {
                id: 'player2', name: 'Target Dummies', isDummy: true,
                lines: { taunt: [], bodyguard: [], avatar: [], front: [], mid: [], back: [], sheltered: [], sideline: [] },
                hand: [], deck: [], discard: [], banish: [],
                resources: { Carnie: { current: 10, max: 10 } },
                setupComplete: true
            }
        }
    };
}


// ============================================================================
// HELPER: PLAYER DECK & HAND CONFIGURATION
// ============================================================================

/**
 * Maps the tested item (Card, Avatar, Deck, Ability) into the Player's state.
 * Automatically attempts to fetch the user's last saved deck to populate BOTH players.
 */
async function configurePlayers(state, itemData, type, sandboxData) {
    const { cards, abilities } = sandboxData;
    const isAvatarTest = type === 'card' && itemData && itemData.type === 'avatar';
    
    let targetCard = null;
    let deckCards = [];
    let deckAvatar = null;

    const dummyCard = getCatalogItem(cards, 'Target Dummy', FALLBACK_DUMMY);
    const shovelCard = getCatalogItem(cards, 'Skull Shovel', FALLBACK_SHOVEL);
    const butcherCard = getCatalogItem(cards, 'Butcher', FALLBACK_DUMMY);

    // 1. Fetch Real Deck Context for both players
    let loadedDeck = [];
    try {
        const lastDeckName = localStorage.getItem('henchies_last_deck');
        const usernameForFetch = localStorage.getItem('henchies_last_username');
        
        if (lastDeckName && usernameForFetch) {
            console.log(`[SANDBOX] Attempting to load real deck context: ${lastDeckName}`);
            const userDecks = await fetchUserDecks(usernameForFetch);
            if (userDecks && userDecks[lastDeckName] && userDecks[lastDeckName].deckData) {
                const rawRefs = userDecks[lastDeckName].deckData;
                loadedDeck = rawRefs.map(ref => {
                    const cid = ref.id || ref;
                    const found = cards.find(c => c.id === cid);
                    if (found) {
                        const clone = JSON.parse(JSON.stringify(found));
                        if (clone.abilities) {
                            clone.abilities = clone.abilities.map(ab => hydrateAbility(ab, abilities)).filter(Boolean);
                        }
                        return clone;
                    }
                    return null;
                }).filter(Boolean);
            }
        }
    } catch(e) {
        console.warn("[SANDBOX] Failed to load real deck context. Falling back to dummy deck.", e);
    }

    // 2. Process the specific item being tested for Player 1
    if (type === 'deck') {
        const fullDeck = JSON.parse(JSON.stringify(itemData));
        const avatarIdx = fullDeck.findIndex(c => c.type === 'avatar');
        if (avatarIdx > -1) deckAvatar = fullDeck.splice(avatarIdx, 1)[0];
        deckCards = fullDeck;
        targetCard = dummyCard;
    } else if (isAvatarTest) {
        deckAvatar = JSON.parse(JSON.stringify(itemData));
        if (deckAvatar.abilities) {
            deckAvatar.abilities = deckAvatar.abilities.map(ab => hydrateAbility(ab, abilities)).filter(Boolean);
        }
        targetCard = dummyCard; 
    } else if (type === 'ability') {
        const standardAttack = getCatalogItem(abilities, 'Attack', FALLBACK_ATTACK, true);
        targetCard = JSON.parse(JSON.stringify(dummyCard));
        targetCard.id = 'test_card';
        targetCard.name = 'Test Dummy';
        targetCard.abilities = [itemData, standardAttack];
        targetCard.description = itemData.name + ' test wrapper.';
    } else {
        targetCard = JSON.parse(JSON.stringify(itemData));
        if (targetCard.abilities) {
            targetCard.abilities = targetCard.abilities.map(ab => hydrateAbility(ab, abilities)).filter(Boolean);
        }
    }

    if (type !== 'deck') {
        if (loadedDeck.length > 0) {
            deckCards = JSON.parse(JSON.stringify(loadedDeck)).filter(c => c.type !== 'avatar');
            if (!deckAvatar) deckAvatar = JSON.parse(JSON.stringify(loadedDeck)).find(c => c.type === 'avatar');
        } else {
            for (let i = 0; i < 15; i++) deckCards.push(JSON.parse(JSON.stringify(dummyCard)));
            for (let i = 0; i < 5; i++) deckCards.push(JSON.parse(JSON.stringify(shovelCard)));
            deckCards.push(JSON.parse(JSON.stringify(butcherCard)));
        }
    }

    // 3. P1 DECK & HAND ASSEMBLY
    for (let i = deckCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deckCards[i], deckCards[j]] = [deckCards[j], deckCards[i]];
    }

    deckCards.forEach((c, idx) => {
        c.instanceId = 'deck_' + idx;
        c.readiness = 0;
        c.ownerId = 'player1';
        c.originalOwnerId = 'player1';
        state.players.player1.deck.push(c);
    });

    if (type === 'deck' || isAvatarTest) {
        for (let i = 0; i < 5; i++) {
            if (state.players.player1.deck.length > 0) {
                state.players.player1.hand.push(state.players.player1.deck.pop());
            }
        }
    } else {
        // Guarantee 5 copies of the specific card being tested
        for(let i=0; i<5; i++) {
            state.players.player1.hand.push({...JSON.parse(JSON.stringify(targetCard)), instanceId: 'h_'+i, readiness: 0, ownerId: 'player1', originalOwnerId: 'player1'});
        }
    }

    // Inject edge-case debugging cards into P1 hand
    state.players.player1.hand.push({...JSON.parse(JSON.stringify(butcherCard)), instanceId: 'h_butcher_1', readiness: 0, ownerId: 'player1', originalOwnerId: 'player1'});
    state.players.player1.hand.push({...JSON.parse(JSON.stringify(butcherCard)), instanceId: 'h_butcher_2', readiness: 0, ownerId: 'player1', originalOwnerId: 'player1'});
    
    const riseAndServeCard = getCatalogItem(cards, 'Rise and Serve', FALLBACK_DUMMY);
    state.players.player1.hand.push({...JSON.parse(JSON.stringify(riseAndServeCard)), instanceId: 'h_rise_1', readiness: 0, ownerId: 'player1', originalOwnerId: 'player1'});

    const liveTauntAbility = getCatalogItem(abilities, 'Taunting Call', FALLBACK_TAUNT_ABILITY, true);
    const tauntingCallCard = getCatalogItem(cards, 'Taunting Call', FALLBACK_TAUNT_CARD);
    autoHealCard(tauntingCallCard, liveTauntAbility);
    for(let i=0; i<3; i++) {
        state.players.player1.hand.push({...JSON.parse(JSON.stringify(tauntingCallCard)), instanceId: 'h_taunt_' + i, readiness: 0, ownerId: 'player1', originalOwnerId: 'player1'});
    }

    if (deckAvatar) {
        deckAvatar.instanceId = 'p1_av';
        deckAvatar.ownerId = 'player1';
        deckAvatar.originalOwnerId = 'player1';
        deckAvatar.readiness = 1;
        deckAvatar.line = 'avatar';
        deckAvatar.defaultLine = 'avatar';
        state.players.player1.lines.avatar = [deckAvatar];
    } else {
        state.players.player1.lines.avatar = [{ id: 'p1_avatar', instanceId: 'p1_av', type: 'avatar', name: 'Test Avatar', health: 30, maxHealth: 30, line: 'avatar', defaultLine: 'avatar', readiness: 1, ownerId: 'player1', originalOwnerId: 'player1' }];
    }

    // 4. P2 DECK & HAND ASSEMBLY
    let p2DeckBase = [];
    let p2Avatar = null;

    if (type === 'deck') {
        p2DeckBase = JSON.parse(JSON.stringify(itemData)); 
    } else if (loadedDeck.length > 0) {
        p2DeckBase = JSON.parse(JSON.stringify(loadedDeck));
    } else {
        for (let i = 0; i < 15; i++) p2DeckBase.push(JSON.parse(JSON.stringify(dummyCard)));
        for (let i = 0; i < 5; i++) p2DeckBase.push(JSON.parse(JSON.stringify(shovelCard)));
        p2DeckBase.push(JSON.parse(JSON.stringify(butcherCard)));
    }

    const p2AvatarIdx = p2DeckBase.findIndex(c => c.type === 'avatar');
    if (p2AvatarIdx > -1) p2Avatar = p2DeckBase.splice(p2AvatarIdx, 1)[0];

    for (let i = p2DeckBase.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [p2DeckBase[i], p2DeckBase[j]] = [p2DeckBase[j], p2DeckBase[i]];
    }

    p2DeckBase.forEach((c, idx) => {
        c.instanceId = 'p2_deck_' + idx;
        c.readiness = 0;
        c.ownerId = 'player2';
        c.originalOwnerId = 'player2';
        state.players.player2.deck.push(c);
    });

    for (let i = 0; i < 5; i++) {
        if (state.players.player2.deck.length > 0) {
            state.players.player2.hand.push(state.players.player2.deck.pop());
        }
    }

    if (p2Avatar) {
        p2Avatar.instanceId = 'p2_av';
        p2Avatar.ownerId = 'player2';
        p2Avatar.originalOwnerId = 'player2';
        p2Avatar.readiness = 1;
        p2Avatar.line = 'avatar';
        p2Avatar.defaultLine = 'avatar';
        state.players.player2.lines.avatar = [p2Avatar];
    }
}


// ============================================================================
// HELPER: BOARD SETUP (DUMMIES & MODIFIERS)
// ============================================================================

/**
 * Populates the board with specific dummy configurations for robust testing scenarios.
 */
function setupSandboxBoard(state, sandboxData) {
    const { cards, abilities } = sandboxData;
    const standardAttack = getCatalogItem(abilities, 'Attack', FALLBACK_ATTACK, true);
    
    const dummyCard = getCatalogItem(cards, 'Target Dummy', FALLBACK_DUMMY);
    // Force-inject Attack onto the dummy so it can be provoked
    if (!dummyCard.abilities) dummyCard.abilities = [];
    if (!dummyCard.abilities.some(a => (a.abilityId || a) === standardAttack.abilityId || a.name === 'Attack')) {
        dummyCard.abilities.push(standardAttack);
    }
    if (dummyCard.strength === null || dummyCard.strength === undefined) dummyCard.strength = 1;

    // Only inject Dummy Avatar if P2 didn't load a real one from the deck context
    if (!state.players.player2.lines.avatar || state.players.player2.lines.avatar.length === 0) {
        state.players.player2.lines.avatar = [{ id: 'p2_avatar', instanceId: 'p2_av', type: 'avatar', name: 'Dummy Avatar', health: 30, maxHealth: 30, line: 'avatar', defaultLine: 'avatar', readiness: 1, ownerId: 'player2', originalOwnerId: 'player2' }];
    }

    const dLine = dummyCard.defaultLine || 'mid';

    // Standard dummies
    for(let i=0; i<5; i++) {
        state.players.player2.lines[dLine].push({...JSON.parse(JSON.stringify(dummyCard)), instanceId: 'e_dum_'+i, readiness: 1, line: dLine, defaultLine: dLine, ownerId: 'player2', originalOwnerId: 'player2'});
    }
    state.players.player2.lines[dLine][0].tribe = "tribe_robot";
    
    // Inject Arrrmsman to Player 2
    const arrrmsmanCard = getCatalogItem(cards, 'Arrrmsman', FALLBACK_ARRRMSMAN);
    const aLine = arrrmsmanCard.defaultLine || 'mid';
    state.players.player2.lines[aLine].push({...JSON.parse(JSON.stringify(arrrmsmanCard)), instanceId: 'e_arrrmsman_1', readiness: 1, line: aLine, defaultLine: aLine, ownerId: 'player2', originalOwnerId: 'player2'});
    state.players.player2.hand.push({...JSON.parse(JSON.stringify(arrrmsmanCard)), instanceId: 'e_arrrmsman_hand_1', readiness: 0, ownerId: 'player2', originalOwnerId: 'player2'});


    // Stealth dummy edge-case
    const stealthDummy = {...JSON.parse(JSON.stringify(dummyCard)), name: 'Stealth Dummy', instanceId: 'e_dum_stealth', readiness: 1, line: dLine, defaultLine: dLine, ownerId: 'player2', originalOwnerId: 'player2'};
    const realStealth = getCatalogItem(abilities, 'Stealth', { abilityId: 'stealth_trait', name: 'Stealth', trigger: 'UNTRIGGERABLE', description: 'This unit has Stealth.' }, true);
    stealthDummy.abilities = [realStealth, standardAttack];
    state.players.player2.lines[dLine].push(stealthDummy);

    // Big dummy edge-case
    state.players.player2.lines[dLine].push({...JSON.parse(JSON.stringify(dummyCard)), instanceId: 'e_dum_10', health: 10, maxHealth: 10, strength: 10, name: 'Big Dummy', readiness: 1, line: dLine, defaultLine: dLine, ownerId: 'player2', originalOwnerId: 'player2'});

    // Friendly dummy to test friendly-fire and attachments
    const friendlyDummy = {...JSON.parse(JSON.stringify(dummyCard)), name: 'Dazed Ally', instanceId: 'f_dum_1', readiness: 1, line: 'back', defaultLine: 'back', ownerId: 'player1', originalOwnerId: 'player1'};
    friendlyDummy.abilities = [{ abilityId: 'dazed_trait', name: 'Dazed', trigger: 'UNTRIGGERABLE', description: 'This unit is Dazed.' }, standardAttack];
    const shovelCard = getCatalogItem(cards, 'Skull Shovel', FALLBACK_SHOVEL);
    const shovelInst = {...JSON.parse(JSON.stringify(shovelCard)), instanceId: 'f_shovel_1', ownerId: 'player1', readiness: 1};
    friendlyDummy.attachments = [shovelInst];
    state.players.player1.lines.back.push(friendlyDummy);
}

/**
 * Modifies enemy units globally. Specifically ensures all enemies have Relentless
 * so they ignore block statuses (like Pacify) for specific testing constraints.
 */
function applyRelentlessModifier(state, abilitiesCatalog) {
    const relentlessAbility = getCatalogItem(abilitiesCatalog, 'Relentless', {
        abilityId: 'ability_relentless_native',
        name: 'Relentless',
        trigger: 'UNTRIGGERABLE',
        passiveFlags: ['IGNORE_BLOCK_ATTACK'],
        description: 'Ignores effects that prevent it from attacking.'
    }, true);

    for (const line in state.players.player2.lines) {
        if (state.players.player2.lines[line]) {
            state.players.player2.lines[line].forEach(u => {
                if (u.type === 'unit') {
                    if (!u.abilities) u.abilities = [];
                    if (!u.abilities.some(a => (a.abilityId || a) === relentlessAbility.abilityId || a.name === 'Relentless')) {
                        u.abilities.push(JSON.parse(JSON.stringify(relentlessAbility)));
                    }
                }
            });
        }
    }
}


// ============================================================================
// MAIN ENTRYPOINT
// ============================================================================

/**
 * Orchestrates the creation of a Sandbox match.
 * @param {Object} itemData - The Card, Avatar, Deck, or Ability being tested.
 * @param {string} type - Identifies the payload type ('card', 'deck', 'avatar', 'ability').
 */
export async function launchSandboxMatch(itemData, type = 'card') {
    const popup = openLoadingPopup();
    
    // 1. Fetch live database context
    const sandboxData = await fetchSandboxData();
    
    // 2. Setup Player Context
    const username = localStorage.getItem('henchies_last_username') || 'Tester';
    const state = createInitialState(username, sandboxData.customTribes);
    
    await configurePlayers(state, itemData, type, sandboxData);
    
    // 3. Setup Opponent Board & Global Rules
    setupSandboxBoard(state, sandboxData);
    applyRelentlessModifier(state, sandboxData.abilities);

    // 4. Finalize
    const roomId = 'TEST_' + Date.now();
    state.gameId = roomId;
    state.turn_start_state = JSON.stringify(state);

    await launchRoom(roomId, state, popup);
}