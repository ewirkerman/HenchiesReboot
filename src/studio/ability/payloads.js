// filepath: src/studio/ability/payloads.js

import { StudioState } from './state.js';
import { updateJSONPreview } from './catalog_sync.js';
import { ACTION_MANIFEST, EFFECT_TYPES, ACTION_CATEGORIES } from '../../engine/actions/index.js';
import { getValidTargetMethods, getValidEffectTypes } from '../../ability_validation.js';
import { generateEffectsHTML } from './ability_renderer.js';

export function getValidActionsForZones(selectedZones) {
    if (!selectedZones || selectedZones.length === 0) return []; 
    return Object.keys(ACTION_MANIFEST).filter(action => {
        const validZones = ACTION_MANIFEST[action].validZones; 
        if (validZones === 'ALL') return true;
        return selectedZones.every(z => validZones.includes(z));
    });
}

export function calculateEffectiveZones(baseZones, payloads, currentIndex) {
    let effectiveZones = [...(baseZones || ['FIELD'])];
    for (let i = 0; i < currentIndex; i++) {
        const p = payloads[i];
        const pt = p.type;
        const manifest = ACTION_MANIFEST[pt];
        if (manifest && manifest.endZone) {
            effectiveZones = [...manifest.endZone];
        } else if (pt === 'CHANGE_DESTINATION' && p.zone) {
            effectiveZones = [p.zone];
        } else if (pt === 'SUMMON' && p.zone) {
            effectiveZones = [p.zone];
        }
    }
    return effectiveZones;
}

export function handleAddEffectGroup() {
  StudioState.effectGroups.push({
    targetMethod: 'SAME_AS_ACTIVATION',
    targetCount: 1,
    quickTargeting: { 
      zones: [...(StudioState.activationQuickTargeting.zones || ['FIELD'])], 
      alignment: [...(StudioState.activationQuickTargeting.alignment || ['ENEMY'])], 
      entityType: [...(StudioState.activationQuickTargeting.entityType || ['UNIT', 'AVATAR'])], 
      ignoreBattlelines: StudioState.activationQuickTargeting.ignoreBattlelines || false 
    },
    showAdvanced: false,
    logicTree: { type: 'group', logicalOperator: 'AND', children: [] },
    payloads: [
        { type: 'DEAL_DAMAGE', amount: 1, duration: 'INSTANT' }
    ]
  });
  revalidatePayloadTypes();
  renderEffects();
  updateJSONPreview();
}

export function removeEffectGroup(index) {
  StudioState.effectGroups.splice(index, 1);
  renderEffects();
  updateJSONPreview();
}

export function moveEffectGroup(index, direction) {
    if (index + direction < 0 || index + direction >= StudioState.effectGroups.length) return;
    const temp = StudioState.effectGroups[index];
    StudioState.effectGroups[index] = StudioState.effectGroups[index + direction];
    StudioState.effectGroups[index + direction] = temp;
    renderEffects();
    updateJSONPreview();
}

export function updateEffectGroup(index, field, value) { 
    if (!StudioState.effectGroups[index]) return;
    StudioState.effectGroups[index][field] = value; 
    if (field === 'targetMethod') revalidatePayloadTypes();
    renderEffects(); 
    updateJSONPreview(); 
}

export function addPayload(groupIndex) {
    const group = StudioState.effectGroups[groupIndex];
    if (!group) return;
    let baseZones = group.quickTargeting?.zones || ['FIELD'];
    if (group.targetMethod === 'SAME_AS_ACTIVATION') baseZones = StudioState.activationQuickTargeting?.zones || ['FIELD'];
        
    let effectiveZones = calculateEffectiveZones(baseZones, group.payloads, group.payloads.length);

    const validActions = typeof getValidActionsForZones !== 'undefined' 
        ? (group.targetMethod === 'SELF' ? EFFECT_TYPES : getValidActionsForZones(effectiveZones))
        : EFFECT_TYPES;
        
    const initialType = validActions.length > 0 ? validActions[0] : 'CUSTOM_SCRIPT';
    group.payloads.push({ type: initialType, amount: 1, duration: 'INSTANT' });
    
    renderEffects();
    updateJSONPreview();
}

export function removePayload(groupIndex, payloadIndex) {
    StudioState.effectGroups[groupIndex].payloads.splice(payloadIndex, 1);
    renderEffects();
    updateJSONPreview();
}

export function handlePayloadDragStart(e, gIdx, pIdx) {
    StudioState.draggedPayloadInfo = { gIdx, pIdx };
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('opacity-50'), 0);
}

