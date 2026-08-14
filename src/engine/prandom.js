/**
 * src/prandom.js
 * Deterministic Mulberry32 PRNG and associated random functions.
 * Modifies and tracks the seed directly on the provided game state.
 */

/**
 * Core Mulberry32 PRNG.
 * Mutates the internal seed in gameState and returns a random float [0, 1).
 */
export function nextRandom(state) {
    if (state.rngSeed === undefined) {
        // Fallback initialization if somehow missing
        state.rngSeed = Math.floor(Math.random() * 4294967296);
    }
    // Advance the internal seed
    state.rngSeed = (state.rngSeed + 0x6D2B79F5) | 0;
    
    // Calculate the pseudo-random value
    let t = Math.imul(state.rngSeed ^ (state.rngSeed >>> 15), 1 | state.rngSeed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    
    // Normalize to [0, 1) float
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Returns a random integer between min (inclusive) and max (exclusive).
 */
export function randomInt(state, min, max) {
    return Math.floor(nextRandom(state) * (max - min)) + min;
}

/**
 * Generates a random alphanumeric ID string.
 */
export function generateId(state, length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(nextRandom(state) * chars.length);
        id += chars[randomIndex];
    }
    return id;
}

/**
 * Shuffles an array in-place using the Fisher-Yates algorithm.
 */
export function shuffleArray(state, array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(nextRandom(state) * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}