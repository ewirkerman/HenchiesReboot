// filepath: src/studio/ability/state.js

/**
 * Global UI State Store for the Ability Studio.
 * Centralizes variables so modules can read/write without circular dependencies.
 */
export const StudioState = {
    allAbilities: [],
    allAbilitiesRegistry: [], 
    allCards: [],
    customTribesList: [],
    currentEditingId: null,
    
    // UI Targeting State
    activationQuickTargeting: { zones: ['FIELD'], alignment: ['ENEMY'], entityType: ['UNIT', 'AVATAR'], ignoreBattlelines: false },
    showAdvancedActivation: false,
    activationRoot: { type: 'group', logicalOperator: 'AND', children: [] },
    effectGroups: [],
    
    // Trigger State
    lastTriggerValue: '',
    additionalTriggers: [],

    // Mentions Autocomplete State
    mentionActive: false,
    mentionStart: -1,
    selectedMentionIndex: 0,
    filteredMentions: [],

    // Drag and Drop State
    draggedAbilityIndex: null,
    draggedPayloadInfo: null,
    
    // External App Links
    activeAssignerId: null
};