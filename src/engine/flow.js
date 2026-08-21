// filepath: src/engine/flow.js
/**
 * src/engine/flow.js
 * Top-level player actions and turn progression flow.
 */

import { GameEngine } from './index.js';
import { getAvatar, resolveResourceKey, LINES, CARD_CATALOG, hasEngineFlag } from './utils.js';
import { HarvestAction, PlayAction, sweepTurnEffects } from './actions/index.js';
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

export function startTurn(state, engine) {
    const pId = state.activePlayerId;
    const player = state.players[pId];
    
    state.abilityUses = {}; 
    
    if (!player.setupComplete) {
        player.setupComplete = true;

        if (player.unplayedAvatar) {
            player.lines.avatar.push(player.unplayedAvatar);
            delete player.unplayedAvatar;
        }

        if (player.unplayedDeck) {
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
            
            const initialDrawCount = pId === 'player1' ? 4 : 5;
            for (let i = 0; i < initialDrawCount; i++) {
                if (player.deck.length > 0) {
                    const card = player.deck.pop();
                    card.readiness = 0;
                    player.hand.push(card);
                }
            }
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
            if (dummy.health === undefined) dummy.health = dummy.maxHealth || 1;
            if (!player.lines['front']) player.lines['front'] = [];
            player.lines['front'].push(dummy);
            
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

    if (player.resources) {
        for (const tribe in player.resources) {
            player.resources[tribe].current = player.resources[tribe].max;
        }
    }
    
    for (const line of LINES) {
        if (player.lines[line]) {
            player.lines[line].forEach(u => {
                let currentReadiness = Number(u.readiness);
                if (isNaN(currentReadiness)) currentReadiness = 0;
                if (currentReadiness < 1) u.readiness = currentReadiness + 1;
                u.acts = u.maxActs !== undefined ? u.maxActs : 1;

                if (u.attachments) {
                    u.attachments.forEach(item => {
                        let ir = Number(item.readiness);
                        if (isNaN(ir)) ir = 0;
                        if (ir < 1) item.readiness = ir + 1;
                        item.acts = item.maxActs !== undefined ? item.maxActs : 1;
                    });
                }
            });
        }
    }

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
    
    if (player.discard) {
        player.discard.forEach(card => {
            if (card.type === 'unit' || card.type === 'equipment' || card.type === 'artifact') {
                card.acts = card.maxActs !== undefined ? card.maxActs : 1;
            }
        });
    }

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
    state.history_log.push({ text: `🌅 Turn ${state.turnNumber} begins for ${player.name}. Drew ${drawn} cards.`, depth: 0 });
    
    if (engine) {
        engine.emit('TURN_STARTING', { playerId: pId });
        engine.emit('TURN_STARTED', { playerId: pId });
    }

    if (pId === 'player2' && player.isAI) {
        state.history_log.push({ text: `⏭️ AI auto-skipped turn.`, depth: 0 });
        endTurn(state);
    }
}

export function executeSacrificeDecision(state, option, cardId) {
    state._actionDepth = 0; // Hard reset to prevent depth leaks from previous errors
    if (state.turnPhase !== 'SACRIFICE_DECISION') return;
    const player = state.players[state.activePlayerId];

    if (option === 'OPTION_A' && cardId) {
        const cardIndex = player.hand.findIndex(c => c.instanceId === cardId || c.id === cardId);
        if (cardIndex > -1) {
            const sacCard = player.hand[cardIndex];
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
        let found = false;
        for (const pId of ['player1', 'player2']) {
            const p = state.players[pId];
            for (const line of LINES) {
                if (p.lines[line]?.some(u => u.name === card.name || u.id === card.id)) {
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
        if (!found && state.equator?.some(i => i.name === card.name || i.id === card.id)) {
            found = true;
        }
        if (found) return { success: false, reason: "A unique copy of this entity is already on the board" };
    }

    let baseCost = typeof card.cost === 'object' ? (card.cost.tribeAmount > 0 ? card.cost.tribeAmount : (card.cost.carnie || card.cost.tent || 0)) : (card.cost || 0);
    let cTribe = resolveResourceKey(state, player, card.tribe);
    let carnieRes = player.resources['Carnie'] ? player.resources['Carnie'].current : 0;

    if (baseCost > 0) {
        if (cTribe === 'Carnie') {
            if (carnieRes < baseCost) return { success: false, reason: `Not enough Carnie (Need ${baseCost})` };
        } else {
            const tribeRes = player.resources[cTribe] ? player.resources[cTribe].current : 0;
            if (tribeRes < 1 && baseCost > 0) return { success: false, reason: `Must use at least 1 Tribe Resource for the card` };
            const maxCarnieConversion = Math.floor(carnieRes / 3);
            if (tribeRes + maxCarnieConversion < baseCost) return { success: false, reason: `Not enough resources (Need ${baseCost})` };
        }
    }

    if (card.abilities) {
        for (const ab of card.abilities) {
            if (['PLAY', 'PLAY_OPTIONAL', 'MODIFY_PLAY', 'ON_BE_PLAYED', 'PLAYED'].includes(ab.trigger) && ab.activation?.method === 'PLAYER_CHOICE') {
                const qt = ab.activation.quickTargeting;
                if (qt && qt.zones && qt.zones.includes('FIELD')) {
                    const oppId = playerId === 'player1' ? 'player2' : 'player1';
                    let targetFound = false;
                    if (qt.alignment?.includes('FRIENDLY') && LINES.some(l => state.players[playerId].lines[l]?.length > 0)) targetFound = true;
                    if (qt.alignment?.includes('ENEMY') && !targetFound && LINES.some(l => state.players[oppId].lines[l]?.length > 0)) targetFound = true;
                    if (!targetFound) return { success: false, reason: "No valid targets on the board for mandatory ability." };
                }
            }
        }
    }
    return { success: true };
}

export function playCard(state, playerId, cardId, targetLine = 'back', chosenAbilityId = null, abilityTargetId = null) {
    state._actionDepth = 0; // Hard reset to prevent depth leaks from previous errors
    const player = state.players[playerId];
    const cardIdx = player.hand.findIndex(c => c.instanceId === cardId || c.id === cardId);
    if (cardIdx === -1) return { success: false, reason: "Card not in hand" };
    const card = player.hand[cardIdx];

    if (hasEngineFlag(state, card, 'UNIQUE_ENTITY')) {
        let found = false;
        for (const pId of ['player1', 'player2']) {
            const p = state.players[pId];
            for (const line of LINES) {
                if (p.lines[line]?.some(u => u.name === card.name || u.id === card.id)) {
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
        if (!found && state.equator?.some(i => i.name === card.name || i.id === card.id)) {
            found = true;
        }
        if (found) return { success: false, reason: "A unique copy of this entity is already on the board" };
    }

    let baseCost = typeof card.cost === 'object' ? (card.cost.tribeAmount > 0 ? card.cost.tribeAmount : (card.cost.carnie || card.cost.tent || 0)) : (card.cost || 0);
    let cTribe = resolveResourceKey(state, player, card.tribe);
    let carnieRes = player.resources['Carnie'] ? player.resources['Carnie'].current : 0;

    if (baseCost > 0) {
        if (cTribe === 'Carnie') {
            if (carnieRes < baseCost) return { success: false, reason: `Not enough Carnie (Need ${baseCost})` };
        } else {
            const tribeRes = player.resources[cTribe] ? player.resources[cTribe].current : 0;
            if (tribeRes < 1 && baseCost > 0) return { success: false, reason: `Must use at least 1 Tribe Resource for the card` };
            const maxCarnieConversion = Math.floor(carnieRes / 3);
            if (tribeRes + maxCarnieConversion < baseCost) return { success: false, reason: `Not enough resources (Need ${baseCost})` };
        }
    }

    // Deduct ONLY baseCost. (executeAbility handles the optional abilityCost natively later in the action)
    if (baseCost > 0) {
        if (cTribe === 'Carnie') {
            player.resources['Carnie'].current -= baseCost;
        } else {
            const tribeRes = player.resources[cTribe] ? player.resources[cTribe].current : 0;
            let costRemaining = baseCost;
            let tribeResToUse = Math.min(tribeRes, costRemaining);
            costRemaining -= tribeResToUse;
            if (costRemaining > 0) player.resources['Carnie'].current -= (costRemaining * 3);
            if (cTribe) player.resources[cTribe].current -= tribeResToUse;
        }
    }

    const engine = new GameEngine(state);
    const action = new PlayAction({
        source: getAvatar(state, playerId),
        target: card,
        targetLine: targetLine,
        eventContext: { chosenAbilityId, abilityTargetId }
    });
    action.run(engine);
    return { success: true };
}

export function executeEntityAction(state, playerId, entityId, actionType, abilityId, targetId, targetLine) {
    state._actionDepth = 0; // Hard reset to prevent depth leaks from previous errors
    if (actionType === 'ABILITY' || actionType === 'ATTACK') {
        let entity = state.equator?.find(i => i.instanceId === entityId);
        if (!entity) {
            for (const line of LINES) {
                entity = state.players[playerId].lines[line]?.find(u => u.instanceId === entityId);
                if (entity) break;
            }
        }
        if (!entity) {
            entity = state.players[playerId].hand.find(c => c.instanceId === entityId || c.id === entityId);
        }
        if (!entity) return { success: false, reason: "Entity not found" };
        
        const ability = entity.abilities?.find(a => a.abilityId === abilityId);
        if (!ability) return { success: false, reason: "Ability not found" };

        const isHandAct = ability.passiveFlags?.includes('ACTIVATE_FROM_HAND') && ['hand', 'discard', 'deck'].some(z => state.players[playerId][z]?.some(c => c.instanceId === entity.instanceId));

        if (actionType === 'ABILITY' && !ability.cost?.freeAction && !isHandAct) {
            let currentActs = Number(entity.acts);
            if (isNaN(currentActs)) currentActs = 0;
            entity.acts = Math.max(0, currentActs - 1);
        }

        let targetEntity = null;
        if (targetId) {
            const p1 = state.players.player1;
            const p2 = state.players.player2;
            const allEntities = [
                ...Object.values(p1.lines).flat(), ...Object.values(p2.lines).flat(), ...(state.equator || []),
                ...p1.hand, ...p1.deck, ...p1.discard, ...p1.banish,
                ...p2.hand, ...p2.deck, ...p2.discard, ...p2.banish
            ].filter(Boolean);
            targetEntity = allEntities.find(e => e.id === targetId || e.instanceId === targetId);
        }

        const engine = new GameEngine(state);
        
        engine.emit('ON_ACT', { source: entity, eventContext: { abilityId, actionType, targetId } });

        engine.processingDepth = 1;
        engine.executeAbility(ability, entity, { target: targetEntity });
        return { success: true };
    }
    return { success: false, reason: "Unknown action" };
}