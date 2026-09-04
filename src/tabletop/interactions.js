import { ClientState } from './client_state.js';
import { updateUI } from './renderer.js';
import { pushActionToLog } from '../firebase.js';
import { playCard, executeEntityAction, endTurn, executeSacrificeDecision, getValidAbilityTargets, getValidAttackTargets, getEntityAvailableActions, LINES, canPlayCard, isUndoable } from '../engine/index.js';
import { showToast } from '../ui.js';
import { reconstructStateFromLog } from './multiplayer.js';
import { RandomAI } from '../ai/random.js';
import { PassAI } from '../ai/pass.js';
import { normalizeActionType } from '../../components/action_button_theme.js';

function findClientEntity(entityId) {
    let entity = ClientState.gameState.equator?.find(i => i.instanceId === entityId);
    if (entity) return entity;
    for (const pId of ['player1', 'player2']) {
        for (const l of LINES) {
            entity = ClientState.gameState.players[pId].lines[l]?.find(u => u.instanceId === entityId);
            if (entity) return entity;
        }
        entity = ClientState.gameState.players[pId].hand.find(c => c.instanceId === entityId || c.id === entityId);
        if (entity) return entity;
    }
    return null;
}

function resolveTargetLine(targetId) {
    const el = document.querySelector(`game-card[data-instance-id="${targetId}"]`);
    const lineDiv = el ? el.closest('[id^="opp-line-"], [id^="player-line-"]') : null;
    return lineDiv ? lineDiv.id.split('-').pop() : 'mid';
}

function isDefaultPlayTrigger(ab) {
    const trigger = ab?.trigger || 'MANUAL';
    if (trigger === 'PLAY_OPTIONAL') return false;
    if (trigger === 'MANUAL' && ab?.passiveFlags?.includes('ACTIVATE_FROM_HAND')) return false;
    if (ab?.activation?.method === 'PLAYER_CHOICE') return false;
    return ['PLAY', 'ON_PLAY', 'ON_BE_PLAYED', 'PLAYED', 'MODIFY_PLAY', 'WOULD_PLAY', 'WOULD_BE_PLAYED'].includes(trigger);
}

function checkDefaultPlaySafety(card) {
    if (!card?.abilities) return false;
    for (const ab of card.abilities) {
        if (isDefaultPlayTrigger(ab) && !isUndoable(ClientState.gameState, ab)) return true;
    }
    return false;
}

export async function dispatchAbility(entityId, abilityId, targetId, targetLine) {
    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
    ClientState.gameState.lastRealActionIndex = ClientState.gameState.actionIndex;
    
    const entity = findClientEntity(entityId);
    const ability = entity?.abilities?.find(a => a.abilityId === abilityId);
    const isAttack = abilityId === 'native_attack' || ability?.effects?.some(g => g.payloads?.some(p => p.type === 'ATTACK'));
    const actionType = isAttack ? 'ATTACK' : 'ABILITY';
    
    ClientState.gameState._irreversibleActionOccurred = false;
    const result = executeEntityAction(ClientState.gameState, ClientState.localPlayerRole, entityId, actionType, abilityId, targetId, targetLine);
    const isUnsafe = (ability ? !isUndoable(ClientState.gameState, ability) : false) || ClientState.gameState._irreversibleActionOccurred;

    const payload = { type: 'ENTITY_ACTION', actionIndex: ClientState.gameState.actionIndex, playerId: ClientState.localPlayerRole, entityId, actionType, abilityId, targetId, targetLine, isUnsafe };
    
    if (result && result.success) {
        showToast('Ability Activated!', 'success');
        await pushActionToLog(ClientState.roomCode, payload, null, ClientState.gameState.history_log);
        window._isDragging = false;
        updateUI();
    } else {
        showToast(result?.reason || 'Failed to activate ability', 'error');
    }
}

export async function dispatchSacrificeDecision(option, cardId = null) {
    if (!ClientState.isMyTurn()) return;
    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
    ClientState.gameState.lastRealActionIndex = ClientState.gameState.actionIndex;
    
    executeSacrificeDecision(ClientState.gameState, option, cardId);
    const payload = { type: 'SACRIFICE_DECISION', option, cardId, actionIndex: ClientState.gameState.actionIndex, isUnsafe: false };
    
    ClientState.selectedCardId = null;
    await pushActionToLog(ClientState.roomCode, payload, null, ClientState.gameState.history_log);
    updateUI();
}

export async function handleEndTurn() {
    if (!ClientState.isMyTurn()) return;
    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
    ClientState.gameState.lastRealActionIndex = ClientState.gameState.actionIndex;
    
    endTurn(ClientState.gameState);
    const payload = { type: 'END_TURN', actionIndex: ClientState.gameState.actionIndex, isUnsafe: true };
    const snapshot = JSON.stringify(ClientState.gameState);
    
    await pushActionToLog(ClientState.roomCode, payload, snapshot, ClientState.gameState.history_log);
    updateUI();
}

export async function executeNormalPlay(cardId, chosenAbilityId = null, abilityTargetId = null) {
    closeUnitActionModal();
    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
    ClientState.gameState.lastRealActionIndex = ClientState.gameState.actionIndex;
    
    const card = findClientEntity(cardId);
    ClientState.gameState._irreversibleActionOccurred = false;
    
    const result = playCard(ClientState.gameState, ClientState.localPlayerRole, cardId, 'back', chosenAbilityId, abilityTargetId);
    
    const ability = chosenAbilityId ? card?.abilities?.find(a => a.abilityId === chosenAbilityId) : null;
    const isUnsafe = (ability ? !isUndoable(ClientState.gameState, ability) : checkDefaultPlaySafety(card)) || ClientState.gameState._irreversibleActionOccurred;

    const payload = { type: 'PLAY_CARD', actionIndex: ClientState.gameState.actionIndex, playerId: ClientState.localPlayerRole, cardId, targetLine: 'back', chosenAbilityId, abilityTargetId, isUnsafe };

    if (result.success) {
        ClientState.selectedCardId = null;
        await pushActionToLog(ClientState.roomCode, payload, null, ClientState.gameState.history_log);
        window._isDragging = false;
        updateUI();
    } else {
        showToast(result.reason, 'error');
    }
}
window.executeNormalPlay = executeNormalPlay;

let isProcessingUndo = false;

export async function handleUndo() {
    if (!ClientState.isMyTurn() || isProcessingUndo) return;
    if (ClientState.gameState.rules && ClientState.gameState.rules?.allowUndo === false) return;
    
    const targetIdx = ClientState.gameState.lastRealActionIndex;
    if (!targetIdx || targetIdx <= ClientState.lastSafeUndoIndex) {
        showToast('No safe actions to undo.', 'error');
        return;
    }

    isProcessingUndo = true;
    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
    const payload = { type: 'UNDO', targetIndex: targetIdx, actionIndex: ClientState.gameState.actionIndex };
    
    window._isDragging = false;
    showToast('Rewinding action...', 'info');
    await pushActionToLog(ClientState.roomCode, payload, null, ClientState.gameState.history_log);
    isProcessingUndo = false;
}

