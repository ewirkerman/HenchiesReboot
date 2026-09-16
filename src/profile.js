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
        const firebaseScriptSw = './firebase-messaging-sw.js'
        const registration = await navigator.serviceWorker.register(firebaseScriptSw);
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
export function resolveNotificationTargetUrl(rawUrl, baseUrl = window.location.href) {
    if (!rawUrl) return new URL('game.html', baseUrl).href;
    if (/^https?:\/\//i.test(rawUrl)) return new URL(rawUrl).href;

    const cleanedUrl = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl;
    return new URL(cleanedUrl, baseUrl).href;
}

export function listenForForegroundNotifications(messaging, onNotificationReceived) {
    if (!messaging) return;

    subscribeToFCMForeground((payload) => {
        console.log('Foreground message received: ', payload);

        const data = payload.data || payload.notification;
        if (!data) return;

        const targetUrl = resolveNotificationTargetUrl(data.url || 'game.html', window.location.href);
        const currentUrl = new URL(window.location.href);
        const target = new URL(targetUrl);
        const isOnExactTarget = currentUrl.origin === target.origin &&
            currentUrl.pathname === target.pathname &&
            currentUrl.hash === target.hash;

        // 1. If the exact target room is already open and focused, do not interrupt the user.
        if (document.hasFocus() && isOnExactTarget) {
            if (onNotificationReceived) {
                onNotificationReceived(data.title || "Turn Update", data.body || "It's your turn!");
            }
            return;
        }

        // 2. If the user is focused elsewhere, or the tab is blurred, show a browser notification.
        if (Notification.permission === 'granted') {
            const notificationData = { ...data, url: targetUrl };
            const sysNotif = new Notification(data.title || "Turn Update", {
                body: data.body || "It's your turn!",
                data: notificationData
            });
            sysNotif.onclick = function() {
                window.location.href = notificationData.url;
                this.close();
            };
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