import { CARD_CATALOG, GLOBAL_UNDO_POLICY } from '../engine/index.js';
import { showToast, loadUI } from '../ui.js';
import { fetchCustomAbilities, fetchCustomCards, fetchUserDecks, fetchCustomTribes, subscribeToGameRoom, subscribeToUserInvites, subscribeToActiveMatches, pushActionToLog, db, messaging } from '../firebase.js';
import { generateAbilityDescription } from '../language_description.js';
import { loadPlayProfile, enableTurnNotifications, listenForForegroundNotifications } from '../profile.js';

import { ClientState } from './client_state.js';
import { updateUI } from './renderer.js';
import { handleQueueMatch, handleAIMatch, handleSendChallenge, handleAcceptInvite, handleResumeMatch, connectToMatch, reconstructStateFromLog } from './multiplayer.js';
import { handleSacrificeConfirm, handleSacrificeDecision, handleEndTurn, handleUndo, handleRestartMatch } from './interactions.js';

window.ClientState = ClientState;

// Bind UI actions to window object for web components
window.handleSacrificeConfirm = handleSacrificeConfirm;
window.handleSacrificeDecision = handleSacrificeDecision;

import './modals.js'; 
import '../../components/main_nav.js';
// Removed synchronous match_lobby.js import for lazy loading
import '../../components/action_log.js';
import '../../components/harvest_modal.js';
import '../../components/unit_action_modal.js';
import '../../components/zone_viewer_modal.js';

// Global Fallback Error Handlers
window.onerror = function(msg, url, lineNo, columnNo, error) {
  console.error("[GLOBAL ERROR]", msg, url, lineNo, columnNo, error);
  showToast("Fatal UI Error: " + msg, "error");
  const btn = document.getElementById('launch-match-btn');
  if (btn) { btn.innerHTML = '🚀 Launch Battleboard Tabletop'; btn.disabled = false; }
  return false;
};

window.addEventListener("unhandledrejection", function(event) {
  console.error("[GLOBAL PROMISE REJECTION]", event.reason);
  showToast("Async Error: " + (event.reason?.message || "Unknown rejection"), "error");
  const btn = document.getElementById('launch-match-btn');
  if (btn) { btn.innerHTML = '🚀 Launch Battleboard Tabletop'; btn.disabled = false; }
});

window.addEventListener('hashchange', () => {
    const newHash = window.location.hash;
    // If the Service Worker just dropped us into a room, force a hard reload to bypass the lobby
    if (newHash.includes('ROOM_')) {
        console.log("[INIT] Dynamic room navigation detected. Reloading...");
        window.location.reload();
    }
});

// Synchronously swap UI to prevent lobby flashing in Sandbox mode
if (window.location.hash.startsWith('#test_')) {
    const tabletop = document.getElementById('match-tabletop-screen');
    if (tabletop) tabletop.classList.remove('hidden');
}

