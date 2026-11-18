/**
 * src/engine/flow.js
 * Top-level player actions and turn progression flow.
 */

import { GameEngine } from './index.js';
import { getAvatar, resolveResourceKey, LINES, CARD_CATALOG, hasEngineFlag, isNameOrIdOnBoard, canAffordCost, payCost, findEntity, getAttackCost, queryState, normalizeEntityCooldownGroups, getAbilityCooldownGroup, hasUsedCooldownGroup, markCooldownGroupUsed, isAttackAbility, canReuseAbilityCooldownGroup } from './utils.js';
import { HarvestAction, PlayAction, sweepTurnEffects } from './actions/action_index.js';
import { generateId, shuffleArray } from './prandom.js';

export function endTurn(state) {
    const engine = new GameEngine(state);
    const prevPlayer = state.activePlayerId;

    engine.emit('TURN_ENDING', { playerId: prevPlayer });
    state.history_log.push({ text: `🏁 ${state.players[prevPlayer].name} ended their turn.`, depth: 0 });

    sweepTurnEffects(engine, prevPlayer);

    engine.emit('TURN_ENDED', { playerId: prevPlayer });

    state.activePlayerId = state.activePlayerId === 'player1' ? 'player2' : 'player1';
    if (state.activePlayerId === 'player1') state.turnNumber++;

    startTurn(state, engine);
}

function resetPlayerAbilityUses(state, playerId) {
    const ownedEntities = queryState(state, {
        players: ['player1', 'player2'],
        zones: ['ALL'],
        target: () => true,
        findAll: true,
        ownedBy: playerId
    }) || [];

    const resetEntity = entity => {
        if (!entity) return;
        normalizeEntityCooldownGroups(entity);
        if (entity.acts !== undefined) entity.acts = {};
        if (!state.abilityUses) return;
        entity.abilities?.forEach((ability, index) => {
            if (typeof ability === 'string') return;
            const abilityKey = ability.instanceId || (entity.instanceId && ability.abilityId
                ? `${entity.instanceId}_${ability.abilityId}_${index}`
                : null);
            if (abilityKey) delete state.abilityUses[abilityKey];
        });
    };

    for (const location of ownedEntities) {
        resetEntity(location.array[location.index]);
    }

    const player = state.players[playerId];
    if (player.avatar) resetEntity(player.avatar);
    if (player.unplayedAvatar) resetEntity(player.unplayedAvatar);
}

function resetPlayerReadiness(state, playerId) {
    for (const ownerId of ['player1', 'player2']) {
        const player = state.players[ownerId];

        for (const line of LINES) {
            player.lines[line]?.forEach(entity => {
                const entityOwner = entity.ownerId || ownerId;
                if (entityOwner === playerId) {
                    let readiness = Number(entity.readiness);
                    if (isNaN(readiness)) readiness = 0;
                    if (readiness < 1) entity.readiness = readiness + 1;
                }

                entity.attachments?.forEach(attachment => {
                    const attachmentOwner = attachment.ownerId || entityOwner;
                    if (attachmentOwner === playerId) {
                        let readiness = Number(attachment.readiness);
                        if (isNaN(readiness)) readiness = 0;
                        if (readiness < 1) attachment.readiness = readiness + 1;
                    }
                });
            });
        }
    }

    state.equator?.forEach(item => {
        if (item.ownerId === playerId || item.type === 'artifact') {
            let readiness = Number(item.readiness);
            if (isNaN(readiness)) readiness = 0;
            if (readiness < 1) item.readiness = readiness + 1;
        }
    });
}

