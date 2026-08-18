// filepath: src/studio/ability/logic_tree.js

import { StudioState } from './state.js';
import { updateJSONPreview } from './catalog_sync.js';
import { renderEffects } from './payloads.js';
import { updateTargetingUI } from './triggers.js';
import { generateGroupHTML } from './ability_renderer.js';
import { ATTRIBUTE_MANIFEST } from '../../engine/attributes.js';

export function getRoot(treeType) {
    if (treeType === 'activation') return StudioState.activationRoot;
    if (treeType.startsWith('effect_')) {
        const idx = parseInt(treeType.split('_')[1], 10);
        return StudioState.effectGroups[idx].logicTree;
    }
    return null;
}

export function getNodeAtPath(treeType, path) {
  let current = getRoot(treeType);
  for (const index of path) {
    if (current && current.children) current = current.children[index];
    else return null; 
  }
  return current;
}

export function getParentArrayAtPath(treeType, path) {
  if (path.length === 0) return null;
  const parentPath = path.slice(0, -1);
  const parentNode = getNodeAtPath(treeType, parentPath);
  return parentNode.children;
}

export function addConditionToGroup(treeType, pathString) {
  const path = JSON.parse(pathString);
  const group = path.length === 0 ? getRoot(treeType) : getNodeAtPath(treeType, path);
  if (group && group.type === 'group') {
    group.children.push({ type: 'condition', attribute: 'family', operator: '==', value: 'SomeFamily' });
    if (treeType === 'activation') renderLogicTrees(); else renderEffects();
    updateJSONPreview();
  }
}

export function addGroupToGroup(treeType, pathString) {
  const path = JSON.parse(pathString);
  const group = path.length === 0 ? getRoot(treeType) : getNodeAtPath(treeType, path);
  if (group && group.type === 'group') {
    group.children.push({ type: 'group', logicalOperator: 'AND', children: [] });
    if (treeType === 'activation') renderLogicTrees(); else renderEffects();
    updateJSONPreview();
  }
}

export function removeNode(treeType, pathString) {
  const path = JSON.parse(pathString);
  if (path.length === 0) return;
  const parentArray = getParentArrayAtPath(treeType, path);
  const indexToRemove = path[path.length - 1];
  parentArray.splice(indexToRemove, 1);
  if (treeType === 'activation') renderLogicTrees(); else renderEffects();
  updateJSONPreview();
}

export function updateNodeField(treeType, pathString, field, value) {
  const path = JSON.parse(pathString);
  const node = path.length === 0 ? getRoot(treeType) : getNodeAtPath(treeType, path);
  node[field] = value;
  
  if (field === 'context') {
      const newDomain = value === 'EVENT' ? 'EVENT' : 'ENTITY';
      const oldDomain = ATTRIBUTE_MANIFEST[node.attribute]?.domain || 'ENTITY';
      if (newDomain !== oldDomain) {
          const newAttr = Object.keys(ATTRIBUTE_MANIFEST).find(k => ATTRIBUTE_MANIFEST[k].domain === newDomain && ATTRIBUTE_MANIFEST[k].evaluable);
          node.attribute = newAttr;
          const typeDef = ATTRIBUTE_MANIFEST[newAttr];
          node.value = typeDef.type === 'select' ? typeDef.options[0] : 1;
          node.operator = '==';
      }
  } else if (field === 'attribute') {
      const typeDef = ATTRIBUTE_MANIFEST[value];
      node.value = typeDef.type === 'select' ? typeDef.options[0] : 1;
      node.operator = '==';
  }
  
  if (treeType === 'activation') renderLogicTrees(); else renderEffects();
  updateJSONPreview();
}

export function renderLogicTrees() {
  document.getElementById('activation-conditions-container').innerHTML = generateGroupHTML('activation', StudioState.activationRoot, []);
}

export function toggleQuickMatrixArray(context, index, field, value) {
    const targetState = context === 'activation' ? StudioState.activationQuickTargeting : StudioState.effectGroups[index].quickTargeting;
    const arr = targetState[field] || [];
    
    if (arr.includes(value)) {
        if (field === 'zones' && arr.length === 1) return; 
        targetState[field] = arr.filter(v => v !== value);
    } else {
        targetState[field].push(value);
    }

    if (field === 'zones') {
        if (window.revalidatePayloadTypes) window.revalidatePayloadTypes();
    }

    if (context === 'activation') updateTargetingUI();
    renderEffects(); 
    updateJSONPreview();
}

export function toggleQuickMatrixBoolean(context, index, field) {
    const targetState = context === 'activation' ? StudioState.activationQuickTargeting : StudioState.effectGroups[index].quickTargeting;
    targetState[field] = !targetState[field];
    if (context === 'activation') updateTargetingUI();
    else renderEffects();
    updateJSONPreview();
}

export function toggleAdvancedLogic(context, index) {
    if (context === 'activation') {
        StudioState.showAdvancedActivation = !StudioState.showAdvancedActivation;
        updateTargetingUI();
    } else {
        StudioState.effectGroups[index].showAdvanced = !StudioState.effectGroups[index].showAdvanced;
        renderEffects();
    }
}

// Bind to window
window.addConditionToGroup = addConditionToGroup;
window.addGroupToGroup = addGroupToGroup;
window.removeNode = removeNode;
window.updateNodeField = updateNodeField;
window.toggleQuickMatrixArray = toggleQuickMatrixArray;
window.toggleQuickMatrixBoolean = toggleQuickMatrixBoolean;
window.toggleAdvancedLogic = toggleAdvancedLogic;