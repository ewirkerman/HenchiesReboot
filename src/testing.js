import { createGameRoom, fetchCustomAbilities, fetchCustomCards, fetchCustomTribes, fetchUserDecks } from './firebase.js';
import { CARD_CATALOG, GLOBAL_UNDO_POLICY, hydrateAbility, instantiateEntity, instantiateAbility, startTurn } from './engine/index.js';
import { GameEngine } from './engine/targeting.js';

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
const FALLBACK_TAUNT_ABILITY = {"abilityId":"ability_taunting_call","name":"Taunting Call","trigger":"ON_BE_PLAYED","triggerScope":"PERSONAL","triggerLimit":"UNLIMITED","cost":{"readinessCost":"NONE"},"activation":{"method":"PLAYER_CHOICE","quickTargeting":{"zones":["FIELD"],"alignment":["FRIENDLY"],"entityType":["UNIT","AVATAR"],"ignoreBattlelines":true}},"effects":[{"targetMethod":"SAME_AS_ACTIVATION","targetCount":1,"payloads":[{"type":"CUSTOM_SCRIPT","script":"const oppId = target.ownerId === 'player1' ? 'player2' : 'player1'; const validEnemies = []; const opp = state.players[oppId]; for (const line of ['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard']) { if (opp.lines[line]) { for (const u of opp.lines[line]) { const acts = engine.utils.getEntityAvailableActions(state, oppId, u.instanceId); if (acts.some(a => a.type === 'ATTACK')) { validEnemies.push(u); } } } } if (validEnemies.length > 0) { const enemy = validEnemies[engine.utils.randomInt(state, 0, validEnemies.length)]; enemy.readiness = Math.max(0, (enemy.readiness || 0) - 1); state.history_log.push(`🎯 ${enemy.name} was provoked into attacking ${target.name}!`); engine.executeAbility({ abilityId: 'temp_provoked_attack', name: 'Provoked Attack', effects: [{ targetMethod: 'EVENT_TARGET', payloads: [{ type: 'ATTACK' }] }] }, enemy, { target: target }); }","duration":"INSTANT"}]}]};
const FALLBACK_DUMMY = {"id":"custom_1785272139394","name":"Target Dummy","tribe":"Carnie","type":"unit","genus":"Generic","cost":1,"health":1,"maxHealth":1,"strength":1,"description":"","artUrl":"","abilities":[],"defaultLine":"mid"};
const FALLBACK_SHOVEL = {"id":"card_1785786111173","name":"Skull Shovel","tribe":"Undead","type":"equipment","genus":"Generic","cost":1,"health":1,"maxHealth":1,"strength":null,"description":"","artUrl":"","abilities":[]};
const FALLBACK_TAUNT_CARD = {"id":"card_taunting_call_test","name":"Taunting Call","tribe":"Carnie","type":"spell","genus":"Generic","cost":1,"health":1,"maxHealth":1,"strength":null,"description":"","artUrl":"","abilities":[FALLBACK_TAUNT_ABILITY]};
const FALLBACK_ARRRMSMAN = {"id":"card_arrrmsman_test","name":"Arrrmsman","tribe":"tribe_pirate","type":"unit","genus":"Pirate","cost":2,"health":2,"maxHealth":2,"strength":2,"description":"","artUrl":"","abilities":[],"defaultLine":"mid"};

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
        console.error("[SANDBOX] Firebase/Local write timed out or failed.", e);
        if (popup) popup.document.write(`<h2 style="color:red; font-family:sans-serif; padding: 20px;">Failed to create Sandbox Room:<br/>${e.message || e}</h2>`);
        return; // HALT REDIRECT SO USER CAN SEE THE ERROR
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
    
    // Hydrate catalog with display descriptions for the UI
    const hydratedCards = rawCustomCards.map(c => {
        if (c.abilities) {
            c.abilities = c.abilities.map(ab => {
                const hyd = hydrateAbility(ab, abilities);
                if (hyd) {
                    try { hyd.displayDescription = generateAbilityDescription(hyd, abilities, rawCustomCards, customTribes); } catch(e){}
                }
                return hyd;
            }).filter(Boolean);
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
    if (!catalog || !Array.isArray(catalog)) return fallback;
    const idKey = isAbility ? 'abilityId' : 'id';
    const searchVal = String(nameOrId).trim().toLowerCase();
    
    // Sort by updatedAt descending to guarantee we pull the absolute newest version
    const sortedCatalog = [...catalog].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    const found = sortedCatalog.find(item => {
        if (item[idKey] === nameOrId) return true;
        if (item.name && String(item.name).trim().toLowerCase() === searchVal) return true;
        return false;
    });
    
    if (!found) console.warn(`[SANDBOX] ⚠️ Item '${nameOrId}' not found in catalog. Using hardcoded fallback.`);
    return found ? JSON.parse(JSON.stringify(found)) : fallback;
}

/**
 * Auto-heals a card if its database links are broken (e.g. string IDs) to ensure tests run smoothly.
 */
function autoHealCard(card, targetLiveAbility) {
    if (!targetLiveAbility || !card.abilities) return;
    const liveAbId = targetLiveAbility.abilityId || targetLiveAbility.id;
    const liveAbName = String(targetLiveAbility.name || '').trim().toLowerCase();
    
    let healed = false;
    card.abilities = card.abilities.map(a => {
        const aId = a.abilityId || a.id || a;
        const aName = String(a.name || '').trim().toLowerCase();
        if (aId === liveAbId || aName === liveAbName) {
            healed = true;
            return JSON.parse(JSON.stringify(targetLiveAbility));
        }
        return a;
    });
    
    if (!healed) {
        console.warn(`[SANDBOX] 🩹 Auto-healing broken ability link on '${card.name}'. Injecting live ability.`);
        card.abilities = card.abilities.filter(a => typeof a === 'object'); 
        card.abilities.push(JSON.parse(JSON.stringify(targetLiveAbility)));
    }
}

// ============================================================================
// HELPER: STATE INITIALIZATION
// ============================================================================
function createInitialState(username, tribes, mode = 'sandbox') {
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
                id: 'player2', name: mode === 'clean_ai' ? 'AI Opponent' : 'Target Dummies', isDummy: mode !== 'clean_ai', isAI: mode === 'clean_ai', isPassOnlyAI: mode === 'sandbox',
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
async function configurePlayers(state, itemData, type, sandboxData) {
    const { cards, abilities } = sandboxData;
    const isAvatarTest = type === 'card' && itemData && itemData.type === 'avatar';
    
    let rawTargetCard = null;
    let rawDeckCards = [];
    let rawDeckAvatar = null;
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
                loadedDeck = rawRefs.map(ref => cards.find(c => c.id === (ref.id || ref))).filter(Boolean);
            }
        }
    } catch(e) {
        console.warn("[SANDBOX] Failed to load real deck context. Falling back to dummy deck.", e);
    }

    // 2. Process the specific item being tested for Player 1
    if (type === 'deck') {
        const fullDeck = [...itemData];
        const avatarIdx = fullDeck.findIndex(c => c.type === 'avatar');
        if (avatarIdx > -1) rawDeckAvatar = fullDeck.splice(avatarIdx, 1)[0];
        rawDeckCards = fullDeck;
        rawTargetCard = dummyCard;
    } else if (isAvatarTest) {
        rawDeckAvatar = itemData;
        rawTargetCard = dummyCard; 
    } else if (type === 'ability') {
        rawTargetCard = { ...dummyCard, id: 'test_card', name: 'Test Dummy', abilities: [itemData], description: itemData.name + ' test wrapper.' };
    } else {
        rawTargetCard = itemData;
    }

    if (type !== 'deck') {
        if (loadedDeck.length > 0) {
            rawDeckCards = loadedDeck.filter(c => c.type !== 'avatar');
            if (!rawDeckAvatar) rawDeckAvatar = loadedDeck.find(c => c.type === 'avatar');
        } else {
            for (let i = 0; i < 15; i++) rawDeckCards.push(dummyCard);
            for (let i = 0; i < 5; i++) rawDeckCards.push(shovelCard);
            rawDeckCards.push(butcherCard);
        }
    }

    // 3. P1 DECK & HAND ASSEMBLY
    for (let i = rawDeckCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rawDeckCards[i], rawDeckCards[j]] = [rawDeckCards[j], rawDeckCards[i]];
    }

    rawDeckCards.forEach(c => {
        const inst = instantiateEntity(c, abilities, state, 'player1');
        state.players.player1.deck.push(inst);
    });

    if (type === 'deck' || isAvatarTest) {
        for (let i = 0; i < 4; i++) {
            if (state.players.player1.deck.length > 0) state.players.player1.hand.push(state.players.player1.deck.pop());
        }
    } else {
        for(let i=0; i<4; i++) {
            state.players.player1.hand.push(instantiateEntity(rawTargetCard, abilities, state, 'player1'));
        }
    }

    // Inject edge-case debugging cards into P1 hand
    state.players.player1.hand.push(instantiateEntity(butcherCard, abilities, state, 'player1'));
    state.players.player1.hand.push(instantiateEntity(butcherCard, abilities, state, 'player1'));
    
    const riseAndServeCard = getCatalogItem(cards, 'Rise and Serve', FALLBACK_DUMMY);
    state.players.player1.hand.push(instantiateEntity(riseAndServeCard, abilities, state, 'player1'));
    
    const liveTauntAbility = getCatalogItem(abilities, 'Taunting Call', FALLBACK_TAUNT_ABILITY, true);
    const tauntingCallCard = getCatalogItem(cards, 'Taunting Call', FALLBACK_TAUNT_CARD);
    autoHealCard(tauntingCallCard, liveTauntAbility);
    for(let i=0; i<3; i++) {
        state.players.player1.hand.push(instantiateEntity(tauntingCallCard, abilities, state, 'player1'));
    }

    if (rawDeckAvatar) {
        const av = instantiateEntity(rawDeckAvatar, abilities, state, 'player1');
        av.readiness = 1; av.line = 'avatar'; av.defaultLine = 'avatar';
        state.players.player1.lines.avatar = [av];
    } else {
        const av = instantiateEntity({ id: 'p1_avatar', type: 'avatar', name: 'Test Avatar', health: 30, maxHealth: 30 }, abilities, state, 'player1');
        av.readiness = 1; av.line = 'avatar'; av.defaultLine = 'avatar';
        state.players.player1.lines.avatar = [av];
    }

    // 4. P2 DECK & HAND ASSEMBLY
    let p2DeckBase = [];
    let p2Avatar = null;

    if (type === 'deck') {
        p2DeckBase = [...itemData]; 
    } else if (loadedDeck.length > 0) {
        p2DeckBase = [...loadedDeck];
    } else {
        for (let i = 0; i < 15; i++) p2DeckBase.push(dummyCard);
        for (let i = 0; i < 5; i++) p2DeckBase.push(shovelCard);
        p2DeckBase.push(butcherCard);
    }

    const p2AvatarIdx = p2DeckBase.findIndex(c => c.type === 'avatar');
    if (p2AvatarIdx > -1) p2Avatar = p2DeckBase.splice(p2AvatarIdx, 1)[0];

    for (let i = p2DeckBase.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [p2DeckBase[i], p2DeckBase[j]] = [p2DeckBase[j], p2DeckBase[i]];
    }

    p2DeckBase.forEach(c => {
        state.players.player2.deck.push(instantiateEntity(c, abilities, state, 'player2'));
    });

    for (let i = 0; i < 5; i++) {
        if (state.players.player2.deck.length > 0) state.players.player2.hand.push(state.players.player2.deck.pop());
    }

    if (p2Avatar) {
        const av = instantiateEntity(p2Avatar, abilities, state, 'player2');
        av.readiness = 1; av.line = 'avatar'; av.defaultLine = 'avatar';
        state.players.player2.lines.avatar = [av];
    }
}

