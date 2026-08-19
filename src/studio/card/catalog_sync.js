// filepath: src/studio/ability/catalog_sync.js

import { StudioState } from './state.js';
import { fetchCustomAbilities, saveAbilityToCatalog, fetchCustomCards, deleteAbilityFromCatalog, saveCardToCatalog, fetchCustomTribes } from '../../firebase.js';
import { CARD_CATALOG } from '../../engine/index.js';
import { generateAbilityDescription } from '../../language_description.js';
import { validateAbilityLogic } from '../../ability_validation.js';
import { renderJSONPreview, showToast, openInspectionModal } from '../../ui.js';
import { launchSandboxMatch } from '../../testing.js';
import { updateTriggerComposite, renderAdditionalTriggers, updateTargetingUI } from './triggers.js';
import { renderLogicTrees } from './logic_tree.js';
import { renderEffects } from './payloads.js';
import { ACTION_MANIFEST } from '../../engine/actions/index.js';

export function getCurrentAbilityState() {
  let derivedTrigger = document.getElementById('ab-trigger').value;
  if (!derivedTrigger) {
      const base = document.getElementById('ab-base-trigger').value;
      const phase = document.getElementById('ab-trigger-phase').value;
      const role = document.getElementById('ab-trigger-role').value;
      const manifest = ACTION_MANIFEST[base];
      if (manifest) {
          let verb = base;
          if (role === 'PASSIVE' && manifest.passiveType) verb = manifest.passiveType;
          derivedTrigger = `${phase}_${verb}`;
      } else {
          derivedTrigger = base || 'MANUAL';
      }
  }

  const formData = {
    abilityId: StudioState.currentEditingId,
    name: document.getElementById('ab-name').value.trim(),
    description: document.getElementById('ab-description').value,
    trigger: derivedTrigger,
    additionalTriggers: StudioState.additionalTriggers || [],
    triggerScope: document.getElementById('ab-trigger-scope').value,
    triggerLimit: document.getElementById('ab-trigger-limit').value,
    passiveFlags: Array.from(document.querySelectorAll('.ab-flag-chk:checked')).map(cb => cb.value),
    tribeAmount: document.getElementById('ab-cost-tribe-amt').value,
    carnie: document.getElementById('ab-cost-tent').value,
    power: document.getElementById('ab-cost-power').value,
    readinessCost: document.getElementById('ab-cost-readiness').value,
    reuseIgnoresReadiness: document.getElementById('ab-cost-reuse-exempt').checked,
    freeAction: document.getElementById('ab-cost-free-action').checked,
    actMethod: document.getElementById('ab-act-method').value,
    actQuickTargeting: StudioState.activationQuickTargeting
  };
  
  const uiState = {
    activationRoot: StudioState.activationRoot,
    targetGroups: StudioState.effectGroups
  };

  return exportCurrentState(formData, uiState);
}

export function exportCurrentState(formData, uiState) {
    let activationData = {
        method: formData.actMethod,
        quickTargeting: formData.actQuickTargeting || { zones: ['FIELD'], alignment: ['ENEMY'], entityType: ['UNIT', 'AVATAR'], ignoreBattlelines: false },
        logicTree: JSON.parse(JSON.stringify(uiState.activationRoot))
    };

    return {
        abilityId: formData.abilityId || uiState.currentEditingId || ('ability_' + Date.now()),
        name: formData.name,
        description: formData.description || '',
        trigger: formData.trigger,
        additionalTriggers: formData.additionalTriggers || [],
        triggerScope: formData.triggerScope || 'PERSONAL',
        triggerLimit: formData.triggerLimit || 'UNLIMITED',
        passiveFlags: formData.passiveFlags || [],
        cost: {
            tribeAmount: parseInt(formData.tribeAmount) || 0,
            carnie: parseInt(formData.carnie) || 0,
            power: parseInt(formData.power) || 0,
            readinessCost: formData.readinessCost || 'NONE',
            reuseIgnoresReadiness: !!formData.reuseIgnoresReadiness,
            freeAction: !!formData.freeAction
        },
        activation: activationData,
        effects: JSON.parse(JSON.stringify(uiState.targetGroups)).map(group => {
            delete group.showAdvanced;
            if (['SELF', 'EVENT_SOURCE', 'EVENT_TARGET', 'AVATAR', 'ENEMY_AVATAR', 'SAME_AS_ACTIVATION'].includes(group.targetMethod)) {
                delete group.quickTargeting;
                delete group.logicTree;
                delete group.targetCount;
            }
            return group;
        })
    };
}

