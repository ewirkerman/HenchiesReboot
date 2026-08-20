import { CARD_CATALOG, GLOBAL_UNDO_POLICY } from '../engine/index.js';
import { showToast, loadUI } from '../ui.js';
import { fetchCustomAbilities, fetchCustomCards, fetchUserDecks, fetchCustomTribes, subscribeToGameRoom } from '../firebase.js';
import { generateAbilityDescription } from '../language_description.js';

import { ClientState } from './client_state.js';
import { updateUI } from './renderer.js';
import { handleLaunchMatch, reconstructStateFromLog } from './multiplayer.js';
import { handleSacrificeConfirm, handleSacrificeDecision, handleEndTurn, handleUndo, handleRestartMatch } from './interactions.js';

import './modals.js'; 
import '../../components/main_nav.js';
import '../../components/match_lobby.js';
import '../../components/action_log.js';
import '../../components/harvest_overlay.js';
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

// Initialize Engine Catalogs & UI
fetchCustomAbilities().then(abs => {
    ClientState.allAbilitiesRegistry = abs.map(ab => ({
        ...ab,
        displayDescription: generateAbilityDescription(ab, abs)
    }));
    console.log("[INIT] Abilities loaded for tooltips.");
}).catch(e => console.warn('[INIT] Glossary fetch failed:', e));

fetchCustomCards().then(cards => {
    ClientState.allCardsRegistry = [...CARD_CATALOG, ...cards];
    console.log("[INIT] Catalog loaded for engine.");
}).catch(e => console.warn('[INIT] Catalog fetch failed:', e));

fetchCustomTribes().then(tribes => {
    ClientState.customTribesList = tribes;
}).catch(e => console.warn('[INIT] Tribes fetch failed:', e));

loadUI().then(() => console.log("[INIT] UI Styles loaded.")).catch(e => console.warn(e));

// Lobby & Sandbox Setup
const savedName = localStorage.getItem('henchies_last_username');
if (savedName) document.getElementById('setup-username').value = savedName;

const hashData = window.location.hash.replace('#', '');
const isTestMode = hashData.startsWith('test_');
const urlRoom = isTestMode ? hashData.replace('test_', '') : hashData;

if (isTestMode && urlRoom) {
  console.log("[INIT] Sandbox Test mode detected. Bypassing lobby.");
  ClientState.roomCode = urlRoom;
  ClientState.localPlayerRole = 'player1';
  document.getElementById('header-room-badge').innerText = `Sandbox: ${ClientState.roomCode}`;
  document.getElementById('match-setup-screen').classList.add('hidden');
  document.getElementById('match-tabletop-screen').classList.remove('hidden');
  
  Promise.all([fetchCustomCards(), fetchCustomAbilities()]).then(([cards, abs]) => {
      ClientState.allCardsRegistry = [...CARD_CATALOG, ...cards];
      ClientState.allAbilitiesRegistry = abs.map(ab => {
          let desc = '';
          try { desc = generateAbilityDescription(ab, abs); } catch(e) {}
          return { ...ab, displayDescription: desc };
      });
      subscribeToGameRoom(ClientState.roomCode, (data) => {
          if (data && data.turn_start_state) reconstructStateFromLog(data);
      });
  }).catch(err => {
      console.error("[INIT] Failed to initialize sandbox registries:", err);
      showToast("Failed to initialize game registries.", "error");
  });
} else {
  if (urlRoom) {
    document.getElementById('setup-room-code').value = urlRoom;
  } else {
    document.getElementById('setup-room-code').value = 'ROOM_' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }
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

async function updateDeckDropdown() {
  const username = document.getElementById('setup-username').value.trim();
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

// Bind Event Listeners
document.getElementById('setup-username').addEventListener('input', updateDeckDropdown);
document.getElementById('cancel-action-btn').addEventListener('click', () => {
    ClientState.pendingAbility = null;
    ClientState.validTargets = [];
    updateUI();
});

document.getElementById('launch-match-btn').addEventListener('click', handleLaunchMatch);
document.getElementById('overlay-sacrifice-confirm-btn').addEventListener('click', handleSacrificeConfirm);
document.getElementById('overlay-sacrifice-skip-btn').addEventListener('click', () => handleSacrificeDecision('SKIP'));
document.getElementById('end-turn-btn').addEventListener('click', handleEndTurn);
document.getElementById('undo-action-btn').addEventListener('click', handleUndo);

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const modal = document.getElementById('unit-action-modal');
    const zoneModal = document.getElementById('zone-viewer-modal');
    const isModalOpen = !modal.classList.contains('hidden');
    const isZoneOpen = zoneModal && !zoneModal.classList.contains('hidden');

    if (isZoneOpen) {
        if (e.key === 'Escape') window.closeZoneModal();
        return;
    }

    if (isModalOpen) {
        const num = parseInt(e.key);
        if (!isNaN(num) && num >= 1 && num <= 9) {
            const buttons = modal.querySelectorAll('#modal-abilities-container button');
            if (buttons[num - 1]) {
                buttons[num - 1].click();
            }
        }
        if (e.key === 'Escape') window.closeUnitActionModal();
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
    }
});

// Run Initial Setup
updateDeckDropdown();