export function startTurn(state, engine) {
    const pId = state.activePlayerId;
    const player = state.players[pId];
    const isFirstTurn = !player.setupComplete;
    let hasUnplayedDeck = false;

    if (!player.setupComplete) {
        player.setupComplete = true;

        if (player.unplayedAvatar) {
            player.lines.avatar.push(player.unplayedAvatar);
            delete player.unplayedAvatar;
        }

        if (player.unplayedDeck) {
            hasUnplayedDeck = true;
            player.deck = player.unplayedDeck;
            delete player.unplayedDeck;

            player.deck.forEach((c, i) => {
                if (!c.instanceId) {
                    c.instanceId = `${pId}_c_${generateId(state, 6)}_${i}`;
                    c.ownerId = pId;
                    c.originalOwnerId = pId;
                }
            });

            shuffleArray(state, player.deck);
        }

        const avatar = getAvatar(state, pId);
        if (avatar) {
            avatar.isDeployed = true;
            const tTribe = resolveResourceKey(state, player, avatar.tribe);
            if (tTribe !== 'Carnie' && tTribe !== 'Generic') {
                if (!player.resources[tTribe]) player.resources[tTribe] = { current: 0, max: 0 };
                player.resources[tTribe].max += 1;
            } else if (tTribe === 'Carnie') {
                player.resources['Carnie'].max += 1;
            }
        }

        if (pId === 'player2') {
            const catalogDummy = state.catalog?.find(c => c.id === 'target_dummy' || c.name === 'Target Dummy') || CARD_CATALOG.find(c => c.id === 'target_dummy' || c.name === 'Target Dummy');
            let dummy = catalogDummy ? JSON.parse(JSON.stringify(catalogDummy)) : {
                id: 'target_dummy', name: 'Target Dummy', type: 'unit', tribe: 'Robot', health: 1, maxHealth: 1, strength: 1, readiness: 0, abilities: []
            };
            dummy.instanceId = 'p2_dum_' + generateId(state, 6);
            dummy.ownerId = pId;
            dummy.originalOwnerId = pId;
            dummy.readiness = 0;
            dummy.defaultLine = 'mid';
            dummy.line = 'mid';
            if (dummy.health === undefined) dummy.health = dummy.maxHealth || 1;

            if (!player.lines.mid) player.lines.mid = [];
            player.lines.mid.push(dummy);

            if (player.isAI) {
                state.history_log.push({ text: `🤖 AI opponent deployed Avatar and summoned Target Dummy.`, depth: 0 });
            } else if (player.isDummy) {
                state.history_log.push({ text: `🤖 Dummy opponent deployed Avatar and summoned Target Dummy.`, depth: 0 });
            } else {
                state.history_log.push({ text: `👤 ${player.name} deployed their Avatar and summoned a Target Dummy.`, depth: 0 });
            }
        } else {
            state.history_log.push({ text: `👤 ${player.name} deployed their Avatar.`, depth: 0 });
        }
    }

    for (const pIdAll of ['player1', 'player2']) {
        const pScan = state.players[pIdAll];

        if (!pScan.avatar) {
            const av = getAvatar(state, pIdAll);
            if (av) {
                pScan.avatar = av;
            }
        }
    }

    resetPlayerReadiness(state, pId);

    state.turnPhase = 'SACRIFICE_DECISION';

    if (isFirstTurn && engine) {
        engine.emit('GAME_STARTING', { playerId: pId });
    }

    if (isFirstTurn && hasUnplayedDeck) {
        const openingHandSize = pId === 'player1' ? 4 : 5;
        while (player.hand.length < openingHandSize && player.deck.length > 0) {
            const card = player.deck.pop();
            card.readiness = 0;
            player.hand.push(card);
        }
    }

    if (engine) {
        console.trace('Emitting TURN_STARTING');
        engine.emit('TURN_STARTING', { playerId: pId });
    }

    let drawn = 0;
    for (let i = 0; i < 2; i++) {
        if (player.deck.length > 0) {
            const card = player.deck.pop();
            card.readiness = 0;
            player.hand.push(card);
            drawn++;
        }
    }

    if (player.resources) {
        for (const tribe in player.resources) {
            player.resources[tribe].current = player.resources[tribe].max;
        }
    }


    resetPlayerAbilityUses(state, pId);

    state.history_log.push({ text: `🌅 Turn ${state.turnNumber} begins for ${player.name}. Drew ${drawn} cards.`, depth: 0 });

    if (engine) {
        engine.emit('TURN_STARTED', { playerId: pId });
    }
}

export function executeSacrificeDecision(state, option, cardId) {
    state._actionDepth = 0;
    if (state.turnPhase !== 'SACRIFICE_DECISION') return;
    const player = state.players[state.activePlayerId];

    if (option === 'OPTION_A' && cardId) {
        const loc = queryState(state, { players: [state.activePlayerId], zones: ['hand'], target: { _fuzzyId: cardId } });
        if (loc) {
            const sacCard = loc.array[loc.index];
            const engine = new GameEngine(state);
            const avatar = getAvatar(state, state.activePlayerId);
            const harvest = new HarvestAction({ source: avatar, target: sacCard });
            harvest.run(engine);
        }
    } else {
        state.history_log.push({ text: `⏭️ ${player.name} skipped the Sacrifice Phase.`, depth: 0 });
    }
    state.turnPhase = 'ACTION_PHASE';
}

