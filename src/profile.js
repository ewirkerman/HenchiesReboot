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
            console.log(`[NOTIF-DEBUG] Profile loaded for ${username}. FCM Tokens: ${existingProfile.fcmTokens?.length || 0}`);
            return existingProfile;
        }
    } catch (error) {
        console.warn("⚠️ [PROFILE] Read failed. Falling back.", error.message);
        // Fallback so the game doesn't crash for new players
        return { username, fcmTokens: [], isFallback: true };
    }

    // Default Profile Structure
    console.log(`[NOTIF-DEBUG] Creating new profile for ${username}.`);
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

    console.log(`[NOTIF-DEBUG] enableTurnNotifications called for user: ${username}`);
    if (!username) {
        console.error("[NOTIF-DEBUG] No username provided to enableTurnNotifications.");
        return false;
    }

    try {
        console.log("[NOTIF-DEBUG] Requesting Notification permission from browser...");
        const permission = await Notification.requestPermission();
        console.log(`[NOTIF-DEBUG] Permission result: ${permission}`);
        
        if (permission !== 'granted') {
            console.warn("[NOTIF-DEBUG] Notifications denied by user.");
            return false;
        }

        // Explicitly register and wait for the Service Worker to be active
        console.log("[NOTIF-DEBUG] Registering Service Worker './firebase-messaging-sw.js'...");
        const firebaseScriptSw = './firebase-messaging-sw.js'
        const registration = await navigator.serviceWorker.register(firebaseScriptSw);
        await navigator.serviceWorker.ready;
        console.log("[NOTIF-DEBUG] Service Worker is ready.");

        // Fetch Token entirely through the centralized firebase API
        console.log("[NOTIF-DEBUG] Requesting FCM Token...");
        const currentToken = await requestFCMToken(VAPID_KEY, registration);

        if (currentToken) {
            console.log(`[NOTIF-DEBUG] FCM Token acquired. Length: ${currentToken.length}. Saving to profile...`);
            await addFCMTokenToProfile(username, currentToken);
            console.log("[NOTIF-DEBUG] Device successfully registered for turn notifications.");
            return true;
        } else {
            console.warn("[NOTIF-DEBUG] No registration token returned. Check VAPID key and messaging setup.");
            return false;
        }
    } catch (err) {
        console.error("[NOTIF-DEBUG] An error occurred while setting up notifications: ", err);
        return false;
    }
}

/**
 * Listens for FCM push messages while the app is active and focused.
 * 
 * @param {Function} onNotificationReceived - Callback to run on message.
 */
export function resolveNotificationTargetUrl(rawUrl) {
    if (!rawUrl) rawUrl = 'game.html';
    if (/^https?:\/\//i.test(rawUrl)) return new URL(rawUrl).href;

    const cleanedUrl = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl;
    
    // import.meta.url points directly to this file (e.g., .../src/profile.js)
    // Resolving '../' + cleanedUrl safely anchors us back to the app's root directory
    // regardless of whether the user is currently on /studios/creator.html or /deckbuilder.html
    return new URL('../' + cleanedUrl, import.meta.url).href;
}

// REMOVED `messaging` requirement here. `firebase.js` handles it.
export function listenForForegroundNotifications(onNotificationReceived) {
    console.log("[NOTIF-DEBUG] Setting up listenForForegroundNotifications hook...");
    
    subscribeToFCMForeground((payload) => {
        console.log('[NOTIF-DEBUG] 🚨 FOREGROUND MESSAGE RECEIVED!', payload);

        const data = payload.data || payload.notification;
        if (!data) {
            console.warn('[NOTIF-DEBUG] Payload missing data/notification objects.');
            return;
        }

        const targetUrl = resolveNotificationTargetUrl(data.url || 'game.html');
        const currentUrl = new URL(window.location.href);
        const target = new URL(targetUrl);
        const isOnExactTarget = currentUrl.origin === target.origin &&
            currentUrl.pathname === target.pathname &&
            currentUrl.hash === target.hash;

        console.log(`[NOTIF-DEBUG] Foreground target analysis. Current: ${currentUrl.hash}, Target: ${target.hash}. Exact Match: ${isOnExactTarget}, HasFocus: ${document.hasFocus()}`);

        // 1. If the exact target room is already open and focused, do not interrupt the user.
        if (document.hasFocus() && isOnExactTarget) {
            console.log('[NOTIF-DEBUG] User is active in the target room. Triggering local UI hook instead of system notification.');
            if (onNotificationReceived) {
                onNotificationReceived(data.title || "Turn Update", data.body || "It's your turn!");
            }
            return;
        }

        // 2. If the user is focused elsewhere, or the tab is blurred, show a browser notification.
        if (Notification.permission === 'granted') {
            console.log('[NOTIF-DEBUG] User not focused on target. Displaying system Notification.');
            const notificationData = { ...data, url: targetUrl };
            const sysNotif = new Notification(data.title || "Turn Update", {
                body: data.body || "It's your turn!",
                data: notificationData
            });
            sysNotif.onclick = function() {
                window.location.href = notificationData.url;
                this.close();
            };
        } else {
            console.warn('[NOTIF-DEBUG] Cannot show fallback system notification; permission not granted.');
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