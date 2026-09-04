/**
 * src/profile.js
 * Manages the Play Profile object and handles FCM Notification registration.
 */

import { getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// VAPID Key from Firebase Console (Project Settings > Cloud Messaging > Web Push certs)
// Replace this with your actual key to enable true push notifications.
const VAPID_KEY = 'BOb-PXzOy3x20GDI63oMrdYNiex7yMVgSHIUnIcORJAEe_dSax3wYusjlTNJKSguyUqETpXTuRBL3HA0l-AbWyo';

// Internal state to track turn changes easily without muddying the main engine
let previousActivePlayerId = null;

/**
 * Initializes or retrieves a Play Profile from Firestore.
 */
export async function loadPlayProfile(db, username) {
    if (!db || !username) return null;

    const profileRef = doc(db, 'profiles', username);
    
    try {
        const snap = await getDoc(profileRef);

        if (snap.exists()) {
            const data = snap.data();
            // Silently update activity timestamp
            updateDoc(profileRef, { lastActive: Date.now() }).catch(() => {});
            return data;
        }
    } catch (error) {
        console.warn("⚠️ [PROFILE] Firestore read failed. Please check Security Rules for 'profiles'.", error.message);
        // Fallback so the game doesn't crash for new players
        return { username, fcmTokens: [], isFallback: true };
    }

    // Default Profile Structure
    const newProfile = {
        username: username,
        fcmTokens: [],      
        activeDecks: [],    
        matchHistory: [],   
        createdAt: Date.now(),
        lastActive: Date.now()
    };

    try {
        await setDoc(profileRef, newProfile);
        return newProfile;
    } catch (e) {
        console.error("Failed to create profile document: ", e);
        return null;
    }
}

/**
 * Requests browser notification permissions and saves the device token to the profile.
 */
export async function enableTurnNotifications(messaging, db, username) {
    if (!messaging || !db || !username) return false;

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn("Notifications denied by user.");
            return false;
        }

        // Explicitly register and wait for the Service Worker to be active
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;

        // Pass the explicit registration to Firebase
        const currentToken = await getToken(messaging, { 
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        if (currentToken) {
            const profileRef = doc(db, 'profiles', username);
            await updateDoc(profileRef, {
                fcmTokens: arrayUnion(currentToken),
                lastActive: Date.now()
            });
            console.log("Device registered for turn notifications.");
            return true;
        } else {
            console.warn("No registration token available. Check VAPID key and messaging setup.");
            return false;
        }
    } catch (err) {
        console.error("An error occurred while setting up notifications: ", err);
        return false;
    }
}

/**
 * Listens for FCM push messages while the app is active and focused.
 */
export function listenForForegroundNotifications(messaging, onNotificationReceived) {
    if (!messaging) return;
    
    onMessage(messaging, (payload) => {
        console.log('Foreground message received: ', payload);
        if (onNotificationReceived && payload.notification) {
            onNotificationReceived(payload.notification.title, payload.notification.body);
        }
    });
}

export function checkTurnStateForNotification(newState, localUsername) {
    if (!newState || !localUsername || newState.status !== 'active') return;

    const currentActivePlayerId = newState.activePlayerId;
    const isOurTurnNow = newState.players[currentActivePlayerId]?.name === localUsername;
    
    // We attach a hidden flag to the state object to remember if we already fired for this turn
    const turnKey = `${newState.gameId}_${newState.turnNumber}_${currentActivePlayerId}`;
    if (newState._lastNotifiedTurn === turnKey) return;

    // Fire local UI hooks if it is our turn. 
    // We removed the local `new Notification()` call here because FCM Cloud Functions 
    // handles our push notifications now. This prevents duplicate popups!
    if (isOurTurnNow) {
        newState._lastNotifiedTurn = turnKey;
    }
}