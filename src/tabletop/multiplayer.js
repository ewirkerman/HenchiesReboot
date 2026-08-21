import { ClientState } from './client_state.js';
import { updateUI } from './renderer.js';
import { createGameRoom, subscribeToGameRoom, pushActionToLog, findOpenQueueRoom, sendDirectInvite, updateInviteStatus } from '../firebase.js';
import { initGame, joinGame, cloneGameState, executeSacrificeDecision, playCard, executeEntityAction, endTurn, hydrateAbility, GameEngine, startTurn } from '../engine/index.js';
import { showToast } from '../ui.js';

export async function validateAndGetDeck() {
    const username = document.getElementById('setup-username').value.trim();
    if (!username) {
        showToast('You must enter a username!', 'error');
        return null;
    }

    const deckOption = document.getElementById('setup-deck-select').value;
    if (!deckOption) {
      showToast('You must construct and select a valid 41-card deck to play!', 'error');
      return null;
    }
    
    const loadedData = ClientState.loadedUserDecks[deckOption]?.deckData;

    if (!loadedData || loadedData.length !== 41) {
      showToast('The selected deck is invalid or corrupted!', 'error');
      return null;
    }

    try {
      const combinedCatalog = ClientState.allCardsRegistry;
      const rawAbs = ClientState.allAbilitiesRegistry;

      const hydratedDeck = [];
      let missingCards = 0;

      for (const savedCard of loadedData) {
          const cardId = savedCard.id || savedCard;
          const fresh = combinedCatalog.find(c => c.id === cardId);
          
          if (!fresh) {
              missingCards++;
              continue;
          }
          
          const clone = JSON.parse(JSON.stringify(fresh));
          if (clone.abilities) {
              clone.abilities = clone.abilities.map(ab => hydrateAbility(ab, rawAbs)).filter(Boolean);
          }
          hydratedDeck.push(clone);
      }

      if (missingCards > 0) {
          showToast(`Error: Deck is missing ${missingCards} cards that were deleted from the studio. Please edit your deck.`, 'error');
          return null;
      }

      const avatars = hydratedDeck.filter(c => c.type === 'avatar');
      const standardCards = hydratedDeck.filter(c => c.type !== 'avatar');
      
      if (avatars.length !== 1 || standardCards.length !== 40) {
          showToast(`Invalid Deck! Must contain exactly 1 Avatar and 40 cards.`, 'error');
          return null;
      }
      
      const counts = {};
      standardCards.forEach(c => counts[c.id] = (counts[c.id] || 0) + 1);
      const overFour = Object.values(counts).filter(cnt => cnt > 4);
      const exactlyFour = Object.values(counts).filter(cnt => cnt === 4);
      
      if (overFour.length > 0 || exactlyFour.length > 1) {
          showToast('Invalid Deck! Violates copy limits.', 'error');
          return null;
      }

      ClientState.activeBattleDeck = hydratedDeck;
      return username;
    } catch(e) {
        console.warn("[LAUNCH] Failed to hydrate deck:", e);
        return null;
    }
}

export async function handleQueueMatch(btn) {
    const username = await validateAndGetDeck();
    if (!username) return;
    
    btn.innerHTML = '⏳ Finding Match...';
    btn.disabled = true;
    
    const gameId = await findOpenQueueRoom(username);
    ClientState.roomCode = gameId;
    window.location.hash = gameId;
    
    connectToMatch(gameId, username);
}

export async function handleAIMatch(btn) {
    const username = await validateAndGetDeck();
    if (!username) return;
    
    btn.innerHTML = '⏳ Loading...';
    btn.disabled = true;
    
    const gameId = 'TEST_AI_' + Date.now();
    ClientState.roomCode = gameId;
    window.location.hash = gameId;
    
    ClientState.localPlayerRole = 'player1';
    ClientState.gameState = initGame(gameId, username, ClientState.activeBattleDeck, ClientState.allAbilitiesRegistry, ClientState.allCardsRegistry, ClientState.customTribesList);
    
    ClientState.gameState = joinGame(ClientState.gameState, "AI Opponent", ClientState.activeBattleDeck);
    ClientState.gameState.players.player2.isAI = true;
    
    const allowUndoChk = document.getElementById('setup-allow-undo');
    if (allowUndoChk) ClientState.gameState.rules.allowUndo = allowUndoChk.checked;
    
    const engine = new GameEngine(ClientState.gameState);
    startTurn(ClientState.gameState, engine);
    
    await createGameRoom(gameId, ClientState.gameState);
    
    subscribeToGameRoom(gameId, (data) => {
        if (data && data.turn_start_state) {
            reconstructStateFromLog(data);
        }
    });

    enterTabletop();
}

