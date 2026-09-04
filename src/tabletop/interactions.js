import { ClientState } from './client_state.js';
import { updateUI } from './renderer.js';
import { pushActionToLog } from '../firebase.js';
import { playCard, executeEntityAction, endTurn, executeSacrificeDecision, getValidAbilityTargets, getValidAttackTargets, getEntityAvailableActions, LINES, canPlayCard, isUndoable, GameEngine, startTurn } from '../engine/index.js';
import { showToast } from '../ui.js';
import { reconstructStateFromLog } from './multiplayer.js';
import { RandomAI } from '../ai/random.js';
import { PassAI } from '../ai/pass.js';

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
    
    const engine = new GameEngine(ClientState.gameState);
    startTurn(ClientState.gameState, engine);

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

export function getCardPlayState(cardId, card) {
    const baseCheck = canPlayCard(ClientState.gameState, ClientState.localPlayerRole, card);
    if (!baseCheck || !baseCheck.success) {
        return { playable: false, reason: baseCheck ? baseCheck.reason : "Cannot play", mode: 'none', actions: [] };
    }

    const legalActions = getEntityAvailableActions(ClientState.gameState, ClientState.localPlayerRole, cardId);
    if (legalActions.length === 0) {
        return { playable: false, reason: "No valid targets available.", mode: 'none', actions: [] };
    }
    
    if (legalActions.length === 1) {
        return { 
            playable: true,
            mode: 'single', 
            actionType: legalActions[0].type,
            requiresTarget: legalActions[0].requiresTarget,
            isPlayAbility: legalActions[0].isPlayAbility,
            abilityId: legalActions[0].abilityId, 
            validTargets: legalActions[0].validTargets, 
            action: legalActions[0],
            actions: legalActions
        };
    }
    
    return { 
        playable: true,
        mode: 'multi', 
        actions: legalActions, 
        validTargets: [...new Set(legalActions.flatMap(a => a.validTargets || []))] 
    };
}
window.getCardPlayState = getCardPlayState;

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
}

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

        // UNIFIED GATEKEEPER: Handles base cost, actions, and targeting in one clean pass
        const playState = getCardPlayState(cardId, card);
        
        if (!playState.playable) {
            showToast(playState.reason, "error");
            return;
        }

        if (playState.mode === 'single') {
            const act = playState.action;
            if (act.type === 'PLAY') {
                window.executeNormalPlay(cardId, act.abilityId === 'native_play' ? null : act.abilityId);
            } else {
                window.activateHandCardAbility(cardId, act.abilityId);
            }
        } else {
            window.openActionModal(cardId, card.name, playState.actions, true);
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

    const actions = getEntityAvailableActions(ClientState.gameState, ClientState.localPlayerRole, cardId);
    const targetAbilityId = abilityId || 'native_play';
    const action = actions.find(a => a.abilityId === targetAbilityId);

    if (!action) {
        console.warn(`[UI] Action '${targetAbilityId}' not found on ${card.name}.`);
        closeUnitActionModal();
        return;
    }

    const ability = card.abilities?.find(a => a.abilityId === action.abilityId);

    if (action.requiresTarget) {
        closeUnitActionModal();
        ClientState.validTargets = action.validTargets;
        
        ClientState.pendingAbility = { 
            entityId: cardId, 
            abilityId: action.abilityId, 
            isHandCard: true, 
            isHandActivate: !action.isPlayAbility 
        };
        
        showToast(`Select a target for ${ability?.name || action.name}`, 'info');
        updateUI();
        maybeOpenZoneModal();
        return;
    }

    closeUnitActionModal();
    
    if (action.isPlayAbility) {
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

let gestureState = {
    phase: 'IDLE', 
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
    pointerId: null,
    requiresTarget: false,
    isPlayAbility: false
};
const DRAG_START_THRESHOLD = 8;

let longPressTimer = null;
let longPressFired = false;
const LONG_PRESS_DURATION = 400; 
const LONG_PRESS_TOLERANCE = 10; 

function hardResetGestureState(e) {
    if (e && e.target && e.target.releasePointerCapture && gestureState.pointerId) {
        try { e.target.releasePointerCapture(gestureState.pointerId); } catch(err) {}
    }
    if (e && e.target && e.target.style) e.target.style.touchAction = '';

    gestureState = {
        phase: 'IDLE', source: null, actionType: null, cardId: null, card: null,
        rect: null, targets: [], abilityId: null, gc: null, hoveredTarget: null,
        actions: [], modalShown: false, pointerType: null, startX: 0, startY: 0, pointerId: null,
        requiresTarget: false, isPlayAbility: false
    };
    window._isDragging = false;
    window._dragCardId = null;
    window._dragTargets = [];
}

function executeLongPress(cardId, e) {
    if (window.HoverManager) {
        window.HoverManager.stopScrub();
        window.HoverManager.handHoverId = null; 
        if (window.HoverManager.handHoverFrame) {
            cancelAnimationFrame(window.HoverManager.handHoverFrame);
            window.HoverManager.handHoverFrame = null;
        }
        window.HoverManager.refreshAllHandCards(); 
    }
    
    window._forceHoverCardId = null;
    hideDragTether();
    clearTargetHighlights(gestureState?.targets);
    
    const entity = findClientEntity(cardId);
    if (entity && window.inspectCard) {
        window.inspectCard(encodeURIComponent(JSON.stringify(entity)).replace(/'/g, "%27"));
    }
    
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

    let rect = gestureState.rect;
    if (gestureState.cardId) {
        const liveEl = document.querySelector(`game-card[data-instance-id="${gestureState.cardId}"]`);
        if (liveEl) {
            const inner = liveEl.firstElementChild || liveEl;
            rect = inner.getBoundingClientRect();
        }
    }

    rect = rect || { left: clientX, top: clientY + 50, width: 0, height: 0 };
    
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const ctrlY = startY + (clientY - startY) / 2;

    line.setAttribute('d', `M ${startX},${startY} Q ${startX},${ctrlY} ${clientX},${clientY}`);
    head.setAttribute('cx', clientX);
    head.setAttribute('cy', clientY);
    overlay.classList.remove('hidden');

    if (gestureState.actionType === 'PLAY' && !gestureState.requiresTarget) updateBoardPlayGlow(clientX, clientY, true);
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
    const isBoardDropActive = gestureState.actionType === 'PLAY' && !gestureState.requiresTarget;
    const active = isBoardDropActive || isDragging || isMultiActionDrag;

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
    const intent = getCardPlayState(card.instanceId || card.id, card);
    return intent.mode === 'single' && intent.actionType === 'PLAY' && !intent.requiresTarget;
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
            window.openActionModal(gestureState.cardId, card.name, gestureState.actions || getEntityAvailableActions(ClientState.gameState, ClientState.localPlayerRole, gestureState.cardId), true);
            gestureState.modalShown = true;
        }
    }

    gestureState.phase = 'DRAGGING';
    
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

    const isBoardPlay = gestureState.actionType === 'PLAY' && !gestureState.requiresTarget;
    if (isBoardPlay || gestureState.actionType === 'MULTI_ACTION') {
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
    
    hideDragTether();
    clearTargetHighlights(gestureState.targets);
    
    gestureState = { 
        ...gestureState, 
        phase: ptType === 'touch' ? 'SCRUBBING' : 'IDLE', 
        actionType: null, targets: [], abilityId: null, hoveredTarget: null, requiresTarget: false, isPlayAbility: false,
        actions: [], modalShown: false 
    };
    
    window._isDragging = false;
    window._dragCardId = null;
    window._dragTargets = [];
    
    window._forceHoverCardId = null;
    if (window.HoverManager) window.HoverManager.unfocusHandCard();
    if (typeof updateUI === 'function') updateUI();
    
    setTimeout(() => {
        if (window.HoverManager && ptType === 'touch') {
            window.HoverManager.startScrub(clientX, clientY);
            window.HoverManager.markScrubMoved();
            window._forceHoverCardId = prevCardId;
            window.HoverManager.focusHandCard(prevCardId);
        }
    }, 10);
}

function updateDragTether(clientX, clientY) {
    setDragTether(clientX, clientY);
    if (gestureState.actionType === 'PLAY' && !gestureState.requiresTarget) {
        updateBoardPlayGlow(clientX, clientY, true);
    } else {
        gestureState.hoveredTarget = findHoveredTarget(clientX, clientY, gestureState.targets);
        updateTargetHighlights(gestureState.targets, gestureState.hoveredTarget);
    }
}

function resolveDragDrop(clientX, clientY) {
    let executed = false;
    
    const isBoardPlay = gestureState.actionType === 'PLAY' && !gestureState.requiresTarget;
    
    if (isBoardPlay) {
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
            const actions = gestureState.actions.length ? gestureState.actions : getEntityAvailableActions(ClientState.gameState, ClientState.localPlayerRole, gestureState.cardId);
            if (actions.length > 0) {
                window._forceHoverCardId = (clientX >= gestureState.rect?.left && clientX <= gestureState.rect?.right && clientY >= gestureState.rect?.top && clientY <= gestureState.rect?.bottom) ? gestureState.cardId : null;
                window.openActionModal(gestureState.cardId, card.name, actions, true);
                executed = true;
            }
        }
    } else if (gestureState.actionType === 'ATTACK' || gestureState.requiresTarget) {
        const hitTarget = findHoveredTarget(clientX, clientY, gestureState.targets);
        if (hitTarget) {
            if (gestureState.actionType === 'ATTACK') {
                dispatchAbility(gestureState.cardId, gestureState.abilityId, hitTarget, resolveTargetLine(hitTarget));
            } else if (gestureState.isPlayAbility) {
                window.executeNormalPlay(gestureState.cardId, gestureState.abilityId, hitTarget);
            } else {
                dispatchAbility(gestureState.cardId, gestureState.abilityId, hitTarget, 'hand');
            }
            executed = true;
        }
    }
    return executed;
}

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
        targets: [], actions: [], modalShown: false, requiresTarget: false, isPlayAbility: false
    };
    
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
            const intent = getCardPlayState(cardId, liveCard);
            if (!intent.playable) {
                gestureState.actionType = 'INVALID';
            } else if (intent.mode === 'single') {
                gestureState.actionType = intent.actionType;
                gestureState.abilityId = intent.abilityId;
                gestureState.requiresTarget = intent.requiresTarget;
                gestureState.isPlayAbility = intent.isPlayAbility;
                gestureState.targets = (intent.validTargets || []).map(t => t.id);
            } else {
                gestureState.actionType = 'MULTI_ACTION';
                gestureState.targets = (intent.validTargets || []).map(t => t.id);
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
            gestureState.actionType = 'ATTACK';
            gestureState.abilityId = canAtk.abilityId;
            gestureState.requiresTarget = true;
            gestureState.targets = (canAtk.validTargets || []).map(t => t.id);
        } else gestureState.actionType = 'INVALID';
    } else {
        gestureState.actionType = 'INVALID';
    }
}

