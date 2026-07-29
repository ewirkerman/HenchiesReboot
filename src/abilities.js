/**
 * Ability Logic Controller (Modular Concept)
 * 
 * In a real-world bundled environment, this file would be imported by your main UI 
 * component to handle all data manipulation, state management, and HTML generation 
 * completely separate from the DOM event listeners.
 */

import { fetchCustomAbilities, saveAbilityToCatalog, fetchCustomCards } from './firebase.js';
import { CARD_CATALOG } from './engine.js';

// --- STATE MANAGEMENT ---
// Centralized state avoids messy global variables scattering across the file.
const state = {
    allAbilities: [],
    allCards: [],
    currentEditingId: null,
    
    // Dual Logic Trees
    activationRoot: { type: 'group', logicalOperator: 'AND', children: [] },
    effectScopeRoot: { type: 'group', logicalOperator: 'AND', children: [] },
    
    // N-Payloads
    abilityEffects: [{ type: 'DEAL_DAMAGE', amount: 2 }]
};

// --- CONSTANTS & CONFIGURATION ---
const ATTRIBUTE_TYPES = {
    'entity': { label: 'Entity Type', type: 'select', options: ['SELF', 'HERO', 'UNIT', 'TARGET', 'ATTACKER'] },
    'tribe': { label: 'Tribe', type: 'select', options: ['Robot', 'Mythic', 'Elemental', 'Pirate', 'Undead', 'Carnie', 'Viking', 'Ninja', 'Stalker', 'Alien', 'Luchador'] },
    'line': { label: 'Board Line', type: 'select', options: ['front', 'mid', 'back', 'bodyguard', 'hero'] },
    'health': { label: 'Current Health', type: 'number' },
    'strength': { label: 'Strength', type: 'number' },
    'hasAbility': { label: 'Has Ability / Trait', type: 'text' }
};

const OPERATORS = {
    '==': 'Is (==)',
    '!=': 'Is Not (!=)',
    '>': 'Greater Than (>)',
    '<': 'Less Than (<)'
};

// --- CORE INITIALIZATION ---
export async function initializeModule() {
    state.allAbilities = await fetchCustomAbilities();
      
    const customCards = await fetchCustomCards();
    if (customCards && customCards.length > 0) {
        // Merge and deduplicate
        const merged = [...CARD_CATALOG, ...customCards];
        state.allCards = Array.from(new Map(merged.map(c => [c.id, c])).values());
    } else {
        state.allCards = [...CARD_CATALOG];
    }
    
    return state;
}

// --- LOGIC TREE MANIPULATION ---
// These functions perform pure data mutations on our tree structures.

function getRoot(treeType) {
    return treeType === 'activation' ? state.activationRoot : state.effectScopeRoot;
}

function getNodeAtPath(treeType, path) {
    let current = getRoot(treeType);
    for (const index of path) {
        if (current && current.children) {
            current = current.children[index];
        } else {
            return null; // Invalid path
        }
    }
    return current;
}

