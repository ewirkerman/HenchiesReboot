/**
 * Ability Logic Controller (Modular Production Ready)
 */

import { fetchCustomAbilities, saveAbilityToCatalog, fetchCustomCards, deleteAbilityFromCatalog } from './firebase.js';
import { CARD_CATALOG } from './engine.js';

// --- STATE MANAGEMENT ---
const state = {
    allAbilities: [],
    allCards: [],
    currentEditingId: null,
    activationRoot: { type: 'group', logicalOperator: 'AND', children: [] },
    effectScopeRoot: { type: 'group', logicalOperator: 'AND', children: [] },
    abilityEffects: [{ type: 'DEAL_DAMAGE', amount: 2 }]
};

// --- CONSTANTS & CONFIGURATION ---
const ATTRIBUTE_TYPES = {
    'entity': { label: 'Entity Type', type: 'select', options: ['SELF', 'HERO', 'UNIT', 'TARGET', 'ATTACKER'] },
    'tribe': { label: 'Tribe', type: 'select', options: ['Robot', 'Mythic', 'Elemental', 'Pirate', 'Undead', 'Carnie', 'Viking', 'Ninja', 'Stalker', 'Alien', 'Luchador'] },
    'line': { label: 'Board Line', type: 'select', options: ['front', 'mid', 'back', 'bodyguard', 'hero'] },
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
    state.allAbilities = await fetchCustomAbilities();
      
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
    return treeType === 'activation' ? state.activationRoot : state.effectScopeRoot;
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

// --- EFFECT PAYLOAD MANIPULATION ---
export function addEffectPayload() {
    state.abilityEffects.push({ type: 'DEAL_DAMAGE', amount: 1 });
}

export function removeEffectPayload(index) {
    state.abilityEffects.splice(index, 1);
}

export function updateEffectPayload(index, field, value) {
    state.abilityEffects[index][field] = value;
    
    if (field === 'type') {
        const type = value;
        const eff = { type: type };
        if (['DEAL_DAMAGE', 'HEAL', 'DRAW_CARD', 'DISCARD_CARD'].includes(type)) eff.amount = 1;
        else if (type === 'MODIFY_STAT') { eff.amount = 1; eff.stat = ''; }
        else if (type === 'GRANT_ABILITY') eff.grantedAbilityId = '';
        else if (type === 'SUMMON') eff.cardId = '';
        else if (type === 'CUSTOM_SCRIPT') eff.script = 'state.players[state.activePlayerId].health += params.amount;';
        
        state.abilityEffects[index] = eff;
    }
}

// --- UI STRING GENERATORS ---
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
            if (child.type === 'group') return renderGroupHTML(treeType, child, childPath);
            else return renderConditionHTML(treeType, child, childPath, borderClass);
        }).join('');
    } else {
        childrenHTML = `<div class="text-[10px] text-slate-500 italic p-2 ml-4">Empty Group. (Always evaluates to true)</div>`;
    }

    return `
        <div class="flex flex-col gap-2 rounded-lg border border-slate-700/50 p-2 ${bgClass} ${isRoot ? '' : 'ml-4 logic-group-border ' + borderClass}">
            <div class="flex justify-between items-center bg-slate-900/60 p-1.5 rounded border border-slate-800">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black uppercase tracking-widest ${textClass}">
                        ${isRoot ? 'ROOT MATCH' : 'SUB-GROUP'}
                    </span>
                    <select onchange="window.UI_UpdateNode('${treeType}', '${pathStr}', 'logicalOperator', this.value)" class="bg-slate-950 border border-slate-700 px-1 py-0.5 rounded text-xs font-bold ${textClass}">
                        <option value="AND" ${group.logicalOperator === 'AND' ? 'selected' : ''}>Match ALL (AND)</option>
                        <option value="OR" ${group.logicalOperator === 'OR' ? 'selected' : ''}>Match ANY (OR)</option>
                    </select>
                </div>
                
                <div class="flex items-center gap-1">
                    <button type="button" onclick='window.UI_AddCondition("${treeType}", "${pathStr}")' class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded transition">+ Condition</button>
                    <button type="button" onclick='window.UI_AddGroup("${treeType}", "${pathStr}")' class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded transition">+ Group</button>
                    ${!isRoot ? `<button type="button" onclick='window.UI_RemoveNode("${treeType}", "${pathStr}")' class="text-slate-500 hover:text-red-400 font-black px-1.5 ml-1 transition">&times;</button>` : ''}
                </div>
            </div>
            <div class="flex flex-col gap-1.5">
                ${childrenHTML}
            </div>
        </div>
    `;
}

