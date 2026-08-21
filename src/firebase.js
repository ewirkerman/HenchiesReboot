/**
 * Henchies 2 Firebase Persistence & Multiplayer Sync Module
 * Includes Firestore real-time snapshot sync + LocalStorage fallback for seamless local/offline testing.
 * Updated to include Anonymous Authentication to pass Firestore security rules.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion, collection, getDocs, addDoc, deleteDoc, query, where
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

// Aggressive RAM Cache to prevent Firestore read spikes
const memoryCache = {
    cards: null,
    abilities: null,
    tribes: null,
    decks: {}
};

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
      // Safety timeout: if auth takes more than 3 seconds, assume offline and unlock the app
      setTimeout(() => {
          if (!authResolved) {
              console.warn("[FIREBASE] Auth initialization timed out after 3 seconds. Forcing offline mode.");
              isFirebaseOnline = false;
              resolveAuth();
          }
      }, 3000);
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
    isOpen: true,
    participants: [state.players.player1.name],
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

  // Bypass Firebase completely for Sandbox test rooms
  if (gameId.startsWith('TEST_')) {
      try {
          // Clean up old test data to prevent QuotaExceededError
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('henchies_game_TEST_')) {
                  keysToRemove.push(key);
              }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));

          localStorage.setItem(`henchies_game_${gameId}`, JSON.stringify(payload));
          window.dispatchEvent(new CustomEvent('henchies_local_game_update', { detail: payload }));
      } catch (e) {
          console.error("Failed to save sandbox match to LocalStorage. It may be full or blocked.", e);
          throw e;
      }
      return;
  }

  if (await isReadyForDB()) {
    try {
      await setDoc(doc(db, "games", gameId), payload);
      console.log("Game room created in Firestore");
    } catch (e) {
      console.error("Firestore createGameRoom failed:", e);
    }
  }
}

export async function pushActionToLog(gameId, actionPayload, updatedTurnStartState, currentHistoryLog) {
    if (gameId.startsWith('TEST_')) {
        const existing = localStorage.getItem(`henchies_game_${gameId}`);
        if (existing) {
            const data = JSON.parse(existing);
            if (!data.action_log) data.action_log = [];
            data.action_log.push(actionPayload);
            data.history_log = currentHistoryLog || data.history_log;
            if (updatedTurnStartState) data.turn_start_state = updatedTurnStartState;
            if (actionPayload.type === 'PLAYER_JOINED') {
                data.isOpen = false;
                if (!data.participants) data.participants = [];
                if (!data.participants.includes(actionPayload.playerName)) data.participants.push(actionPayload.playerName);
            }
            data.updatedAt = Date.now();
            localStorage.setItem(`henchies_game_${gameId}`, JSON.stringify(data));
            window.dispatchEvent(new CustomEvent('henchies_local_game_update', { detail: data }));
        }
        return;
    }

    if (await isReadyForDB()) {
        try {
            const updateData = {
                action_log: arrayUnion(actionPayload),
                history_log: currentHistoryLog,
                updatedAt: Date.now()
            };
            if (updatedTurnStartState) updateData.turn_start_state = updatedTurnStartState;
            if (actionPayload.type === 'PLAYER_JOINED') {
                updateData.isOpen = false;
                updateData.participants = arrayUnion(actionPayload.playerName);
            }
            
            await updateDoc(doc(db, "games", gameId), updateData);
        } catch (e) {
            console.error("Firestore pushActionToLog failed:", e);
        }
    }
}

export async function subscribeToGameRoom(gameId, callback) {
    if (gameId.startsWith('TEST_')) {
        const initial = localStorage.getItem(`henchies_game_${gameId}`);
        if (initial) callback(JSON.parse(initial));
        
        window.addEventListener('henchies_local_game_update', (e) => {
            if (e.detail && e.detail.gameId === gameId) {
                callback(e.detail);
            }
        });
        return;
    }

    if (await isReadyForDB()) {
        onSnapshot(doc(db, "games", gameId), (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data());
            } else {
                callback(null);
            }
        }, (err) => {
            console.error("Firestore subscription error:", err);
        });
    }
}

// ---------------------------------------------------------------------------
// DELTA SYNC ENGINE (REAL-TIME CACHING)
// ---------------------------------------------------------------------------

let syncListeners = { cards: null, abilities: null, tribes: null };

function syncCollection(collectionName, cacheKey, type, idKey) {
    return new Promise(async (resolve) => {
        const localData = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        memoryCache[type] = localData.filter(i => !i.isDeleted);
        
        let maxUpdated = 0;
        memoryCache[type].forEach(item => {
            if (item.updatedAt && item.updatedAt > maxUpdated) maxUpdated = item.updatedAt;
        });

        // Resolve instantly from local cache to allow offline-first booting
        if (maxUpdated > 0) resolve(memoryCache[type]);

        if (await isReadyForDB()) {
            if (syncListeners[type]) {
                if (maxUpdated === 0) resolve(memoryCache[type]);
                return; 
            }

            // Delta Query: Only fetch documents modified after our newest local document
            let q = maxUpdated > 0 
                ? query(collection(db, collectionName), where("updatedAt", ">", maxUpdated))
                : collection(db, collectionName);

            syncListeners[type] = onSnapshot(q, (snapshot) => {
                let changed = false;
                
                if (!snapshot.empty) {
                    snapshot.docChanges().forEach(change => {
                        const data = change.doc.data();
                        if (data.isDeleted) {
                            memoryCache[type] = memoryCache[type].filter(item => item[idKey] !== data[idKey]);
                        } else {
                            const idx = memoryCache[type].findIndex(item => item[idKey] === data[idKey]);
                            if (idx !== -1) memoryCache[type][idx] = data;
                            else memoryCache[type].push(data);
                        }
                        changed = true;
                    });
                }

                if (changed) {
                    localStorage.setItem(cacheKey, JSON.stringify(memoryCache[type]));
                    window.dispatchEvent(new CustomEvent('catalog_delta_sync', { detail: { type } }));
                }
                
                if (maxUpdated === 0) {
                    maxUpdated = Date.now();
                    resolve(memoryCache[type]); // Resolve the promise for first-time empty boots
                }
            }, (error) => {
                console.error(`Delta Sync Error (${type}):`, error);
                if (maxUpdated === 0) resolve(memoryCache[type]);
            });
        } else {
            if (maxUpdated === 0) resolve(memoryCache[type]);
        }
    });
}

// ---------------------------------------------------------------------------
// CATALOG OPERATIONS
// ---------------------------------------------------------------------------

export async function saveCardToCatalog(cardData) {
  cardData.updatedAt = Date.now(); // Force fresh timestamp for delta sync
  if (await isReadyForDB()) {
    try {
      await setDoc(doc(db, "cards", cardData.id), cardData);
      console.log("Card saved to Firestore");
    } catch (e) {
      console.warn("Firestore card save failed, saving to LocalStorage", e);
    }
  }

  // Update RAM cache
  if (memoryCache.cards) {
      const idx = memoryCache.cards.findIndex(c => c.id === cardData.id);
      if (idx !== -1) memoryCache.cards[idx] = cardData;
      else memoryCache.cards.push(cardData);
  }

  // Update LocalStorage fallback
  const existing = JSON.parse(localStorage.getItem('henchies_custom_cards') || '[]');
  const idx = existing.findIndex(c => c.id === cardData.id);
  if (idx !== -1) existing[idx] = cardData;
  else existing.push(cardData);
  localStorage.setItem('henchies_custom_cards', JSON.stringify(existing));
  return true;
}

export function fetchCustomCards() {
    return syncCollection('cards', 'henchies_custom_cards', 'cards', 'id');
}

export async function deleteCardFromCatalog(cardId) {
  if (await isReadyForDB()) {
    try {
      await updateDoc(doc(db, "cards", cardId), { isDeleted: true, updatedAt: Date.now() });
      console.log(`Card ${cardId} soft-deleted from Firestore`);
    } catch (e) {
      console.warn("Firestore soft-delete failed, falling back to LocalStorage", e);
    }
  }

  if (memoryCache.cards) {
      memoryCache.cards = memoryCache.cards.filter(c => c.id !== cardId);
  }

  const existing = JSON.parse(localStorage.getItem('henchies_custom_cards') || '[]');
  const filtered = existing.filter(c => c.id !== cardId);
  localStorage.setItem('henchies_custom_cards', JSON.stringify(filtered));
}


export async function saveAbilityToCatalog(abilityData) {
  abilityData.updatedAt = Date.now(); // Force fresh timestamp for delta sync
  if (await isReadyForDB()) {
    try {
      await setDoc(doc(db, "abilities", abilityData.abilityId), abilityData);
      console.log("Ability saved to Firestore");
    } catch (e) {
      console.warn("Firestore ability save failed, saving to LocalStorage", e);
    }
  }

  if (memoryCache.abilities) {
      const idx = memoryCache.abilities.findIndex(a => a.abilityId === abilityData.abilityId);
      if (idx !== -1) memoryCache.abilities[idx] = abilityData;
      else memoryCache.abilities.push(abilityData);
  }

  const existing = JSON.parse(localStorage.getItem('henchies_custom_abilities') || '[]');
  const idx = existing.findIndex(a => a.abilityId === abilityData.abilityId);
  if (idx !== -1) existing[idx] = abilityData;
  else existing.push(abilityData);
  localStorage.setItem('henchies_custom_abilities', JSON.stringify(existing));
  return true;
}

export function fetchCustomAbilities() {
    return syncCollection('abilities', 'henchies_custom_abilities', 'abilities', 'abilityId');
}

export async function deleteAbilityFromCatalog(abilityId) {
  if (await isReadyForDB()) {
    try {
      await updateDoc(doc(db, "abilities", abilityId), { isDeleted: true, updatedAt: Date.now() });
      console.log(`Ability ${abilityId} soft-deleted from Firestore`);
    } catch (e) {
      console.warn("Firestore soft-delete failed, falling back to LocalStorage", e);
    }
  }

  if (memoryCache.abilities) {
      memoryCache.abilities = memoryCache.abilities.filter(a => a.abilityId !== abilityId);
  }

  const existing = JSON.parse(localStorage.getItem('henchies_custom_abilities') || '[]');
  const filtered = existing.filter(a => a.abilityId !== abilityId);
  localStorage.setItem('henchies_custom_abilities', JSON.stringify(filtered));
}


export async function saveTribeToCatalog(tribeData) {
  tribeData.updatedAt = Date.now(); // Force fresh timestamp for delta sync
  if (await isReadyForDB()) {
    try {
      await setDoc(doc(db, "tribes", tribeData.id), tribeData);
      console.log("Tribe saved to Firestore");
    } catch (e) {
      console.warn("Firestore tribe save failed, saving to LocalStorage", e);
    }
  }

  if (memoryCache.tribes) {
      const idx = memoryCache.tribes.findIndex(t => t.id === tribeData.id);
      if (idx !== -1) memoryCache.tribes[idx] = tribeData;
      else memoryCache.tribes.push(tribeData);
  }

  const existing = JSON.parse(localStorage.getItem('henchies_custom_tribes') || '[]');
  const idx = existing.findIndex(t => t.id === tribeData.id);
  if (idx !== -1) existing[idx] = tribeData;
  else existing.push(tribeData);
  localStorage.setItem('henchies_custom_tribes', JSON.stringify(existing));
  return true;
}

export function fetchCustomTribes() {
    return syncCollection('tribes', 'henchies_custom_tribes', 'tribes', 'id');
}

export async function deleteTribeFromCatalog(tribeId) {
  if (await isReadyForDB()) {
    try {
      await updateDoc(doc(db, "tribes", tribeId), { isDeleted: true, updatedAt: Date.now() });
      console.log(`Tribe ${tribeId} soft-deleted from Firestore`);
    } catch (e) {
      console.warn("Firestore soft-delete failed, falling back to LocalStorage", e);
    }
  }

  if (memoryCache.tribes) {
      memoryCache.tribes = memoryCache.tribes.filter(t => t.id !== tribeId);
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

export async function fetchUserDecks(username, forceRefresh = false) {
    if (!forceRefresh && memoryCache.decks[username]) return memoryCache.decks[username];
    
    const localData = JSON.parse(localStorage.getItem(`henchies_decks_${username}`) || 'null');
    const lastSync = localStorage.getItem(`henchies_sync_decks_${username}`);
    const needsSync = forceRefresh || !localData || !lastSync || (Date.now() - parseInt(lastSync) > 1000 * 60 * 60 * 12);

    if (needsSync && await isReadyForDB()) {
        try {
            console.log(`[FIREBASE] ☁️ Fetching DECKS for ${username} from Cloud...`);
            const q = query(collection(db, "custom_decks"), where("username", "==", username));
            const qSnapshot = await getDocs(q);
            
            const userDecks = {};
            qSnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                userDecks[data.deckName] = data;
            });
            memoryCache.decks[username] = userDecks;
            localStorage.setItem(`henchies_decks_${username}`, JSON.stringify(userDecks));
            localStorage.setItem(`henchies_sync_decks_${username}`, Date.now().toString());
            return userDecks;
        } catch (e) {
            console.error("Error fetching decks:", e);
            return localData || {};
        }
    }
    
    console.log(`[FIREBASE] 💾 Loading DECKS for ${username} from LocalStorage cache (0 reads).`);
    memoryCache.decks[username] = localData || {};
    return memoryCache.decks[username];
}

export async function saveDeckToCatalog(username, deckName, deckData) {
    try {
        const deckId = `${username}_${deckName}`.replace(/[^a-zA-Z0-9_]/g, '_');
        const payload = {
            username,
            deckName,
            deckData,
            updatedAt: Date.now()
        };
        await setDoc(doc(db, "custom_decks", deckId), payload);
        
        if (!memoryCache.decks[username]) memoryCache.decks[username] = {};
        memoryCache.decks[username][deckName] = payload;
        localStorage.setItem(`henchies_decks_${username}`, JSON.stringify(memoryCache.decks[username]));
        
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
        
        if (memoryCache.decks[username]) {
            delete memoryCache.decks[username][deckName];
            localStorage.setItem(`henchies_decks_${username}`, JSON.stringify(memoryCache.decks[username]));
        }
        
        return true;
    } catch (e) {
        console.error("Error deleting deck:", e);
        return false;
    }
}

// =====================================
// LOBBY & MATCHMAKING
// =====================================

export async function findOpenQueueRoom(username) {
    if (await isReadyForDB()) {
        try {
            const qOpen = query(collection(db, "games"), where("isOpen", "==", true), where("status", "==", "active"));
            const snapshot = await getDocs(qOpen);
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                if (!data.participants.includes(username)) {
                    return data.gameId;
                }
            }
        } catch (e) {
            console.error("Error finding open room:", e);
        }
    }
    return 'ROOM_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

export async function sendDirectInvite(fromName, toName, gameId) {
    if (await isReadyForDB()) {
        try {
            await addDoc(collection(db, "invites"), {
                from: fromName,
                to: toName,
                gameId: gameId,
                status: 'pending',
                createdAt: Date.now()
            });
            return true;
        } catch(e) {
            console.error("Error sending invite:", e);
        }
    }
    return false;
}

export async function updateInviteStatus(inviteId, status) {
    if (await isReadyForDB()) {
        try {
            await updateDoc(doc(db, "invites", inviteId), { status });
        } catch(e) {
            console.error("Error updating invite:", e);
        }
    }
}

export async function subscribeToUserInvites(username, callback) {
    if (await isReadyForDB()) {
        const q = query(collection(db, "invites"), where("to", "==", username), where("status", "==", "pending"));
        return onSnapshot(q, (snapshot) => {
            const invites = [];
            snapshot.forEach(docSnap => invites.push({ id: docSnap.id, ...docSnap.data() }));
            callback(invites);
        }, (err) => console.error("Invites subscription error:", err));
    }
    return () => {};
}

export async function subscribeToActiveMatches(username, callback) {
    if (await isReadyForDB()) {
        const q = query(collection(db, "games"), where("participants", "array-contains", username), where("status", "==", "active"));
        return onSnapshot(q, (snapshot) => {
            const matches = [];
            snapshot.forEach(docSnap => matches.push(docSnap.data()));
            callback(matches);
        }, (err) => console.error("Active matches subscription error:", err));
    }
    return () => {};
}