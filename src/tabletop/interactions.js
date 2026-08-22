import { ClientState } from './client_state.js';
import { updateUI } from './renderer.js';
import { pushActionToLog } from '../firebase.js';
import { playCard, executeEntityAction, endTurn, executeSacrificeDecision, getValidAbilityTargets, getEntityAvailableActions, LINES, canPlayCard, isUndoable } from '../engine/index.js';
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
    const entity = getEntityRef(entityId);
    
    const ability = entity?.abilities?.find(a => a.abilityId === abilityId);
    const isAttack = ability?.effects?.some(g => g.payloads?.some(p => p.type === 'ATTACK'));
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
    const actionPayload = { type: 'SACRIFICE_DECISION', option, cardId, actionIndex: ClientState.gameState.actionIndex, isUnsafe: false };
    executeSacrificeDecision(ClientState.gameState, option, cardId);
    ClientState.selectedCardId = null;
    await pushActionToLog(ClientState.roomCode, actionPayload, null, ClientState.gameState.history_log);
    updateUI();
}

export async function handleEndTurn() {
    if (!ClientState.isMyTurn()) return;
    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
    const actionPayload = { type: 'END_TURN', actionIndex: ClientState.gameState.actionIndex, isUnsafe: true };
    endTurn(ClientState.gameState);
    const snapshot = JSON.stringify(ClientState.gameState);
    await pushActionToLog(ClientState.roomCode, actionPayload, snapshot, ClientState.gameState.history_log);
    updateUI();
}