export function updateJSONPreview() {
  const state = getCurrentAbilityState();
  renderJSONPreview('json-preview-container', state, 'copyJSONPreview');
  
  const stateForAutoGen = { ...state, description: '' };
  let autoDesc = 'Complete the ability details to generate a description.';
  try {
      const generated = generateAbilityDescription(stateForAutoGen, StudioState.allAbilities, StudioState.allCards, StudioState.customTribesList);
      if (generated) autoDesc = generated;
  } catch (e) {
      autoDesc = 'Unable to generate description (schema updating).';
  }
  document.getElementById('ab-auto-description').innerText = autoDesc;
}

export function copyJSONPreview() {
  const state = getCurrentAbilityState();
  navigator.clipboard.writeText(JSON.stringify(state, null, 2)).then(() => {
    showToast('JSON Copied to Clipboard!', 'success');
  });
}

export async function handleSaveAbility() {
  const ability = getCurrentAbilityState();

  const validationErrors = validateAbilityLogic(ability);
  if (validationErrors.length > 0) {
    showToast(`Cannot save: ${validationErrors[0]}`, 'error');
    return;
  }

  if (!ability.name || ability.name === '') {
    showToast(`Cannot save: Please provide an Ability Name!`, 'error');
    return;
  }

  const isDuplicate = StudioState.allAbilities.some(a => (a.name || '').trim().toLowerCase() === ability.name.toLowerCase() && a.abilityId !== ability.abilityId);
  const originalAb = StudioState.allAbilities.find(a => a.abilityId === StudioState.currentEditingId);
  const isNameChanged = !originalAb || (originalAb.name || '').trim().toLowerCase() !== ability.name.toLowerCase();

  if (isDuplicate && (!StudioState.currentEditingId || isNameChanged)) {
    showToast(`Cannot save: An ability named '${ability.name}' already exists!`, 'error');
    return;
  }
  
  const btn = document.getElementById('save-ability-btn');
  const originalText = btn.innerHTML;
  
  btn.innerHTML = 'Saving...';
  btn.disabled = true;
  
  const topbar = document.getElementById('studio-topbar');
  if (topbar && topbar.setLoading) topbar.setLoading('save', true);

  const cloudSaveSuccess = await saveAbilityToCatalog(ability);
  
  btn.innerHTML = originalText;
  btn.disabled = false;
  
  if (topbar && topbar.setLoading) topbar.setLoading('save', false);

  if (cloudSaveSuccess) {
      showToast(`Ability '${ability.name}' saved!`, 'success');
  } else {
      showToast(`⚠️ Cloud save failed! '${ability.name}' saved locally.`, 'error');
  }

  let newDesc = '';
  try { newDesc = generateAbilityDescription(ability, StudioState.allAbilities, StudioState.allCards, StudioState.customTribesList); } catch(e) {}
  const processedAbility = { ...ability, displayDescription: newDesc };
  
  StudioState.allAbilities = [...StudioState.allAbilities.filter(a => a.abilityId !== ability.abilityId), processedAbility];
  renderCatalogList();

  StudioState.currentEditingId = ability.abilityId;
  window.location.hash = ability.abilityId;
  StudioState.activeAssignerId = ability.abilityId;
  document.getElementById('form-heading').innerText = `⚡ Edit: ${ability.name}`;
  document.getElementById('studio-topbar').showButtons(true);
}

