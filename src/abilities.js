/**
 * Ability Logic Controller (Modular Production Ready)
 */

import { fetchCustomAbilities, saveAbilityToCatalog, fetchCustomCards, deleteAbilityFromCatalog } from './firebase.js';
import { CARD_CATALOG } from './engine.js';
import { generateAbilityDescription } from './language_description.js';
import { getActionTriggers } from './actions.js';

// --- STATE MANAGEMENT ---
const state = {
    allAbilities: [],
    allCards: [],
    currentEditingId: null,
    activationRoot: { type: 'group', logicalOperator: 'AND', children: [] },
    targetGroups: [] 
};

// --- CONSTANTS & CONFIGURATION ---

export const ZONES = ['HAND', 'DECK', 'FIELD', 'DISCARD', 'BANISH', 'ORIGINAL_DECK'];

export { EFFECT_TYPES } from './actions.js';

export const TRIGGER_EVENTS = [
    'MANUAL', 'UNTRIGGERABLE', 
    'TURN_STARTING', 'TURN_STARTED', 'TURN_ENDING', 'TURN_ENDED',
    'PLAY', 'PLAY_OPTIONAL', 'PLAYED',
    'ATTACK', 'ATTACKED',
    'HARVESTED', 'DISCARDED',
    ...getActionTriggers()
];

export const EFFECT_ZONE_MAP = {
    'DEAL_DAMAGE': ['FIELD'],
    'HEAL': ['FIELD'],
    'KILL': ['FIELD'],
    'ATTACH': ['FIELD'],
    'UNATTACH': ['FIELD'],
    'ATTACH_TO': ['FIELD'],
    'RETURN': ['FIELD'],
    'TRASH': ['FIELD'],
    'ATTACK': ['FIELD'],
    'DRAW_CARD': ['DECK'],
    'DISCARD': ['DECK', 'HAND'],
    'RECOVER': ['DISCARD'],
    'BANISH': ZONES,
    // Global Actions valid anywhere
    'SHUFFLE': ZONES,
    'BLOCK_ACT': ZONES,
    'BLOCK_ATTACK': ZONES,
    'BLOCK_RETALIATE': ZONES,
    'GRANT_ABILITY': ZONES,
    'MODIFY_STAT': ZONES,
    'SET_STAT': ZONES,
    'SUMMON': ZONES,
    'CUSTOM_SCRIPT': ZONES,
    'DISCARD_CARD': ['DECK', 'HAND'],
    'FIELD': ['HAND', 'DISCARD'],
    'PLAY': ['HAND'],
    'HARVEST': ['HAND']
};

export const SINGLE_ZONE_ACTIONS = {
    'DEAL_DAMAGE': 'FIELD', 'HEAL': 'FIELD', 'KILL': 'FIELD', 
    'ATTACH': 'FIELD', 'UNATTACH': 'FIELD', 'ATTACH_TO': 'FIELD', 
    'RETURN': 'FIELD', 'TRASH': 'FIELD',
    'ATTACK': 'FIELD',
    'DRAW_CARD': 'DECK', 'RECOVER': 'DISCARD',
    'PLAY': 'HAND', 'HARVEST': 'HAND'
};

export function getValidActionsForZones(selectedZones) {
    if (!selectedZones || selectedZones.length === 0) return []; 
    return EFFECT_TYPES.filter(action => {
        const validZones = EFFECT_ZONE_MAP[action] || ZONES; 
        // INTERSECTION LOGIC: The action must be valid in ALL selected zones
        return selectedZones.every(z => validZones.includes(z));
    });
}

const ATTRIBUTE_TYPES = {
    'entity': { label: 'Entity Type', type: 'select', options: ['SELF', 'AVATAR', 'UNIT', 'TARGET', 'ATTACKER'] },
    'zone': { label: 'Zone', type: 'select', options: ZONES },
    'tribe': { label: 'Tribe', type: 'select', options: ['Robot', 'Mythic', 'Elemental', 'Pirate', 'Undead', 'Carnie', 'Viking', 'Ninja', 'Stalker', 'Alien', 'Luchador'] },
    'family': { label: 'Family', type: 'text' },
    'genus': { label: 'Genus', type: 'text' },
    'health': { label: 'Current Health', type: 'number' },
    'strength': { label: 'Strength', type: 'number' },
    'hasAbility': { label: 'Has Ability', type: 'text' }
};

