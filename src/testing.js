import { createGameRoom, fetchCustomAbilities, fetchCustomCards, fetchCustomTribes, fetchUserDecks } from './firebase.js';
import { CARD_CATALOG } from './engine.js';

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

export async function launchSandboxMatch(itemData, type = 'card') {
    const abs = await fetchCustomAbilities();
    
    const getAbility = (nameOrId, fallback) => {
        const found = abs.find(a => (a.name && a.name.toLowerCase() === nameOrId.toLowerCase()) || a.abilityId === nameOrId);
        if (!found) console.warn(`[SANDBOX] ⚠️ Ability '${nameOrId}' not found in catalog. Using hardcoded fallback.`);
        return found ? JSON.parse(JSON.stringify(found)) : fallback;
    };

    let standardAttack = getAbility('Attack', {"abilityId":"ability_dummy_attack","name":"Attack","trigger":"MANUAL","cost":{"readinessCost":"EXHAUSTS"},"activation":{"method":"PLAYER_CHOICE","quickTargeting":{"zones":["FIELD"],"alignment":["ENEMY"],"entityType":["UNIT","AVATAR"],"ignoreBattlelines":false}},"effects":[{"targetMethod":"SAME_AS_ACTIVATION","targetCount":1,"payloads":[{"type":"ATTACK","duration":"INSTANT"}]}]});

    const customCards = await fetchCustomCards();
    const hydratedCards = customCards.map(c => {
        if (c.abilities) {
            c.abilities = c.abilities.map(ab => {
                const abId = typeof ab === 'string' ? ab : (ab.abilityId || ab.id);
                const match = abs.find(a => a.abilityId === abId);
                return match ? JSON.parse(JSON.stringify(match)) : ab;
            }).filter(Boolean);
        }
        return c;
    });
    const allCards = [...CARD_CATALOG, ...hydratedCards];

    const getCard = (nameOrId, fallback) => {
        const found = allCards.find(c => c.id === nameOrId || (c.name && c.name.toLowerCase() === nameOrId.toLowerCase()));
        if (!found) console.warn(`[SANDBOX] ⚠️ Card '${nameOrId}' not found in catalog. Using hardcoded fallback.`);
        return found ? JSON.parse(JSON.stringify(found)) : fallback;
    };

    // Fallbacks (Only used if the user deleted these cards from their database)
    const fallbackDummy = {"id":"custom_1785272139394","name":"Target Dummy","tribe":"Carnie","type":"unit","genus":"Generic","cost":1,"health":1,"maxHealth":1,"strength":1,"description":"","artUrl":"","abilities":[standardAttack],"defaultLine":"mid"};
    const fallbackShovel = {"id":"card_1785786111173","name":"Skull Shovel","tribe":"Undead","type":"equipment","genus":"Generic","cost":1,"health":1,"maxHealth":1,"strength":null,"description":"","artUrl":"","abilities":[]};
    const fallbackTauntAbility = {"abilityId":"ability_taunting_call","name":"Taunting Call","trigger":"ON_BE_PLAYED","triggerScope":"PERSONAL","triggerLimit":"UNLIMITED","cost":{"readinessCost":"NONE"},"activation":{"method":"PLAYER_CHOICE","quickTargeting":{"zones":["FIELD"],"alignment":["FRIENDLY"],"entityType":["UNIT"],"ignoreBattlelines":true}},"effects":[{"targetMethod":"SAME_AS_ACTIVATION","targetCount":1,"payloads":[{"type":"CUSTOM_SCRIPT","script":"const oppId = target.ownerId === 'player1' ? 'player2' : 'player1'; const validEnemies = []; const opp = state.players[oppId]; for (const line of ['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard']) { if (opp.lines[line]) { for (const u of opp.lines[line]) { const acts = engine.utils.getEntityAvailableActions(state, oppId, u.instanceId); if (acts.some(a => a.type === 'ATTACK')) { validEnemies.push(u); } } } } if (validEnemies.length > 0) { const enemy = validEnemies[engine.utils.randomInt(state, 0, validEnemies.length)]; enemy.readiness = Math.max(0, (enemy.readiness || 0) - 1); state.history_log.push(`🎯 ${enemy.name} was provoked into attacking ${target.name}!`); engine.executeAbility({ abilityId: 'temp_provoked_attack', name: 'Provoked Attack', effects: [{ targetMethod: 'EVENT_TARGET', payloads: [{ type: 'ATTACK' }] }] }, enemy, { target: target }); }","duration":"INSTANT"}]}]};
    const fallbackTaunt = {"id":"card_taunting_call_test","name":"Taunting Call","tribe":"Generic","type":"spell","genus":"Generic","cost":1,"health":1,"maxHealth":1,"strength":null,"description":"","artUrl":"","abilities":[fallbackTauntAbility]};

    const username = localStorage.getItem('henchies_last_username') || 'Tester';

    // Auto-heals a card if its database links are broken (e.g. string IDs) to ensure tests run smoothly
    const autoHealCard = (card, targetLiveAbility) => {
        if (!targetLiveAbility || !card.abilities) return;
        const hasExactId = card.abilities.some(a => (a.abilityId || a) === targetLiveAbility.abilityId);
        const hasNameMatch = card.abilities.some(a => a.name === targetLiveAbility.name);
        
        if (!hasExactId && !hasNameMatch) {
            console.warn(`[SANDBOX] 🩹 Auto-healing broken ability link on '${card.name}'. Injecting live ability: '${targetLiveAbility.name}'`);
            card.abilities = card.abilities.filter(a => typeof a === 'object'); // Clear dangling string references
            card.abilities.push(JSON.parse(JSON.stringify(targetLiveAbility)));
        }
    };

    // Dynamically load from catalog
    const dummyCard = getCard('Target Dummy', fallbackDummy);
    
    // Force-inject Attack onto the dummy so it can be provoked, even if your catalog version lacks it
    if (!dummyCard.abilities) dummyCard.abilities = [];
    if (!dummyCard.abilities.some(a => (a.abilityId || a) === standardAttack.abilityId || a.name === 'Attack')) {
        dummyCard.abilities.push(standardAttack);
    }
    // Force inject strength so it can actually deal damage when provoked
    if (dummyCard.strength === null || dummyCard.strength === undefined) {
        dummyCard.strength = 1;
    }

    const shovelCard = getCard('Skull Shovel', fallbackShovel);
    
    const liveTauntAbility = getAbility('Taunting Call', fallbackTauntAbility);
    const tauntingCallCard = getCard('Taunting Call', fallbackTaunt);
    autoHealCard(tauntingCallCard, liveTauntAbility);

    const butcherCard = getCard('Butcher', fallbackDummy);
    const riseAndServeCard = getCard('Rise and Serve', fallbackDummy);

    let isAvatarTest = type === 'card' && itemData && itemData.type === 'avatar';
    
    let card;
    let deckCards = [];
    let deckAvatar = null;

    if (type === 'deck') {
        const fullDeck = JSON.parse(JSON.stringify(itemData));
        const avatarIdx = fullDeck.findIndex(c => c.type === 'avatar');
        if (avatarIdx > -1) {
            deckAvatar = fullDeck.splice(avatarIdx, 1)[0];
        }
        deckCards = fullDeck;
        card = dummyCard;
    } else if (isAvatarTest) {
        deckAvatar = JSON.parse(JSON.stringify(itemData));
        if (deckAvatar.abilities) {
            deckAvatar.abilities = deckAvatar.abilities.map(ab => {
                const abId = typeof ab === 'string' ? ab : (ab.abilityId || ab.id);
                const match = abs.find(a => a.abilityId === abId);
                return match ? JSON.parse(JSON.stringify(match)) : ab;
            }).filter(Boolean);
        }
        
        let loadedDeck = [];
        try {
            const lastDeckName = localStorage.getItem('henchies_last_deck');
            const usernameForFetch = localStorage.getItem('henchies_last_username');
            
            if (lastDeckName && usernameForFetch) {
                console.log(`[SANDBOX] Avatar Test Mode: Attempting to use deck: ${lastDeckName}`);
                const userDecks = await fetchUserDecks(usernameForFetch);
                if (userDecks && userDecks[lastDeckName] && userDecks[lastDeckName].deckData) {
                    const rawRefs = userDecks[lastDeckName].deckData;
                    loadedDeck = rawRefs.map(ref => {
                        const cid = ref.id || ref;
                        const found = allCards.find(c => c.id === cid);
                        if (found) {
                            const clone = JSON.parse(JSON.stringify(found));
                            if (clone.abilities) {
                                clone.abilities = clone.abilities.map(ab => {
                                    const abId = typeof ab === 'string' ? ab : (ab.abilityId || ab.id);
                                    const match = abs.find(a => a.abilityId === abId);
                                    return match ? JSON.parse(JSON.stringify(match)) : null;
                                }).filter(Boolean);
                            }
                            return clone;
                        }
                        return null;
                    }).filter(Boolean);
                }
            }
        } catch(e) {
            console.warn("[SANDBOX] Failed to load real deck for Avatar test:", e);
        }
        
        if (loadedDeck.length > 0) {
            deckCards = loadedDeck.filter(c => c.type !== 'avatar');
            console.log(`[SANDBOX] Successfully loaded ${deckCards.length} standard cards from user deck.`);
        } else {
            console.log(`[SANDBOX] Falling back to dummy deck.`);
            for (let i = 0; i < 15; i++) { deckCards.push(JSON.parse(JSON.stringify(dummyCard))); }
            for (let i = 0; i < 5; i++) { deckCards.push(JSON.parse(JSON.stringify(shovelCard))); }
            deckCards.push(JSON.parse(JSON.stringify(butcherCard)));
        }
        
        card = dummyCard; 
    } else if (type === 'ability') {
        card = JSON.parse(JSON.stringify(dummyCard));
        card.id = 'test_card';
        card.name = 'Test Dummy';
        card.abilities = [itemData, standardAttack];
        card.description = itemData.name + ' test wrapper.';
    } else {
        card = JSON.parse(JSON.stringify(itemData));
        if (card.abilities) {
            card.abilities = card.abilities.map(ab => {
                const abId = typeof ab === 'string' ? ab : (ab.abilityId || ab.id);
                const match = abs.find(a => a.abilityId === abId);
                return match ? JSON.parse(JSON.stringify(match)) : ab;
            }).filter(Boolean);
        }
    }

    const customTribes = await fetchCustomTribes();
    const p1Res = { 'Carnie': {current: 10, max: 10} };
    customTribes.forEach(t => {
        if (t.name !== 'Carnie' && t.name !== 'Generic') {
            p1Res[t.id] = {current: 10, max: 10};
        }
    });
    
    const state = {
        status: 'active',
        rngSeed: Math.floor(Math.random() * 4294967296),
        activePlayerId: 'player1',
        turnNumber: 1,
        turnPhase: 'ACTION_PHASE',
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

    if (type === 'deck' || isAvatarTest) {
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

        for (let i = 0; i < 5; i++) {
            if (state.players.player1.deck.length > 0) {
                state.players.player1.hand.push(state.players.player1.deck.pop());
            }
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
    } else {
        for(let i=0; i<5; i++) {
            state.players.player1.hand.push({...JSON.parse(JSON.stringify(card)), instanceId: 'h_'+i, readiness: 0, ownerId: 'player1', originalOwnerId: 'player1'});
        }
        
        // Add the Butcher to hand
        state.players.player1.hand.push({...JSON.parse(JSON.stringify(butcherCard)), instanceId: 'h_butcher_1', readiness: 0, ownerId: 'player1', originalOwnerId: 'player1'});
        state.players.player1.hand.push({...JSON.parse(JSON.stringify(butcherCard)), instanceId: 'h_butcher_2', readiness: 0, ownerId: 'player1', originalOwnerId: 'player1'});
        state.players.player1.hand.push({...JSON.parse(JSON.stringify(riseAndServeCard)), instanceId: 'h_rise_1', readiness: 0, ownerId: 'player1', originalOwnerId: 'player1'});

        for(let i=0; i<3; i++) {
            state.players.player1.hand.push({...JSON.parse(JSON.stringify(tauntingCallCard)), instanceId: 'h_taunt_' + i, readiness: 0, ownerId: 'player1', originalOwnerId: 'player1'});
        }

        state.players.player1.lines.avatar = [{ id: 'p1_avatar', instanceId: 'p1_av', type: 'avatar', name: 'Test Avatar', health: 30, maxHealth: 30, line: 'avatar', defaultLine: 'avatar', readiness: 1, ownerId: 'player1', originalOwnerId: 'player1' }];
    }

    state.players.player2.lines.avatar = [{ id: 'p2_avatar', instanceId: 'p2_av', type: 'avatar', name: 'Dummy Avatar', health: 30, maxHealth: 30, line: 'avatar', defaultLine: 'avatar', readiness: 1, ownerId: 'player2', originalOwnerId: 'player2' }];

    for(let i=0; i<5; i++) {
        state.players.player2.lines.front.push({...JSON.parse(JSON.stringify(dummyCard)), instanceId: 'e_dum_'+i, readiness: 1, line: 'front', defaultLine: 'front', ownerId: 'player2', originalOwnerId: 'player2'});
    }
    
    const stealthDummy = {...JSON.parse(JSON.stringify(dummyCard)), name: 'Stealth Dummy', instanceId: 'e_dum_stealth', readiness: 1, line: 'front', defaultLine: 'front', ownerId: 'player2', originalOwnerId: 'player2'};
    const realStealth = getAbility('Stealth', { abilityId: 'stealth_trait', name: 'Stealth', trigger: 'UNTRIGGERABLE', description: 'This unit has Stealth.' });
    stealthDummy.abilities = [realStealth, standardAttack];
    state.players.player2.lines.front.push(stealthDummy);

    state.players.player2.lines.front.push({...JSON.parse(JSON.stringify(dummyCard)), instanceId: 'e_dum_10', health: 10, maxHealth: 10, strength: 10, name: 'Big Dummy', readiness: 1, line: 'front', defaultLine: 'front', ownerId: 'player2', originalOwnerId: 'player2'});

    const friendlyDummy = {...JSON.parse(JSON.stringify(dummyCard)), name: 'Dazed Ally', instanceId: 'f_dum_1', readiness: 1, line: 'back', defaultLine: 'back', ownerId: 'player1', originalOwnerId: 'player1'};
    friendlyDummy.abilities = [{ abilityId: 'dazed_trait', name: 'Dazed', trigger: 'UNTRIGGERABLE', description: 'This unit is Dazed.' }, standardAttack];
    const shovelInst = {...JSON.parse(JSON.stringify(shovelCard)), instanceId: 'f_shovel_1', ownerId: 'player1', readiness: 1};
    friendlyDummy.attachments = [shovelInst];
    state.players.player1.lines.back.push(friendlyDummy);

    const roomId = 'TEST_' + Date.now();
    state.gameId = roomId;
    state.turn_start_state = JSON.stringify(state);

    await createGameRoom(roomId, state);
    
    const isStudio = window.location.pathname.includes('/studios/');
    const gamePath = isStudio ? '../game.html' : 'game.html';
    
    window.open(`${gamePath}#test_${roomId}`, '_blank');
}