export async function handleDeleteAbility() {
  if (StudioState.currentEditingId) {
    await deleteAbilityFromCatalog(StudioState.currentEditingId);
    StudioState.allAbilities = StudioState.allAbilities.filter(a => a.abilityId !== StudioState.currentEditingId);
    resetForm();
    renderCatalogList();
  }
}

export function handleCloneAbility() {
  if (!StudioState.currentEditingId) return;
  
  const currentConfig = getCurrentAbilityState();
  StudioState.currentEditingId = null; 
  window.location.hash = '';
  StudioState.activeAssignerId = null;
  
  document.getElementById('form-heading').innerText = `⚡ Design Ability Logic (Cloned)`;
  document.getElementById('ab-name').value = currentConfig.name + ' (Copy)';
  document.getElementById('studio-topbar').showButtons(false);
  
  updateJSONPreview();
  showToast('Ability cloned! Save to keep it.', 'info');
}

export function resetForm() {
  StudioState.currentEditingId = null;
  window.location.hash = '';
  StudioState.activeAssignerId = null;
  
  document.getElementById('form-heading').innerText = `⚡ Design Ability Logic`;
  document.getElementById('ab-name').value = '';
  document.getElementById('ab-description').value = '';
  
  document.getElementById('ab-base-trigger').value = 'MANUAL';
  document.getElementById('ab-trigger-phase').value = 'ON';
  document.getElementById('ab-trigger-role').value = 'ACTIVE';
  updateTriggerComposite();
  
  StudioState.additionalTriggers = [];
  renderAdditionalTriggers();
  
  document.getElementById('ab-trigger-limit').value = 'UNLIMITED';
  document.querySelectorAll('.ab-flag-chk').forEach(cb => cb.checked = false);
  if (typeof window.updatePassiveFlagsCount === 'function') window.updatePassiveFlagsCount();
  
  document.getElementById('ab-cost-tribe-amt').value = '0';
  document.getElementById('ab-cost-tent').value = '0';
  document.getElementById('ab-cost-power').value = '0';
  document.getElementById('ab-cost-readiness').value = 'NONE';
  document.getElementById('ab-cost-reuse-exempt').checked = false;
  document.getElementById('ab-cost-free-action').checked = false;

  document.getElementById('ab-act-method').value = 'NONE';
  
  StudioState.activationQuickTargeting = { zones: ['FIELD'], alignment: ['ENEMY'], entityType: ['UNIT', 'AVATAR'], ignoreBattlelines: false };
  StudioState.showAdvancedActivation = false;
  StudioState.activationRoot = { type: 'group', logicalOperator: 'AND', children: [] };
  StudioState.effectGroups = [];
  
  document.getElementById('studio-topbar').showButtons(false);
  
  renderLogicTrees();
  renderEffects();
  updateTargetingUI();
  updateJSONPreview();
  renderAssociatedCards();
}

export function renderCatalogList() {
  const catalogEl = document.getElementById('ability-catalog');
  if (!catalogEl) return;

  catalogEl.setItems(StudioState.allAbilities, (ab) => {
    let conditionCount = 0;
    const countConditions = (node) => {
      if (!node) return;
      if (node.type === 'condition') conditionCount++;
      else if (node.children) node.children.forEach(countConditions);
    };
    countConditions(ab.activation?.logicTree || ab.targeting?.logicTree);

    let effectsCount = 0;
    if (ab.effects) {
        effectsCount = ab.effects.reduce((acc, g) => acc + (g.payloads ? g.payloads.length : 1), 0);
    }

    return `
      <div onclick="window.loadAbility('${ab.abilityId}')" class="p-3 bg-slate-900 border border-slate-800 hover:border-amber-500 rounded-xl text-xs flex flex-col gap-1 cursor-pointer transition">
        <div class="flex justify-between items-center font-bold text-amber-300">
          <span>${ab.name}</span>
          <span class="text-[9px] bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded border border-amber-800 font-bold max-w-[120px] truncate" title="${ab.trigger}">${ab.trigger}</span>
        </div>
        <div class="text-[10px] text-emerald-400">${ab.effects?.length || 0} Targets, ${effectsCount} Actions</div>
        ${conditionCount > 0 ? `<div class="text-[9px] text-indigo-400 mt-1">${conditionCount} Nested Filters</div>` : ''}
      </div>
    `;
  });
}