// ============================================================================
// HELPER: BOARD SETUP (DUMMIES & MODIFIERS)
// ============================================================================
function setupSandboxBoard(state, sandboxData, mode = 'sandbox') {
    if (mode === 'clean_ai') return; // Skip dummy injection for clean AI matches
    const { cards, abilities } = sandboxData;
    
    const dummyCard = getCatalogItem(cards, 'Target Dummy', FALLBACK_DUMMY);
    if (dummyCard.strength === null || dummyCard.strength === undefined) dummyCard.strength = 1;

    // Only inject Dummy Avatar if P2 didn't load a real one from the deck context
    if (!state.players.player2.lines.avatar || state.players.player2.lines.avatar.length === 0) {
        const av = instantiateEntity({ id: 'p2_avatar', type: 'avatar', name: 'Dummy Avatar', health: 30, maxHealth: 30 }, abilities, state, 'player2');
        av.readiness = 1; av.line = 'avatar'; av.defaultLine = 'avatar';
        state.players.player2.lines.avatar = [av];
    }

    const dLine = dummyCard.defaultLine || 'mid';
    
    // Standard dummies
    for(let i=0; i<5; i++) {
        const dum = instantiateEntity(dummyCard, abilities, state, 'player2');
        dum.readiness = 1; dum.line = dLine;
        if (i===0) dum.tribe = "tribe_robot";
        state.players.player2.lines[dLine].push(dum);
    }

    // Inject Arrrmsman to Player 2
    const arrrmsmanCard = getCatalogItem(cards, 'Arrrmsman', FALLBACK_ARRRMSMAN);
    const aLine = arrrmsmanCard.defaultLine || 'mid';
    const arr = instantiateEntity(arrrmsmanCard, abilities, state, 'player2');
    arr.readiness = 1; arr.line = aLine;
    state.players.player2.lines[aLine].push(arr);
    
    state.players.player2.hand.push(instantiateEntity(arrrmsmanCard, abilities, state, 'player2'));

    // Stealth dummy edge-case
    const stealthDummy = instantiateEntity(dummyCard, abilities, state, 'player2');
    stealthDummy.name = 'Stealth Dummy'; stealthDummy.readiness = 1; stealthDummy.line = dLine;
    const realStealth = getCatalogItem(abilities, 'Stealth', { abilityId: 'stealth_trait', name: 'Stealth', trigger: 'UNTRIGGERABLE', description: 'This unit has Stealth.' }, true);
    stealthDummy.abilities.push(instantiateAbility(realStealth, abilities, state));
    state.players.player2.lines[dLine].push(stealthDummy);

    // Big dummy edge-case
    const bigDummy = instantiateEntity(dummyCard, abilities, state, 'player2');
    bigDummy.health = 10; bigDummy.maxHealth = 10; bigDummy.strength = 10;
    bigDummy.name = 'Big Dummy'; bigDummy.readiness = 1; bigDummy.line = dLine;
    state.players.player2.lines[dLine].push(bigDummy);

    // Friendly dummy to test friendly-fire and attachments
    const friendlyDummy = instantiateEntity(dummyCard, abilities, state, 'player1');
    friendlyDummy.name = 'Dazed Ally'; friendlyDummy.readiness = 1; friendlyDummy.line = 'back';
    friendlyDummy.abilities.push(instantiateAbility({ abilityId: 'dazed_trait', name: 'Dazed', trigger: 'UNTRIGGERABLE', description: 'This unit is Dazed.' }, abilities, state));
    
    const shovelCard = getCatalogItem(cards, 'Skull Shovel', FALLBACK_SHOVEL);
    const shovelInst = instantiateEntity(shovelCard, abilities, state, 'player1');
    shovelInst.readiness = 1;
    friendlyDummy.attachments = [shovelInst];
    state.players.player1.lines.back.push(friendlyDummy);
}