export async function handleSendChallenge(btn) {
    const username = await validateAndGetDeck();
    if (!username) return;
    
    const toUser = document.getElementById('challenge-username').value.trim();
    if (!toUser) {
        showToast("Enter a friend's username to challenge them.", "error");
        return;
    }
    
    btn.innerHTML = '⏳...';
    btn.disabled = true;
    
    const gameId = 'ROOM_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const success = await sendDirectInvite(username, toUser, gameId);
    
    if (success) {
        ClientState.roomCode = gameId;
        window.location.hash = gameId;
        connectToMatch(gameId, username);
        showToast("Challenge sent! Waiting for them to accept.", "success");
    } else {
        showToast("Failed to send challenge.", "error");
        btn.innerHTML = 'Send ⚔️';
        btn.disabled = false;
    }
}

export async function handleAcceptInvite(inviteId, gameId) {
    const username = await validateAndGetDeck();
    if (!username) return;
    
    await updateInviteStatus(inviteId, 'accepted');
    
    ClientState.roomCode = gameId;
    window.location.hash = gameId;
    connectToMatch(gameId, username);
}

export async function handleResumeMatch(gameId) {
    const username = await validateAndGetDeck();
    if (!username) return;
    
    ClientState.roomCode = gameId;
    window.location.hash = gameId;
    connectToMatch(gameId, username);
}

export async function connectToMatch(gameId, username) {
    localStorage.setItem('henchies_last_username', username);
    localStorage.setItem('henchies_last_deck', document.getElementById('setup-deck-select').value);

    let isJoining = true;
    
    const connectionTimeout = setTimeout(() => {
      if (isJoining) {
        isJoining = false;
        showToast('Connection timed out. Firebase may be unavailable or blocked.', 'error');
        const qBtn = document.getElementById('queue-match-btn');
        if(qBtn) { qBtn.innerHTML = '🎲 Queue for Random Match'; qBtn.disabled = false; }
      }
    }, 8000);

    try {
      await subscribeToGameRoom(gameId, async (data) => {
        try {
          if (isJoining) {
            clearTimeout(connectionTimeout);
            isJoining = false;
            
            if (!data || !data.turn_start_state) {
              ClientState.localPlayerRole = 'player1';
              ClientState.gameState = initGame(gameId, username, ClientState.activeBattleDeck, ClientState.allAbilitiesRegistry, ClientState.allCardsRegistry, ClientState.customTribesList);
              
              const allowUndoChk = document.getElementById('setup-allow-undo');
              if (allowUndoChk) ClientState.gameState.rules.allowUndo = allowUndoChk.checked;
              
              const engine = new GameEngine(ClientState.gameState);
              startTurn(ClientState.gameState, engine);

              const createTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error("Database write timeout")), 5000));
              await Promise.race([createGameRoom(gameId, ClientState.gameState), createTimeout]);
              
              enterTabletop();
            } else {
              const parsedState = JSON.parse(data.turn_start_state);
              if (parsedState.players.player1.name === username) {
                  ClientState.localPlayerRole = 'player1';
                  reconstructStateFromLog(data);
                  enterTabletop();
              } else if (parsedState.players.player2.name === username) {
                  ClientState.localPlayerRole = 'player2';
                  reconstructStateFromLog(data);
                  enterTabletop();
              } else if (parsedState.players.player2.isDummy) {
                  ClientState.localPlayerRole = 'player2';
                  reconstructStateFromLog(data);
                  ClientState.gameState = joinGame(ClientState.gameState, username, ClientState.activeBattleDeck);
                  Object.defineProperty(ClientState.gameState, 'abilityCatalog', { value: ClientState.allAbilitiesRegistry, enumerable: false, configurable: true });
                  Object.defineProperty(ClientState.gameState, 'catalog', { value: ClientState.allCardsRegistry, enumerable: false, configurable: true });
                  Object.defineProperty(ClientState.gameState, 'tribeCatalog', { value: ClientState.customTribesList, enumerable: false, configurable: true });
                  
                  if (ClientState.gameState.activePlayerId === 'player2' && !ClientState.gameState.players.player2.setupComplete) {
                      const engine = new GameEngine(ClientState.gameState);
                      startTurn(ClientState.gameState, engine);
                  }

                  ClientState.gameState.actionIndex = (ClientState.gameState.actionIndex || 0) + 1;
                  const actionPayload = { type: 'PLAYER_JOINED', actionIndex: ClientState.gameState.actionIndex, playerName: username };
                  
                  const joinTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error("Database write timeout")), 5000));
                  await Promise.race([pushActionToLog(gameId, actionPayload, JSON.stringify(ClientState.gameState), ClientState.gameState.history_log), joinTimeout]);
                  
                  enterTabletop();
              } else {
                  showToast("Room is already full!", "error");
                  const qBtn = document.getElementById('queue-match-btn');
                  if(qBtn) { qBtn.innerHTML = '🎲 Queue for Random Match'; qBtn.disabled = false; }
              }
            }
          } else {
            if (data && data.turn_start_state) {
              reconstructStateFromLog(data);
            }
          }
        } catch (innerErr) {
          showToast("Error joining match: " + (innerErr.message || "Unknown error"), "error");
          isJoining = true; 
          const qBtn = document.getElementById('queue-match-btn');
          if(qBtn) { qBtn.innerHTML = '🎲 Queue for Random Match'; qBtn.disabled = false; }
        }
      });
    } catch (outerErr) {
      clearTimeout(connectionTimeout);
      showToast("Failed to connect to game servers: " + outerErr.message, "error");
      const qBtn = document.getElementById('queue-match-btn');
      if(qBtn) { qBtn.innerHTML = '🎲 Queue for Random Match'; qBtn.disabled = false; }
    }
}