function handlePointerMove(e) {
    const pt = getEventPoint(e);
    
    if (longPressFired) {
        e.preventDefault();
        return;
    }

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
                        
                        const intent = getCardPlayState(gestureState.cardId, scrubCard);
                        if (intent.playable) {
                             gestureState.actionType = intent.mode === 'single' ? intent.actionType : 'MULTI_ACTION';
                             gestureState.abilityId = intent.mode === 'single' ? intent.abilityId : null;
                             gestureState.requiresTarget = intent.mode === 'single' ? intent.requiresTarget : false;
                             gestureState.isPlayAbility = intent.mode === 'single' ? intent.isPlayAbility : false;
                             gestureState.targets = (intent.validTargets || []).map(t => t.id);
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

window.addEventListener('pointerdown', handlePointerDown, { passive: false });
window.addEventListener('pointermove', handlePointerMove, { passive: false });
window.addEventListener('pointerup', handlePointerUp, { passive: true });
window.addEventListener('pointercancel', handlePointerUp, { passive: true });
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
            const engine = new GameEngine(state);
            startTurn(state, engine);
            await pushActionToLog(ClientState.roomCode, { type: 'END_TURN', actionIndex: state.actionIndex, isUnsafe: true }, JSON.stringify(state), state.history_log);
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
            console.warn("[AI] Move failed to execute or was invalid. Forcing PASS to prevent infinite loop.", move);
            endTurn(state);
            const engine = new GameEngine(state);
            startTurn(state, engine);
            await pushActionToLog(ClientState.roomCode, { type: 'END_TURN', actionIndex: state.actionIndex, isUnsafe: true }, JSON.stringify(state), state.history_log);
        }
        
        updateUI();
    } catch(e) { 
        console.error("AI Loop Error:", e); 
    } finally { 
        isAIRunning = false; 
    }
}
window.triggerAILoop = triggerAILoop;

export { dispatchSacrificeDecision as handleSacrificeDecision };
export { dispatchAbility as handleAbility };
export { executeNormalPlay as handlePlayCard };

// Cleaned up the bottom exports by entirely replacing the old canPlayCardWithTargets