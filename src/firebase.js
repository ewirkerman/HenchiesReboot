/**
 * Henchies 2 Firebase Persistence & Multiplayer Sync Module
 * Includes Firestore real-time snapshot sync + LocalStorage fallback for seamless local/offline testing.
 * Updated to include Anonymous Authentication to pass Firestore security rules.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion, collection, getDocs, addDoc, deleteDoc 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Default Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyACHtGdXLq9TNZZchfrx46pUQcGb6ndtAI",
  authDomain: "henchies-reboot.firebaseapp.com",
  projectId: "henchies-reboot",
  storageBucket: "henchies-reboot.firebasestorage.app",
  messagingSenderId: "641284877771",
  appId: "1:641284877771:web:0497d79a089e6ca2831a4e"
};

let app, db, storage, auth;
let isFirebaseOnline = false;
let authReady = false; 

let authResolved = false;
let authWaiters = [];
const resolveAuth = () => {
    authResolved = true;
    authWaiters.forEach(resolve => resolve(isFirebaseOnline && authReady));
    authWaiters = [];
};

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
  
  // Sign in anonymously immediately so we have a valid request.auth for Firestore rules
  signInAnonymously(auth)
    .then(() => {
        console.log("🤫 Signed in anonymously");
    })
    .catch((error) => {
        console.error("Auth Error:", error.code, error.message);
        isFirebaseOnline = false;
        resolveAuth();
    });

  // Listen for auth state to confirm we are ready to write
  onAuthStateChanged(auth, (user) => {
    if (user) {
        authReady = true;
        isFirebaseOnline = true;
        console.log("🔥 Firebase initialized and User Authenticated. UID:", user.uid);
    } else {
        authReady = false;
    }
    resolveAuth();
  });

} catch (e) {
  console.warn("⚠️ Firebase credentials offline/unconfigured. Falling back to LocalStorage sync.", e);
  isFirebaseOnline = false;
  resolveAuth();
}

const isReadyForDB = () => {
  return new Promise((resolve) => {
    if (authResolved) {
      resolve(isFirebaseOnline && authReady);
    } else {
      authWaiters.push(resolve);
    }
  });
};

// ---------------------------------------------------------------------------
// GAME ROOM & MULTIPLAYER SYNC API
// ---------------------------------------------------------------------------

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

  if (await isReadyForDB()) {
    try {
      await setDoc(doc(db, "games", gameId), payload);
      return;
    } catch (err) {
      console.warn("Firestore error on createGameRoom, using LocalStorage fallback", err);
    }
  }

  localStorage.setItem(`henchies_game_${gameId}`, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent('henchies_local_game_update', { detail: payload }));
}

export function subscribeToGameRoom(gameId, callback) {
  let unsub = () => {};
  let isUnsubscribed = false;

  isReadyForDB().then((ready) => {
    if (isUnsubscribed) return; 

    if (ready) {
      try {
        const firestoreUnsub = onSnapshot(doc(db, "games", gameId), (snapshot) => {
          callback(snapshot.exists() ? snapshot.data() : null);
        });
        unsub = firestoreUnsub;
        return;
      } catch (err) {
        console.warn("Firestore snapshot failed, falling back to LocalStorage listener", err);
      }
    }

    const handler = (e) => {
      if (e.detail && e.detail.gameId === gameId) {
        callback(e.detail);
      }
    };
    window.addEventListener('henchies_local_game_update', handler);

    const interval = setInterval(() => {
      const raw = localStorage.getItem(`henchies_game_${gameId}`);
      if (raw) {
        callback(JSON.parse(raw));
      }
    }, 1000);

    unsub = () => {
      window.removeEventListener('henchies_local_game_update', handler);
      clearInterval(interval);
    };
  });

  return () => {
    isUnsubscribed = true;
    unsub();
  };
}

export async function pushActionToLog(gameId, actionPayload, updatedTurnStartState = null, currentHistoryLog = []) {
  if (await isReadyForDB()) {
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
  if (await isReadyForDB()) {
    try {
      await setDoc(doc(db, "cards", cardData.id), cardData);
      console.log("Card saved to Firestore");
      return true;
    } catch (e) {
      console.warn("Firestore card save failed, saving to LocalStorage", e);
    }
  }

  const existing = JSON.parse(localStorage.getItem('henchies_custom_cards') || '[]');
  const idx = existing.findIndex(c => c.id === cardData.id);
  if (idx !== -1) existing[idx] = cardData;
  else existing.push(cardData);
  localStorage.setItem('henchies_custom_cards', JSON.stringify(existing));
  return false;
}

export async function fetchCustomCards() {
  if (await isReadyForDB()) {
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

export async function deleteCardFromCatalog(cardId) {
  if (await isReadyForDB()) {
    try {
      await deleteDoc(doc(db, "cards", cardId));
      console.log(`Card ${cardId} deleted from Firestore`);
    } catch (e) {
      console.warn("Firestore card delete failed, deleting from LocalStorage", e);
    }
  }

  const existing = JSON.parse(localStorage.getItem('henchies_custom_cards') || '[]');
  const filtered = existing.filter(c => c.id !== cardId);
  localStorage.setItem('henchies_custom_cards', JSON.stringify(filtered));
}


export async function saveAbilityToCatalog(abilityData) {
  if (await isReadyForDB()) {
    try {
      await setDoc(doc(db, "abilities", abilityData.abilityId), abilityData);
      console.log("Ability saved to Firestore");
      return true;
    } catch (e) {
      console.warn("Firestore ability save failed, saving to LocalStorage", e);
    }
  }

  const existing = JSON.parse(localStorage.getItem('henchies_custom_abilities') || '[]');
  const idx = existing.findIndex(a => a.abilityId === abilityData.abilityId);
  if (idx !== -1) existing[idx] = abilityData;
  else existing.push(abilityData);
  localStorage.setItem('henchies_custom_abilities', JSON.stringify(existing));
  return false;
}

export async function fetchCustomAbilities() {
  if (await isReadyForDB()) {
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

export async function deleteAbilityFromCatalog(abilityId) {
  if (await isReadyForDB()) {
    try {
      await deleteDoc(doc(db, "abilities", abilityId));
      console.log(`Ability ${abilityId} deleted from Firestore`);
    } catch (e) {
      console.warn("Firestore ability delete failed, deleting from LocalStorage", e);
    }
  }

  const existing = JSON.parse(localStorage.getItem('henchies_custom_abilities') || '[]');
  const filtered = existing.filter(a => a.abilityId !== abilityId);
  localStorage.setItem('henchies_custom_abilities', JSON.stringify(filtered));
}


export async function saveTribeToCatalog(tribeData) {
  if (await isReadyForDB()) {
    try {
      await setDoc(doc(db, "tribes", tribeData.id), tribeData);
      console.log("Tribe saved to Firestore");
      return true;
    } catch (e) {
      console.warn("Firestore tribe save failed, saving to LocalStorage", e);
    }
  }

  const existing = JSON.parse(localStorage.getItem('henchies_custom_tribes') || '[]');
  const idx = existing.findIndex(t => t.id === tribeData.id);
  if (idx !== -1) existing[idx] = tribeData;
  else existing.push(tribeData);
  localStorage.setItem('henchies_custom_tribes', JSON.stringify(existing));
  return false;
}

export async function fetchCustomTribes() {
  if (await isReadyForDB()) {
    try {
      const querySnapshot = await getDocs(collection(db, "tribes"));
      const tribes = [];
      querySnapshot.forEach((doc) => tribes.push(doc.data()));
      if (tribes.length > 0) return tribes;
    } catch (e) {
      console.warn("Firestore tribe fetch failed, reading LocalStorage", e);
    }
  }
  return JSON.parse(localStorage.getItem('henchies_custom_tribes') || '[]');
}

export async function deleteTribeFromCatalog(tribeId) {
  if (await isReadyForDB()) {
    try {
      await deleteDoc(doc(db, "tribes", tribeId));
      console.log(`Tribe ${tribeId} deleted from Firestore`);
    } catch (e) {
      console.warn("Firestore tribe delete failed, deleting from LocalStorage", e);
    }
  }

  const existing = JSON.parse(localStorage.getItem('henchies_custom_tribes') || '[]');
  const filtered = existing.filter(t => t.id !== tribeId);
  localStorage.setItem('henchies_custom_tribes', JSON.stringify(filtered));
}


export async function uploadCardArt(file) {
  if ((await isReadyForDB()) && file) {
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

// =====================================
// CUSTOM DECKS CATALOG (DECKBUILDER)
// =====================================

export async function fetchUserDecks(username) {
    try {
        const qSnapshot = await getDocs(collection(db, "custom_decks"));
        const userDecks = {};
        qSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.username === username) {
                userDecks[data.deckName] = data;
            }
        });
        return userDecks;
    } catch (e) {
        console.error("Error fetching decks:", e);
        return {};
    }
}

export async function saveDeckToCatalog(username, deckName, deckData) {
    try {
        const deckId = `${username}_${deckName}`.replace(/[^a-zA-Z0-9_]/g, '_');
        await setDoc(doc(db, "custom_decks", deckId), {
            username,
            deckName,
            deckData,
            updatedAt: Date.now()
        });
        return true;
    } catch (e) {
        console.error("Error saving deck:", e);
        return false;
    }
}

export async function deleteDeckFromCatalog(username, deckName) {
    try {
        const deckId = `${username}_${deckName}`.replace(/[^a-zA-Z0-9_]/g, '_');
        await deleteDoc(doc(db, "custom_decks", deckId));
        return true;
    } catch (e) {
        console.error("Error deleting deck:", e);
        return false;
    }
}