export function handlePayloadDragOver(e, gIdx) {
    e.preventDefault();
    if (StudioState.draggedPayloadInfo && StudioState.draggedPayloadInfo.gIdx === gIdx) {
        e.dataTransfer.dropEffect = 'move';
    } else {
        e.dataTransfer.dropEffect = 'none';
    }
}

export function handlePayloadDrop(e, targetGIdx, targetPIdx) {
    e.preventDefault();
    if (!StudioState.draggedPayloadInfo || StudioState.draggedPayloadInfo.gIdx !== targetGIdx) return;
    const srcPIdx = StudioState.draggedPayloadInfo.pIdx;
    if (srcPIdx === targetPIdx) return;

    const group = StudioState.effectGroups[targetGIdx];
    const [movedItem] = group.payloads.splice(srcPIdx, 1);
    group.payloads.splice(targetPIdx, 0, movedItem);

    renderEffects();
    updateJSONPreview();
}

export function handlePayloadDragEnd(e) {
    StudioState.draggedPayloadInfo = null;
    e.target.classList.remove('opacity-50');
    renderEffects();
}

export function updatePayload(groupIndex, payloadIndex, field, value) {
  if (!StudioState.effectGroups[groupIndex] || !StudioState.effectGroups[groupIndex].payloads[payloadIndex]) return;
  const payload = StudioState.effectGroups[groupIndex].payloads[payloadIndex];
  
  if (field === 'stat') {
      if (value === 'line') payload.amount = 'mid';
      else if (payload.stat === 'line' && value !== 'line') payload.amount = 1;
  }

  payload[field] = value;
  
  if (field === 'type') {
      const manifest = ACTION_MANIFEST[value];
      if (!manifest) return;
      
      if (manifest.requiresAmount) {
          payload.amount = 1; 
          delete payload.amountIsX;
      } else { 
          delete payload.amount; 
          delete payload.amountIsX; 
      }
      if (manifest.requiresStat) payload.stat = 'strength'; else delete payload.stat;
      if (manifest.requiresResource) payload.resource = 'Carnie'; else delete payload.resource;
      if (manifest.requiresGrantedAbility) payload.grantedAbilityId = ''; else delete payload.grantedAbilityId;
      if (value !== 'GRANT_ABILITY') { delete payload.grantedAbilityParamX; delete payload.grantedAbilityParamXIsX; }
      if (manifest.requiresCardId) payload.cardId = ''; else delete payload.cardId;
      if (manifest.requiresScript) { payload.script = 'state.players[state.activePlayerId].health += params.amount;'; payload.description = ''; } else { delete payload.script; delete payload.description; }
      if (manifest.requiresZone) payload.zone = 'FIELD'; else delete payload.zone;
      if (manifest.requiresZoneOwner) payload.zoneOwner = 'CASTER'; else delete payload.zoneOwner;
      if (manifest.canLimitStacks) payload.maxStacks = 0; else delete payload.maxStacks;
      if (!manifest.canBlockDuplicates) delete payload.blockDuplicates;
      if (!manifest.canInvert) delete payload.invertRoles;
      if (!manifest.canBeCost) delete payload.isCost;
      
      if (manifest.hasNestedGroup) {
          payload.nestedGroup = { targetMethod: 'AUTO_ALL', targetCount: 1, quickTargeting: { zones: ['FIELD'], alignment: ['FRIENDLY'], entityType: ['UNIT'], ignoreBattlelines: false }, logicTree: { type: 'group', logicalOperator: 'AND', children: [] }, payloads: [] };
      } else {
          delete payload.nestedGroup;
      }
      
      if (!manifest.validDurations.includes(payload.duration)) {
          payload.duration = manifest.validDurations[0] || 'INSTANT';
      }
  }
  renderEffects();
  updateJSONPreview();
}

export function updateGrantedAbility(gIdx, pIdx, value) {
  const match = StudioState.allAbilities.find(a => a.name.toLowerCase() === value.toLowerCase());
  StudioState.effectGroups[gIdx].payloads[pIdx].grantedAbilityId = match ? match.abilityId : value;
  renderEffects(); updateJSONPreview();
}

export function updateSummonCard(gIdx, pIdx, value) {
  const match = StudioState.allCards.find(c => c.name.toLowerCase() === value.toLowerCase());
  StudioState.effectGroups[gIdx].payloads[pIdx].cardId = match ? match.id : value;
  renderEffects(); updateJSONPreview();
}

