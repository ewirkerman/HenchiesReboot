// This single file now acts as a complete stand-in for your 'src/firebase.js' wrapper during tests.
// It exports dummy functions for EVERY function your real src/firebase.js exports, preventing ESM errors.

// Game Room & Multiplayer Sync API
export const createGameRoom = async () => {};
export const pushActionToLog = async () => {};
export const subscribeToGameRoom = async () => {};

// Catalog Operations
export const saveCardToCatalog = async () => true;
export const fetchCustomCards = async () => [];
export const deleteCardFromCatalog = async () => {};

export const saveAbilityToCatalog = async () => true;
export const fetchCustomAbilities = async () => [];
export const deleteAbilityFromCatalog = async () => {};

export const saveTribeToCatalog = async () => true;
export const fetchCustomTribes = async () => [];
export const deleteTribeFromCatalog = async () => {};

export const uploadCardArt = async () => null;

// Custom Decks Catalog
export const fetchUserDecks = async () => ({});
export const saveDeckToCatalog = async () => true;
export const deleteDeckFromCatalog = async () => true;

// Lobby & Matchmaking
export const findOpenQueueRoom = async () => 'MOCK_ROOM_ID';
export const sendDirectInvite = async () => true;
export const updateInviteStatus = async () => {};
export const subscribeToUserInvites = async () => () => {};
export const subscribeToActiveMatches = async () => () => {};

// Profile & Push Notifications API
export const fetchUserProfile = async () => null;
export const createUserProfile = async () => true;
export const addFCMTokenToProfile = async () => true;
export const requestFCMToken = async () => null;
export const subscribeToFCMForeground = () => {};

// Core references
export const db = {};
export const messaging = {};

export default {};