export function loadAbility(id) {
  const ab = StudioState.allAbilities.find(a => a.abilityId === id);
  if (!ab) return;

  StudioState.currentEditingId = ab.abilityId;
  window.location.hash = id;
  document.getElementById('form-heading').innerText = `⚡ Edit: ${ab.name}`;
  document.getElementById('ab-name').value = ab.name;
  document.getElementById('ab-description').value = ab.description || '';
  
  const comp = window.parseTriggerToComposite(ab.trigger);
  document.getElementById('ab-base-trigger').value = comp.base;
  document.getElementById('ab-trigger-phase').value = comp.phase;
  document.getElementById('ab-trigger-role').value = comp.role;
  updateTriggerComposite();
  
  StudioState.additionalTriggers = ab.additionalTriggers || [];
  renderAdditionalTriggers();
  
  document.getElementById('ab-trigger-limit').value = ab.triggerLimit || 'UNLIMITED';
  document.querySelectorAll('.ab-flag-chk').forEach(cb => {
      cb.checked = ab.passiveFlags ? ab.passiveFlags.includes(cb.value) : false;
  });
  if (typeof window.updatePassiveFlagsCount === 'function') window.updatePassiveFlagsCount();
  
  const cost = ab.cost || {};
  document.getElementById('ab-cost-tribe-amt').value = cost.tribeAmount || 0;
  document.getElementById('ab-cost-tent').value = cost.carnie || cost.tent || 0;
  document.getElementById('ab-cost-power').value = cost.power || 0;
  
  if (cost.readinessCost) document.getElementById('ab-cost-readiness').value = cost.readinessCost;
  else if (cost.exhausts) document.getElementById('ab-cost-readiness').value = 'EXHAUSTS';
  else document.getElementById('ab-cost-readiness').value = 'NONE';
  document.getElementById('ab-cost-reuse-exempt').checked = !!cost.reuseIgnoresReadiness;
  document.getElementById('ab-cost-free-action').checked = !!cost.freeAction;

  document.getElementById('ab-trigger-scope').value = ab.triggerScope || 'PERSONAL';

  document.getElementById('studio-topbar').showButtons(true);

    const srcAct = ab.activation || ab.targeting || {};
    document.getElementById('ab-act-method').value = srcAct.method || 'NONE';

    const oldTargeting = srcAct.quickTargeting || {};
    StudioState.activationQuickTargeting = {
        zones: Array.isArray(oldTargeting.zones) ? oldTargeting.zones : ['FIELD'],
        alignment: Array.isArray(oldTargeting.alignment) ? oldTargeting.alignment : 
                    (oldTargeting.alignment === 'ANY' ? ['FRIENDLY', 'ENEMY'] : [oldTargeting.alignment || srcAct.affiliation || 'ENEMY']),
        entityType: Array.isArray(oldTargeting.entityType) ? oldTargeting.entityType : 
                    (oldTargeting.entityType === 'ANY' ? ['UNIT', 'AVATAR', 'EQUIPMENT', 'ARTIFACT', 'SPELL', 'BOON'] : [oldTargeting.entityType || 'UNIT']),
        ignoreBattlelines: oldTargeting.ignoreBattlelines !== undefined ? oldTargeting.ignoreBattlelines : 
                            (oldTargeting.line === 'ANY' || false)
    };

    if (srcAct.logicTree) StudioState.activationRoot = JSON.parse(JSON.stringify(srcAct.logicTree));
  else StudioState.activationRoot = { type: 'group', logicalOperator: 'AND', children: [] };
  
  StudioState.showAdvancedActivation = StudioState.activationRoot.children && StudioState.activationRoot.children.length > 0;

  const migrateConditions = (node) => {
    if (!node) return;
    if (node.type === 'condition' && node.attribute === 'hasTrait') node.attribute = 'hasAbility';
    if (node.children) node.children.forEach(migrateConditions);
  };
  migrateConditions(StudioState.activationRoot);
  
  const srcEffScope = ab.effectScope || {};
  
  if (ab.effects && ab.effects.length > 0) {
    StudioState.effectGroups = JSON.parse(JSON.stringify(ab.effects)).map(e => {
        if (e.payloads) {
           e.showAdvanced = e.logicTree && e.logicTree.children && e.logicTree.children.length > 0;
           migrateConditions(e.logicTree);
           
           if (!e.quickTargeting) e.quickTargeting = {};
           if (!Array.isArray(e.quickTargeting.zones)) e.quickTargeting.zones = ['FIELD'];
           if (!Array.isArray(e.quickTargeting.alignment)) e.quickTargeting.alignment = ['ENEMY'];
           if (!Array.isArray(e.quickTargeting.entityType)) e.quickTargeting.entityType = ['UNIT'];

           e.payloads = e.payloads.map(p => {
              if (p.type === 'APPLY_TRAIT' || p.type === 'GRANT_TRAIT_OR_ABILITY') p.type = 'GRANT_ABILITY';
              if (p.traitId) { p.grantedAbilityId = p.traitId; delete p.traitId; }
              return p;
           });
           return e;
        }

        const group = {
            targetMethod: e.targetMethod || srcEffScope.method || 'SAME_AS_ACTIVATION',
            targetCount: e.targetCount || srcEffScope.count || 1,
            quickTargeting: e.quickTargeting || {},
            logicTree: e.logicTree || srcEffScope.logicTree || { type: 'group', logicalOperator: 'AND', children: [] },
            payloads: []
        };

        const effQT = srcEffScope.quickTargeting || {};
        group.quickTargeting = {
            zones: Array.isArray(e.quickTargeting?.zones) ? e.quickTargeting.zones : ['FIELD'],
            alignment: Array.isArray(e.quickTargeting?.alignment) ? e.quickTargeting.alignment : 
                       (e.quickTargeting?.alignment === 'ANY' ? ['FRIENDLY', 'ENEMY'] : [e.quickTargeting?.alignment || srcEffScope.affiliation || e.targetAffiliation || 'ENEMY']),
            entityType: Array.isArray(e.quickTargeting?.entityType) ? e.quickTargeting.entityType : 
                        (e.quickTargeting?.entityType === 'ANY' ? ['UNIT', 'AVATAR', 'EQUIPMENT', 'ARTIFACT', 'SPELL', 'BOON'] : [e.quickTargeting?.entityType || 'UNIT']),
            ignoreBattlelines: e.quickTargeting?.ignoreBattlelines !== undefined ? e.quickTargeting.ignoreBattlelines : 
                               (e.quickTargeting?.line === 'ANY' || false)
        };
        
        group.showAdvanced = group.logicTree.children && group.logicTree.children.length > 0;
        migrateConditions(group.logicTree);
        
        if (e.type === 'APPLY_TRAIT' || e.type === 'GRANT_TRAIT_OR_ABILITY') e.type = 'GRANT_ABILITY';
        
        group.payloads.push({
            type: e.type || 'DEAL_DAMAGE',
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
  } else { StudioState.effectGroups = []; }
  
  renderLogicTrees();
  renderEffects();
  updateTargetingUI();
  updateJSONPreview();
  renderAssociatedCards();
}

export function renderAssociatedCards() {
    const container = document.getElementById('associated-cards-list');
    if (!container) return;

    if (!StudioState.currentEditingId) {
        container.innerHTML = '<div class="text-xs text-slate-500 italic text-center p-4">Select an ability to see associated cards.</div>';
        document.getElementById('associated-cards-count').innerText = '0';
        return;
    }

    const currentName = document.getElementById('ab-name').value;
    
    const dependentAbilityIds = new Set([StudioState.currentEditingId]);
    const dependentNames = new Set([currentName.toLowerCase()]);
    let addedNew = true;
    
    while (addedNew) {
        addedNew = false;
        StudioState.allAbilities.forEach(ab => {
            if (dependentAbilityIds.has(ab.abilityId)) return;
            
            let isDependent = false;
            
            const desc = (ab.description || '') + ' ' + (ab.displayDescription || '');
            for (const name of dependentNames) {
                if (name && desc.toLowerCase().includes('@[' + name + ']')) {
                    isDependent = true; break;
                }
            }
            
            if (!isDependent && ab.effects) {
                ab.effects.forEach(g => {
                    if (g.payloads) {
                        g.payloads.forEach(p => {
                            if (p.type === 'GRANT_ABILITY' || p.type === 'REMOVE_ABILITY') {
                                if (dependentAbilityIds.has(p.grantedAbilityId) || dependentNames.has((p.grantedAbilityId || '').toLowerCase())) isDependent = true;
                            }
                            if (p.nestedGroup && p.nestedGroup.payloads) {
                                p.nestedGroup.payloads.forEach(np => {
                                    if (np.type === 'GRANT_ABILITY' || np.type === 'REMOVE_ABILITY') {
                                        if (dependentAbilityIds.has(np.grantedAbilityId) || dependentNames.has((np.grantedAbilityId || '').toLowerCase())) isDependent = true;
                                    }
                                });
                            }
                        });
                    }
                });
            }
            
            if (isDependent) {
                dependentAbilityIds.add(ab.abilityId);
                if (ab.name) dependentNames.add(ab.name.toLowerCase());
                addedNew = true;
            }
        });
    }

    const linkedCards = StudioState.allCards.filter(c => {
        if (!c.abilities) return false;
        return c.abilities.some(a => {
            const aId = typeof a === 'string' ? a : (a.abilityId || a.id);
            const aName = (a.name || '').toLowerCase();
            return dependentAbilityIds.has(aId) || dependentNames.has(aName);
        });
    });

    document.getElementById('associated-cards-count').innerText = linkedCards.length;

    if (linkedCards.length === 0) {
        container.innerHTML = '<div class="text-[10px] text-slate-500 italic text-center p-4 border border-dashed border-slate-700/50 rounded-lg mt-2">No cards natively use this ability.</div>';
        return;
    }

    container.innerHTML = linkedCards.map(c => {
        const json = encodeURIComponent(JSON.stringify(c)).replace(/'/g, "%27");
        const matchedTribe = StudioState.customTribesList?.find(t => t.id === c.tribe || t.name === c.tribe);
        const tribeName = matchedTribe ? matchedTribe.name : (c.tribe || 'Generic');
        
        const linkHref = window.CreatorController ? `#${c.id}` : `cards.html#${c.id}`;
        
        return `
        <div oncontextmenu="event.preventDefault(); window.inspectCard('${json}')" title="Right-click to inspect ${c.name}" class="py-1.5 px-2 bg-slate-900/60 border border-slate-700/50 rounded-lg text-xs flex justify-between items-center transition-all group cursor-context-menu hover:border-sky-500/50 overflow-hidden">
            <div class="flex items-center gap-2 flex-1 min-w-0 pr-2 pointer-events-none">
                <span class="w-4 h-4 rounded bg-amber-500 text-black font-extrabold flex items-center justify-center text-[8px] shrink-0 shadow">${c.cost || 0}</span>
                <div class="flex flex-col truncate flex-1 min-w-0">
                    <span class="font-bold text-sky-300 truncate group-hover:text-white transition-colors text-[11px] leading-tight">${c.name}</span>
                    <span class="text-[9px] text-slate-400 capitalize truncate leading-tight">${tribeName} • ${c.type || 'Unit'}</span>
                </div>
            </div>
            <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button type="button" onclick="window.testAssociatedCard('${c.id}')" title="Test this card" class="text-slate-500 hover:text-purple-400 transition p-1">
                    🧪
                </button>
                <a href="${linkHref}" title="Edit ${c.name}" class="text-slate-500 hover:text-sky-400 transition p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                </a>
            </div>
        </div>
    `}).join('');
}

export function updateGlobalCard(updatedCard) {
    const idx = StudioState.allCards.findIndex(c => c.id === updatedCard.id);
    if (idx !== -1) StudioState.allCards[idx] = updatedCard;
    else StudioState.allCards.push(updatedCard);
    renderAssociatedCards();
}

export async function testAssociatedCard(cardId) {
    const card = StudioState.allCards.find(c => c.id === cardId);
    if (card) {
        const topbar = document.getElementById('studio-topbar');
        if (topbar && topbar.setLoading) topbar.setLoading('test', true);
        await launchSandboxMatch(card, 'card');
        if (topbar && topbar.setLoading) topbar.setLoading('test', false);
    }
}

export async function launchTestMatch() {
    const ability = getCurrentAbilityState();
    const topbar = document.getElementById('studio-topbar');
    if (topbar && topbar.setLoading) topbar.setLoading('test', true);

    await launchSandboxMatch(ability, 'ability');
    
    if (topbar && topbar.setLoading) topbar.setLoading('test', false);
}

export async function initCardAssigner() {
    const panels = document.querySelectorAll('main .glass-panel');
    const usagePanel = panels.length >= 3 ? panels[panels.length - 1] : null;
    
    if (!usagePanel || document.getElementById('assign-card-container')) return;

    const container = document.createElement('div');
    container.id = 'assign-card-container';
    container.className = 'mt-auto pt-4 border-t border-slate-800 flex flex-col gap-2 w-full shrink-0';
    container.innerHTML = `
        <label class="text-[10px] font-black text-cyan-400 uppercase tracking-wider">➕ Quick Assign to Card</label>
        <input type="text" list="assign-card-options" id="assign-card-input" placeholder="Type to search cards..." class="bg-slate-900 border border-cyan-900/50 p-2 rounded text-cyan-300 text-xs w-full outline-none focus:border-cyan-500 placeholder-cyan-900/50" />
        <datalist id="assign-card-options"></datalist>
    `;
    usagePanel.appendChild(container);

    const customCards = await fetchCustomCards();
    const allCards = [...CARD_CATALOG, ...customCards];
    const datalist = document.getElementById('assign-card-options');
    
    allCards.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        datalist.appendChild(opt);
    });

    const input = document.getElementById('assign-card-input');
    input.addEventListener('change', async (e) => {
        const val = e.target.value.toLowerCase();
        const match = allCards.find(c => c.name.toLowerCase() === val);
        
        let loadId = StudioState.activeAssignerId || window.location.hash.replace('#', '');
        
        if (!loadId) {
            showToast('Please select or save an ability first.', 'error');
            input.value = '';
            return;
        }

        if (match) {
            if (!match.abilities) match.abilities = [];
            const hasAb = match.abilities.some(a => (a.abilityId || a) === loadId);
            
            if (!hasAb) {
                input.disabled = true;
                input.value = 'Assigning...';
                
                const abs = await fetchCustomAbilities();
                const fullAb = abs.find(a => a.abilityId === loadId);
                
                if (fullAb) {
                    match.abilities.push(JSON.parse(JSON.stringify(fullAb)));
                    await saveCardToCatalog(match);
                    showToast(`Ability assigned to ${match.name}!`, 'success');
                    
                    updateGlobalCard(match);
                    loadAbility(loadId); 
                } else {
                    showToast('Ability not found in database. Save it first.', 'error');
                }
                
                input.disabled = false;
                input.value = '';
                input.blur();
            } else {
                showToast(`${match.name} already has this ability.`, 'info');
                input.value = '';
            }
        }
    });
}

window.inspectCard = (cardJson) => {
    openInspectionModal(JSON.parse(decodeURIComponent(cardJson)), StudioState.allAbilities);
};

// Bind window functions
window.loadAbility = loadAbility;
window.copyJSONPreview = copyJSONPreview;
window.testAssociatedCard = testAssociatedCard;
window.updateGlobalCard = updateGlobalCard;
window.launchTestMatch = launchTestMatch;