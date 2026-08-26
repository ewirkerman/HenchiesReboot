import { ClientState } from './client_state.js';
import { updateUI } from './renderer.js';
import { pushActionToLog } from '../firebase.js';
import { playCard, executeEntityAction, endTurn, executeSacrificeDecision, getValidAbilityTargets, getValidAttackTargets, getEntityAvailableActions, LINES, canPlayCard, isUndoable } from '../engine/index.js';
import { resolveResourceKey } from '../engine/index.js';
import { showToast } from '../ui.js';
import { reconstructStateFromLog } from './multiplayer.js';

function getEntityRef(entityId) {
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

function isActionUnsafe(entity, abilityId) {
    if (!entity) return true;
    const ability = entity.abilities?.find(a => a.abilityId === abilityId);
    if (!ability) return false;
    if (!isUndoable(ClientState.gameState, ability)) return true;
    return false;
}

function isPlayUnsafe(card, chosenAbilityId) {
    if (!card) return true;
    if (chosenAbilityId && isActionUnsafe(card, chosenAbilityId)) return true;
    if (card.abilities) {
        for (const ab of card.abilities) {
            // Only evaluate mandatory play triggers. Optional ones are evaluated via chosenAbilityId above.
            if (['PLAY', 'ON_BE_PLAYED', 'PLAYED'].includes(ab.trigger)) {
                if (!isUndoable(ClientState.gameState, ab)) return true;
            }
        }
    }
    return false;
}

export async function executeAndLogAbility(entityId, abilityId, targetId, targetLine) {
    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
    ClientState.gameState.lastRealActionIndex = ClientState.gameState.actionIndex;
    const entity = getEntityRef(entityId);
    
    const ability = entity?.abilities?.find(a => a.abilityId === abilityId);
    const isAttack = abilityId === 'native_attack' || ability?.effects?.some(g => g.payloads?.some(p => p.type === 'ATTACK'));
    const actionType = isAttack ? 'ATTACK' : 'ABILITY';
    
    ClientState.gameState._irreversibleActionOccurred = false;
    const result = executeEntityAction(ClientState.gameState, ClientState.localPlayerRole, entityId, actionType, abilityId, targetId, targetLine);
    
    const actuallyUnsafe = isActionUnsafe(entity, abilityId) || ClientState.gameState._irreversibleActionOccurred;

    const actionPayload = {
        type: 'ENTITY_ACTION',
        actionIndex: ClientState.gameState.actionIndex,
        playerId: ClientState.localPlayerRole,
        entityId: entityId,
        actionType: actionType,
        abilityId: abilityId,
        targetId: targetId,
        targetLine: targetLine,
        isUnsafe: actuallyUnsafe
    };
    
    if (result && result.success) {
        showToast('Ability Activated!', 'success');
        await pushActionToLog(ClientState.roomCode, actionPayload, null, ClientState.gameState.history_log);
        window._isDragging = false; // Add this line
        updateUI();
    } else {
        showToast(result?.reason || 'Failed to activate ability', 'error');
    }
}

export async function handleSacrificeConfirm() {
    if (!ClientState.isMyTurn() || !ClientState.selectedCardId) {
        showToast('Please select a card from your hand to sacrifice!', 'error');
        return;
    }
    handleSacrificeDecision('OPTION_A', ClientState.selectedCardId);
}

export async function handleSacrificeDecision(option, cardId = null) {
    if (!ClientState.isMyTurn()) return;
    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
    ClientState.gameState.lastRealActionIndex = ClientState.gameState.actionIndex;
    const actionPayload = { type: 'SACRIFICE_DECISION', option, cardId, actionIndex: ClientState.gameState.actionIndex, isUnsafe: false };
    executeSacrificeDecision(ClientState.gameState, option, cardId);
    ClientState.selectedCardId = null;
    await pushActionToLog(ClientState.roomCode, actionPayload, null, ClientState.gameState.history_log);
    updateUI();
}

export async function handleEndTurn() {
    if (!ClientState.isMyTurn()) return;
    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
    ClientState.gameState.lastRealActionIndex = ClientState.gameState.actionIndex;
    const actionPayload = { type: 'END_TURN', actionIndex: ClientState.gameState.actionIndex, isUnsafe: true };
    endTurn(ClientState.gameState);
    const snapshot = JSON.stringify(ClientState.gameState);
    await pushActionToLog(ClientState.roomCode, actionPayload, snapshot, ClientState.gameState.history_log);
    updateUI();
}

let isProcessingUndo = false;

export async function handleUndo() {
    console.log("[UNDO] Button clicked! State checks:", {
        isMyTurn: ClientState.isMyTurn(),
        rules: ClientState.gameState.rules,
        lastRealActionIndex: ClientState.gameState.lastRealActionIndex,
        lastSafeUndoIndex: ClientState.lastSafeUndoIndex
    });

    if (!ClientState.isMyTurn() || isProcessingUndo) {
        console.warn("[UNDO] Aborted: Not your turn or already processing.");
        return;
    }
    
    if (ClientState.gameState.rules && ClientState.gameState.rules?.allowUndo === false) {
        console.warn("[UNDO] Aborted: Rules explicitly forbid undo.");
        return;
    }
    
    const targetIdx = ClientState.gameState.lastRealActionIndex;
    
    if (!targetIdx || targetIdx <= ClientState.lastSafeUndoIndex) {
        showToast('No safe actions to undo.', 'error');
        console.warn("[UNDO] Aborted: No safe actions to undo.");
        return;
    }

    isProcessingUndo = true;
    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
    
    const actionPayload = { 
        type: 'UNDO', 
        targetIndex: targetIdx, 
        actionIndex: ClientState.gameState.actionIndex 
    };
    
    window._isDragging = false; // Add this line
    console.log(`[UNDO] Processing undo for action index ${targetIdx}. New sequence index: ${actionPayload.actionIndex}`);
    showToast('Rewinding action...', 'info');
    
    await pushActionToLog(ClientState.roomCode, actionPayload, null, ClientState.gameState.history_log);
    isProcessingUndo = false;
}

export async function handleRestartMatch() {
    console.log("[RESTART] Initiating match restart...");
    if (!ClientState.roomCode.toUpperCase().startsWith('TEST_')) {
        console.warn("[RESTART] Aborted: Not a test room.");
        return;
    }

    try {
        // We have the pristine turn 1 state already saved in RAM!
        if (!ClientState.localReplayStates || ClientState.localReplayStates.length === 0) {
            showToast('Cannot restart: No initial state found.', 'error');
            return;
        }

        const pristineState = ClientState.localReplayStates[0];
        
        // Construct the exact payload Firebase/LocalStorage expects
        const resetPayload = {
            gameId: ClientState.roomCode,
            status: pristineState.status || 'active',
            turnNumber: pristineState.turnNumber || 1,
            activePlayerId: pristineState.activePlayerId || 'player1',
            turnPhase: pristineState.turnPhase || 'ACTION_PHASE',
            players: {
                player1Name: pristineState.players?.player1?.name || 'Player 1',
                player2Name: pristineState.players?.player2?.name || 'Player 2'
            },
            turn_start_state: JSON.stringify(pristineState),
            action_log: [],
            history_log: pristineState.history_log || ['Test match restarted.'],
            updatedAt: Date.now()
        };
        
        // Push to localStorage so the polling listener stays in sync
        localStorage.setItem(`henchies_game_${ClientState.roomCode}`, JSON.stringify(resetPayload));
        
        // Clear UI State
        ClientState.selectedCardId = null;
        ClientState.pendingAbility = null;
        ClientState.validTargets = [];
        ClientState.replayStepIndex = 0;
        
        // Force the engine to instantly rebuild the board from the reset payload
        reconstructStateFromLog(resetPayload);
        
        showToast('Match restarted!', 'success');
    } catch (err) {
        console.error("[RESTART] Failed to restart match:", err);
        showToast('Error restarting match.', 'error');
    }
}
window.handleRestartMatch = handleRestartMatch;

export async function handleForfeitInGame() {
    if (!confirm("Are you sure you want to forfeit this match?")) return;
    
    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
    ClientState.gameState.lastRealActionIndex = ClientState.gameState.actionIndex;
    const actionPayload = { 
        type: 'FORFEIT', 
        playerId: ClientState.localPlayerRole,
        playerName: ClientState.gameState.players[ClientState.localPlayerRole].name,
        actionIndex: ClientState.gameState.actionIndex 
    };
    
    await pushActionToLog(ClientState.roomCode, actionPayload, null, ClientState.gameState.history_log);
    showToast("You have forfeited the match.", "info");
}
window.handleForfeitInGame = handleForfeitInGame;

window.handleLineClick = async (clickedPrefix, line) => {
    if (window._isDragging || window._blockClick) return;
    if (typeof event !== 'undefined' && event) event.stopPropagation();
    if (ClientState.pendingAbility) {
        showToast("Targeting cancelled.", "info");
        window._forceHoverCardId = null;
        ClientState.pendingAbility = null;
        ClientState.validTargets = [];
        updateUI();
        return;
    }
};

window.handleEntityClick = async (prefix, line, entityId) => {
    if (window._isDragging || window._blockClick) return;
    if (typeof event !== 'undefined' && event) event.stopPropagation();
    
    if (!ClientState.isMyTurn()) {
        let entity = null;
        if (prefix === 'equator') entity = ClientState.gameState.equator?.find(i => i.instanceId === entityId);
        else {
            const role = prefix === 'player' ? ClientState.localPlayerRole : (ClientState.localPlayerRole === 'player1' ? 'player2' : 'player1');
            entity = ClientState.gameState.players[role].lines[line]?.find(u => u.instanceId === entityId);
        }
        if (entity) {
            const json = encodeURIComponent(JSON.stringify(entity)).replace(/'/g, "%27");
            window.inspectCard(json);
        }
        return;
    }

    if (ClientState.pendingAbility) {
        if (ClientState.validTargets.some(t => t.id === entityId)) {
            if (ClientState.pendingAbility.isHandCard) {
                console.log(`[UI] Executing targeted play for card ${ClientState.pendingAbility.entityId} onto target ${entityId}`);
                
                ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
                ClientState.gameState.lastRealActionIndex = ClientState.gameState.actionIndex;
                const card = getEntityRef(ClientState.pendingAbility.entityId);
                
                ClientState.gameState._irreversibleActionOccurred = false;
                const playRes = playCard(ClientState.gameState, ClientState.localPlayerRole, ClientState.pendingAbility.entityId, 'back', ClientState.pendingAbility.abilityId, entityId);
                
                const actuallyUnsafe = isPlayUnsafe(card, ClientState.pendingAbility.abilityId) || ClientState.gameState._irreversibleActionOccurred;

                const actionPayload = {
                    type: 'PLAY_CARD',
                    actionIndex: ClientState.gameState.actionIndex,
                    playerId: ClientState.localPlayerRole,
                    cardId: ClientState.pendingAbility.entityId,
                    targetLine: 'back',
                    chosenAbilityId: ClientState.pendingAbility.abilityId,
                    abilityTargetId: entityId,
                    isUnsafe: actuallyUnsafe
                };

                if (playRes.success) {
                    ClientState.pendingAbility = null;
                    ClientState.validTargets = [];
                    await pushActionToLog(ClientState.roomCode, actionPayload, null, ClientState.gameState.history_log);
                    updateUI();
                } else {
                    showToast(playRes.reason, 'error');
                }
            } else {
                executeAndLogAbility(ClientState.pendingAbility.entityId, ClientState.pendingAbility.abilityId, entityId, line);
                ClientState.pendingAbility = null;
                ClientState.validTargets = [];
                updateUI();
            }
            window.closeUnitActionModal();
            return;
        } else {
            showToast("Targeting cancelled.", "info");
            if (entityId === ClientState.pendingAbility.entityId) window._forceHoverCardId = entityId;
            else window._forceHoverCardId = null;
            ClientState.pendingAbility = null;
            ClientState.validTargets = [];
            updateUI();
            window.closeUnitActionModal();
            return;
        }
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

window.activateHandCardAbility = async (cardId, abilityId) => {
    if (typeof event !== 'undefined' && event) event.stopPropagation();
    const player = ClientState.gameState.players[ClientState.localPlayerRole];
    const card = player.hand.find(c => c.instanceId === cardId || c.id === cardId);
    if (!card) return;

    const ability = card.abilities.find(a => a.abilityId === abilityId);
    
    const isHandActivate = ability.trigger === 'MANUAL' && ability.passiveFlags?.includes('ACTIVATE_FROM_HAND');
    
    if (ability?.activation?.method === 'PLAYER_CHOICE') {
        window.closeUnitActionModal();
        ClientState.validTargets = getValidAbilityTargets(ClientState.gameState, ClientState.localPlayerRole, cardId, abilityId);
        ClientState.pendingAbility = { entityId: cardId, abilityId: abilityId, isHandCard: true, isHandActivate };
        showToast(`Select a target for ${ability.name}`, 'info');
        updateUI();
        
        maybeOpenZoneModal();
        return;
    }

    window.closeUnitActionModal();

    if (isHandActivate) {
        executeAndLogAbility(cardId, abilityId, null, null);
    } else {
        await window.executeNormalPlay(cardId, abilityId);
    }
};

window.activateAbility = async (entityId, abilityId) => {
    if (typeof event !== 'undefined' && event) event.stopPropagation();
    if (!ClientState.isMyTurn()) return;
    
    let entity = null;
    const eqItem = ClientState.gameState.equator?.find(i => i.instanceId === entityId);
    if (eqItem) entity = eqItem;
    else {
        for (const l of LINES) {
            const u = ClientState.gameState.players[ClientState.localPlayerRole].lines[l]?.find(u => u.instanceId === entityId);
            if (u) { entity = u; break; }
        }
    }
    
    if (!entity) return;

    if (abilityId === 'native_attack') {
        window.closeUnitActionModal();
        ClientState.validTargets = getValidAttackTargets(ClientState.gameState, ClientState.localPlayerRole, entity);
        ClientState.pendingAbility = { entityId, abilityId };
        showToast(`Select a target to attack`, 'info');
        updateUI();
        return;
    }

    const ability = entity.abilities?.find(a => a.abilityId === abilityId);
    
    if (ability?.activation?.method === 'PLAYER_CHOICE') {
        window.closeUnitActionModal();
        ClientState.validTargets = getValidAbilityTargets(ClientState.gameState, ClientState.localPlayerRole, entityId, abilityId);
        ClientState.pendingAbility = { entityId, abilityId };
        showToast(`Select a target for ${ability.name}`, 'info');
        updateUI();
        
        maybeOpenZoneModal();
        return;
    }
    
    window.closeUnitActionModal();
    executeAndLogAbility(entityId, abilityId, null, null);
};

window.executeNormalPlay = async (cardId, chosenAbilityId = null, abilityTargetId = null) => {
    if (typeof event !== 'undefined' && event) event.stopPropagation();
    window.closeUnitActionModal();
    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
    ClientState.gameState.lastRealActionIndex = ClientState.gameState.actionIndex;
    const card = getEntityRef(cardId);
    
    ClientState.gameState._irreversibleActionOccurred = false;
    const result = playCard(ClientState.gameState, ClientState.localPlayerRole, cardId, 'back', chosenAbilityId, abilityTargetId);
    
    const actuallyUnsafe = isPlayUnsafe(card, chosenAbilityId) || ClientState.gameState._irreversibleActionOccurred;

    const actionPayload = {
      type: 'PLAY_CARD',
      actionIndex: ClientState.gameState.actionIndex,
      playerId: ClientState.localPlayerRole,
      cardId: cardId,
      targetLine: 'back',
      chosenAbilityId: chosenAbilityId,
      abilityTargetId: abilityTargetId,
      isUnsafe: actuallyUnsafe
    };

    if (result.success) {
      ClientState.selectedCardId = null;
      await pushActionToLog(ClientState.roomCode, actionPayload, null, ClientState.gameState.history_log);
      window._isDragging = false; // Add this line
      updateUI();
    } else {
      showToast(result.reason, 'error');
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
      if (ClientState.validTargets.some(t => t.id === cardId)) {
          if (ClientState.pendingAbility.isHandCard) {
              if (ClientState.pendingAbility.isHandActivate) {
                  executeAndLogAbility(ClientState.pendingAbility.entityId, ClientState.pendingAbility.abilityId, cardId, 'hand');
                  ClientState.pendingAbility = null;
                  ClientState.validTargets = [];
                  updateUI();
                  return;
              }

              ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
              ClientState.gameState.lastRealActionIndex = ClientState.gameState.actionIndex;
              const card = getEntityRef(ClientState.pendingAbility.entityId);
              
              ClientState.gameState._irreversibleActionOccurred = false;
              const playRes = playCard(ClientState.gameState, ClientState.localPlayerRole, ClientState.pendingAbility.entityId, 'back', ClientState.pendingAbility.abilityId, cardId);
              
              const actuallyUnsafe = isPlayUnsafe(card, ClientState.pendingAbility.abilityId) || ClientState.gameState._irreversibleActionOccurred;

              const actionPayload = {
                  type: 'PLAY_CARD',
                  actionIndex: ClientState.gameState.actionIndex,
                  playerId: ClientState.localPlayerRole,
                  cardId: ClientState.pendingAbility.entityId,
                  targetLine: 'back',
                  chosenAbilityId: ClientState.pendingAbility.abilityId,
                  abilityTargetId: cardId,
                  isUnsafe: actuallyUnsafe
              };

              if (playRes.success) {
                  ClientState.pendingAbility = null;
                  ClientState.validTargets = [];
                  await pushActionToLog(ClientState.roomCode, actionPayload, null, ClientState.gameState.history_log);
                  updateUI();
              } else {
                  showToast(playRes.reason, 'error');
              }
          } else {
              executeAndLogAbility(ClientState.pendingAbility.entityId, ClientState.pendingAbility.abilityId, cardId, 'hand');
              ClientState.pendingAbility = null;
              ClientState.validTargets = [];
              updateUI();
          }
          window.closeUnitActionModal();
          return;
      } else {
          showToast("Targeting cancelled.", "info");
          if (cardId === ClientState.pendingAbility.entityId) window._forceHoverCardId = cardId;
          else window._forceHoverCardId = null;
          ClientState.pendingAbility = null;
          ClientState.validTargets = [];
          updateUI();
          window.closeUnitActionModal();
          return;
      }
  }

  if (ClientState.gameState.turnPhase === 'ACTION_PHASE') {
      const player = ClientState.gameState.players[ClientState.localPlayerRole];
        const c = player.hand.find(card => card.instanceId === cardId || card.id === cardId);
        if (!c) return;

        const playCheck = canPlayCard(ClientState.gameState, ClientState.localPlayerRole, c);
        const canPlay = playCheck.success;

        let baseCost = typeof c.cost === 'object' ? (c.cost.tribeAmount > 0 ? c.cost.tribeAmount : (c.cost.carnie || c.cost.tent || 0)) : (c.cost || 0);
        let cTribe = resolveResourceKey(ClientState.gameState, player, c.tribe);
        
        let simCarnie = player.resources['Carnie'] ? player.resources['Carnie'].current : 0;
        let simTribe = (cTribe !== 'Carnie' && player.resources[cTribe]) ? player.resources[cTribe].current : 0;
        
        if (canPlay && baseCost > 0) {
            if (cTribe === 'Carnie') {
                simCarnie -= baseCost;
            } else {
                let costRemaining = baseCost;
                let tribeResToUse = Math.min(simTribe, costRemaining);
                costRemaining -= tribeResToUse;
                simTribe -= tribeResToUse;
                simCarnie -= (costRemaining * 3);
            }
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
            showToast(playCheck.reason || "Cannot play this card.", "error");
        }
  }
};

window.openActionModal = (entityId, entityName, actions, isHand = false) => {
    ClientState.activeMenuEntityId = entityId;
    updateUI();
    const menu = document.querySelector('unit-action-modal');
    if (menu) menu.open(entityId, entityName, actions, isHand);
};

window.closeUnitActionModal = () => {
    ClientState.activeMenuEntityId = null;
    updateUI();
    const menu = document.querySelector('unit-action-modal');
    if (menu) menu.close();
};

// ==========================================
// DRAG-TO-ACT ENGINE
// ==========================================
let dState = {
    down: false, dragging: false, cardId: null, card: null, type: null, rect: null, targets: [], abilityId: null, gc: null, clone: null, hoveredTarget: null
};

window.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (!ClientState.isMyTurn() || ClientState.gameState.turnPhase !== 'ACTION_PHASE') return;
    
    if (e.target.closest('unit-action-modal') || e.target.closest('zone-viewer-modal') || e.target.closest('button') || e.target.closest('#harvest-overlay')) return;

    const gc = e.target.closest('game-card');
    if (!gc) return;

    const isHand = gc.hasAttribute('is-hand');
    const cardId = gc.getAttribute('data-instance-id');
    if (!cardId) return;

    const liveCard = getEntityRef(cardId);
    if (!liveCard) return;

    dState.down = true; dState.dragging = false; dState.cardId = cardId; dState.card = liveCard;
    dState.rect = gc.firstElementChild.getBoundingClientRect(); dState.gc = gc; dState.targets = []; dState.type = 'INVALID'; dState.abilityId = null;

    if (isHand) {
        const playCheck = canPlayCard(ClientState.gameState, ClientState.localPlayerRole, liveCard);
        if (!playCheck.success) {
            dState.type = 'INVALID';
        } else {
            const playAbs = liveCard.abilities?.filter(a => ['PLAY', 'PLAY_OPTIONAL', 'ON_BE_PLAYED'].includes(a.trigger)) || [];
            const hasOptional = playAbs.some(a => a.trigger === 'PLAY_OPTIONAL');
            
            if (hasOptional) {
                dState.type = 'OPTIONAL';
                // Trigger modal instantly on clickdown to bypass drag logic
                window.handleHandCardClick(cardId);
                dState.down = false; 
                return;
            } else {
                const hasMandatoryTarget = playAbs.find(a => a.activation?.method === 'PLAYER_CHOICE');
                if (hasMandatoryTarget) {
                    dState.abilityId = hasMandatoryTarget.abilityId;
                    const targets = getValidAbilityTargets(ClientState.gameState, ClientState.localPlayerRole, cardId, dState.abilityId);
                    if (targets.length > 0) {
                        dState.type = 'PLAY_TARGET';
                        dState.targets = targets.map(t => t.id);
                    } else {
                        dState.type = 'INVALID';
                    }
                } else if (liveCard.type === 'spell') {
                     const spellTarget = playAbs.find(a => a.activation?.method === 'PLAYER_CHOICE');
                     if (spellTarget) {
                         dState.abilityId = spellTarget.abilityId;
                         const targets = getValidAbilityTargets(ClientState.gameState, ClientState.localPlayerRole, cardId, dState.abilityId);
                         if (targets.length > 0) {
                             dState.type = 'PLAY_TARGET'; dState.targets = targets.map(t => t.id);
                         } else {
                             dState.type = 'INVALID';
                         }
                     } else {
                         dState.type = 'PLAY_BOARD';
                     }
                } else {
                    dState.type = 'PLAY_BOARD';
                }
            }
        }
    } else {
        // Board Drag = Attack ONLY
        if (gc.closest('#equator-cards-container')) {
            dState.type = 'INVALID'; 
        } else {
            const available = getEntityAvailableActions(ClientState.gameState, ClientState.localPlayerRole, cardId);
            const canAtk = available.find(a => a.type === 'ATTACK');
            if (canAtk) {
                const targets = getValidAttackTargets(ClientState.gameState, ClientState.localPlayerRole, liveCard);
                if (targets.length > 0) {
                    dState.type = 'ATTACK';
                    dState.abilityId = canAtk.abilityId;
                    dState.targets = targets.map(t => t.id);
                } else {
                    dState.type = 'INVALID';
                }
            } else {
                dState.type = 'INVALID';
            }
        }
    }
});

window.addEventListener('mousemove', e => {
    if (!dState.down && ClientState.pendingAbility) {
        const sourceCardId = ClientState.pendingAbility.entityId;
        const sourceGc = document.querySelector(`game-card[data-instance-id="${sourceCardId}"]`);
        if (sourceGc && sourceGc.firstElementChild) {
            const rect = sourceGc.firstElementChild.getBoundingClientRect();
            const startX = rect.left + rect.width / 2;
            const startY = rect.top + rect.height / 2;
            
            document.getElementById('drag-tether-overlay').classList.remove('hidden');
            
            const line = document.getElementById('drag-tether-line');
            const head = document.getElementById('drag-tether-head');
            const ctrlY = startY + (e.clientY - startY) / 2;
            
            line.setAttribute('d', `M ${startX},${startY} Q ${startX},${ctrlY} ${e.clientX},${e.clientY}`);
            head.setAttribute('cx', e.clientX);
            head.setAttribute('cy', e.clientY);
            
            ClientState.validTargets.forEach(t => {
               const el = document.querySelector(`game-card[data-instance-id="${t.id}"]`);
               const inner = el?.firstElementChild;
               if (inner) {
                   const tr = inner.getBoundingClientRect();
                   if (e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top && e.clientY <= tr.bottom) {
                       inner.classList.replace('ring-cyan-400', 'ring-amber-400');
                   } else {
                       inner.classList.replace('ring-amber-400', 'ring-cyan-400');
                   }
               }
            });
        }
        return;
    }

    if (!dState.down) return;

    if (!dState.dragging) {
        if (e.clientX < dState.rect.left || e.clientX > dState.rect.right || 
            e.clientY < dState.rect.top || e.clientY > dState.rect.bottom) {
            
            if (dState.type === 'INVALID') {
                const innerCard = dState.gc.firstElementChild;
                innerCard.classList.add('animate-error-flash');
                setTimeout(() => innerCard.classList.remove('animate-error-flash'), 500);
                dState.down = false;
                return;
            }

            dState.dragging = true;
            window._isDragging = true;
            window._dragCardId = dState.cardId;
            window._dragTargets = dState.targets;
            
            if (ClientState.pendingAbility) {
                ClientState.pendingAbility = null; ClientState.validTargets = []; 
            }

            updateUI(); // Renders the casting/target states dynamically

            // Refresh the source card reference and RECT so the tether perfectly tracks the raised card
            dState.gc = document.querySelector(`game-card[data-instance-id="${dState.cardId}"]`);
            if (dState.gc && dState.gc.firstElementChild) {
                dState.rect = dState.gc.firstElementChild.getBoundingClientRect();
            }

            document.getElementById('drag-tether-overlay').classList.remove('hidden');

            if (dState.type === 'PLAY_BOARD') {
                document.getElementById('player-board').classList.add('ring-4', 'ring-cyan-400', 'shadow-[0_0_30px_rgba(34,211,238,0.5)]');
            }
        }
    }

    if (dState.dragging) {
        const line = document.getElementById('drag-tether-line');
        const head = document.getElementById('drag-tether-head');
        
        const startX = dState.rect.left + dState.rect.width / 2;
        const startY = dState.rect.top + dState.rect.height / 2;
        const ctrlY = startY + (e.clientY - startY) / 2;
        
        line.setAttribute('d', `M ${startX},${startY} Q ${startX},${ctrlY} ${e.clientX},${e.clientY}`);
        head.setAttribute('cx', e.clientX);
        head.setAttribute('cy', e.clientY);

        if (dState.type === 'PLAY_BOARD') {
            const handWrapper = document.getElementById('player-hand-wrapper').getBoundingClientRect();
            if (e.clientY < handWrapper.top) {
                document.getElementById('player-board').classList.replace('ring-cyan-400', 'ring-amber-400');
            } else {
                document.getElementById('player-board').classList.replace('ring-amber-400', 'ring-cyan-400');
            }
        } else {
            dState.targets.forEach(tid => {
                const el = document.querySelector(`game-card[data-instance-id="${tid}"]`);
                const tr = el?.firstElementChild?.getBoundingClientRect();
                const inner = el?.firstElementChild;
                if (tr && e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top && e.clientY <= tr.bottom) {
                    inner?.classList.replace('ring-cyan-400', 'ring-amber-400');
                    dState.hoveredTarget = tid;
                } else if (inner) {
                    inner.classList.replace('ring-amber-400', 'ring-cyan-400');
                    if (dState.hoveredTarget === tid) dState.hoveredTarget = null;
                }
            });
        }
    }
});

window.addEventListener('mouseup', e => {
    if (dState.dragging) {
        let executed = false;
        if (dState.type === 'PLAY_BOARD') {
            const handWrapper = document.getElementById('player-hand-wrapper').getBoundingClientRect();
            if (e.clientY < handWrapper.top) {
                window.executeNormalPlay(dState.cardId);
                executed = true;
            }
        } else if (dState.type === 'ATTACK' || dState.type === 'PLAY_TARGET') {
            let hitTarget = null;
            dState.targets.forEach(tid => {
                const el = document.querySelector(`game-card[data-instance-id="${tid}"]`);
                const tr = el?.firstElementChild?.getBoundingClientRect();
                if (tr && e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top && e.clientY <= tr.bottom) {
                    hitTarget = tid;
                }
            });

            if (hitTarget) {
                if (dState.type === 'ATTACK') {
                    const tgc = document.querySelector(`game-card[data-instance-id="${hitTarget}"]`);
                    const lineDiv = tgc.closest('[id^="opp-line-"], [id^="player-line-"]');
                    const line = lineDiv ? lineDiv.id.split('-').pop() : 'mid';
                    executeAndLogAbility(dState.cardId, dState.abilityId, hitTarget, line);
                    executed = true;
                } else if (dState.type === 'PLAY_TARGET') {
                    window.executeNormalPlay(dState.cardId, dState.abilityId, hitTarget);
                    executed = true;
                }
            }
        }

        if (!executed && dState.rect && e.clientX >= dState.rect.left && e.clientX <= dState.rect.right && e.clientY >= dState.rect.top && e.clientY <= dState.rect.bottom) {
            window._forceHoverCardId = dState.cardId;
        } else {
            window._forceHoverCardId = null;
        }

        document.getElementById('drag-tether-overlay').classList.add('hidden');
        document.getElementById('player-board').classList.remove('ring-4', 'ring-cyan-400', 'ring-amber-400', 'shadow-[0_0_30px_rgba(34,211,238,0.5)]');
        
        window._isDragging = false;
        window._dragCardId = null;
        window._dragTargets = [];
        window._blockClick = true;
        updateUI();
        
        setTimeout(() => {
            window._blockClick = false;
        }, 50);
    } else {
        window._isDragging = false;
        window._dragCardId = null;
        window._dragTargets = [];
    }

    dState.down = false; dState.dragging = false; dState.type = null; dState.targets = []; dState.hoveredTarget = null;
});

window.handleUndo = handleUndo;