const OPERATORS = {
    '==': 'Is (==)',
    '!=': 'Is Not (!=)',
    '>': 'Greater Than (>)',
    '<': 'Less Than (<)'
};

// --- CORE INITIALIZATION ---
export async function initializeModule() {
    const rawAbilities = await fetchCustomAbilities();
    
    state.allAbilities = rawAbilities.map(ab => ({
        ...ab,
        displayDescription: generateAbilityDescription(ab)
    }));
      
    const customCards = await fetchCustomCards();
    if (customCards && customCards.length > 0) {
        const merged = [...CARD_CATALOG, ...customCards];
        state.allCards = Array.from(new Map(merged.map(c => [c.id, c])).values());
    } else {
        state.allCards = [...CARD_CATALOG];
    }
    
    return state;
}

// --- LOGIC TREE MANIPULATION ---
function getRoot(treeType) {
    if (treeType === 'activation') return state.activationRoot;
    if (treeType.startsWith('effect_')) {
        const index = parseInt(treeType.split('_')[1], 10);
        return state.targetGroups[index].logicTree;
    }
    return null;
}

function getNodeAtPath(treeType, path) {
    let current = getRoot(treeType);
    for (const index of path) {
        if (current && current.children) current = current.children[index];
        else return null;
    }
    return current;
}

export function addCondition(treeType, path) {
    const group = path.length === 0 ? getRoot(treeType) : getNodeAtPath(treeType, path);
    if (group && group.type === 'group') {
        group.children.push({ type: 'condition', attribute: 'entity', operator: '==', value: 'SELF' });
    }
}

export function addSubGroup(treeType, path) {
    const group = path.length === 0 ? getRoot(treeType) : getNodeAtPath(treeType, path);
    if (group && group.type === 'group') {
        group.children.push({ type: 'group', logicalOperator: 'AND', children: [] });
    }
}