// Initialize Engine Catalogs & UI Safely
async function initializeApp() {
    try {
        const [abs, cards, tribes] = await Promise.all([
            fetchCustomAbilities(),
            fetchCustomCards(),
            fetchCustomTribes(),
            loadUI()
        ]);
        
        ClientState.allCardsRegistry = [...CARD_CATALOG, ...cards];
        ClientState.customTribesList = tribes;
        ClientState.allAbilitiesRegistry = abs.map(ab => {
            let desc = '';
            try { desc = generateAbilityDescription(ab, abs, ClientState.allCardsRegistry, tribes); } catch(e) {}
            return { ...ab, displayDescription: desc };
        });
        console.log("[INIT] Registries and UI Styles loaded.");

        const hashData = window.location.hash.replace('#', '');
        const isTestMode = hashData.startsWith('test_');
        const urlRoom = isTestMode ? hashData.replace('test_', '') : hashData;
        const savedName = localStorage.getItem('henchies_last_username');

        if (isTestMode && urlRoom) {
            console.log("[INIT] Sandbox Test mode detected. Bypassing lobby.");
            ClientState.roomCode = urlRoom;
            ClientState.localPlayerRole = 'player1';
            document.getElementById('header-room-badge').innerText = `Sandbox: ${ClientState.roomCode}`;
            
            const anchor = document.getElementById('lobby-anchor');
            if (anchor) anchor.style.display = 'none';
            document.getElementById('match-tabletop-screen').classList.remove('hidden');
            
            console.log("[INIT] Subscribing to local Game Room...");
            subscribeToGameRoom(ClientState.roomCode, (data) => {
                if (data && data.turn_start_state) {
                    console.log("[INIT] Game room data received. Reconstructing board...");
                    reconstructStateFromLog(data);
                }
            });
        } else if (urlRoom && savedName) {
            // Direct Room URL Routing (BYPASS LOBBY ENTIRELY)
            console.log(`[INIT] Direct room link detected. Connecting to ${urlRoom}...`);
            
            const anchor = document.getElementById('lobby-anchor');
            if (anchor) anchor.innerHTML = '<div class="text-amber-400 font-bold text-center mt-20 text-xl animate-pulse">Entering Match...</div>';
            
            connectToMatch(urlRoom, savedName);
        } else {
            // MOUNT LOBBY
            await mountLobby();
            
            if (savedName) {
                const nameInput = document.getElementById('setup-username');
                if (nameInput) nameInput.value = savedName;
            }

            const undoCheckbox = document.getElementById('setup-allow-undo');
            if (undoCheckbox) {
                if (GLOBAL_UNDO_POLICY === 'FORCED_ON') {
                    undoCheckbox.checked = true;
                    undoCheckbox.disabled = true;
                } else if (GLOBAL_UNDO_POLICY === 'FORCED_OFF') {
                    undoCheckbox.checked = false;
                    undoCheckbox.disabled = true;
                }
            }

            await updateLobbyData();
            
            // Auto-trigger AI match if routed from the Deckbuilder
            if (window.location.search.includes('auto_ai=true')) {
                const btn = document.getElementById('ai-match-btn');
                if (btn) btn.click();
                // Clean up the URL to prevent reloading loops
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
        
        console.log(`[NOTIF-DEBUG] App initialized. Firebase messaging instance available: ${!!messaging}`);
        
        // Listen for foreground push notifications on the client
        // Note: Removed the `messaging` parameter to match the updated profile.js signature
        listenForForegroundNotifications((title, body) => {
            console.log(`[NOTIF-DEBUG] Foreground callback executed! Title: ${title}`);
            showToast(`${title}: ${body}`, "info");
        });
        
    } catch(err) {
        console.error("[INIT] Initialization failed:", err);
        showToast("Failed to initialize game registries.", "error");
    }
}

// Lazy Load the Lobby Component
async function mountLobby() {
    await import('../../components/match_lobby.js');
    const anchor = document.getElementById('lobby-anchor');
    if (anchor) {
        anchor.innerHTML = '<match-lobby></match-lobby>';
    }

    let lobbyDebounce;
    document.getElementById('setup-username')?.addEventListener('input', () => {
        clearTimeout(lobbyDebounce);
        lobbyDebounce = setTimeout(updateLobbyData, 500);
    });

    document.getElementById('queue-match-btn')?.addEventListener('click', (e) => handleQueueMatch(e.target));
    document.getElementById('ai-match-btn')?.addEventListener('click', (e) => handleAIMatch(e.target));
    document.getElementById('send-challenge-btn')?.addEventListener('click', (e) => handleSendChallenge(e.target));
}

async function updateDeckDropdown() {
  const usernameInput = document.getElementById('setup-username');
  if (!usernameInput) return; // Abort safely if lobby isn't mounted
  
  const username = usernameInput.value.trim();
  const select = document.getElementById('setup-deck-select');
  
  if (!username) {
      select.innerHTML = '<option value="">-- Enter Username to Load Decks --</option>';
      select.disabled = true;
      return;
  }
  
  select.innerHTML = '<option value="">-- Loading Decks from Cloud... --</option>';
  select.disabled = true;
  
  ClientState.loadedUserDecks = await fetchUserDecks(username);
  const deckNames = Object.keys(ClientState.loadedUserDecks);
  
  if (deckNames.length === 0) {
    select.innerHTML = '<option value="">No valid decks found for this username</option>';
    select.disabled = true;
  } else {
    select.innerHTML = '';
    deckNames.forEach(name => {
      select.innerHTML += `<option value="${name}">${name}</option>`;
    });
    select.disabled = false;
    
    const savedDeck = localStorage.getItem('henchies_last_deck');
    if (savedDeck && deckNames.includes(savedDeck)) {
        select.value = savedDeck;
    }
  }
}

let invitesUnsub = null;
let matchesUnsub = null;
let latestInvites = [];
let latestMatches = [];

function renderCombinedLobbyList(username) {
    const listEl = document.getElementById('combined-matches-list');
    const countEl = document.getElementById('combined-count');
    if (!listEl) return;

    // 1. Process matches to extract local turn states
    const enrichedMatches = latestMatches.map(m => {
        let realActivePlayerId = m.activePlayerId;
        let realTurnNumber = m.turnNumber || 1;
        let realTurnPhase = m.turnPhase || 'Setup';
        let activePlayerName = m.players ? m.players[realActivePlayerId + "Name"] : null;

        if (m.turn_start_state) {
            try {
                const stateObj = typeof m.turn_start_state === 'string' ? JSON.parse(m.turn_start_state) : m.turn_start_state;
                realActivePlayerId = stateObj.activePlayerId || realActivePlayerId;
                realTurnNumber = stateObj.turnNumber || realTurnNumber;
                realTurnPhase = stateObj.turnPhase || realTurnPhase;
                activePlayerName = stateObj.players?.[realActivePlayerId]?.name || activePlayerName;
            } catch (e) {
                console.warn("Failed to parse match state", e);
            }
        }
        
        const isMyTurn = activePlayerName === username;
        return { ...m, isMyTurn, realTurnNumber, realTurnPhase };
    });
    
    // 2. Separate into My Turn vs Waiting, sorted individually
    const myTurnMatches = enrichedMatches.filter(m => m.isMyTurn).sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));
    const waitingMatches = enrichedMatches.filter(m => !m.isMyTurn).sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));

    const totalItems = myTurnMatches.length + latestInvites.length + waitingMatches.length;
    if (countEl) countEl.innerText = totalItems;

    if (totalItems === 0) {
        listEl.innerHTML = '<span class="text-xs text-slate-500 italic px-1">No active games or invites.</span>';
        return;
    }

    let html = '';

    // Group 1: Your Turn (Matches)
    myTurnMatches.forEach(m => {
        const oppName = m.participants.find(p => p !== username) || 'Waiting...';
        const phaseStr = (m.realTurnPhase || 'Setup').replace('_', ' ');
        html += `
            <div class="flex justify-between items-center p-1.5 sm:p-2 rounded-md border border-amber-500/80 bg-amber-950/30 hover:bg-amber-950/50 shadow-[0_0_8px_rgba(245,158,11,0.1)] transition group mb-1.5 cursor-pointer" onclick="window.handleResumeMatch('${m.gameId}')">
                <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span class="text-[10px] sm:text-[11px] font-black text-amber-400 uppercase tracking-wider leading-none truncate">vs ${oppName}</span>
                    <div class="flex items-center gap-1.5 mt-0.5">
                        <span class="text-[9px] font-bold text-amber-500 animate-pulse flex items-center gap-1 leading-none">
                            <span class="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_#f59e0b]"></span> YOUR TURN
                        </span>
                        <span class="text-[9px] text-amber-600/70 font-semibold truncate hidden sm:inline">• T${m.realTurnNumber} • ${phaseStr}</span>
                    </div>
                </div>
                <div class="flex items-center gap-1 shrink-0 ml-2">
                    <button onclick="if(event)event.stopPropagation(); window.handleForfeitFromLobby('${m.gameId}')" class="text-[9px] text-amber-700 hover:text-red-500 font-bold px-1.5 py-0.5 rounded transition" title="Forfeit Match">🏳️</button>
                    <button class="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black px-2.5 sm:px-3 py-1 rounded text-[9px] font-black shadow-md transition-all active:scale-95">
                        PLAY
                    </button>
                </div>
            </div>
        `;
    });

    // Group 2: Pending Invites
    latestInvites.forEach(inv => {
        html += `
            <div class="flex justify-between items-center p-1.5 sm:p-2 rounded-md border border-sky-600/60 bg-sky-950/40 hover:bg-sky-900/50 shadow-sm transition group mb-1.5">
                <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span class="text-[10px] sm:text-[11px] font-black text-sky-300 uppercase tracking-wider leading-none truncate">Invite: ${inv.from}</span>
                    <div class="flex items-center gap-1.5 mt-0.5">
                        <span class="text-[9px] font-semibold text-sky-500 flex items-center gap-1 leading-none">
                            <span class="h-1 w-1 rounded-full bg-sky-500"></span> Pending...
                        </span>
                    </div>
                </div>
                <div class="flex items-center shrink-0 ml-2">
                    <button onclick="window.acceptAndJoinInvite('${inv.id}', '${inv.gameId}')" class="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1 rounded text-[9px] font-bold shadow-md transition-all active:scale-95">
                        ACCEPT
                    </button>
                </div>
            </div>
        `;
    });

    // Group 3: Waiting on Opponent (Matches)
    waitingMatches.forEach(m => {
        const oppName = m.participants.find(p => p !== username) || 'Waiting...';
        const phaseStr = (m.realTurnPhase || 'Setup').replace('_', ' ');
        html += `
            <div class="flex justify-between items-center p-1.5 sm:p-2 rounded-md border border-slate-700/50 bg-slate-800/30 opacity-70 hover:opacity-100 transition-opacity group mb-1.5 cursor-pointer" onclick="window.handleResumeMatch('${m.gameId}')">
                <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span class="text-[10px] sm:text-[11px] font-bold text-slate-300 leading-none truncate">vs ${oppName}</span>
                    <div class="flex items-center gap-1.5 mt-0.5">
                        <span class="text-[9px] font-semibold text-slate-500 flex items-center gap-1 leading-none">
                            <span class="h-1 w-1 rounded-full bg-slate-600"></span> Waiting
                        </span>
                        <span class="text-[9px] text-slate-600 font-semibold truncate hidden sm:inline">• T${m.realTurnNumber} • ${phaseStr}</span>
                    </div>
                </div>
                <div class="flex items-center gap-1 shrink-0 ml-2">
                    <button onclick="if(event)event.stopPropagation(); window.handleForfeitFromLobby('${m.gameId}')" class="text-[9px] text-slate-600 hover:text-red-500 font-bold px-1.5 py-0.5 rounded transition" title="Forfeit Match">🏳️</button>
                    <button class="bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1 rounded text-[9px] font-bold shadow-sm transition-colors border border-slate-600">
                        VIEW
                    </button>
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
}

window.acceptAndJoinInvite = async (inviteId, gameId) => {
    // Attempt to accept it (resolves backend updates)
    if (window.handleAcceptInvite) {
        await window.handleAcceptInvite(inviteId, gameId);
    }
    // Route instantly into the game
    if (window.handleResumeMatch) {
        window.handleResumeMatch(gameId);
    }
};

async function updateLobbyData() {
    const usernameInput = document.getElementById('setup-username');
    if (!usernameInput) return; // Abort safely if lobby isn't mounted
    
    await updateDeckDropdown();
    
    const username = usernameInput.value.trim();
    if (invitesUnsub) { invitesUnsub(); invitesUnsub = null; }
    if (matchesUnsub) { matchesUnsub(); matchesUnsub = null; }

    if (!username || window.location.hash.startsWith('#test_')) return;
    
    // Wire up push notification profile
    console.log(`[NOTIF-DEBUG] Lobby updated for user: ${username}. Fetching profile...`);
    ClientState.profile = await loadPlayProfile(db, username);
    const notifBtn = document.getElementById('enable-notifications-btn');
    
    if (notifBtn) {
        const updateBtnState = () => {
            console.log(`[NOTIF-DEBUG] UI Button State Update. Browser Permission: ${Notification.permission}`);
            if (Notification.permission === 'granted') {
                if (ClientState.profile && ClientState.profile.fcmTokens && ClientState.profile.fcmTokens.length > 0) {
                    console.log("[NOTIF-DEBUG] Token found in profile. UI Button -> Active/Disabled.");
                    notifBtn.innerText = "🔔 Notifications Active";
                    notifBtn.className = "bg-emerald-900/40 border border-emerald-700 text-emerald-300 font-bold px-2 py-0.5 rounded text-[9px] shadow-sm transition opacity-70 cursor-not-allowed";
                    notifBtn.disabled = true;
                    notifBtn.title = "Manage in browser settings";
                } else {
                    console.log("[NOTIF-DEBUG] Permission granted, but no token in profile. UI Button -> Sync.");
                    // Browser allows it, but Firebase profile is missing the token
                    notifBtn.innerText = "🔄 Sync Notifications";
                    notifBtn.className = "bg-amber-900/40 hover:bg-amber-800 border border-amber-700 text-amber-300 font-bold px-2 py-0.5 rounded text-[9px] shadow-sm transition";
                    notifBtn.disabled = false;
                    notifBtn.title = "Save device to profile";
                }
            } else if (Notification.permission === 'denied') {
                console.log("[NOTIF-DEBUG] Permission denied. UI Button -> Blocked.");
                notifBtn.innerText = "🔕 Notifications Blocked";
                notifBtn.className = "bg-red-900/40 border border-red-700 text-red-300 font-bold px-2 py-0.5 rounded text-[9px] shadow-sm transition opacity-70 cursor-not-allowed";
                notifBtn.disabled = true;
                notifBtn.title = "Unblock in browser settings (URL bar icon) to enable";
            } else {
                console.log("[NOTIF-DEBUG] Permission default (not asked). UI Button -> Enable.");
                notifBtn.innerText = "🔔 Notify on Turn";
                notifBtn.className = "bg-sky-900/40 hover:bg-sky-800 border border-sky-700 text-sky-300 font-bold px-2 py-0.5 rounded text-[9px] shadow-sm transition";
                notifBtn.disabled = false;
                notifBtn.title = "Enable turn notifications";
            }
        };

        // Run immediately to set initial state
        updateBtnState();

        // Listen to browser-level permission changes dynamically!
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'notifications' }).then((status) => {
                status.onchange = () => {
                    console.log(`[NOTIF-DEBUG] Browser permission changed via system! New status: ${status.state}`);
                    updateBtnState();
                }
            });
        }

        notifBtn.onclick = async () => {
            console.log("[NOTIF-DEBUG] Notification button clicked!");
            if (Notification.permission === 'denied') {
                showToast("Please allow notifications in your browser's URL bar settings.", "error");
                return;
            }
            
            const success = await enableTurnNotifications(messaging, db, username);
            if (success) {
                console.log("[NOTIF-DEBUG] enableTurnNotifications returned success.");
                showToast("Turn notifications enabled!", "success");
                // Mock local profile update so UI updates instantly
                if (!ClientState.profile) ClientState.profile = {};
                if (!ClientState.profile.fcmTokens) ClientState.profile.fcmTokens = [];
                ClientState.profile.fcmTokens.push('local_sync_token');
                updateBtnState();
            } else {
                console.error("[NOTIF-DEBUG] enableTurnNotifications returned false.");
                showToast("Failed to enable notifications. (Check console)", "error");
            }
        };
    }

    invitesUnsub = await subscribeToUserInvites(username, (invites) => {
        latestInvites = invites || [];
        renderCombinedLobbyList(username);
    });

    matchesUnsub = await subscribeToActiveMatches(username, (matches) => {
        latestMatches = matches || [];
        renderCombinedLobbyList(username);
    });
}

window.handleForfeitFromLobby = async (gameId) => {
    if (!confirm("Are you sure you want to forfeit this match?")) return;
    const username = document.getElementById('setup-username').value.trim();
    const actionPayload = { type: 'FORFEIT', playerName: username, actionIndex: Date.now() };
    await pushActionToLog(gameId, actionPayload, null, null);
    showToast("Match forfeited.", "info");
};

// Bind Global Event Listeners (Lobby listeners moved to mountLobby)
document.getElementById('cancel-action-btn').addEventListener('click', () => {
    ClientState.pendingAbility = null;
    ClientState.validTargets = [];
    updateUI();
});

window.handleAcceptInvite = handleAcceptInvite;
window.handleResumeMatch = handleResumeMatch;

document.getElementById('end-turn-btn').addEventListener('click', handleEndTurn);

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const zoneModal = document.getElementById('zone-viewer-modal');
    const isZoneOpen = zoneModal && !zoneModal.classList.contains('hidden');

    if (isZoneOpen) {
        if (e.key === 'Escape') window.closeZoneModal();
        return;
    }

    if (e.key.toLowerCase() === 'e') {
        const btn = document.getElementById('end-turn-btn');
        if (btn && !btn.disabled && !btn.classList.contains('hidden')) btn.click();
    } else if (e.key.toLowerCase() === 'c') {
        const btn = document.getElementById('overlay-sacrifice-confirm-btn');
        if (btn && !btn.disabled) btn.click();
    } else if (e.key.toLowerCase() === 's') {
        const btn = document.getElementById('overlay-sacrifice-skip-btn');
        if (btn && !btn.disabled) btn.click();
    } else if (e.key.toLowerCase() === 'u') {
        const btn = document.getElementById('undo-action-btn');
        if (btn && !btn.disabled && !btn.classList.contains('hidden')) btn.click();
    } else if (e.key === 'Escape') {
        if (ClientState.pendingAbility) document.getElementById('cancel-action-btn')?.click();
    }
});

// Run Initial Setup
initializeApp();