export function addCondition(treeType, path) {
    const group = path.length === 0 ? getRoot(treeType) : getNodeAtPath(treeType, path);
    if (group && group.type === 'group') {
        group.children.push({ type: 'condition', attribute: 'tribe', operator: '==', value: 'Robot' });
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
    
    // Auto-reset value if the attribute type changes
    if (field === 'attribute') {
        const typeDef = ATTRIBUTE_TYPES[value];
        node.value = typeDef.type === 'select' ? typeDef.options[0] : 1;
        node.operator = '==';
    }
}

// --- EFFECT PAYLOAD MANIPULATION ---

export function addEffectPayload() {
    state.abilityEffects.push({ type: 'DEAL_DAMAGE', amount: 1 });
}

export function removeEffectPayload(index) {
    state.abilityEffects.splice(index, 1);
}

export function updateEffectPayload(index, field, value) {
    state.abilityEffects[index][field] = value;
    
    // Auto-scaffold necessary fields when type changes
    if (field === 'type') {
        const type = value;
        const eff = { type: type };
        if (['DEAL_DAMAGE', 'HEAL', 'MODIFY_STAT', 'DRAW_CARD'].includes(type)) eff.amount = 1;
        else if (type === 'GRANT_ABILITY') eff.grantedAbilityId = '';
        else if (type === 'SUMMON') eff.cardId = 'target_dummy';
        else if (type === 'CUSTOM_SCRIPT') eff.script = 'state.players[state.activePlayerId].health += params.amount;';
        
        state.abilityEffects[index] = eff;
    }
}

// --- UI STRING GENERATORS ---
// These decouple the complex DOM rendering logic from the main application flow.

export function renderGroupHTML(treeType, group, path = []) {
    const pathStr = JSON.stringify(path);
    const isRoot = path.length === 0;
    
    const isAnd = group.logicalOperator === 'AND';
    const borderClass = isAnd ? 'border-and' : 'border-or';
    const bgClass = treeType === 'activation' 
        ? (isAnd ? 'bg-indigo-950/40' : 'bg-amber-950/40') 
        : (isAnd ? 'bg-fuchsia-950/40' : 'bg-amber-950/40');
    const textClass = treeType === 'activation'
        ? (isAnd ? 'text-indigo-400' : 'text-amber-400')
        : (isAnd ? 'text-fuchsia-400' : 'text-amber-400');
    
    let childrenHTML = '';
    if (group.children && group.children.length > 0) {
        childrenHTML = group.children.map((child, index) => {
            const childPath = [...path, index];
            if (child.type === 'group') {
                return renderGroupHTML(treeType, child, childPath);
            } else {
                return renderConditionHTML(treeType, child, childPath, borderClass);
            }
        }).join('');
    } else {
        childrenHTML = `<div class="text-[10px] text-slate-500 italic p-2 ml-4">Empty Group. (Always evaluates to true)</div>`;
    }

    return `
        <div class="flex flex-col gap-2 rounded-lg border border-slate-700/50 p-2 ${bgClass} ${isRoot ? '' : 'ml-4 logic-group-border ' + borderClass}">
            <!-- Group Header omitted for brevity in conceptual file, but would contain the AND/OR dropdowns -->
            <div class="flex flex-col gap-1.5">
                ${childrenHTML}
            </div>
        </div>
    `;
}

function renderConditionHTML(treeType, cond, path, parentBorderClass) {
    const pathStr = JSON.stringify(path);
    const typeDef = ATTRIBUTE_TYPES[cond.attribute] || ATTRIBUTE_TYPES['entity'];
    
    // In a real module, these strings would be returned to the main view renderer
    return `
        <div class="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded border border-slate-700 ml-4 logic-group-border ${parentBorderClass}">
            <!-- Selectors and inputs populated based on typeDef -->
            <span class="text-xs text-white">${cond.attribute} ${cond.operator} ${cond.value}</span>
        </div>
    `;
}

// --- DATA EXPORT & MIGRATION ---

export function exportCurrentState(formData) {
    // Merges current in-memory trees/effects with form inputs from the UI
    return {
        abilityId: state.currentEditingId || ('ability_' + Date.now()),
        name: formData.name,
        trigger: formData.trigger,
        activation: {
            method: formData.actMethod,
            affiliation: formData.actAffiliation,
            logicTree: JSON.parse(JSON.stringify(state.activationRoot)) 
        },
        effectScope: {
            method: formData.effMethod,
            count: formData.effCount,
            affiliation: formData.effAffiliation,
            logicTree: JSON.parse(JSON.stringify(state.effectScopeRoot))
        },
        effects: [...state.abilityEffects]
    };
}

export async function saveAbility(formData) {
    const ability = exportCurrentState(formData);
    await saveAbilityToCatalog(ability);
    
    // Update local state instantly
    state.allAbilities = [...state.allAbilities.filter(a => a.abilityId !== ability.abilityId), ability];
    return ability;
}

export function hydrateStateFromAbility(ability) {
    state.currentEditingId = ability.abilityId;
    
    // Safely migrate older schemas
    const srcAct = ability.activation || ability.targeting || {};
    state.activationRoot = srcAct.logicTree 
        ? JSON.parse(JSON.stringify(srcAct.logicTree)) 
        : { type: 'group', logicalOperator: 'AND', children: [] };

    const srcEff = ability.effectScope || {};
    state.effectScopeRoot = srcEff.logicTree 
        ? JSON.parse(JSON.stringify(srcEff.logicTree)) 
        : { type: 'group', logicalOperator: 'AND', children: [] };
        
    state.abilityEffects = ability.effects && ability.effects.length > 0
        ? JSON.parse(JSON.stringify(ability.effects))
        : [{ type: 'DEAL_DAMAGE', amount: 2 }];
        
    return state; // Returns hydrated state to the UI renderer
}