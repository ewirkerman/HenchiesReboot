/**
 * src/profile.js
 * Manages the Play Profile object and handles FCM Notification registration.
 * 
 * Note: Refactored to remove direct Firebase imports. It now routes data calls
 * through the unified `firebase.js` architecture.
 */

import { 
    fetchUserProfile, 
    createUserProfile, 
    addFCMTokenToProfile, 
    requestFCMToken, 
    subscribeToFCMForeground 
} from './firebase.js';

// VAPID Key from Firebase Console (Project Settings > Cloud Messaging > Web Push certs)
const VAPID_KEY = 'BOb-PXzOy3x20GDI63oMrdYNiex7yMVgSHIUnIcORJAEe_dSax3wYusjlTNJKSguyUqETpXTuRBL3HA0l-AbWyo';

// Internal state to track turn changes easily without muddying the main engine
let previousActivePlayerId = null;

/**
 * Initializes or retrieves a Play Profile from the backend.
 * 
 * @param {Object} legacyDbParam - DEPRECATED: Passed for backward compatibility, ignored internally.
 * @param {String} usernameOpt - The player's username
 */
export async function loadPlayProfile(legacyDbParam, usernameOpt) {
    // Gracefully handle updated signature calls vs legacy callers
    let username = usernameOpt;
    if (arguments.length === 1 && typeof legacyDbParam === 'string') {
        username = legacyDbParam;
    }
    
    if (!username) return null;
    
    try {
        const existingProfile = await fetchUserProfile(username);
        if (existingProfile) {
            return existingProfile;
        }
    } catch (error) {
        console.warn("⚠️ [PROFILE] Read failed. Falling back.", error.message);
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

    const created = await createUserProfile(username, newProfile);
    return created ? newProfile : null;
}

/**
 * Requests browser notification permissions and saves the device token to the profile.
 * 
 * @param {Object} legacyMessaging - DEPRECATED: Handled by firebase.js now.
 * @param {Object} legacyDb - DEPRECATED: Handled by firebase.js now.
 * @param {String} username - The player's username.
 */
export async function enableTurnNotifications(legacyMessaging, legacyDb, usernameOpt) {
    let username = usernameOpt;
    // Auto-detect if caller just passed the username directly: enableTurnNotifications('Bob')
    if (arguments.length === 1 && typeof legacyMessaging === 'string') {
        username = legacyMessaging;
    }

    if (!username) return false;

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn("Notifications denied by user.");
            return false;
        }

        // Explicitly register and wait for the Service Worker to be active
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;

        // Fetch Token entirely through the centralized firebase API
        const currentToken = await requestFCMToken(VAPID_KEY, registration);

        if (currentToken) {
            await addFCMTokenToProfile(username, currentToken);
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
 * 
 * @param {Object} legacyMessaging - DEPRECATED: Handled by firebase.js.
 * @param {Function} onNotificationReceived - Callback to run on message.
 */
export function listenForForegroundNotifications(legacyMessaging, onNotificationReceivedOpt) {
    let onNotificationReceived = onNotificationReceivedOpt;
    if (typeof legacyMessaging === 'function') {
        onNotificationReceived = legacyMessaging;
    }

    subscribeToFCMForeground((payload) => {
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