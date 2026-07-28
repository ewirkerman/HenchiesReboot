/**
 * Henchies 2 Firebase Persistence & Multiplayer Sync Module
 * Includes Firestore real-time snapshot sync + LocalStorage fallback for seamless local/offline testing.
 */

// Firebase CDN Module Imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion, collection, getDocs, addDoc 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

// Default Firebase Configuration (Update with your project credentials if hosting on Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyDemoConfigKeyForPrototype12345",
  authDomain: "henchies2-prototype.firebaseapp.com",
  projectId: "henchies2-prototype",
  storageBucket: "henchies2-prototype.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

let app, db, storage;
let isFirebaseOnline = false;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  isFirebaseOnline = true;
  console.log("🔥 Firebase initialized successfully.");
} catch (e) {
  console.warn("⚠️ Firebase credentials offline/unconfigured. Falling back to LocalStorage sync.", e);
  isFirebaseOnline = false;
}

// ---------------------------------------------------------------------------
// GAME ROOM & MULTIPLAYER SYNC API
// ---------------------------------------------------------------------------

/**
 * Creates or overwrites a game room document in Firestore or LocalStorage.
 * Keyframe + Action Log architecture.
 */
export async function createGameRoom(gameId, state) {
  const payload = {
    gameId: state.gameId,
    status: state.status,
    turnNumber: state.turnNumber,
    activePlayerId: state.activePlayerId,
    turnPhase: state.turnPhase,
    players: {
      player1Name: state.players.player1.name,
      player2Name: state.players.player2.name
    },
    turn_start_state: state.turn_start_state || JSON.stringify(state),
    action_log: state.action_log || [],
    history_log: state.history_log || [],
    updatedAt: Date.now()
  };

  if (isFirebaseOnline) {
    try {
      await setDoc(doc(db, "games", gameId), payload);
      return;
    } catch (err) {
      console.warn("Firestore error on createGameRoom, using LocalStorage fallback", err);
    }
  }

  // LocalStorage Fallback
  localStorage.setItem(`henchies_game_${gameId}`, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent('henchies_local_game_update', { detail: payload }));
}

/**
 * Listens for real-time updates on a game document.
 */
export function subscribeToGameRoom(gameId, callback) {
  if (isFirebaseOnline) {
    try {
      const unsub = onSnapshot(doc(db, "games", gameId), (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data());
        }
      });
      return unsub;
    } catch (err) {
      console.warn("Firestore snapshot failed, falling back to LocalStorage listener", err);
    }
  }

  // LocalStorage Fallback listener
  const handler = (e) => {
    if (e.detail && e.detail.gameId === gameId) {
      callback(e.detail);
    }
  };
  window.addEventListener('henchies_local_game_update', handler);

  // Poll LocalStorage every second for multi-tab testing
  const interval = setInterval(() => {
    const raw = localStorage.getItem(`henchies_game_${gameId}`);
    if (raw) {
      callback(JSON.parse(raw));
    }
  }, 1000);

  return () => {
    window.removeEventListener('henchies_local_game_update', handler);
    clearInterval(interval);
  };
}

/**
 * Appends an action to the action_log and updates game state snapshot.
 */
export async function pushActionToLog(gameId, actionPayload, updatedTurnStartState = null, currentHistoryLog = []) {
  if (isFirebaseOnline) {
    try {
      const gameRef = doc(db, "games", gameId);
      const updateData = {
        action_log: arrayUnion(actionPayload),
        history_log: currentHistoryLog,
        updatedAt: Date.now()
      };
      if (updatedTurnStartState) {
        updateData.turn_start_state = updatedTurnStartState;
      }
      await updateDoc(gameRef, updateData);
      return;
    } catch (err) {
      console.warn("Firestore update failed, using LocalStorage fallback", err);
    }
  }

  // LocalStorage fallback
  const raw = localStorage.getItem(`henchies_game_${gameId}`);
  if (raw) {
    const data = JSON.parse(raw);
    data.action_log.push(actionPayload);
    data.history_log = currentHistoryLog;
    if (updatedTurnStartState) data.turn_start_state = updatedTurnStartState;
    data.updatedAt = Date.now();
    localStorage.setItem(`henchies_game_${gameId}`, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('henchies_local_game_update', { detail: data }));
  }
}

// ---------------------------------------------------------------------------
// CREATOR STUDIOS (CARDS & ABILITIES DB)
// ---------------------------------------------------------------------------

export async function saveCardToCatalog(cardData) {
  if (isFirebaseOnline) {
    try {
      await setDoc(doc(db, "cards", cardData.id), cardData);
      console.log("Card saved to Firestore");
    } catch (e) {
      console.warn("Firestore card save failed, saving to LocalStorage", e);
    }
  }

  const existing = JSON.parse(localStorage.getItem('henchies_custom_cards') || '[]');
  const idx = existing.findIndex(c => c.id === cardData.id);
  if (idx !== -1) existing[idx] = cardData;
  else existing.push(cardData);
  localStorage.setItem('henchies_custom_cards', JSON.stringify(existing));
}

export async function fetchCustomCards() {
  if (isFirebaseOnline) {
    try {
      const querySnapshot = await getDocs(collection(db, "cards"));
      const cards = [];
      querySnapshot.forEach((doc) => cards.push(doc.data()));
      if (cards.length > 0) return cards;
    } catch (e) {
      console.warn("Firestore card fetch failed, reading LocalStorage", e);
    }
  }
  return JSON.parse(localStorage.getItem('henchies_custom_cards') || '[]');
}

export async function saveAbilityToCatalog(abilityData) {
  if (isFirebaseOnline) {
    try {
      await setDoc(doc(db, "abilities", abilityData.abilityId), abilityData);
      console.log("Ability saved to Firestore");
    } catch (e) {
      console.warn("Firestore ability save failed, saving to LocalStorage", e);
    }
  }

  const existing = JSON.parse(localStorage.getItem('henchies_custom_abilities') || '[]');
  const idx = existing.findIndex(a => a.abilityId === abilityData.abilityId);
  if (idx !== -1) existing[idx] = abilityData;
  else existing.push(abilityData);
  localStorage.setItem('henchies_custom_abilities', JSON.stringify(existing));
}

export async function fetchCustomAbilities() {
  if (isFirebaseOnline) {
    try {
      const querySnapshot = await getDocs(collection(db, "abilities"));
      const abs = [];
      querySnapshot.forEach((doc) => abs.push(doc.data()));
      if (abs.length > 0) return abs;
    } catch (e) {
      console.warn("Firestore ability fetch failed, reading LocalStorage", e);
    }
  }
  return JSON.parse(localStorage.getItem('henchies_custom_abilities') || '[]');
}

export async function uploadCardArt(file) {
  if (isFirebaseOnline && file) {
    try {
      const storageRef = ref(storage, `card_art/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (e) {
      console.warn("Firebase Storage upload failed", e);
    }
  }
  return null;
}