export function removeNode(treeType, path) {
    if (path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const parentNode = getNodeAtPath(treeType, parentPath);
    const indexToRemove = path[path.length - 1];
    parentNode.children.splice(indexToRemove, 1);
}

export function updateNode(treeType, path, field, value) {
    const node = path.length === 0 ? getRoot(treeType) : getNodeAtPath(treeType, path);
    node[field] = value;
    
    if (field === 'attribute') {
        const typeDef = ATTRIBUTE_TYPES[value] || ATTRIBUTE_TYPES['entity'];
        node.value = typeDef.type === 'select' ? typeDef.options[0] : 1;
        node.operator = '==';
    }
}

// --- TARGET GROUP & PAYLOAD MANIPULATION ---
export function addTargetGroup() {
    state.targetGroups.push({
        targetMethod: 'SAME_AS_ACTIVATION',
        targetCount: 1,
        quickTargeting: { zones: ['FIELD'], alignment: ['ENEMY'], entityType: ['UNIT', 'AVATAR'], ignoreBattlelines: false },
        logicTree: { type: 'group', logicalOperator: 'AND', children: [] },
        payloads: [
            { type: 'DEAL_DAMAGE', amount: 1, duration: 'INSTANT' }
        ]
    });
}

export function removeTargetGroup(index) {
    state.targetGroups.splice(index, 1);
}

export function updateTargetGroup(index, field, value) {
    state.targetGroups[index][field] = value;
}

export function addPayload(groupIndex, initialType = 'DEAL_DAMAGE') {
    state.targetGroups[groupIndex].payloads.push({ type: initialType, amount: 1, duration: 'INSTANT' });
}

export function removePayload(groupIndex, payloadIndex) {
    state.targetGroups[groupIndex].payloads.splice(payloadIndex, 1);
}

export function updatePayload(groupIndex, payloadIndex, field, value) {
    const payload = state.targetGroups[groupIndex].payloads[payloadIndex];
    payload[field] = value;
    
    if (field === 'type') {
        const type = value;
        // Centralized logic for sanitizing parameterized effects based on type
        if (['DEAL_DAMAGE', 'HEAL', 'DRAW_CARD', 'DISCARD_CARD', 'DISCARD', 'TRASH', 'RECOVER'].includes(type)) { 
            payload.amount = 1; delete payload.stat; delete payload.grantedAbilityId; delete payload.cardId; delete payload.script; delete payload.nestedGroup; delete payload.zone;
        } else if (type === 'MODIFY_STAT' || type === 'SET_STAT') { 
            payload.amount = 1; payload.stat = 'strength'; delete payload.grantedAbilityId; delete payload.cardId; delete payload.script; delete payload.nestedGroup; delete payload.zone;
        } else if (type === 'GRANT_ABILITY') { 
            payload.grantedAbilityId = ''; delete payload.amount; delete payload.stat; delete payload.cardId; delete payload.script; delete payload.nestedGroup; delete payload.zone; delete payload.zoneOwner;
        } else if (type === 'SUMMON') { 
            payload.cardId = ''; payload.amount = 1; payload.zone = 'FIELD'; payload.zoneOwner = 'CASTER'; delete payload.grantedAbilityId; delete payload.script; delete payload.stat; 
            // Initialize a nested group specifically for SUMMON
            payload.nestedGroup = {
                targetMethod: 'AUTO_ALL',
                targetCount: 1,
                quickTargeting: { zones: ['FIELD'], alignment: ['FRIENDLY'], entityType: ['UNIT'], ignoreBattlelines: false },
                logicTree: { type: 'group', logicalOperator: 'AND', children: [] },
                payloads: []
            };
        } else if (type === 'CUSTOM_SCRIPT') { 
            payload.script = 'state.players[state.activePlayerId].health += params.amount;'; delete payload.amount; delete payload.grantedAbilityId; delete payload.cardId; delete payload.stat; delete payload.nestedGroup; delete payload.zone; delete payload.zoneOwner;
        } else if (['BLOCK_ACT', 'BLOCK_ATTACK', 'BLOCK_RETALIATE', 'SHUFFLE', 'RETURN', 'ATTACH', 'UNATTACH', 'FIELD', 'BANISH', 'PLAY', 'ATTACK', 'HARVEST'].includes(type)) { 
            delete payload.amount; delete payload.grantedAbilityId; delete payload.cardId; delete payload.script; delete payload.stat; delete payload.nestedGroup; delete payload.zone; delete payload.zoneOwner;
        }
    }
}

// --- DATA EXPORT & MIGRATION ---
export function exportCurrentState(formData) {
    return {
        abilityId: state.currentEditingId || ('ability_' + Date.now()),
        name: formData.name,
        description: formData.description || '',
        trigger: formData.trigger,
        triggerLimit: formData.triggerLimit || 'UNLIMITED',
        cost: {
            tribeAmount: parseInt(formData.tribeAmount) || 0,
            tent: parseInt(formData.tent) || 0,
            power: parseInt(formData.power) || 0,
            readinessCost: formData.readinessCost || 'NONE',
            reuseIgnoresReadiness: !!formData.reuseIgnoresReadiness
        },
        activation: { 
            method: formData.actMethod, 
            quickTargeting: formData.actQuickTargeting || { zones: ['FIELD'], alignment: ['ENEMY'], entityType: ['UNIT', 'AVATAR'], ignoreBattlelines: false }, 
            logicTree: JSON.parse(JSON.stringify(state.activationRoot)) 
        },
        effects: JSON.parse(JSON.stringify(state.targetGroups))
    };
}

export async function saveAbility(formData) {
    const ability = exportCurrentState(formData);
    await saveAbilityToCatalog(ability);
    
    const processedAbility = {
        ...ability,
        displayDescription: generateAbilityDescription(ability)
    };
    
    state.allAbilities = [...state.allAbilities.filter(a => a.abilityId !== ability.abilityId), processedAbility];
    return processedAbility;
}

export async function deleteAbility(abilityId) {
    if (!abilityId) return state;
    await deleteAbilityFromCatalog(abilityId);
    state.allAbilities = state.allAbilities.filter(a => a.abilityId !== abilityId);
    state.currentEditingId = null;
    return state;
}

export function hydrateStateFromAbility(ability) {
    state.currentEditingId = ability.abilityId;
    
    const srcAct = ability.activation || ability.targeting || {};
    state.activationRoot = srcAct.logicTree ? JSON.parse(JSON.stringify(srcAct.logicTree)) : { type: 'group', logicalOperator: 'AND', children: [] };
    
    const srcEffScope = ability.effectScope || { method: 'SAME_AS_ACTIVATION', count: 1, quickTargeting: { zones: ['FIELD'], alignment: ['ENEMY'], entityType: ['UNIT', 'AVATAR'], ignoreBattlelines: false }, logicTree: { type: 'group', logicalOperator: 'AND', children: [] } };

    if (ability.effects && ability.effects.length > 0) {
        state.targetGroups = JSON.parse(JSON.stringify(ability.effects)).map(e => {
            
            // Nested format found
            if (e.payloads) {
                if (!Array.isArray(e.quickTargeting?.zones)) e.quickTargeting.zones = ['FIELD'];
                if (!Array.isArray(e.quickTargeting?.alignment)) e.quickTargeting.alignment = ['ENEMY'];
                if (!Array.isArray(e.quickTargeting?.entityType)) e.quickTargeting.entityType = ['UNIT'];
                
                e.payloads = e.payloads.map(p => {
                    if (p.type === 'APPLY_TRAIT' || p.type === 'GRANT_TRAIT_OR_ABILITY') p.type = 'GRANT_ABILITY';
                    if (p.traitId) { p.grantedAbilityId = p.traitId; delete p.traitId; }
                    return p;
                });
                return e;
            }

            // Legacy Flat Format Wrapper
            const group = {
                targetMethod: e.targetMethod || srcEffScope.method || 'SAME_AS_ACTIVATION',
                targetCount: e.targetCount || srcEffScope.count || 1,
                logicTree: e.logicTree || srcEffScope.logicTree || { type: 'group', logicalOperator: 'AND', children: [] },
                payloads: []
            };

            const effQT = srcEffScope.quickTargeting || {};
            group.quickTargeting = {
                zones: Array.isArray(e.quickTargeting?.zones) ? e.quickTargeting.zones : ['FIELD'],
                alignment: Array.isArray(e.quickTargeting?.alignment) ? e.quickTargeting.alignment : 
                           (e.quickTargeting?.alignment === 'ANY' ? ['FRIENDLY', 'ENEMY'] : [e.quickTargeting?.alignment || srcEffScope.affiliation || e.targetAffiliation || 'ENEMY']),
                entityType: Array.isArray(e.quickTargeting?.entityType) ? e.quickTargeting.entityType : 
                            (e.quickTargeting?.entityType === 'ANY' ? ['UNIT', 'AVATAR', 'EQUIPMENT'] : [e.quickTargeting?.entityType || 'UNIT']),
                ignoreBattlelines: e.quickTargeting?.ignoreBattlelines !== undefined ? e.quickTargeting.ignoreBattlelines : 
                                   (e.quickTargeting?.line === 'ANY' || false)
            };

            let pType = e.type || 'DEAL_DAMAGE';
            if (pType === 'APPLY_TRAIT' || pType === 'GRANT_TRAIT_OR_ABILITY') pType = 'GRANT_ABILITY';
            
            group.payloads.push({
                type: pType,
                duration: e.duration || 'INSTANT',
                amount: e.amount,
                stat: e.stat,
                grantedAbilityId: e.grantedAbilityId || e.traitId,
                cardId: e.cardId,
                script: e.script,
                zone: e.zone,
                zoneOwner: e.zoneOwner || 'CASTER',
                nestedGroup: e.nestedGroup
            });
            
            return group;
        });
    } else {
        state.targetGroups = [];
    }
    
    return state;
}