export function updateNestedSummonCard(gIdx, pIdx, nIdx, value) {
  const match = StudioState.allCards.find(c => c.name.toLowerCase() === value.toLowerCase());
  StudioState.effectGroups[gIdx].payloads[pIdx].nestedGroup.payloads[nIdx].cardId = match ? match.id : value;
  renderEffects(); updateJSONPreview();
}

export function addNestedPayload(gIdx, pIdx) {
    StudioState.effectGroups[gIdx].payloads[pIdx].nestedGroup.payloads.push({ type: 'MODIFY_STAT', amount: 1, stat: 'strength', duration: 'INSTANT' });
    renderEffects();
    updateJSONPreview();
}

export function removeNestedPayload(gIdx, pIdx, nIdx) {
    StudioState.effectGroups[gIdx].payloads[pIdx].nestedGroup.payloads.splice(nIdx, 1);
    renderEffects();
    updateJSONPreview();
}

export function updateNestedPayload(gIdx, pIdx, nIdx, field, value) {
  const payload = StudioState.effectGroups[gIdx].payloads[pIdx].nestedGroup.payloads[nIdx];
  
  if (field === 'stat') {
      if (value === 'line') payload.amount = 'mid';
      else if (payload.stat === 'line' && value !== 'line') payload.amount = 1;
  }

  payload[field] = value;
  
  if (field === 'type') {
      const manifest = ACTION_MANIFEST[value];
      if (!manifest) return;
      
      if (manifest.requiresAmount) { 
          payload.amount = 1; 
          delete payload.amountIsX; 
      } else { 
          delete payload.amount; 
          delete payload.amountIsX; 
      }
      if (manifest.requiresStat) payload.stat = 'strength'; else delete payload.stat;
      if (manifest.requiresResource) payload.resource = 'Carnie'; else delete payload.resource;
      if (manifest.requiresGrantedAbility) payload.grantedAbilityId = ''; else delete payload.grantedAbilityId;
      if (value !== 'GRANT_ABILITY') { delete payload.grantedAbilityParamX; delete payload.grantedAbilityParamXIsX; }
      if (manifest.requiresCardId) payload.cardId = ''; else delete payload.cardId;
      if (manifest.requiresScript) { payload.script = 'state.players[state.activePlayerId].health += params.amount;'; payload.description = ''; } else { delete payload.script; delete payload.description; }
      if (manifest.requiresZone) payload.zone = 'FIELD'; else delete payload.zone;
      if (manifest.requiresZoneOwner) payload.zoneOwner = 'CASTER'; else delete payload.zoneOwner;
      if (manifest.canLimitStacks) payload.maxStacks = 0; else delete payload.maxStacks;
      if (!manifest.canBlockDuplicates) delete payload.blockDuplicates;
      if (!manifest.canInvert) delete payload.invertRoles;
      if (!manifest.canBeCost) delete payload.isCost;
      
      if (!manifest.validDurations.includes(payload.duration)) {
          payload.duration = manifest.validDurations[0] || 'INSTANT';
      }
  }
  
  renderEffects();
  updateJSONPreview();
}

export function updateNestedGrantedAbility(gIdx, pIdx, nIdx, value) {
  const match = StudioState.allAbilities.find(a => a.name.toLowerCase() === value.toLowerCase());
  StudioState.effectGroups[gIdx].payloads[pIdx].nestedGroup.payloads[nIdx].grantedAbilityId = match ? match.abilityId : value;
  renderEffects(); updateJSONPreview();
}

export function updateNestedGroup(gIdx, pIdx, field, value) {
    StudioState.effectGroups[gIdx].payloads[pIdx].nestedGroup[field] = value;
    renderEffects();
    updateJSONPreview();
}