export function canPlayCard(state, playerId, card) {
    const player = state.players[playerId];
    if (!player) return { success: false, reason: "Player not found" };

    if (hasEngineFlag(state, card, 'UNIQUE_ENTITY')) {
        if (isNameOrIdOnBoard(state, playerId, card)) return { success: false, reason: "A unique copy of this entity is already on the board" };
    }

    const affordCheck = canAffordCost(state, player, card, card.cost, 0, true);
    if (!affordCheck.success) return affordCheck;

    if (card.abilities) {
        for (const ab of card.abilities) {
            if (['PLAY', 'MODIFY_PLAY', 'ON_BE_PLAYED', 'PLAYED'].includes(ab.trigger) && ab.activation?.method === 'PLAYER_CHOICE') {
                const qt = ab.activation.quickTargeting;
                if (qt && qt.zones && qt.zones.includes('FIELD')) {
                    const oppId = playerId === 'player1' ? 'player2' : 'player1';
                    let targetFound = false;

                    // Use queryState with a catch-all predicate to find ANY entity in the BOARD zones
                    if (qt.alignment?.includes('FRIENDLY') && queryState(state, { players: [playerId], zones: ['BOARD'], target: () => true })) targetFound = true;
                    if (qt.alignment?.includes('ENEMY') && !targetFound && queryState(state, { players: [oppId], zones: ['BOARD'], target: () => true })) targetFound = true;

                    if (!targetFound) return { success: false, reason: "No valid targets on the board for mandatory ability." };
                }
            }
        }
    }
    return { success: true };
}

export function playCard(state, playerId, cardId, targetLine = 'back', chosenAbilityId = null, abilityTargetId = null) {
    state._actionDepth = 0;
    const player = state.players[playerId];

    const loc = queryState(state, { players: [playerId], zones: ['hand'], target: { _fuzzyId: cardId } });
    if (!loc) return { success: false, reason: "Card not in hand" };
    const card = loc.array[loc.index];

    const playCheck = canPlayCard(state, playerId, card);
    if (!playCheck.success) return playCheck;

    payCost(state, player, card, card.cost, 0, true);

    const engine = new GameEngine(state);

    // Setup event context
    const eventContext = { chosenAbilityId, abilityTargetId, autocastAbilities: [] };

    // Before creating the PlayAction, find all ON_BE_PLAYED triggers that are NOT selectable
    // and store them in the context to be fired automatically during the event sequence.
    if (card.abilities) {
        eventContext.autocastAbilities = card.abilities.filter(ab =>
            ab.trigger === 'ON_BE_PLAYED' && !ab.isSelectable && ab.activation.method != 'PLAYER_CHOICE'
        );
    }

    const action = new PlayAction({
        source: getAvatar(state, playerId),
        target: card,
        targetLine: targetLine,
        eventContext: eventContext
    });
    action.run(engine);
    return { success: true };
}

export function executeEntityAction(state, playerId, entityId, actionType, abilityId, targetId, targetLine, abilityInstanceId = null) {
    state._actionDepth = 0;
    if (actionType === 'ABILITY' || actionType === 'ATTACK') {
        let entity = findEntity(state, playerId, entityId);
        if (!entity) return { success: false, reason: "Entity not found" };

        let ability = entity.abilities?.find(a =>
            a.abilityId === abilityId && (!abilityInstanceId || a.instanceId === abilityInstanceId)
        );
        if (abilityId === 'native_attack') {
            ability = {
                abilityId: 'native_attack',
                name: 'Attack',
                trigger: 'MANUAL',
                cost: getAttackCost(state, entity),
                effects: [{ targetMethod: 'EVENT_TARGET', payloads: [{ type: 'ATTACK' }] }]
            };
        }
        if (!ability) return { success: false, reason: "Ability not found" };

        const cooldownGroup = getAbilityCooldownGroup(ability);
        const consumesCooldown = actionType === 'ABILITY' &&
            ability.trigger === 'MANUAL' &&
            !ability.cost?.freeAction &&
            !isAttackAbility(ability);
        if (consumesCooldown &&
            hasUsedCooldownGroup(entity, cooldownGroup) &&
            !canReuseAbilityCooldownGroup(state, ability)) {
            return { success: false, reason: `Cooldown group '${cooldownGroup}' has already been used this turn` };
        }
        if (consumesCooldown) markCooldownGroupUsed(entity, cooldownGroup);

        let targetEntity = null;
        if (targetId) {
            const loc = queryState(state, { target: { _fuzzyId: targetId } });
            if (loc) targetEntity = loc.array[loc.index];
        }

        const engine = new GameEngine(state);
        engine.emit('ON_ACT', { source: entity, eventContext: { abilityId, actionType, targetId } });
        engine.processingDepth = 1;
        engine.executeAbility(ability, entity, { target: targetEntity });
        return { success: true };
    }
    return { success: false, reason: "Unknown action" };
}