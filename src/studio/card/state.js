// filepath: src/studio/card/state.js

/**
 * Global UI State Store for the Card Studio.
 * Centralizes variables so modules can read/write without circular dependencies.
 */
export const CardState = {
    allCards: [],
    allAbilities: [],
    allAbilitiesRegistry: [],
    customTribes: [],
    currentEditingId: null,
    currentAbilities: [],
    draggedAbilityIndex: null
};