export async function handleRestartMatch() {
    if (!ClientState.roomCode.toUpperCase().startsWith('TEST_')) return;
    if (!ClientState.localReplayStates || ClientState.localReplayStates.length === 0) {
        showToast('Cannot restart: No initial state found.', 'error');
        return;
    }

    const pristine = ClientState.localReplayStates[0];
    const payload = {
        gameId: ClientState.roomCode, status: pristine.status || 'active', turnNumber: pristine.turnNumber || 1,
        activePlayerId: pristine.activePlayerId || 'player1', turnPhase: pristine.turnPhase || 'ACTION_PHASE',
        players: { player1Name: pristine.players?.player1?.name || 'Player 1', player2Name: pristine.players?.player2?.name || 'Player 2' },
        turn_start_state: JSON.stringify(pristine), action_log: [], history_log: pristine.history_log || ['Test match restarted.'],
        updatedAt: Date.now()
    };
    
    localStorage.setItem(`henchies_game_${ClientState.roomCode}`, JSON.stringify(payload));
    ClientState.selectedCardId = null;
    ClientState.pendingAbility = null;
    ClientState.validTargets = [];
    ClientState.replayStepIndex = 0;
    
    reconstructStateFromLog(payload);
    showToast('Match restarted!', 'success');
}

export async function handleForfeitInGame() {
    if (!confirm("Are you sure you want to forfeit this match?")) return;
    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
    ClientState.gameState.lastRealActionIndex = ClientState.gameState.actionIndex;
    
    const payload = { type: 'FORFEIT', playerId: ClientState.localPlayerRole, playerName: ClientState.gameState.players[ClientState.localPlayerRole].name, actionIndex: ClientState.gameState.actionIndex };
    await pushActionToLog(ClientState.roomCode, payload, null, ClientState.gameState.history_log);
    showToast("You have forfeited the match.", "info");
}

window.handleRestartMatch = handleRestartMatch;
window.handleForfeitInGame = handleForfeitInGame;
window.handleUndo = handleUndo;
window.handleEndTurn = handleEndTurn;
export const handleSacrificeConfirm = async () => {
    if (!ClientState.isMyTurn() || !ClientState.selectedCardId) {
        showToast('Please select a card to sacrifice!', 'error');
        return;
    }
    dispatchSacrificeDecision('OPTION_A', ClientState.selectedCardId);
};

export function buildCardActions(cardId, card) {
    if (!card) return [];
    const state = ClientState.gameState;
    const playerId = ClientState.localPlayerRole;
    const legalActions = [];
    
    console.log(`\n[DEBUG-TARGETS] === Checking Card: ${card.name} (${cardId}) ===`);

    const engineActions = getEntityAvailableActions(state, playerId, cardId);
    console.log(`[DEBUG-TARGETS] Engine Available Actions:`, engineActions);

    engineActions.forEach(action => {
        // Handle the Engine's native play action
        if (action.abilityId === 'native_play') {
            console.log(`[DEBUG-TARGETS] -> Pushing Engine PLAY_BOARD action (Play Normally).`);
            legalActions.push({
                type: 'PLAY_BOARD', name: 'Play Normally', abilityId: 'native_play', actionType: 'PLAY_BOARD',
                validTargets: [], undoable: !checkDefaultPlaySafety(card), cost: action.cost
            });
            return; // Skip standard ability processing
        }

        const ab = card.abilities?.find(a => a.abilityId === action.abilityId);
        const requiresTarget = ab?.activation?.method === 'PLAYER_CHOICE';
        const validTargets = requiresTarget ? getValidAbilityTargets(state, playerId, cardId, action.abilityId).map(t => t.id) : [];

        console.log(`[DEBUG-TARGETS] -> Pushing Engine Action [${action.name}]. Needs target: ${requiresTarget}, Valid count: ${validTargets.length}`);

        const isPlay = ['PLAY', 'PLAY_OPTIONAL', 'ON_PLAY', 'ON_PLAY_OPTIONAL', 'MODIFY_PLAY', 'WOULD_PLAY'].includes(ab?.trigger);
        const resolvedType = isPlay 
            ? (requiresTarget ? 'PLAY_TARGET' : 'PLAY_BOARD') 
            : (requiresTarget ? 'ABILITY_TARGET' : 'ABILITY');

        legalActions.push({
            type: resolvedType, actionType: resolvedType,
            name: action.name, abilityId: action.abilityId, validTargets, undoable: action.undoable, cost: action.cost
        });
    });

    console.log(`[DEBUG-TARGETS] === Final Legal Actions Count: ${legalActions.length} ===\n`);
    return legalActions;
}

export function getCurrentPlayIntent(cardId, card) {
    const legalActions = buildCardActions(cardId, card);
    if (legalActions.length === 0) return { mode: 'none' };
    if (legalActions.length === 1) {
        return { mode: 'single', actionType: legalActions[0].actionType, abilityId: legalActions[0].abilityId, validTargets: legalActions[0].validTargets, action: legalActions[0] };
    }
    return { mode: 'multi', actions: legalActions, validTargets: [...new Set(legalActions.flatMap(a => a.validTargets || []))] };
}

function getDragPlayIntent(cardId, card) {
    return getCurrentPlayIntent(cardId, card);
}

function clearPendingAbility() {
    ClientState.pendingAbility = null;
    ClientState.validTargets = [];
    window._forceHoverCardId = null;
    updateUI();
    closeUnitActionModal();
}

function cancelTargeting(cardId) {
    showToast("Targeting cancelled.", "info");
    if (ClientState.pendingAbility && cardId === ClientState.pendingAbility.entityId) window._forceHoverCardId = cardId;
    else window._forceHoverCardId = null;
    clearPendingAbility();
}