export function enterTabletop() {
    document.getElementById('header-room-badge').innerText = `Lobby: ${ClientState.roomCode}`;
    document.getElementById('match-setup-screen').classList.add('hidden');
    document.getElementById('match-tabletop-screen').classList.remove('hidden');
    showToast(`Entered match tabletop as ${ClientState.localPlayerRole.toUpperCase()}!`, 'success');
    updateUI();
}

export function reconstructStateFromLog(data) {
    if (!data.turn_start_state) return;
    
    try {
      const baseState = JSON.parse(data.turn_start_state);
      
      Object.defineProperty(baseState, 'abilityCatalog', { value: ClientState.allAbilitiesRegistry, enumerable: false, configurable: true });
      Object.defineProperty(baseState, 'catalog', { value: ClientState.allCardsRegistry, enumerable: false, configurable: true });
      Object.defineProperty(baseState, 'tribeCatalog', { value: ClientState.customTribesList, enumerable: false, configurable: true });
      
      ClientState.localReplayStates = [cloneGameState(baseState)];
      let liveState = cloneGameState(baseState);
      liveState.isReconstructing = true;
      
      ClientState.lastSafeUndoIndex = 0;
      let lastRealActionIndex = 0;
      
      if (data.action_log && data.action_log.length > 0) {
        const validActions = [];
        for (const action of data.action_log) {
            if (action.type === 'UNDO') {
                const idx = validActions.findIndex(a => a.actionIndex === action.targetIndex);
                if (idx !== -1) validActions.splice(idx, 1);
                validActions.push(action); // Keep the UNDO marker to safely advance the sequence clock
            } else {
                validActions.push(action);
            }
        }
        
        for (const action of validActions) {
          if (action.actionIndex && action.actionIndex <= (liveState.actionIndex || 0)) {
            continue;
          }

          if (action.type === 'UNDO') {
              console.log(`[REPLAY] Processed UNDO marker. Fast-forwarding clock to ${action.actionIndex}`);
              liveState.actionIndex = action.actionIndex;
              liveState.history_log.push({ text: `⏪ Previous Action Undone.`, depth: 0 });
              continue;
          }
          
          if (action.type === 'SACRIFICE_DECISION') {
            executeSacrificeDecision(liveState, action.option, action.cardId);
          } else if (action.type === 'PLAY_CARD') {
            playCard(liveState, action.playerId, action.cardId, action.targetLine, action.chosenAbilityId, action.abilityTargetId);
          } else if (action.type === 'ENTITY_ACTION') {
            executeEntityAction(liveState, action.playerId, action.entityId, action.actionType, action.abilityId, action.targetId, action.targetLine);
          } else if (action.type === 'END_TURN') {
            endTurn(liveState);
          }
          liveState.actionIndex = action.actionIndex;
          if (action.type !== 'UNDO') lastRealActionIndex = action.actionIndex;
          
          if (action.isUnsafe || action.type === 'END_TURN' || action.type === 'PLAYER_JOINED') {
              ClientState.lastSafeUndoIndex = action.actionIndex;
          }
        }
      }
      
      liveState.lastRealActionIndex = lastRealActionIndex;
      liveState.isReconstructing = false;
      ClientState.gameState = liveState;
      Object.defineProperty(ClientState.gameState, 'abilityCatalog', { value: ClientState.allAbilitiesRegistry, enumerable: false, configurable: true });
      Object.defineProperty(ClientState.gameState, 'catalog', { value: ClientState.allCardsRegistry, enumerable: false, configurable: true });
      Object.defineProperty(ClientState.gameState, 'tribeCatalog', { value: ClientState.customTribesList, enumerable: false, configurable: true });
      ClientState.replayStepIndex = Math.max(0, ClientState.localReplayStates.length - 1);
      updateUI();
      
    } catch (err) {
      console.error("Error reconstructing game state from log:", err);
      showToast("Error loading game state. Data may be out of sync.", "error");
    }
}