export function revalidatePayloadTypes() {
    if (typeof getValidActionsForZones === 'undefined') return;
    
    const fullTrigger = document.getElementById('ab-trigger') ? document.getElementById('ab-trigger').value.toUpperCase() : 'MANUAL';

    StudioState.effectGroups.forEach((group, gIdx) => {
        let baseZones = group.quickTargeting?.zones || ['FIELD'];
        if (group.targetMethod === 'SAME_AS_ACTIVATION') baseZones = StudioState.activationQuickTargeting?.zones || ['FIELD'];
        
        group.payloads.forEach((payload, pIdx) => {
            let effectiveZones = calculateEffectiveZones(baseZones, group.payloads, pIdx);
            const baseValidActions = group.targetMethod === 'SELF' ? EFFECT_TYPES : getValidActionsForZones(effectiveZones);
            const validActions = getValidEffectTypes(fullTrigger, baseValidActions);
            
            if (!validActions.includes(payload.type)) {
                const fallback = validActions.includes('DEAL_DAMAGE') ? 'DEAL_DAMAGE' : (validActions.length > 0 ? validActions[0] : 'CUSTOM_SCRIPT');
                payload.type = fallback;
                
                const manifest = ACTION_MANIFEST[fallback];
                if (manifest) {
                    if (manifest.requiresAmount) payload.amount = 1; else delete payload.amount;
                    if (manifest.requiresStat) payload.stat = 'strength'; else delete payload.stat;
                    if (manifest.requiresResource) payload.resource = 'Carnie'; else delete payload.resource;
                    if (manifest.requiresGrantedAbility) payload.grantedAbilityId = ''; else delete payload.grantedAbilityId;
                    if (fallback !== 'GRANT_ABILITY') { delete payload.grantedAbilityParamX; delete payload.grantedAbilityParamXIsX; }
                    if (manifest.requiresCardId) payload.cardId = ''; else delete payload.cardId;
                    if (manifest.requiresScript) { payload.script = 'state.players[state.activePlayerId].health += params.amount;'; payload.description = ''; } else { delete payload.script; delete payload.description; }
                    if (manifest.requiresZone) payload.zone = 'FIELD'; else delete payload.zone;
                    if (manifest.requiresZoneOwner) payload.zoneOwner = 'CASTER'; else delete payload.zoneOwner;
                    if (manifest.canLimitStacks) payload.maxStacks = 0; else delete payload.maxStacks;
                    if (!manifest.canBlockDuplicates) delete payload.blockDuplicates;
                    if (!manifest.canInvert) delete payload.invertRoles;
                    if (!manifest.canBeCost) delete payload.isCost;
                    
                    if (manifest.hasNestedGroup) {
                        payload.nestedGroup = { targetMethod: 'AUTO_ALL', targetCount: 1, quickTargeting: { zones: ['FIELD'], alignment: ['FRIENDLY'], entityType: ['UNIT'], ignoreBattlelines: false }, logicTree: { type: 'group', logicalOperator: 'AND', children: [] }, payloads: [] };
                    } else { delete payload.nestedGroup; }
                    
                    if (!manifest.validDurations.includes(payload.duration)) {
                        payload.duration = manifest.validDurations[0] || 'INSTANT';
                    }
                }
            }
        });
    });
}

export function renderEffects() {
  const container = document.getElementById('effect-groups-container');
  
  if (StudioState.effectGroups.length === 0) {
    container.innerHTML = `<div class="text-slate-500 italic text-xs p-3 text-center border border-dashed border-slate-700 rounded-xl">No target blocks added. This ability does nothing.</div>`;
    return;
  }

  const baseTrigger = document.getElementById('ab-trigger').value.toUpperCase();
  const scope = document.getElementById('ab-trigger-scope').value;
  const actMethod = document.getElementById('ab-act-method').value;

  const ctx = {
      effectGroups: StudioState.effectGroups, baseTrigger, scope, actMethod, activationQuickTargeting: StudioState.activationQuickTargeting,
      getValidActionsForZones, calculateEffectiveZones, EFFECT_TYPES, getValidEffectTypes, ACTION_MANIFEST, ACTION_CATEGORIES,
      allAbilities: StudioState.allAbilities, allCards: StudioState.allCards, customTribesList: StudioState.customTribesList, getValidTargetMethods
  };

  container.innerHTML = generateEffectsHTML(ctx);
}

// Bind to window
window.removeEffectGroup = removeEffectGroup;
window.moveEffectGroup = moveEffectGroup;
window.updateEffectGroup = updateEffectGroup;
window.addPayload = addPayload;
window.removePayload = removePayload;
window.handlePayloadDragStart = handlePayloadDragStart;
window.handlePayloadDragOver = handlePayloadDragOver;
window.handlePayloadDrop = handlePayloadDrop;
window.handlePayloadDragEnd = handlePayloadDragEnd;
window.updatePayload = updatePayload;
window.updateGrantedAbility = updateGrantedAbility;
window.updateSummonCard = updateSummonCard;
window.updateNestedSummonCard = updateNestedSummonCard;
window.addNestedPayload = addNestedPayload;
window.removeNestedPayload = removeNestedPayload;
window.updateNestedPayload = updateNestedPayload;
window.updateNestedGrantedAbility = updateNestedGrantedAbility;
window.updateNestedGroup = updateNestedGroup;
window.revalidatePayloadTypes = revalidatePayloadTypes;