function applyRelentlessModifier(state, abilitiesCatalog, mode = 'sandbox') {
    if (mode === 'clean_ai') return; // Skip modifier injection for clean AI matches
    
    const relentlessAbility = getCatalogItem(abilitiesCatalog, 'Relentless', {
        abilityId: 'ability_relentless_native', name: 'Relentless', trigger: 'UNTRIGGERABLE',
        passiveFlags: ['IGNORE_BLOCK_ATTACK'], description: 'Ignores effects that prevent it from attacking.'
    }, true);

    for (const line in state.players.player2.lines) {
        if (state.players.player2.lines[line]) {
            state.players.player2.lines[line].forEach(u => {
                if (u.type === 'unit') {
                    if (!u.abilities) u.abilities = [];
                    if (!u.abilities.some(a => (a.abilityId || a) === relentlessAbility.abilityId || a.name === 'Relentless')) {
                        u.abilities.push(instantiateAbility(relentlessAbility, abilitiesCatalog, state));
                    }
                }
            });
        }
    }
}

// ============================================================================
// MAIN ENTRYPOINT
// ============================================================================
export async function launchSandboxMatch(itemData, type = 'card', mode = 'sandbox') {
    console.log(`[SANDBOX] Initiating launch for ${type}...`);
    const popup = openLoadingPopup();
    
    try {
        console.log("[SANDBOX] Fetching live database context...");
        const sandboxData = await fetchSandboxData();
        
        const username = localStorage.getItem('henchies_last_username') || 'Tester';
        const state = createInitialState(username, sandboxData.customTribes, mode);
        
        console.log("[SANDBOX] Configuring players...");
        await configurePlayers(state, itemData, type, sandboxData);
        
        console.log("[SANDBOX] Setting up opponent board...");
        setupSandboxBoard(state, sandboxData, mode);
        applyRelentlessModifier(state, sandboxData.abilities, mode);
        
        const roomId = 'TEST_' + Date.now();
        state.gameId = roomId;
        
        const engine = new GameEngine(state);
        startTurn(state, engine);
        state.turn_start_state = JSON.stringify(state);
        
        console.log(`[SANDBOX] Launching room ${roomId}...`);
        await launchRoom(roomId, state, popup);
    } catch (err) {
        console.error("[SANDBOX] FATAL ERROR during launch:", err);
        if (popup) popup.document.write(`<h2 style="color:red; font-family:sans-serif; padding: 20px;">Fatal Error Launching Sandbox:<br/>${err.message}</h2>`);
        throw err;
    }
}