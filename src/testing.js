import { createGameRoom, fetchCustomAbilities, fetchCustomCards } from './firebase.js';
import { CARD_CATALOG } from './engine.js';

export async function launchSandboxMatch(itemData, type = 'card') {
    const abs = await fetchCustomAbilities();
    let standardAttack = abs.find(a => a.name === 'Attack' || a.abilityId === 'ability_1785516184176');
    if (!standardAttack) {
        standardAttack = {"abilityId":"ability_dummy_attack","name":"Attack","trigger":"MANUAL","cost":{"readinessCost":"EXHAUSTS"},"activation":{"method":"PLAYER_CHOICE","quickTargeting":{"zones":["FIELD"],"alignment":["ENEMY"],"entityType":["UNIT","AVATAR"],"ignoreBattlelines":false}},"effects":[{"targetMethod":"SAME_AS_ACTIVATION","targetCount":1,"payloads":[{"type":"ATTACK","duration":"INSTANT"}]}]};
    }

    const dummyCard = {"id":"custom_1785272139394","name":"Target Dummy","tribe":"Carnie","type":"unit","genus":"Generic","cost":1,"health":1,"maxHealth":1,"strength":1,"description":"","artUrl":"","abilities":[standardAttack],"defaultLine":"mid"};
    const shovelCard = {"id":"card_1785786111173","name":"Skull Shovel","tribe":"Undead","type":"equipment","genus":"Generic","cost":1,"health":1,"maxHealth":1,"strength":null,"description":"","artUrl":"","abilities":[{"cost":{"carnie":0,"readinessCost":"NONE","tribeAmount":0,"reuseIgnoresReadiness":false},"activation":{"quickTargeting":{"entityType":["UNIT"],"ignoreBattlelines":true,"alignment":["FRIENDLY"],"zones":["FIELD"]},"logicTree":{"type":"group","logicalOperator":"AND","children":[]},"method":"PLAYER_CHOICE"},"effects":[{"payloads":[{"type":"ATTACH","invertRoles":true,"duration":"INDEFINITE"}],"targetCount":1,"targetMethod":"SAME_AS_ACTIVATION","logicTree":{"children":[],"type":"group","logicalOperator":"AND"},"quickTargeting":{"zones":["FIELD"],"alignment":["ENEMY"],"ignoreBattlelines":true,"entityType":["UNIT","AVATAR"]}}],"abilityId":"ability_1785760109406","description":"","name":"Equip on play","trigger":"ON_BE_PLAYED","triggerLimit":"UNLIMITED","displayDescription":"When played, attach to a chosen ally (indefinite)."},{"description":"","name":"Equip","triggerScope":"PERSONAL","additionalTriggers":[],"triggerLimit":"UNLIMITED","effects":[{"logicTree":{"children":[],"type":"group","logicalOperator":"AND"},"targetMethod":"SAME_AS_ACTIVATION","targetCount":1,"payloads":[{"duration":"INDEFINITE","type":"ATTACH","invertRoles":true}],"quickTargeting":{"alignment":["ENEMY"],"entityType":["UNIT","AVATAR"],"ignoreBattlelines":true,"zones":["FIELD"]}}],"trigger":"MANUAL","activation":{"logicTree":{"type":"group","logicalOperator":"AND","children":[]},"method":"PLAYER_CHOICE","quickTargeting":{"ignoreBattlelines":false,"zones":["FIELD"],"entityType":["UNIT"],"alignment":["FRIENDLY"]}},"abilityId":"ability_1785782572054","cost":{"reuseIgnoresReadiness":false,"carnie":2,"tribeAmount":0,"readinessCost":"NONE"},"displayDescription":"Attach to a chosen ally (indefinite)."},{"name":"Grant Dig","triggerLimit":"UNLIMITED","effects":[{"targetMethod":"SAME_AS_ACTIVATION","targetCount":1,"payloads":[{"type":"GRANT_ABILITY","duration":"WHILE_ATTACHED","grantedAbilityId":"ability_1785512849923"}],"quickTargeting":{"zones":["FIELD"],"ignoreBattlelines":false,"entityType":["UNIT","AVATAR"],"alignment":["ENEMY"]},"logicTree":{"children":[],"logicalOperator":"AND","type":"group"}}],"activation":{"quickTargeting":{"zones":["FIELD"],"entityType":["UNIT","AVATAR"],"ignoreBattlelines":false,"alignment":["ENEMY"]},"method":"NONE","logicTree":{"logicalOperator":"AND","children":[],"type":"group"}},"trigger":"ON_BE_ATTACHED","description":"","abilityId":"ability_1785795705988","cost":{"carnie":0,"reuseIgnoresReadiness":false,"readinessCost":"NONE","tribeAmount":0},"displayDescription":"When attached, grant ability 'Dig' to the triggered entity (while attached)."}]};

    let card;
    if (type === 'ability') {
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

    const username = localStorage.getItem('henchies_last_username') || 'Tester';

    const allTribes = ['Carnie', 'Robot', 'Mythic', 'Elemental', 'Pirate', 'Undead', 'Viking', 'Ninja', 'Stalker', 'Alien', 'Luchador', 'Generic'];
    const p1Res = {};
    allTribes.forEach(t => p1Res[t] = {current: 10, max: 10});
    
    // Look up Butcher from catalog
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
    const butcherCard = allCards.find(c => c.name.toLowerCase() === 'butcher') || dummyCard;
    const riseAndServeCard = allCards.find(c => c.name.toLowerCase() === 'rise and serve') || dummyCard;

    const state = {
        status: 'active',
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

    for(let i=0; i<5; i++) {
        state.players.player1.hand.push({...JSON.parse(JSON.stringify(card)), instanceId: 'h_'+i, readiness: 0, ownerId: 'player1', originalOwnerId: 'player1'});
    }
    
    // Add the Butcher to hand
    state.players.player1.hand.push({...JSON.parse(JSON.stringify(butcherCard)), instanceId: 'h_butcher_1', readiness: 0, ownerId: 'player1', originalOwnerId: 'player1'});
    state.players.player1.hand.push({...JSON.parse(JSON.stringify(butcherCard)), instanceId: 'h_butcher_2', readiness: 0, ownerId: 'player1', originalOwnerId: 'player1'});
    state.players.player1.hand.push({...JSON.parse(JSON.stringify(riseAndServeCard)), instanceId: 'h_rise_1', readiness: 0, ownerId: 'player1', originalOwnerId: 'player1'});

    state.players.player1.lines.avatar = [{ id: 'p1_avatar', instanceId: 'p1_av', type: 'avatar', name: 'Test Avatar', health: 30, maxHealth: 30, line: 'avatar', defaultLine: 'avatar', readiness: 1, ownerId: 'player1', originalOwnerId: 'player1' }];
    state.players.player2.lines.avatar = [{ id: 'p2_avatar', instanceId: 'p2_av', type: 'avatar', name: 'Dummy Avatar', health: 30, maxHealth: 30, line: 'avatar', defaultLine: 'avatar', readiness: 1, ownerId: 'player2', originalOwnerId: 'player2' }];

    for(let i=0; i<5; i++) {
        state.players.player2.lines.front.push({...JSON.parse(JSON.stringify(dummyCard)), instanceId: 'e_dum_'+i, readiness: 1, line: 'front', defaultLine: 'front', ownerId: 'player2', originalOwnerId: 'player2'});
    }
    
    const stealthDummy = {...JSON.parse(JSON.stringify(dummyCard)), name: 'Stealth Dummy', instanceId: 'e_dum_stealth', readiness: 1, line: 'front', defaultLine: 'front', ownerId: 'player2', originalOwnerId: 'player2'};
    stealthDummy.traits = ['Stealth'];
    const realStealth = abs.find(a => a.name && a.name.toLowerCase() === 'stealth') || { abilityId: 'stealth_trait', name: 'Stealth', trigger: 'UNTRIGGERABLE', description: 'This unit has Stealth.' };
    stealthDummy.abilities = [realStealth, standardAttack];
    state.players.player2.lines.front.push(stealthDummy);

    state.players.player2.lines.front.push({...JSON.parse(JSON.stringify(dummyCard)), instanceId: 'e_dum_10', health: 10, maxHealth: 10, strength: 10, name: 'Big Dummy', readiness: 1, line: 'front', defaultLine: 'front', ownerId: 'player2', originalOwnerId: 'player2'});

    const friendlyDummy = {...JSON.parse(JSON.stringify(dummyCard)), name: 'Dazed Ally', instanceId: 'f_dum_1', readiness: 1, line: 'back', defaultLine: 'back', ownerId: 'player1', originalOwnerId: 'player1'};
    friendlyDummy.traits = ['Dazed'];
    friendlyDummy.abilities = [{ abilityId: 'dazed_trait', name: 'Dazed', trigger: 'UNTRIGGERABLE', description: 'This unit is Dazed.' }, standardAttack];
    const shovelInst = {...JSON.parse(JSON.stringify(shovelCard)), instanceId: 'f_shovel_1', ownerId: 'player1', readiness: 1};
    friendlyDummy.attachments = [shovelInst];
    state.players.player1.lines.back.push(friendlyDummy);

    const roomId = 'TEST_' + Date.now();
    state.gameId = roomId;
    state.turn_start_state = JSON.stringify(state);

    await createGameRoom(roomId, state);
    
    window.open(`game.html#test_${roomId}`, '_blank');
}