function renderConditionHTML(treeType, cond, path, parentBorderClass) {
    const pathStr = JSON.stringify(path);
    const typeDef = ATTRIBUTE_TYPES[cond.attribute] || ATTRIBUTE_TYPES['entity'];
    
    const attrOptions = Object.entries(ATTRIBUTE_TYPES).map(([key, def]) => `<option value="${key}" ${cond.attribute === key ? 'selected' : ''}>${def.label}</option>`).join('');
    const opOptions = Object.entries(OPERATORS).map(([val, label]) => `<option value="${val}" ${cond.operator === val ? 'selected' : ''}>${label}</option>`).join('');

    let valueInputHTML = '';
    if (typeDef.type === 'select') {
        valueInputHTML = `<select onchange="window.UI_UpdateNode('${treeType}', '${pathStr}', 'value', this.value)" class="bg-slate-900 border border-slate-700 p-1 rounded text-white flex-1 min-w-[80px]">
            ${typeDef.options.map(opt => `<option value="${opt}" ${cond.value === opt ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>`;
    } else if (typeDef.type === 'text') {
        valueInputHTML = `<input type="text" value="${cond.value || ''}" placeholder="Value..." onchange="window.UI_UpdateNode('${treeType}', '${pathStr}', 'value', this.value)" class="bg-slate-900 border border-slate-700 p-1 rounded text-white flex-1 min-w-[80px]" />`;
    } else {
        valueInputHTML = `<input type="number" value="${cond.value}" onchange="window.UI_UpdateNode('${treeType}', '${pathStr}', 'value', this.value)" class="bg-slate-900 border border-slate-700 p-1 rounded text-white flex-1 min-w-[80px]" />`;
    }

    return `
        <div class="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded border border-slate-700 ml-4 logic-group-border ${parentBorderClass} hover:border-slate-500 transition-colors">
            <select onchange="window.UI_UpdateNode('${treeType}', '${pathStr}', 'attribute', this.value)" class="bg-slate-950 border border-slate-700 p-1 rounded text-cyan-300 font-bold w-1/3">${attrOptions}</select>
            <select onchange="window.UI_UpdateNode('${treeType}', '${pathStr}', 'operator', this.value)" class="bg-slate-950 border border-slate-700 p-1 rounded text-pink-300 font-bold w-24">${opOptions}</select>
            ${valueInputHTML}
            <button type="button" onclick='window.UI_RemoveNode("${treeType}", "${pathStr}")' class="text-slate-500 hover:text-red-400 font-bold px-2">&times;</button>
        </div>
    `;
}

// --- DATA EXPORT & MIGRATION ---
export function exportCurrentState(formData) {
    return {
        abilityId: state.currentEditingId || ('ability_' + Date.now()),
        name: formData.name,
        trigger: formData.trigger,
        activation: { method: formData.actMethod, affiliation: formData.actAffiliation, logicTree: JSON.parse(JSON.stringify(state.activationRoot)) },
        effectScope: { method: formData.effMethod, count: formData.effCount, affiliation: formData.effAffiliation, logicTree: JSON.parse(JSON.stringify(state.effectScopeRoot)) },
        effects: [...state.abilityEffects]
    };
}

export async function saveAbility(formData) {
    const ability = exportCurrentState(formData);
    await saveAbilityToCatalog(ability);
    state.allAbilities = [...state.allAbilities.filter(a => a.abilityId !== ability.abilityId), ability];
    return ability;
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
    const srcEff = ability.effectScope || {};
    state.effectScopeRoot = srcEff.logicTree ? JSON.parse(JSON.stringify(srcEff.logicTree)) : { type: 'group', logicalOperator: 'AND', children: [] };
    state.abilityEffects = ability.effects && ability.effects.length > 0 ? JSON.parse(JSON.stringify(ability.effects)) : [{ type: 'DEAL_DAMAGE', amount: 2 }];
    return state;
}