function processPendingTarget(targetId) {
    if (ClientState.validTargets.some(t => t.id === targetId)) {
        if (ClientState.pendingAbility.isHandCard) {
            if (ClientState.pendingAbility.isHandActivate) {
                dispatchAbility(ClientState.pendingAbility.entityId, ClientState.pendingAbility.abilityId, targetId, 'hand');
            } else {
                window.executeNormalPlay(ClientState.pendingAbility.entityId, ClientState.pendingAbility.abilityId, targetId);
            }
        } else {
            const targetLine = resolveTargetLine(targetId);
            dispatchAbility(ClientState.pendingAbility.entityId, ClientState.pendingAbility.abilityId, targetId, targetLine);
        }
        clearPendingAbility();
    } else {
        cancelTargeting(targetId);
    }

    if (prefix === 'player' || prefix === 'equator') {
      if (ClientState.gameState.turnPhase === 'ACTION_PHASE') {
        const actions = getEntityAvailableActions(ClientState.gameState, ClientState.localPlayerRole, entityId);
        if (actions.length === 1) {
            window.activateAbility(entityId, actions[0].abilityId);
        } else if (actions.length > 1) {
          let entityName = "Unknown Entity";
          if (prefix === 'equator') {
              const eq = ClientState.gameState.equator.find(i => i.instanceId === entityId);
              if (eq) entityName = eq.name;
          } else {
            for (const l of LINES) {
              const u = ClientState.gameState.players[ClientState.localPlayerRole].lines[l]?.find(u => u.instanceId === entityId);
              if (u) { entityName = u.name; break; }
            }
          }
          
          window.openActionModal(entityId, entityName, actions, false);
        } else {
          let entity = null;
          if (prefix === 'equator') entity = ClientState.gameState.equator?.find(i => i.instanceId === entityId);
          else entity = ClientState.gameState.players[ClientState.localPlayerRole].lines[line]?.find(u => u.instanceId === entityId);
          if (entity) {
              const json = encodeURIComponent(JSON.stringify(entity)).replace(/'/g, "%27");
              window.inspectCard(json);
          }
        }
      }
    } else if (prefix === 'opp') {
      const oppRole = ClientState.localPlayerRole === 'player1' ? 'player2' : 'player1';
      const entity = ClientState.gameState.players[oppRole].lines[line]?.find(u => u.instanceId === entityId);
      if (entity) {
          const json = encodeURIComponent(JSON.stringify(entity)).replace(/'/g, "%27");
          window.inspectCard(json);
      }
    }
};

function maybeOpenZoneModal() {
    const uniqueZones = [...new Set(ClientState.validTargets.map(t => t.line))];
    const uniquePlayers = [...new Set(ClientState.validTargets.map(t => t.playerId))];
    if (uniqueZones.length === 1 && uniquePlayers.length === 1) {
        const z = uniqueZones[0];
        const p = uniquePlayers[0];
        const isLocalHand = (z === 'hand' && p === ClientState.localPlayerRole);
        if (['deck', 'discard', 'hand', 'banish'].includes(z) && !isLocalHand) {
            setTimeout(() => window.openZoneModal(p, z), 50);
        }
    }
}

window.handleZoneBadgeClick = (prefix, zone) => {
    if (window._isDragging || window._blockClick) return;
    const role = prefix === 'player' ? ClientState.localPlayerRole : (ClientState.localPlayerRole === 'player1' ? 'player2' : 'player1');
    window.openZoneModal(role, zone);
};

window.handleLineClick = async (clickedPrefix, line) => {
    if (window._isDragging || window._blockClick) return;
    if (typeof event !== 'undefined' && event) event.stopPropagation();
    if (ClientState.pendingAbility) cancelTargeting(null);
};

window.handleEntityClick = async (prefix, line, entityId) => {
    if (window._isDragging || window._blockClick) return;
    if (typeof event !== 'undefined' && event) event.stopPropagation();
    
    if (!ClientState.isMyTurn()) {
        const entity = findClientEntity(entityId);
        if (entity) window.inspectCard(encodeURIComponent(JSON.stringify(entity)).replace(/'/g, "%27"));
        return;
    }

    if (ClientState.pendingAbility) {
        processPendingTarget(entityId);
        return;
    }

    if (prefix === 'player' || prefix === 'equator') {
      if (ClientState.gameState.turnPhase === 'ACTION_PHASE') {
        const actions = getEntityAvailableActions(ClientState.gameState, ClientState.localPlayerRole, entityId);
        if (actions.length === 1) {
            window.activateAbility(entityId, actions[0].abilityId);
        } else if (actions.length > 1) {
          const entity = findClientEntity(entityId);
          window.openActionModal(entityId, entity?.name || "Unknown", actions, false);
        } else {
          const entity = findClientEntity(entityId);
          if (entity) window.inspectCard(encodeURIComponent(JSON.stringify(entity)).replace(/'/g, "%27"));
        }
      }
    } else if (prefix === 'opp') {
      const entity = findClientEntity(entityId);
      if (entity) window.inspectCard(encodeURIComponent(JSON.stringify(entity)).replace(/'/g, "%27"));
    }
};

window.handleHandCardClick = async (cardId) => {
    if (window._isDragging || window._blockClick) return;
    if (typeof event !== 'undefined' && event) event.stopPropagation();
    if (!ClientState.isMyTurn()) return;

    if (ClientState.gameState.turnPhase === 'SACRIFICE_DECISION') {
        ClientState.selectedCardId = ClientState.selectedCardId === cardId ? null : cardId;
        updateUI();
        return;
    }

    if (ClientState.pendingAbility) {
        processPendingTarget(cardId);
        return;
    }

    if (ClientState.gameState.turnPhase === 'ACTION_PHASE') {
        const card = findClientEntity(cardId);
        if (!card) return;

        const actions = buildCardActions(cardId, card);
        
        if (actions.length === 0) {
            showToast("Cannot play this card.", "error");
            return;
        }

        const canAffordAbility = (abCost) => {
            if (!abCost) return true;
            let reqCarnie = abCost.carnie || abCost.tent || 0;
            let reqTribe = abCost.tribeAmount || 0;
            
            if (reqCarnie === 0 && reqTribe === 0) return true;
            
            let availCarnie = simCarnie;
            let availTribe = simTribe;

            if (reqCarnie > 0) {
                if (availCarnie < reqCarnie) return false;
                availCarnie -= reqCarnie;
            }

            if (reqTribe > 0) {
                if (cTribe === 'Carnie') {
                    if (availCarnie < reqTribe) return false;
                } else {
                    let maxConversion = Math.floor(availCarnie / 3);
                    if ((availTribe + maxConversion) < reqTribe) return false;
                }
            }
            return true;
        };

        const playAbilities = c.abilities ? c.abilities.filter(ab => {
            const t = ab.trigger || 'MANUAL';
            const isPlayTrigger = ['PLAY', 'PLAY_OPTIONAL', 'MODIFY_PLAY', 'ON_PLAYED', 'ON_BE_PLAYED', 'WOULD_PLAY', 'WOULD_BE_PLAYED'].includes(t);
            const requiresTarget = ab.activation?.method === 'PLAYER_CHOICE';
            const hasTargets = requiresTarget ? getValidAbilityTargets(ClientState.gameState, ClientState.localPlayerRole, cardId, ab.abilityId).length > 0 : true;
            
            if (t === 'PLAY_OPTIONAL') {
                return canPlay && canAffordAbility(ab.cost) && hasTargets;
            }

            if (t === 'MANUAL' && ab.passiveFlags?.includes('ACTIVATE_FROM_HAND')) {
                // Hand activations don't require the card's base cost! We check base resources directly.
                if (!hasTargets) return false;
                
                let rawCarnie = player.resources['Carnie'] ? player.resources['Carnie'].current : 0;
                let rawTribe = (cTribe !== 'Carnie' && player.resources[cTribe]) ? player.resources[cTribe].current : 0;
                
                let reqCarnie = ab.cost?.carnie || ab.cost?.tent || 0;
                let reqTribe = ab.cost?.tribeAmount || 0;
                
                if (reqCarnie === 0 && reqTribe === 0) return true;
                
                if (reqCarnie > 0) {
                    if (rawCarnie < reqCarnie) return false;
                    rawCarnie -= reqCarnie;
                }
                
                if (reqTribe > 0) {
                    if (cTribe === 'Carnie') {
                        if (rawCarnie < reqTribe) return false;
                    } else {
                        let maxConversion = Math.floor(rawCarnie / 3);
                        if ((rawTribe + maxConversion) < reqTribe) return false;
                    }
                }
                return true;
            }
            
            return canPlay && isPlayTrigger && requiresTarget;
        }) : [];

        const hasMandatoryTarget = playAbilities.some(ab => ['PLAY', 'MODIFY_PLAY', 'ON_PLAYED', 'ON_BE_PLAYED'].includes(ab.trigger) && ab.activation?.method === 'PLAYER_CHOICE');
        const showPlayNormally = canPlay && !hasMandatoryTarget;

        if (playAbilities.length > 0 || canPlay) {
            const actions = [];
            
            if (showPlayNormally) {
                actions.push({ type: 'PLAY', name: 'Play Normally', undoable: !isPlayUnsafe(c, null), cost: c.cost });
            }

            playAbilities.forEach(ab => {
                actions.push({ type: 'ABILITY', name: ab.name, abilityId: ab.abilityId, undoable: isUndoable(ClientState.gameState, ab), cost: ab.cost });
            });
            
            if (actions.length === 1) {
                if (actions[0].type === 'PLAY') window.executeNormalPlay(cardId);
                else window.activateHandCardAbility(cardId, actions[0].abilityId);
            } else if (actions.length > 1) {
                window.openActionModal(cardId, c.name, actions, true);
            } else if (!canPlay) {
                showToast("Cannot play this card.", "error");
            }
        } else {
            window.openActionModal(cardId, card.name, actions, true);
        }
    }
};

window.openActionModal = (entityId, entityName, actions, isHand = false) => {
    ClientState.activeMenuEntityId = entityId;
    updateUI();
    const menu = document.querySelector('unit-action-modal');
    if (menu) menu.open(entityId, entityName, actions, isHand);
};

export const closeUnitActionModal = () => {
    ClientState.activeMenuEntityId = null;
    updateUI();
    const menu = document.querySelector('unit-action-modal');
    if (menu) menu.close();
};
window.closeUnitActionModal = closeUnitActionModal;

window.activateHandCardAbility = async (cardId, abilityId) => {
    if (typeof event !== 'undefined' && event) event.stopPropagation();
    const card = findClientEntity(cardId);
    if (!card) return;

    // 1. Data-Driven Lookup: Re-evaluate to get structured Action Objects
    const actions = buildCardActions(cardId, card);
    
    // Safely default null ability IDs (from cached UI) to native_play
    const targetAbilityId = abilityId || 'native_play';
    const action = actions.find(a => a.abilityId === targetAbilityId);

    if (!action) {
        console.warn(`[UI] Action '${targetAbilityId}' not found on ${card.name}.`);
        closeUnitActionModal();
        return;
    }

    const ability = card.abilities?.find(a => a.abilityId === action.abilityId);

    // 2. Principled Dispatch: Route entirely based on the derived action type
    if (action.actionType === 'PLAY_TARGET' || action.actionType === 'ABILITY_TARGET') {
        closeUnitActionModal();
        ClientState.validTargets = getValidAbilityTargets(ClientState.gameState, ClientState.localPlayerRole, cardId, action.abilityId);
        
        const isHandActivate = action.actionType === 'ABILITY_TARGET';
        ClientState.pendingAbility = { entityId: cardId, abilityId: action.abilityId, isHandCard: true, isHandActivate };
        
        showToast(`Select a target for ${ability?.name || action.name}`, 'info');
        updateUI();
        maybeOpenZoneModal();
        return;
    }

    closeUnitActionModal();
    
    if (action.actionType === 'PLAY_BOARD') {
        await window.executeNormalPlay(cardId, action.abilityId === 'native_play' ? null : action.abilityId);
    } else {
        dispatchAbility(cardId, action.abilityId, null, null);
    }
};

window.activateAbility = async (entityId, abilityId) => {
    if (typeof event !== 'undefined' && event) event.stopPropagation();
    if (!ClientState.isMyTurn()) return;
    
    const entity = findClientEntity(entityId);
    if (!entity) return;

    if (abilityId === 'native_attack') {
        closeUnitActionModal();
        ClientState.validTargets = getValidAttackTargets(ClientState.gameState, ClientState.localPlayerRole, entity);
        ClientState.pendingAbility = { entityId, abilityId };
        showToast(`Select a target to attack`, 'info');
        updateUI();
        return;
    }

    const ability = entity.abilities?.find(a => a.abilityId === abilityId);
    if (ability?.activation?.method === 'PLAYER_CHOICE') {
        closeUnitActionModal();
        ClientState.validTargets = getValidAbilityTargets(ClientState.gameState, ClientState.localPlayerRole, entityId, abilityId);
        ClientState.pendingAbility = { entityId, abilityId };
        showToast(`Select a target for ${ability.name}`, 'info');
        updateUI();
        maybeOpenZoneModal();
        return;
    }
    
    closeUnitActionModal();
    dispatchAbility(entityId, abilityId, null, null);
};


// ==========================================
// 🕹️ POINTER-AGNOSTIC STATE MACHINE
// ==========================================

let gestureState = {
    phase: 'IDLE', // 'IDLE', 'DOWN', 'SCRUBBING', 'DRAGGING'
    source: null,
    actionType: null,
    cardId: null,
    card: null,
    rect: null,
    targets: [],
    abilityId: null,
    gc: null,
    hoveredTarget: null,
    actions: [],
    modalShown: false,
    pointerType: null,
    startX: 0,
    startY: 0,
    pointerId: null
};
const DRAG_START_THRESHOLD = 8;

// Custom Long Press Tracking
let longPressTimer = null;
let longPressFired = false;
const LONG_PRESS_DURATION = 400; // 400ms hold triggers the inspector
const LONG_PRESS_TOLERANCE = 10; // Allow slight finger wiggles

function hardResetGestureState(e) {
    if (e && e.target && e.target.releasePointerCapture && gestureState.pointerId) {
        try { e.target.releasePointerCapture(gestureState.pointerId); } catch(err) {}
    }
    if (e && e.target && e.target.style) e.target.style.touchAction = '';

    gestureState = {
        phase: 'IDLE', source: null, actionType: null, cardId: null, card: null,
        rect: null, targets: [], abilityId: null, gc: null, hoveredTarget: null,
        actions: [], modalShown: false, pointerType: null, startX: 0, startY: 0, pointerId: null
    };
    window._isDragging = false;
    window._dragCardId = null;
    window._dragTargets = [];
}

function executeLongPress(cardId, e) {
    // 1. Force instantaneous cleanup of the Hover Manager to prevent stuck CSS transforms
    if (window.HoverManager) {
        window.HoverManager.stopScrub();
        window.HoverManager.handHoverId = null; 
        if (window.HoverManager.handHoverFrame) {
            cancelAnimationFrame(window.HoverManager.handHoverFrame);
            window.HoverManager.handHoverFrame = null;
        }
        window.HoverManager.refreshAllHandCards(); // Force immediate visual drop
    }
    
    window._forceHoverCardId = null;
    hideDragTether();
    clearTargetHighlights(gestureState?.targets);
    
    // 2. Open the Glossary/Inspector Modal
    const entity = findClientEntity(cardId);
    if (entity && window.inspectCard) {
        window.inspectCard(encodeURIComponent(JSON.stringify(entity)).replace(/'/g, "%27"));
    }
    
    // 3. Reset the gesture state machine so no drops or clicks fire on release
    hardResetGestureState(e);
    if (typeof updateUI === 'function') updateUI();
}

function getEventPoint(e) {
    return { x: e.clientX, y: e.clientY, type: e.pointerType || (e.touches ? 'touch' : 'mouse') };
}

function getTargetElement(targetId) {
    const el = document.querySelector(`[data-instance-id="${targetId}"]`);
    return el?.tagName.toLowerCase() === 'game-card' ? el.firstElementChild : el;
}

function clearTargetHighlights(targetIds = gestureState.targets) {
    (targetIds || []).forEach(tid => {
        const inner = getTargetElement(tid);
        if (inner) inner.classList.remove('ring-2', 'ring-4', 'ring-cyan-400', 'ring-cyan-500', 'ring-amber-400', 'z-20', 'cursor-pointer', 'shadow-[0_0_10px_rgba(34,211,238,0.35)]', 'shadow-[0_0_20px_rgba(34,211,238,0.6)]');
    });
}

function updateTargetHighlights(targetIds, hoveredTargetId = null) {
    (targetIds || []).forEach(tid => {
        const inner = getTargetElement(tid);
        if (!inner) return;
        const isHovered = tid === hoveredTargetId;
        inner.classList.toggle('ring-2', !isHovered);
        inner.classList.toggle('ring-4', isHovered);
        inner.classList.toggle('ring-cyan-400', !isHovered);
        inner.classList.toggle('ring-cyan-500', isHovered);
        inner.classList.toggle('ring-amber-400', false);
        inner.classList.toggle('z-20', true);
        inner.classList.toggle('cursor-pointer', true);
        inner.classList.toggle('shadow-[0_0_10px_rgba(34,211,238,0.35)]', !isHovered);
        inner.classList.toggle('shadow-[0_0_20px_rgba(34,211,238,0.6)]', isHovered);
    });
}

function setDragTether(clientX, clientY) {
    const overlay = document.getElementById('drag-tether-overlay');
    const line = document.getElementById('drag-tether-line');
    const head = document.getElementById('drag-tether-head');
    if (!overlay || !line || !head) return;

    // Dynamically track the live card element to ensure the tether anchors to it,
    // even if it has moved far upwards due to CSS drag transforms.
    let rect = gestureState.rect;
    if (gestureState.cardId) {
        const liveEl = document.querySelector(`game-card[data-instance-id="${gestureState.cardId}"]`);
        if (liveEl) {
            const inner = liveEl.firstElementChild || liveEl;
            rect = inner.getBoundingClientRect();
        }
    }

    // Gracefully handle any missing rects visually without drawing to top-left corner
    rect = rect || { left: clientX, top: clientY + 50, width: 0, height: 0 };
    
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const ctrlY = startY + (clientY - startY) / 2;

    line.setAttribute('d', `M ${startX},${startY} Q ${startX},${ctrlY} ${clientX},${clientY}`);
    head.setAttribute('cx', clientX);
    head.setAttribute('cy', clientY);
    overlay.classList.remove('hidden');

    if (gestureState.actionType === 'PLAY_BOARD') updateBoardPlayGlow(clientX, clientY, true);
}

function hideDragTether() {
    const overlay = document.getElementById('drag-tether-overlay');
    const board = document.getElementById('player-board');
    if (overlay) overlay.classList.add('hidden');
    if (board) {
        board.classList.remove('ring-2', 'ring-4', 'ring-cyan-400', 'ring-cyan-500', 'ring-amber-400', 'border-2', 'border-cyan-400', 'border-cyan-500', 'shadow-[0_0_10px_rgba(34,211,238,0.35)]', 'shadow-[0_0_16px_rgba(34,211,238,0.45)]', 'shadow-[0_0_20px_rgba(34,211,238,0.6)]', 'shadow-[0_0_30px_rgba(34,211,238,0.5)]', 'animate-pulse');
        board.classList.add('border-emerald-950/40');
    }
}

function findHoveredTarget(clientX, clientY, targetIds = gestureState.targets) {
    let hitTarget = null;
    targetIds.forEach(tid => {
        const inner = getTargetElement(tid);
        if (!inner) return;
        const tr = inner.getBoundingClientRect();
        if (clientX >= tr.left && clientX <= tr.right && clientY >= tr.top && clientY <= tr.bottom) hitTarget = tid;
    });
    return hitTarget;
}

function isPointInsideRect(clientX, clientY, rect) {
    if (!rect) return false;
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function isValidBoardPlayDrop(clientX, clientY) {
    const board = document.getElementById('player-board');
    return board ? isPointInsideRect(clientX, clientY, board.getBoundingClientRect()) : false;
}

function updateBoardPlayGlow(clientX, clientY, isDragging = false) {
    const board = document.getElementById('player-board');
    if (!board) return;

    const isValidHover = isValidBoardPlayDrop(clientX, clientY);
    const isMultiActionDrag = gestureState.actionType === 'MULTI_ACTION';
    const active = gestureState.actionType === 'PLAY_BOARD' || isDragging || isMultiActionDrag;

    board.classList.remove('ring-2', 'ring-4', 'ring-cyan-400', 'ring-cyan-500', 'ring-amber-400', 'border-cyan-400', 'border-cyan-500', 'border-emerald-950/40', 'border-amber-400', 'shadow-[0_0_10px_rgba(34,211,238,0.35)]', 'shadow-[0_0_16px_rgba(34,211,238,0.45)]', 'shadow-[0_0_20px_rgba(34,211,238,0.6)]', 'shadow-[0_0_10px_rgba(251,191,36,0.35)]', 'animate-pulse');

    if (!active) return;
    if (isMultiActionDrag) {
        board.classList.add('border-2', 'border-amber-400', 'ring-2', 'ring-amber-400', 'shadow-[0_0_10px_rgba(251,191,36,0.35)]');
        return;
    }

    board.classList.add('border-2', isValidHover ? 'border-cyan-500' : 'border-cyan-400', isValidHover ? 'ring-4' : 'ring-2', isValidHover ? 'ring-cyan-500' : 'ring-cyan-400', isValidHover ? 'shadow-[0_0_20px_rgba(34,211,238,0.6)]' : 'shadow-[0_0_10px_rgba(34,211,238,0.35)]');
    if (isValidHover) board.classList.add('animate-pulse');
}

function boardPlayHasSingleDefaultAction(card) {
    if (!card) return false;
    const intent = getCurrentPlayIntent(card.instanceId || card.id, card);
    return intent.mode === 'single' && intent.actionType === 'PLAY_BOARD';
}

function initiateDrag(pt, rectOverride = null) {
    if (gestureState.actionType === 'INVALID') {
        gestureState.gc?.firstElementChild?.classList.add('animate-error-flash');
        setTimeout(() => gestureState.gc?.firstElementChild?.classList.remove('animate-error-flash'), 500);
        gestureState.phase = 'IDLE';
        return;
    }

    if (gestureState.actionType === 'MULTI_ACTION' && !gestureState.modalShown) {
        const card = gestureState.card || findClientEntity(gestureState.cardId);
        if (card) {
            window.openActionModal(gestureState.cardId, card.name, gestureState.actions || buildCardActions(gestureState.cardId, card), true);
            gestureState.modalShown = true;
        }
    }

    gestureState.phase = 'DRAGGING';
    
    // Crucial Fix: Only use the previously captured rect if no override exists. 
    // DO NOT re-query getBoundingClientRect() here, as updateUI() detaches the node.
    if (rectOverride) {
        gestureState.rect = rectOverride;
    } else if (!gestureState.rect && gestureState.gc) {
        gestureState.rect = (gestureState.gc.firstElementChild || gestureState.gc).getBoundingClientRect();
    }

    window._isDragging = true;
    window._dragCardId = gestureState.cardId;
    window._dragTargets = gestureState.targets;

    if (ClientState.pendingAbility) clearPendingAbility();
    updateUI(); 

    document.getElementById('drag-tether-overlay')?.classList.remove('hidden');

    if (gestureState.actionType === 'PLAY_BOARD' || gestureState.actionType === 'MULTI_ACTION') {
        updateBoardPlayGlow(pt.x, pt.y, true);
        const board = document.getElementById('player-board');
        if (board) {
            if (gestureState.actionType === 'MULTI_ACTION') board.classList.add('ring-2', 'ring-amber-400', 'shadow-[0_0_10px_rgba(251,191,36,0.35)]', 'border-2', 'border-amber-400');
            else board.classList.add('ring-4', 'ring-cyan-500', 'shadow-[0_0_20px_rgba(34,211,238,0.6)]', 'border-2', 'border-cyan-500');
        }
    } else {
        updateTargetHighlights(gestureState.targets);
    }
}

function cancelDragToScrub(clientX, clientY) {
    const prevCardId = gestureState.cardId;
    const ptType = gestureState.pointerType;
    
    // 1. Clear overlays and highlights
    hideDragTether();
    clearTargetHighlights(gestureState.targets);
    
    // 2. Soft reset gesture state, gracefully returning to idle or scrub phase
    gestureState = { 
        ...gestureState, 
        phase: ptType === 'touch' ? 'SCRUBBING' : 'IDLE', 
        actionType: null, targets: [], abilityId: null, hoveredTarget: null, 
        actions: [], modalShown: false 
    };
    
    window._isDragging = false;
    window._dragCardId = null;
    window._dragTargets = [];
    
    // Forcefully clear the hovered state so the card physically drops back to its hand origin.
    // This allows it to reset successfully before native mouse hovers or touch logic takes back over.
    window._forceHoverCardId = null;
    if (window.HoverManager) window.HoverManager.unfocusHandCard();
    
    // 3. Force UI re-render to strip external dragging styles
    if (typeof updateUI === 'function') updateUI();
    
    // 4. Restart scrubbing/hovering gracefully AFTER the DOM has reconciled
    setTimeout(() => {
        if (window.HoverManager) {
            // Touch inputs need manual scrub tracking restarted.
            // Mouse inputs will naturally rely on DOM hover events now that the drag state is fully cleared.
            if (ptType === 'touch') {
                window.HoverManager.startScrub(clientX, clientY);
                window.HoverManager.markScrubMoved();
                window._forceHoverCardId = prevCardId;
                window.HoverManager.focusHandCard(prevCardId);
            }
        }
    }, 10);
}

function updateDragTether(clientX, clientY) {
    setDragTether(clientX, clientY);
    if (gestureState.actionType === 'PLAY_BOARD') {
        updateBoardPlayGlow(clientX, clientY, true);
    } else {
        gestureState.hoveredTarget = findHoveredTarget(clientX, clientY, gestureState.targets);
        updateTargetHighlights(gestureState.targets, gestureState.hoveredTarget);
    }
}

function resolveDragDrop(clientX, clientY) {
    let executed = false;
    if (gestureState.actionType === 'PLAY_BOARD') {
        const card = gestureState.card || findClientEntity(gestureState.cardId);
        if (card && !boardPlayHasSingleDefaultAction(card)) {
            showToast('Choose a play option before releasing.', 'info');
        } else if (isValidBoardPlayDrop(clientX, clientY)) {
            window.executeNormalPlay(gestureState.cardId);
            executed = true;
        }
    } else if (gestureState.actionType === 'MULTI_ACTION') {
        const card = gestureState.card || findClientEntity(gestureState.cardId);
        if (card) {
            const actions = gestureState.actions.length ? gestureState.actions : buildCardActions(gestureState.cardId, card);
            if (actions.length > 0) {
                window._forceHoverCardId = (clientX >= gestureState.rect?.left && clientX <= gestureState.rect?.right && clientY >= gestureState.rect?.top && clientY <= gestureState.rect?.bottom) ? gestureState.cardId : null;
                window.openActionModal(gestureState.cardId, card.name, actions, true);
                executed = true;
            }
        }
    } else if (gestureState.actionType === 'ATTACK' || gestureState.actionType === 'PLAY_TARGET') {
        const hitTarget = findHoveredTarget(clientX, clientY, gestureState.targets);
        if (hitTarget) {
            if (gestureState.actionType === 'ATTACK') dispatchAbility(gestureState.cardId, gestureState.abilityId, hitTarget, resolveTargetLine(hitTarget));
            else if (gestureState.actionType === 'PLAY_TARGET') window.executeNormalPlay(gestureState.cardId, gestureState.abilityId, hitTarget);
            executed = true;
        }
    }
    return executed;
}

// ------------------------------------------
// Core Input Handlers
// ------------------------------------------

function handlePointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (window._isDragging) return;

    const target = e.target;
    if (target.closest('unit-action-modal') || target.closest('zone-viewer-modal') || target.closest('button') || target.closest('#harvest-overlay')) return;

    const pt = getEventPoint(e);
    const gc = target.closest('game-card');

    if (!gc && window._forceHoverCardId && pt.type === 'touch') {
        window._forceHoverCardId = null;
        window.HoverManager.unfocusHandCard();
        return;
    }

    if (!gc) return;

    try { target.setPointerCapture(e.pointerId); } catch(err) {}
    target.style.touchAction = 'none';

    const cardId = gc.getAttribute('data-instance-id');
    const isHand = gc.hasAttribute('is-hand');
    const liveCard = cardId ? findClientEntity(cardId) : null;

    if (!liveCard) return;

    gestureState = {
        ...gestureState, phase: 'DOWN', pointerType: pt.type, startX: pt.x, startY: pt.y, pointerId: e.pointerId,
        cardId: cardId, card: liveCard, gc: gc,
        rect: gc.firstElementChild?.getBoundingClientRect() || gc.getBoundingClientRect(),
        source: isHand ? 'hand' : 'board', actionType: null, abilityId: null,
        targets: [], actions: [], modalShown: false
    };
    
    // Reset and start custom Long Press timer
    longPressFired = false;
    clearTimeout(longPressTimer);
    if (pt.type === 'touch') {
        longPressTimer = setTimeout(() => {
            longPressFired = true;
            executeLongPress(cardId, e);
        }, LONG_PRESS_DURATION);
    }

    if (isHand) {
        if (ClientState.isMyTurn() && ClientState.gameState.turnPhase === 'ACTION_PHASE') {
            const intent = getDragPlayIntent(cardId, liveCard);
            if (!intent || intent.mode === 'none') {
                gestureState.actionType = 'INVALID';
            } else if (intent.mode === 'single') {
                gestureState.actionType = intent.actionType;
                gestureState.abilityId = intent.abilityId;
                gestureState.targets = intent.validTargets || [];
            } else {
                gestureState.actionType = 'MULTI_ACTION';
                gestureState.targets = intent.validTargets || [];
                gestureState.actions = intent.actions || [];
            }
        } else {
            gestureState.actionType = 'INVALID';
        }

        if (pt.type === 'touch') {
            window.HoverManager.startScrub(pt.x, pt.y);
            window._blockClick = true;
            if (window._forceHoverCardId !== cardId) {
                window._forceHoverCardId = cardId;
                window.HoverManager.focusHandCard(cardId);
            }
            gestureState.phase = 'SCRUBBING';
        }
    } else if (!gc.closest('#equator-cards-container') && ClientState.isMyTurn() && ClientState.gameState.turnPhase === 'ACTION_PHASE') {
        const available = getEntityAvailableActions(ClientState.gameState, ClientState.localPlayerRole, cardId);
        const canAtk = available.find(a => a.type === 'ATTACK');
        if (canAtk) {
            const targets = getValidAttackTargets(ClientState.gameState, ClientState.localPlayerRole, liveCard);
            if (targets.length > 0) {
                gestureState.actionType = 'ATTACK';
                gestureState.abilityId = canAtk.abilityId;
                gestureState.targets = targets.map(t => t.id);
            } else gestureState.actionType = 'INVALID';
        } else gestureState.actionType = 'INVALID';
    } else {
        gestureState.actionType = 'INVALID';
    }
}

function handlePointerMove(e) {
    const pt = getEventPoint(e);
    
    // If a long press already fired, completely block movement processing
    if (longPressFired) {
        e.preventDefault();
        return;
    }

    // Monitor movement to cancel the long press if the user is actively swiping
    if (longPressTimer) {
        const dx = Math.abs(pt.x - gestureState.startX);
        const dy = Math.abs(pt.y - gestureState.startY);
        if (dx > LONG_PRESS_TOLERANCE || dy > LONG_PRESS_TOLERANCE) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }

    if (pt.type === 'touch' && (gestureState.phase === 'SCRUBBING' || gestureState.phase === 'DRAGGING' || gestureState.phase === 'DOWN')) {
         e.preventDefault(); 
    }

    if (gestureState.phase === 'IDLE' && ClientState.pendingAbility && pt.type === 'mouse') {
        const sourceGc = document.querySelector(`game-card[data-instance-id="${ClientState.pendingAbility.entityId}"]`);
        if (sourceGc?.firstElementChild) {
            const rect = sourceGc.firstElementChild.getBoundingClientRect();
            document.getElementById('drag-tether-overlay')?.classList.remove('hidden');
            document.getElementById('drag-tether-line')?.setAttribute('d', `M ${rect.left + rect.width / 2},${rect.top + rect.height / 2} Q ${rect.left + rect.width / 2},${rect.top + rect.height / 2 + (pt.y - rect.top - rect.height / 2) / 2} ${pt.x},${pt.y}`);
            document.getElementById('drag-tether-head')?.setAttribute('cx', pt.x);
            document.getElementById('drag-tether-head')?.setAttribute('cy', pt.y);

            ClientState.validTargets.forEach(t => {
               const inner = document.querySelector(`[data-instance-id="${t.id}"]`)?.tagName.toLowerCase() === 'game-card' ? document.querySelector(`[data-instance-id="${t.id}"]`).firstElementChild : document.querySelector(`[data-instance-id="${t.id}"]`);
               if (inner) {
                   const tr = inner.getBoundingClientRect();
                   if (pt.x >= tr.left && pt.x <= tr.right && pt.y >= tr.top && pt.y <= tr.bottom) inner.classList.replace('ring-cyan-400', 'ring-amber-400');
                   else inner.classList.replace('ring-amber-400', 'ring-cyan-400');
               }
            });
        }
        return;
    }

    if (gestureState.phase === 'IDLE') return;

    if (pt.type === 'touch' && (gestureState.phase === 'SCRUBBING' || gestureState.phase === 'DRAGGING')) {
         e.preventDefault(); 
    }

    // 2. Pre-Drag Movement Resolution (Convert to scrub or real drag)
    if (gestureState.phase === 'DOWN') {
        if (gestureState.source === 'hand') {
            const handContainer = document.getElementById('player-hand-container');
            const dragThresholdY = handContainer ? (handContainer.getBoundingClientRect().top - 60) : (gestureState.rect?.top || 0);
            
            if (pt.y < dragThresholdY) initiateDrag(pt);
        } else {
            const isBoardDragStart = (pt.x < gestureState.rect.left || pt.x > gestureState.rect.right || pt.y < gestureState.rect.top || pt.y > gestureState.rect.bottom);
            if (isBoardDragStart) initiateDrag(pt);
        }
    }
    // 3. Scrubbing Hand Evaluation (Mostly Mobile, handles conversion to Drag)
    else if (gestureState.phase === 'SCRUBBING') {
        if (!window.HoverManager.getScrubHasMoved() && window.HoverManager.evaluateScrubThreshold(pt.x, pt.y, DRAG_START_THRESHOLD)) {
            window.HoverManager.markScrubMoved();
        }
        if (!window.HoverManager.getScrubHasMoved()) return;

        if (window.HoverManager.evaluateDragStart(pt.y)) {
            if (window._forceHoverCardId) {
                const activeGc = document.querySelector(`game-card[data-instance-id="${window._forceHoverCardId}"]`);
                const handWrapper = document.getElementById('player-hand-container');
                const rectToUse = activeGc ? activeGc.firstElementChild.getBoundingClientRect() : (handWrapper ? handWrapper.getBoundingClientRect() : null);
                
                const scrubCard = findClientEntity(window._forceHoverCardId);
                
                if (scrubCard && rectToUse) {
                    gestureState.cardId = window._forceHoverCardId;
                    gestureState.card = scrubCard;
                    gestureState.rect = rectToUse;
                    
                    const intent = getDragPlayIntent(gestureState.cardId, scrubCard);
                    if (intent && intent.mode !== 'none') {
                         gestureState.actionType = intent.mode === 'single' ? intent.actionType : 'MULTI_ACTION';
                         gestureState.abilityId = intent.mode === 'single' ? intent.abilityId : null;
                         gestureState.targets = intent.validTargets || [];
                         gestureState.actions = intent.actions || [];
                         
                         initiateDrag(pt, rectToUse);
                         window.HoverManager.stopScrub();
                         window.HoverManager.unfocusHandCard();
                         return;
                    }
                }
            }

            if (gestureState.gc?.firstElementChild) {
                gestureState.gc.firstElementChild.classList.add('animate-error-flash');
                setTimeout(() => gestureState.gc.firstElementChild.classList.remove('animate-error-flash'), 500);
            }
            window.HoverManager.stopScrub();
            window._forceHoverCardId = null;
            window.HoverManager.unfocusHandCard();
            gestureState.phase = 'IDLE';
            return;
        }

        const foundId = window.HoverManager.findHoveredHandCardId(pt.x);
        if (foundId && foundId !== window._forceHoverCardId) {
            window._forceHoverCardId = foundId;
            window.HoverManager.focusHandCard(foundId);
        }
    }
    // 4. Active Target Dragging Evaluation
    else if (gestureState.phase === 'DRAGGING') {
        if (gestureState.source === 'hand') {
            const handContainer = document.getElementById('player-hand-container');
            const revertThresholdY = handContainer ? (handContainer.getBoundingClientRect().top - 30) : (gestureState.rect?.top || 0);

            if (pt.y >= revertThresholdY) {
                cancelDragToScrub(pt.x, pt.y);
                return;
            }
        }
        updateDragTether(pt.x, pt.y);
    }
}

function handlePointerUp(e) {
    const pt = getEventPoint(e);
    
    // Cleanup timers and check if we should ignore this release
    clearTimeout(longPressTimer);
    longPressTimer = null;
    
    if (longPressFired) {
        hardResetGestureState(e);
        return;
    }

    try { e.target.releasePointerCapture(e.pointerId); } catch(err) {}
    if (e.target.style) e.target.style.touchAction = '';

    if (gestureState.phase === 'DRAGGING') {
        const executed = resolveDragDrop(pt.x, pt.y);

        if (!executed && gestureState.rect && pt.x >= gestureState.rect.left && pt.x <= gestureState.rect.right && pt.y >= gestureState.rect.top && pt.y <= gestureState.rect.bottom) {
            window._forceHoverCardId = gestureState.cardId;
        } else {
            window._forceHoverCardId = null;
            if (window.HoverManager) window.HoverManager.unfocusHandCard();
        }

        hideDragTether();
        window._isDragging = false;
        window._dragCardId = null;
        window._dragTargets = [];
        window._blockClick = true;
        updateUI();
        setTimeout(() => { window._blockClick = false; }, 50);
    }
    else if (gestureState.phase === 'SCRUBBING') {
        const tappedCardId = window._forceHoverCardId || gestureState.cardId;
        const wasDrag = window.HoverManager.getScrubHasMoved();

        window.HoverManager.stopScrub();

        if (window._forceHoverCardId) {
            window._forceHoverCardId = null;
            window.HoverManager.unfocusHandCard();
        }

        setTimeout(() => { window._blockClick = false; }, 300);
        if (!wasDrag && tappedCardId) {
            window._blockClick = false;
            if (typeof window.handleHandCardClick === 'function') window.handleHandCardClick(tappedCardId);
            window._blockClick = true;
        }
    }
    else if (gestureState.phase === 'DOWN') {
        if (gestureState.actionType === 'OPTIONAL' && gestureState.cardId) { 
            window.handleHandCardClick(gestureState.cardId);
        } else if (pt.type === 'mouse' && gestureState.cardId && gestureState.source === 'hand') {
            window.handleHandCardClick(gestureState.cardId);
        }
    }

    hardResetGestureState(e);
}
window.handleUndo = handleUndo;
// Global Kill-Switch for Long-Press (Context Menu) - Kept as Desktop Right-Click Fallback
function handleContextMenu(e) {
    if (window.HoverManager) {
        window.HoverManager.stopScrub();
        window.HoverManager.unfocusHandCard();
    }
    
    window._forceHoverCardId = null;
    hideDragTether();
    clearTargetHighlights(gestureState?.targets);
    
    hardResetGestureState(e);
    if (typeof updateUI === 'function') updateUI();
}

// Bind unified handlers to native DOM events
window.addEventListener('pointerdown', handlePointerDown, { passive: false });
window.addEventListener('pointermove', handlePointerMove, { passive: false });
window.addEventListener('pointerup', handlePointerUp, { passive: true });
window.addEventListener('pointercancel', handlePointerUp, { passive: true });

// CRITICAL: Use capture: true so this fires BEFORE the card's stopPropagation() hides it!
window.addEventListener('contextmenu', handleContextMenu, { capture: true, passive: true });

let isAIRunning = false;
export async function triggerAILoop() {
    if (isAIRunning) return;
    
    let state = ClientState.gameState;
    if (!state || state.status === 'finished') return;
    
    const activePlayer = state.players[state.activePlayerId];
    if (!activePlayer || (!activePlayer.isAI && !activePlayer.isPassOnlyAI) || ClientState.localPlayerRole !== 'player1') return;
    
    isAIRunning = true;
    try {
        await new Promise(r => setTimeout(r, 1500));
        state = ClientState.gameState;
        if (!state || state.status === 'finished' || state.activePlayerId !== activePlayer.id) return;

        const AIClass = activePlayer.isPassOnlyAI ? PassAI : RandomAI;
        if (!ClientState.aiInstance || ClientState.aiInstance.playerId !== state.activePlayerId || !(ClientState.aiInstance instanceof AIClass)) {
            ClientState.aiInstance = new AIClass(state.activePlayerId);
        }
        if (ClientState.aiTurnNumber !== state.turnNumber) {
            ClientState.aiInstance.resetTurn();
            ClientState.aiTurnNumber = state.turnNumber;
        }

        state.actionIndex = (state.actionIndex || 0) + 1;
        state.lastRealActionIndex = state.actionIndex;
        const move = ClientState.aiInstance.executeNextMove(state);

        if (move.type === 'SACRIFICE' || move.type === 'SACRIFICE_SKIP') {
            const option = move.action?.action || (move.type === 'SACRIFICE_SKIP' ? 'SKIP' : 'OPTION_A');
            const cardId = move.action?.cardId || null;
            const actionPayload = { 
                type: 'SACRIFICE_DECISION', 
                option, 
                cardId, 
                actionIndex: state.actionIndex, 
                isUnsafe: false 
            };
            await pushActionToLog(ClientState.roomCode, actionPayload, null, state.history_log);
            
        } else if (move.type === 'PASS' || move.type === 'NO_MOVES') {
            endTurn(state);
            const actionPayload = { type: 'END_TURN', actionIndex: state.actionIndex, isUnsafe: true };
            await pushActionToLog(ClientState.roomCode, actionPayload, JSON.stringify(state), state.history_log);
            
        } else if (move.executed) {
            const actionData = move.action || move;
            let payload = null;

            if (move.type === 'PLAY_CARD' || actionData.type === 'PLAY_CARD') {
                payload = { 
                    type: 'PLAY_CARD', 
                    actionIndex: state.actionIndex, 
                    playerId: state.activePlayerId, 
                    cardId: actionData.cardId || actionData.entityId, 
                    targetLine: actionData.targetLine || 'back', 
                    chosenAbilityId: actionData.abilityId, 
                    abilityTargetId: actionData.targetId || actionData.abilityTargetId, 
                    isUnsafe: true 
                };
            } else if (move.type === 'ABILITY' || move.type === 'ATTACK' || actionData.type === 'ENTITY_ACTION') {
                payload = { 
                    type: 'ENTITY_ACTION', 
                    actionIndex: state.actionIndex, 
                    playerId: state.activePlayerId, 
                    entityId: actionData.entityId || actionData.cardId, 
                    actionType: (move.type === 'ABILITY' || move.type === 'ATTACK') ? move.type : actionData.actionType, 
                    abilityId: actionData.abilityId, 
                    targetId: actionData.targetId, 
                    targetLine: actionData.targetLine, 
                    isUnsafe: true 
                };
            }
            
            if (payload) {
                await pushActionToLog(ClientState.roomCode, payload, JSON.stringify(state), state.history_log);
            }
        } else {
            // Include the helpful console warning from HEAD alongside the fallback from the target branch
            console.warn("[AI] Move failed to execute or was invalid. Forcing PASS to prevent infinite loop.", move);
            endTurn(state);
            const actionPayload = { type: 'END_TURN', actionIndex: state.actionIndex, isUnsafe: true };
            await pushActionToLog(ClientState.roomCode, actionPayload, JSON.stringify(state), state.history_log);
        }
        
        // This will naturally recall triggerAILoop via the renderer if the turn didn't end
        updateUI();
    } catch(e) { 
        console.error("AI Loop Error:", e); 
    } finally { 
        isAIRunning = false; 
    }
}
window.triggerAILoop = triggerAILoop;

// Bridge the gap between the internal dispatcher names and the index.js imports
export { dispatchSacrificeDecision as handleSacrificeDecision };

// Proactively catching other potential ability/action naming mismatches:
export { dispatchAbility as handleAbility };
export { executeNormalPlay as handlePlayCard };

// INTERCEPTOR: Wrapped canPlayCard check
// If your renderer is importing 'canPlayCard' directly, it skips target validation. 
// Use this function instead for UI highlights!
export function canPlayCardWithTargets(state, playerId, card) {
    const baseCheck = canPlayCard(state, playerId, card);
    if (!baseCheck || !baseCheck.success) return baseCheck;
    
    const actions = buildCardActions(card.instanceId || card.id, card);
    if (actions.length === 0) return { success: false, reason: "No valid targets available." };
    
    return baseCheck;
}
window.canPlayCardWithTargets = canPlayCardWithTargets;