export async function handleUndo() {
    console.log("[UNDO] Button clicked! State checks:", {
        isMyTurn: ClientState.isMyTurn(),
        rules: ClientState.gameState.rules,
        lastRealActionIndex: ClientState.gameState.lastRealActionIndex,
        lastSafeUndoIndex: ClientState.lastSafeUndoIndex
    });

    if (!ClientState.isMyTurn()) {
        console.warn("[UNDO] Aborted: Not your turn.");
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

    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
    
    const actionPayload = { 
        type: 'UNDO', 
        targetIndex: targetIdx, 
        actionIndex: ClientState.gameState.actionIndex 
    };
    
    console.log(`[UNDO] Processing undo for action index ${targetIdx}. New sequence index: ${actionPayload.actionIndex}`);
    showToast('Rewinding action...', 'info');
    
    await pushActionToLog(ClientState.roomCode, actionPayload, null, ClientState.gameState.history_log);
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
    if (event) event.stopPropagation();
    if (ClientState.pendingAbility) {
        showToast("Targeting cancelled.", "info");
        ClientState.pendingAbility = null;
        ClientState.validTargets = [];
        updateUI();
        return;
    }
};

window.handleEntityClick = async (prefix, line, entityId) => {
    if (event) event.stopPropagation();
    
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
            return;
        } else {
            showToast("Targeting cancelled.", "info");
            ClientState.pendingAbility = null;
            ClientState.validTargets = [];
            updateUI();
            return;
        }
    }

    if (prefix === 'player' || prefix === 'equator') {
      if (ClientState.gameState.turnPhase === 'ACTION_PHASE') {
        const actions = getEntityAvailableActions(ClientState.gameState, ClientState.localPlayerRole, entityId);
        if (actions.length > 0) {
          if (actions.length === 1 && actions[0].undoable) {
            window.activateAbility(entityId, actions[0].abilityId);
            return;
          }

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
          window.openActionModal(entityId, entityName, actions);
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
    if (event) event.stopPropagation();
    window.closeUnitActionModal();
    const player = ClientState.gameState.players[ClientState.localPlayerRole];
    const card = player.hand.find(c => c.instanceId === cardId || c.id === cardId);
    if (!card) return;

    const ability = card.abilities.find(a => a.abilityId === abilityId);
    
    const isHandActivate = ability.trigger === 'MANUAL' && ability.passiveFlags?.includes('ACTIVATE_FROM_HAND');
    
    if (ability?.activation?.method === 'PLAYER_CHOICE') {
        ClientState.validTargets = getValidAbilityTargets(ClientState.gameState, ClientState.localPlayerRole, cardId, abilityId);
        ClientState.pendingAbility = { entityId: cardId, abilityId: abilityId, isHandCard: true, isHandActivate };
        showToast(`Select a target for ${ability.name}`, 'info');
        updateUI();
        
        maybeOpenZoneModal();
        return;
    }

    if (isHandActivate) {
        executeAndLogAbility(cardId, abilityId, null, null);
    } else {
        await window.executeNormalPlay(cardId, abilityId);
    }
};

window.activateAbility = async (entityId, abilityId) => {
    if (event) event.stopPropagation();
    window.closeUnitActionModal();
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
    const ability = entity.abilities?.find(a => a.abilityId === abilityId);
    
    if (ability?.activation?.method === 'PLAYER_CHOICE') {
        ClientState.validTargets = getValidAbilityTargets(ClientState.gameState, ClientState.localPlayerRole, entityId, abilityId);
        ClientState.pendingAbility = { entityId, abilityId };
        showToast(`Select a target for ${ability.name}`, 'info');
        updateUI();
        
        maybeOpenZoneModal();
        return;
    }
    
    executeAndLogAbility(entityId, abilityId, null, null);
};

window.executeNormalPlay = async (cardId, chosenAbilityId = null, abilityTargetId = null) => {
    if (event) event.stopPropagation();
    window.closeUnitActionModal();
    ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
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
      updateUI();
    } else {
      showToast(result.reason, 'error');
    }
};

window.handleHandCardClick = async (cardId) => {
  if (event) event.stopPropagation();
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
          return;
      } else {
          showToast("Targeting cancelled.", "info");
          ClientState.pendingAbility = null;
          ClientState.validTargets = [];
          updateUI();
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
            
            if (t === 'PLAY_OPTIONAL') {
                return canPlay && canAffordAbility(ab.cost);
            }

            if (t === 'MANUAL' && ab.passiveFlags?.includes('ACTIVATE_FROM_HAND')) {
                // Hand activations don't require the card's base cost! We check base resources directly.
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

        if ((showPlayNormally ? 1 : 0) + playAbilities.length === 1) {
            if (showPlayNormally && !isPlayUnsafe(c, null)) {
                window.executeNormalPlay(cardId);
                return;
            }
            if (playAbilities.length === 1 && isUndoable(ClientState.gameState, playAbilities[0])) {
                window.activateHandCardAbility(cardId, playAbilities[0].abilityId);
                return;
            }
        }

        if (playAbilities.length > 0 || canPlay) {
            document.getElementById('modal-unit-name').innerText = `Action: ${c.name}`;
            const container = document.getElementById('modal-abilities-container');
            let html = '';
            let idx = 1;
            
            if (showPlayNormally) {
                const undoWarning = isPlayUnsafe(c, null) ? ' <span title="Cannot be undone" class="text-yellow-400 drop-shadow-md">⚠️</span>' : '';
                html += `<button onclick="window.executeNormalPlay('${cardId}')" class="bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/50 p-3 rounded-xl text-sm font-bold shadow-lg transition flex justify-center items-center gap-2">🃏 [${idx++}] Play Normally${undoWarning}</button>`;
            }

            playAbilities.forEach(ab => {
                const undoWarning = (!isUndoable(ClientState.gameState, ab)) ? ' <span title="Cannot be undone" class="text-yellow-400 drop-shadow-md">⚠️</span>' : '';
                html += `<button onclick="window.activateHandCardAbility('${cardId}', '${ab.abilityId}')" class="bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-500/50 p-3 rounded-xl text-sm font-bold shadow-lg transition flex justify-center items-center gap-2">✨ [${idx++}] ${ab.name}${undoWarning}</button>`;
            });
            
            if (html !== '') {
                container.innerHTML = html;
                document.getElementById('unit-action-modal').classList.remove('hidden');
            } else if (!canPlay) {
                showToast("Cannot play this card.", "error");
            }
        } else {
            showToast(playCheck.reason || "Cannot play this card.", "error");
        }
  }
};

window.openActionModal = (entityId, entityName, actions) => {
    document.getElementById('modal-unit-name').innerText = entityName;
    const container = document.getElementById('modal-abilities-container');
    
    let html = '';
    
    actions.forEach((act, idx) => {
      const hotkey = `[${idx + 1}]`;
      const undoWarning = (!act.undoable) ? ' <span title="Cannot be undone" class="text-yellow-400 drop-shadow-md">⚠️</span>' : '';
      if (act.type === 'ATTACK') {
        html += `<button onclick="window.activateAbility('${entityId}', '${act.abilityId}')" class="bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-500/50 p-3 rounded-xl text-sm font-bold shadow-lg transition flex justify-center items-center gap-2">⚔️ ${hotkey} ${act.name}${undoWarning}</button>`;
      } else if (act.type === 'ABILITY') {
        html += `<button onclick="window.activateAbility('${entityId}', '${act.abilityId}')" class="bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-500/50 p-3 rounded-xl text-sm font-bold shadow-lg transition flex justify-center items-center gap-2">✨ ${hotkey} ${act.name}${undoWarning}</button>`;
      }
    });
    
    container.innerHTML = html;
    document.getElementById('unit-action-modal').classList.remove('hidden');
};

window.closeUnitActionModal = () => {
    document.getElementById('unit-action-modal').classList.add('hidden');
};

window.handleUndo = handleUndo;