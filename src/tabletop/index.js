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
            try { desc = generateAbilityDescription(ab, abs); } catch(e) {}
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
        
        // Listen for foreground push notifications on the client
        listenForForegroundNotifications(messaging, (title, body) => {
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

async function updateLobbyData() {
    const usernameInput = document.getElementById('setup-username');
    if (!usernameInput) return; // Abort safely if lobby isn't mounted
    
    await updateDeckDropdown();
    
    const username = usernameInput.value.trim();
    if (invitesUnsub) { invitesUnsub(); invitesUnsub = null; }
    if (matchesUnsub) { matchesUnsub(); matchesUnsub = null; }

    if (!username || window.location.hash.startsWith('#test_')) return;
    
    // Wire up push notification profile
    ClientState.profile = await loadPlayProfile(db, username);
    const notifBtn = document.getElementById('enable-notifications-btn');
    
    if (notifBtn) {
        const updateBtnState = () => {
            if (Notification.permission === 'granted') {
                if (ClientState.profile && ClientState.profile.fcmTokens && ClientState.profile.fcmTokens.length > 0) {
                    notifBtn.innerText = "🔔 Notifications Active";
                    notifBtn.className = "bg-emerald-900/40 border border-emerald-700 text-emerald-300 font-bold px-2 py-0.5 rounded text-[9px] shadow-sm transition opacity-70 cursor-not-allowed";
                    notifBtn.disabled = true;
                    notifBtn.title = "Manage in browser settings";
                } else {
                    // Browser allows it, but Firebase profile is missing the token
                    notifBtn.innerText = "🔄 Sync Notifications";
                    notifBtn.className = "bg-amber-900/40 hover:bg-amber-800 border border-amber-700 text-amber-300 font-bold px-2 py-0.5 rounded text-[9px] shadow-sm transition";
                    notifBtn.disabled = false;
                    notifBtn.title = "Save device to profile";
                }
            } else if (Notification.permission === 'denied') {
                notifBtn.innerText = "🔕 Notifications Blocked";
                notifBtn.className = "bg-red-900/40 border border-red-700 text-red-300 font-bold px-2 py-0.5 rounded text-[9px] shadow-sm transition opacity-70 cursor-not-allowed";
                notifBtn.disabled = true;
                notifBtn.title = "Unblock in browser settings (URL bar icon) to enable";
            } else {
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
                status.onchange = () => updateBtnState();
            });
        }

        notifBtn.onclick = async () => {
            if (Notification.permission === 'denied') {
                showToast("Please allow notifications in your browser's URL bar settings.", "error");
                return;
            }
            const success = await enableTurnNotifications(messaging, db, username);
            if (success) {
                showToast("Turn notifications enabled!", "success");
                // Mock local profile update so UI updates instantly
                if (!ClientState.profile) ClientState.profile = {};
                if (!ClientState.profile.fcmTokens) ClientState.profile.fcmTokens = [];
                ClientState.profile.fcmTokens.push('local_sync_token');
                updateBtnState();
            } else {
                showToast("Failed to enable notifications. (Check console)", "error");
            }
        };
    }

    invitesUnsub = await subscribeToUserInvites(username, (invites) => {
        const countEl = document.getElementById('invites-count');
        const listEl = document.getElementById('invites-list');
        if (countEl) countEl.innerText = invites.length;
        if (listEl) {
            if (invites.length === 0) {
                listEl.innerHTML = '<span class="text-xs text-slate-500 italic">No pending invites.</span>';
            } else {
                listEl.innerHTML = invites.map(inv => `
                    <div class="bg-slate-950 p-2 rounded border border-slate-700 flex justify-between items-center">
                        <span class="text-xs text-amber-300 font-bold">From: ${inv.from}</span>
                        <button onclick="window.handleAcceptInvite('${inv.id}', '${inv.gameId}')" class="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded transition">Accept</button>
                    </div>
                `).join('');
            }
        }
    });

    matchesUnsub = await subscribeToActiveMatches(username, (matches) => {
        const countEl = document.getElementById('matches-count');
        const listEl = document.getElementById('active-matches-list');
        if (countEl) countEl.innerText = matches.length;
        if (listEl) {
            if (matches.length === 0) {
                listEl.innerHTML = '<span class="text-xs text-slate-500 italic">No active matches.</span>';
            } else {
                listEl.innerHTML = matches.map(m => `
                    <div class="bg-slate-950 p-2 rounded border border-slate-700 flex justify-between items-center group">
                        <div class="flex flex-col cursor-pointer flex-1 hover:opacity-80 transition-opacity" onclick="window.handleResumeMatch('${m.gameId}')">
                            <span class="text-xs text-emerald-400 font-bold">vs ${m.participants.find(p => p !== username) || 'Waiting...'}</span>
                            <span class="text-[9px] text-slate-500">Turn ${m.turnNumber || 1} • ${(m.turnPhase || 'Setup').replace('_', ' ')}</span>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <button onclick="window.handleForfeitFromLobby('${m.gameId}')" class="text-[10px] text-slate-500 hover:text-red-400 font-bold px-1.5 py-0.5 rounded border border-transparent hover:border-red-900 transition" title="Forfeit Match">🏳️</button>
                            <span class="text-lg text-emerald-500 cursor-pointer" onclick="window.handleResumeMatch('${m.gameId}')">▶</span>
                        </div>
                    </div>
                `).join('');
            }
        }
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