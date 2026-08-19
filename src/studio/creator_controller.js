/**
 * src/studio/creator_controller.js
 * Master orchestrator for the Unified Creator Studio.
 * Imports from existing sub-modules and manages layout rendering & routing.
 */

import { fetchCustomCards, fetchCustomAbilities, fetchCustomTribes, saveCardToCatalog, saveAbilityToCatalog, deleteCardFromCatalog, deleteAbilityFromCatalog } from '../firebase.js';
import { CARD_CATALOG } from '../engine/index.js';
import { hydrateAbility } from '../engine/utils.js';
import { generateAbilityDescription } from '../language_description.js';
import { extractGlossary, renderJSONPreview, loadUI, showToast, openInspectionModal } from '../ui.js';
import { launchSandboxMatch } from '../testing.js';
import { processBulkImport } from './importer.js';

import { CardState } from './card/state.js';
import { StudioState } from './ability/state.js';

// Card logic
import { populateGenuses, populateFamily, toggleStatFields, resetForm as resetCardForm, buildCardState } from './card/form.js';
import { renderAssignedAbilities, renderReferencedAbilities } from './card/abilities.js';
import { updatePreview as updateCardPreview, initImagePanning } from './card/preview.js';

// Ability logic
import { resetForm as resetAbilityForm, updateJSONPreview as updateAbilityJSONPreview, renderCatalogList as renderAbilityCatalogList, renderAssociatedCards, getCurrentAbilityState } from './ability/catalog_sync.js';
import { renderEffects, revalidatePayloadTypes, handleAddEffectGroup } from './ability/payloads.js';
import { renderLogicTrees } from './ability/logic_tree.js';
import { updateTargetingUI, updateTriggerComposite, populateBaseTriggers } from './ability/triggers.js';
import { validateAbilityLogic } from '../ability_validation.js';
import { handleDescriptionInput, handleDescriptionKeydown, closeMentionDropdown } from './ability/mentions.js';

// Import Web Components
import '../../components/main_nav.js';
import '../../components/catalog.js'; 
import '../../components/topbar.js';
import '../../components/card_preview.js';
import '../../components/art_panner.js';

export const CreatorState = {
    activeMode: 'empty', // 'empty', 'card', 'ability'
    activeId: null,
    isDirty: false,
    returnContext: null,
    pendingNavigation: null
};

window.CreatorController = {
    async init() {
        await loadUI();

        // 1. Fetch Shared Dependencies
        CardState.customTribes = await fetchCustomTribes();
        StudioState.customTribesList = CardState.customTribes;
        
        const rawAbs = await fetchCustomAbilities();
        const customCards = await fetchCustomCards();
        
        // 2. Hydrate Global Registries
        const tempCards = [...CARD_CATALOG, ...customCards];
        
        StudioState.allAbilities = rawAbs.map(ab => {
            let desc = '';
            try { desc = generateAbilityDescription(ab, rawAbs, tempCards, StudioState.customTribesList); } catch(e) {}
            return { ...ab, displayDescription: desc };
        });
        StudioState.allAbilitiesRegistry = [...StudioState.allAbilities];
        CardState.allAbilities = StudioState.allAbilities;
        CardState.allAbilitiesRegistry = [...StudioState.allAbilities];

        const hydratedCustomCards = customCards.map(c => {
            if (c.abilities) c.abilities = c.abilities.map(ab => hydrateAbility(ab, rawAbs)).filter(Boolean);
            return c;
        });
        
        CardState.allCards = [...CARD_CATALOG, ...hydratedCustomCards];
        StudioState.allCards = CardState.allCards;

        // 3. Initialize Shared Form Elements
        const tribeSelect = document.getElementById('card-tribe');
        if (CardState.customTribes.length > 0) {
            tribeSelect.innerHTML = CardState.customTribes.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        } else {
            tribeSelect.innerHTML = `<option value="Generic">Generic</option>`;
        }
        tribeSelect.addEventListener('change', (e) => populateGenuses(e.target.value));
        
        populateFamily('');
        populateBaseTriggers();

        // Bind Ability Specific UI
        document.getElementById('add-effect-group-btn').addEventListener('click', () => {
            handleAddEffectGroup();
            this.markDirty();
            window.updatePreview();
        });

        const updateTrig = () => { updateTriggerComposite(); this.markDirty(); window.updatePreview(); };
        document.getElementById('ab-base-trigger').addEventListener('change', updateTrig);
        document.getElementById('ab-trigger-phase').addEventListener('change', updateTrig);
        document.getElementById('ab-trigger-role').addEventListener('change', updateTrig);

        const descInput = document.getElementById('ab-description');
        if (descInput) {
            descInput.addEventListener('input', handleDescriptionInput);
            descInput.addEventListener('keydown', handleDescriptionKeydown);
            descInput.addEventListener('blur', () => setTimeout(closeMentionDropdown, 200));
        }

        // 4. Dirty State Trackers (Event Delegation for dynamic elements)
        document.getElementById('workspace-card').addEventListener('input', () => { this.markDirty(); window.updatePreview(); });
        document.getElementById('workspace-card').addEventListener('change', () => { this.markDirty(); window.updatePreview(); });
        
        document.getElementById('workspace-ability').addEventListener('input', () => { this.markDirty(); window.updatePreview(); });
        document.getElementById('workspace-ability').addEventListener('change', () => { this.markDirty(); window.updatePreview(); });
        document.getElementById('workspace-ability').addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                this.markDirty();
            }
        });

        // 5. Setup Action Modals
        document.getElementById('btn-dirty-cancel').addEventListener('click', () => this.resolveDirtyModal(false));
        document.getElementById('btn-dirty-discard').addEventListener('click', () => this.resolveDirtyModal(true));
        
        const topbar = document.getElementById('global-topbar');
        topbar.addEventListener('save', () => this.handleSave());
        topbar.addEventListener('test', () => this.handleTest());
        topbar.addEventListener('clone', () => this.handleClone());
        topbar.addEventListener('delete', () => this.handleDelete());
        topbar.addEventListener('import', (e) => this.handleImport(e.detail));
        
        // 6. Setup Catalog
        const catalogEl = document.getElementById('unified-catalog');
        catalogEl.setAttribute('hide-badges', 'true');
        catalogEl.addEventListener('new-item', (e) => {
            const type = e.detail?.type || (CreatorState.activeMode === 'ability' ? 'ability' : 'card');
            this.requestNavigation(type, '');
        });
        
        this.renderUnifiedCatalog();

        // 7. Initialize Quick Assigner for Abilities
        const assignInput = document.getElementById('assign-card-input');
        const assignDatalist = document.getElementById('assign-card-options');
        if (assignInput && assignDatalist) {
            assignDatalist.innerHTML = CardState.allCards.map(c => `<option value="${c.name}"></option>`).join('');
            assignInput.addEventListener('change', async (e) => {
                const val = e.target.value.toLowerCase();
                const match = CardState.allCards.find(c => c.name.toLowerCase() === val);
                
                if (!CreatorState.activeId || CreatorState.activeMode !== 'ability') {
                    showToast('Please select or save an ability first.', 'error');
                    assignInput.value = '';
                    return;
                }

                if (match) {
                    if (!match.abilities) match.abilities = [];
                    const hasAb = match.abilities.some(a => (a.abilityId || a.id || a) === CreatorState.activeId);
                    
                    if (!hasAb) {
                        assignInput.disabled = true;
                        assignInput.value = 'Assigning...';
                        match.abilities.push({ abilityId: CreatorState.activeId, paramX: null });
                        await saveCardToCatalog(match);
                        showToast(`Ability assigned to ${match.name}!`, 'success');
                        
                        const idx = CardState.allCards.findIndex(c => c.id === match.id);
                        if (idx !== -1) CardState.allCards[idx] = match;
                        renderAssociatedCards();
                        
                        assignInput.disabled = false;
                        assignInput.value = '';
                        assignInput.blur();
                    } else {
                        showToast(`${match.name} already has this ability.`, 'info');
                        assignInput.value = '';
                    }
                }
            });
        }

        // 8. Route Execution
        window.addEventListener('hashchange', () => this.handleHashRoute());
        this.handleHashRoute();
        
        initImagePanning();
    },

    renderUnifiedCatalog() {
        const catalogEl = document.getElementById('unified-catalog');
        if (!catalogEl) return;
        
        const combined = [...CardState.allCards, ...StudioState.allAbilities].map(item => {
            // Normalize ID properties for unified sorting
            return {
                ...item,
                unifiedId: item.id || item.abilityId,
                unifiedType: item.id ? 'card' : 'ability'
            };
        });

        catalogEl.setItems(combined, (item) => {
            const isCard = item.unifiedType === 'card';
            let contentHtml = '';
            
            if (isCard) {
                let tribeName = item.tribe || 'Generic';
                if (!tribeName.startsWith('tribe_')) {
                    const match = CardState.customTribes.find(t => t.id === tribeName || t.name === tribeName);
                    if (match) tribeName = match.name;
                } else {
                    const match = CardState.customTribes.find(t => t.id === tribeName);
                    if (match) tribeName = match.name;
                }
                
                contentHtml = `
                    <div class="flex items-center gap-2 overflow-hidden pointer-events-none">
                        <span class="w-6 h-6 rounded bg-amber-500 text-black font-extrabold flex items-center justify-center text-[10px] shrink-0 shadow border border-amber-700">${item.cost || 0}</span>
                        <div class="flex flex-col truncate">
                            <span class="font-bold text-amber-300 truncate">${item.name || 'Unnamed Card'}</span>
                            <span class="text-[9px] text-slate-400 capitalize truncate">${tribeName} • ${item.type || 'Unit'}</span>
                        </div>
                    </div>
                    ${(item.abilities && item.abilities.length > 0) ? `<span class="text-[9px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-900 shrink-0 ml-1 shadow-inner">${item.abilities.length} Abil</span>` : ''}
                `;
            } else {
                let effectsCount = 0;
                if (item.effects) {
                    effectsCount = item.effects.reduce((acc, g) => acc + (g.payloads ? g.payloads.length : 1), 0);
                }
                contentHtml = `
                    <div class="flex items-center gap-2 overflow-hidden pointer-events-none w-full">
                        <span class="w-6 h-6 rounded bg-slate-800 text-amber-400 font-extrabold flex items-center justify-center text-[12px] shrink-0 shadow border border-slate-700">⚡</span>
                        <div class="flex flex-col truncate w-full">
                            <span class="font-bold text-amber-300 truncate">${item.name || 'Unnamed Ability'}</span>
                            <span class="text-[9px] text-slate-400 capitalize truncate">${(item.trigger || 'MANUAL').replace(/_/g, ' ')} • ${item.effects ? item.effects.length : 0} Targets</span>
                        </div>
                    </div>
                    ${effectsCount > 0 ? `<span class="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-900 shrink-0 ml-1 shadow-inner">${effectsCount} Acts</span>` : ''}
                `;
            }

            return `
                <div data-catalog-id="${item.unifiedId}" onclick="window.CreatorController.requestNavigation('${item.unifiedType}', '${item.unifiedId}')" 
                     class="p-2 bg-slate-900/60 border border-slate-700/50 hover:border-amber-500/50 rounded-xl text-xs cursor-pointer flex justify-between items-center transition-all group relative overflow-hidden">
                    ${contentHtml}
                </div>
            `;
        });

        if (CreatorState.activeId) {
            catalogEl.setActiveItem(CreatorState.activeId);
        }
    },

    async requestNavigation(type, id) {
        if (CreatorState.activeMode === type && CreatorState.activeId === id) {
            // If user clicks "New" while already in an unsaved empty form, prompt or ignore
            if (!id && CreatorState.isDirty) {
                const userConfirmedDiscard = await this.showDirtyModal();
                if (!userConfirmedDiscard) return;
                this.switchWorkspace(type, id); // force reset
            }
            return;
        }

        if (CreatorState.isDirty) {
            const userConfirmedDiscard = await this.showDirtyModal();
            if (!userConfirmedDiscard) return;
        }
        
        window.location.hash = id || `new_${type}`;
    },

    handleHashRoute() {
        const hash = window.location.hash.replace('#', '');
        if (!hash) {
            // Intercept hash clearing triggered by form resets
            // so we don't accidentally kick the user out to the empty workspace
            if (CreatorState.activeMode === 'card' && !CreatorState.activeId) return;
            if (CreatorState.activeMode === 'ability' && !CreatorState.activeId) return;
            
            this.switchWorkspace('empty', null);
            return;
        }

        let type = '';
        let id = '';

        if (hash.startsWith('new_')) {
            type = hash.split('_')[1]; // 'card' or 'ability'
            id = '';
        } else if (hash.startsWith('card_')) {
            type = 'card';
            id = hash;
        } else if (hash.startsWith('ability_')) {
            type = 'ability';
            id = hash;
        } else {
            return; // Unknown hash
        }

        if (type === 'card' || type === 'ability') {
            this.switchWorkspace(type, id);
        }
    },

    switchWorkspace(mode, id) {
        CreatorState.activeMode = mode;
        CreatorState.activeId = id;

        document.getElementById('workspace-empty').classList.add('hidden');
        document.getElementById('workspace-card').classList.add('hidden');
        document.getElementById('workspace-card').classList.remove('flex');
        document.getElementById('workspace-ability').classList.add('hidden');
        document.getElementById('workspace-ability').classList.remove('flex');

        const titleEl = document.getElementById('workspace-title');
        const topbar = document.getElementById('global-topbar');

        const catalogEl = document.getElementById('unified-catalog');
        if (catalogEl) catalogEl.setActiveItem(id);

        if (mode === 'card') {
            titleEl.innerText = "⚡ Editing Card";
            titleEl.className = "text-lg font-black text-blue-400 uppercase tracking-wider";
            document.getElementById('workspace-card').classList.remove('hidden');
            document.getElementById('workspace-card').classList.add('flex');
            
            if (id) {
                // We map window.loadCard from the old system to our master state logic here
                const card = CardState.allCards.find(c => c.id === id);
                if (card) {
                    CardState.currentEditingId = card.id;
                    const setVal = (fid, v) => { const el = document.getElementById(fid); if (el) el.value = v; };
                    setVal('card-name', card.name);
                    let mappedTribe = card.tribe || 'Generic';
                    if (!mappedTribe.startsWith('tribe_')) {
                        const match = CardState.customTribes.find(t => t.name.toLowerCase() === mappedTribe.toLowerCase());
                        if (match) mappedTribe = match.id;
                    }
                    setVal('card-tribe', mappedTribe);
                    populateGenuses(mappedTribe, card.genus || '');
                    setVal('card-type', card.type || 'unit');
                    setVal('card-default-line', card.defaultLine || 'mid');
                    setVal('card-genus', card.genus || '');
                    populateFamily(card.family || '');
                    setVal('card-cost', card.cost || 0);
                    setVal('card-power', card.power || 0);
                    setVal('card-health', card.maxHealth || card.health || 1);
                    setVal('card-strength', (card.strength !== undefined && card.strength !== null) ? card.strength : '');
                    setVal('card-art', card.artUrl || '');
                    setVal('card-art-x', card.artX ?? 50); setVal('card-art-y', card.artY ?? 50); setVal('card-art-scale', card.artScale ?? 100);
                    setVal('card-description', card.description || '');
                    
                    CardState.currentAbilities = (card.abilities || []).map(a => {
                        if (typeof a === 'string') return { id: a, paramX: null };
                        return { id: a.abilityId || a.id, paramX: a.paramX !== undefined ? a.paramX : null };
                    });
                    
                    toggleStatFields();
                    renderAssignedAbilities();
                    updateCardPreview();
                    this.updateRightPanePreview(card, 'card');
                    topbar.showButtons(true);
                }
            } else {
                resetCardForm();
                topbar.showButtons(false);
            }
            
            document.getElementById('card-relationships-panel').classList.remove('hidden');
            document.getElementById('ability-relationships-panel').classList.add('hidden');
            
        } else if (mode === 'ability') {
            titleEl.innerText = "⚡ Editing Ability";
            titleEl.className = "text-lg font-black text-amber-400 uppercase tracking-wider";
            document.getElementById('workspace-ability').classList.remove('hidden');
            document.getElementById('workspace-ability').classList.add('flex');
            
            const banner = document.getElementById('jump-return-banner');
            if (CreatorState.returnContext) {
                banner.classList.remove('hidden');
                document.getElementById('jump-target-name').innerText = CreatorState.returnContext.name || 'Card';
            } else {
                banner.classList.add('hidden');
            }

            if (id) {
                // Simulate loadAbility from ability_controller
                const ab = StudioState.allAbilities.find(a => a.abilityId === id);
                if (ab) {
                    StudioState.currentEditingId = ab.abilityId;
                    const setVal = (fid, v) => { const el = document.getElementById(fid); if (el) el.value = v; };
                    setVal('ab-name', ab.name);
                    setVal('ab-description', ab.description || '');
                    setVal('ab-trigger-scope', ab.triggerScope || 'PERSONAL');
                    setVal('ab-trigger-limit', ab.triggerLimit || 'UNLIMITED');
                    
                    const comp = window.parseTriggerToComposite ? window.parseTriggerToComposite(ab.trigger) : {base: ab.trigger, phase: 'ON', role: 'ACTIVE'};
                    setVal('ab-base-trigger', comp.base);
                    setVal('ab-trigger-phase', comp.phase);
                    setVal('ab-trigger-role', comp.role);
                    updateTriggerComposite();
                    
                    document.querySelectorAll('.ab-flag-chk').forEach(cb => {
                        cb.checked = ab.passiveFlags ? ab.passiveFlags.includes(cb.value) : false;
                    });
                    
                    const cost = ab.cost || {};
                    setVal('ab-cost-tribe-amt', cost.tribeAmount || 0);
                    setVal('ab-cost-tent', cost.carnie || cost.tent || 0);
                    setVal('ab-cost-power', cost.power || 0);
                    setVal('ab-cost-readiness', cost.readinessCost || (cost.exhausts ? 'EXHAUSTS' : 'NONE'));
                    document.getElementById('ab-cost-reuse-exempt').checked = !!cost.reuseIgnoresReadiness;
                    document.getElementById('ab-cost-free-action').checked = !!cost.freeAction;
                    
                    // We must rely on the ability module state sync functions for deep nested logic
                    // so we mock a tiny reset and call render
                    const srcAct = ab.activation || ab.targeting || {};
                    setVal('ab-act-method', srcAct.method || 'NONE');
                    if (srcAct.logicTree) StudioState.activationRoot = JSON.parse(JSON.stringify(srcAct.logicTree));
                    else StudioState.activationRoot = { type: 'group', logicalOperator: 'AND', children: [] };
                    
                    StudioState.effectGroups = ab.effects ? JSON.parse(JSON.stringify(ab.effects)) : [];
                    
                    renderLogicTrees();
                    renderEffects();
                    updateTargetingUI();
                    updateAbilityJSONPreview();
                    this.updateRightPanePreview(ab, 'ability');
                    renderAssociatedCards();
                    topbar.showButtons(true);
                }
            } else {
                resetAbilityForm();
                topbar.showButtons(false);
            }
            
            document.getElementById('card-relationships-panel').classList.add('hidden');
            document.getElementById('ability-relationships-panel').classList.remove('hidden');
            
        } else {
            titleEl.innerText = "⚡ Workspace";
            document.getElementById('workspace-empty').classList.remove('hidden');
        }

        this.clearDirty();
    },
    
    updateRightPanePreview(item, type) {
        const previewContainer = document.getElementById('right-preview-container');
        const titleEl = document.getElementById('right-preview-title');
        
        if (type === 'card') {
            titleEl.innerText = 'Card Preview';
            previewContainer.innerHTML = `<card-preview card-data="${encodeURIComponent(JSON.stringify(item)).replace(/'/g, "%27")}"></card-preview>`;
        } else {
            titleEl.innerText = 'Generated Glossary';
            const glossaryEntries = extractGlossary([item], StudioState.allAbilitiesRegistry, item.description);
            if (glossaryEntries.length === 0) {
                previewContainer.innerHTML = '<div class="text-xs text-slate-500 italic flex items-center justify-center h-full">No glossary terms detected.</div>';
                return;
            }
            
            previewContainer.innerHTML = `<div class="flex flex-col gap-2 w-full h-full overflow-y-auto minimal-scrollbar p-1 items-start justify-start">` + 
                glossaryEntries.map(a => `
                    <div class="bg-slate-900/90 p-3 rounded-lg border border-slate-700 w-full shrink-0">
                        <div class="font-black text-fuchsia-300 text-[11px]">${a.name || a.abilityId || a.id}</div>
                        <div class="text-slate-300 text-[10px] mt-1">${a.displayDescription || a.description || ''}</div>
                    </div>
                `).join('') + `</div>`;
        }
    },

    jumpToNewAbility() {
        this.handleSave(true); // Auto-save card (even as draft)
        
        const cardObj = buildCardState();
        CreatorState.returnContext = { id: cardObj.id, name: cardObj.name };
        
        window.location.hash = 'new_ability'; 
    },

    cancelJump() {
        if (CreatorState.returnContext) {
            const targetHash = CreatorState.returnContext.id;
            CreatorState.returnContext = null;
            window.location.hash = targetHash;
        }
    },

    async handleSave(isAutoSave = false) {
        const topbar = document.getElementById('global-topbar');
        if (!isAutoSave) topbar.setLoading('save', true);

        if (CreatorState.activeMode === 'card') {
            const cardObj = buildCardState();
            // Validate (Dummy implementation - extend as needed)
            cardObj.isValid = !!cardObj.name && !!cardObj.family;
            
            await saveCardToCatalog(cardObj);
            const idx = CardState.allCards.findIndex(c => c.id === cardObj.id);
            if (idx !== -1) CardState.allCards[idx] = cardObj;
            else CardState.allCards.push(cardObj);

            if (!isAutoSave) showToast(`Card ${cardObj.name} saved!`, 'success');
            
        } else if (CreatorState.activeMode === 'ability') {
            const abObj = getCurrentAbilityState();
            const errors = validateAbilityLogic(abObj);
            abObj.isValid = errors.length === 0;

            await saveAbilityToCatalog(abObj);
            const idx = StudioState.allAbilities.findIndex(a => a.abilityId === abObj.abilityId);
            if (idx !== -1) StudioState.allAbilities[idx] = abObj;
            else StudioState.allAbilities.push(abObj);

            if (!isAutoSave) showToast(`Ability ${abObj.name} saved!`, 'success');

            // Handle Jump Return Injection
            if (!isAutoSave && CreatorState.returnContext) {
                const targetCard = CardState.allCards.find(c => c.id === CreatorState.returnContext.id);
                if (targetCard) {
                    if (!targetCard.abilities) targetCard.abilities = [];
                    targetCard.abilities.push({ abilityId: abObj.abilityId, paramX: null });
                    await saveCardToCatalog(targetCard);
                }
                const targetHash = CreatorState.returnContext.id;
                CreatorState.returnContext = null; 
                window.location.hash = targetHash; 
            }
        }
        
        this.clearDirty();
        this.renderUnifiedCatalog();
        if (!isAutoSave) topbar.setLoading('save', false);
    },

    showDirtyModal() {
        return new Promise((resolve) => {
            CreatorState.pendingNavigation = resolve;
            const modal = document.getElementById('dirty-state-modal');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        });
    },

    resolveDirtyModal(discardChanges) {
        const modal = document.getElementById('dirty-state-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        
        if (discardChanges) {
            this.clearDirty();
            if (CreatorState.pendingNavigation) CreatorState.pendingNavigation(true);
        } else {
            if (CreatorState.pendingNavigation) CreatorState.pendingNavigation(false);
        }
        CreatorState.pendingNavigation = null;
    },

    markDirty() {
        CreatorState.isDirty = true;
        const btn = document.getElementById('btn-save');
        if (btn && !btn.innerHTML.includes('*')) {
            btn.innerHTML += '*';
        }
        this.evaluateDraftState();
    },

    clearDirty() {
        CreatorState.isDirty = false;
        const btn = document.getElementById('btn-save');
        if (btn) {
            btn.innerHTML = btn.innerHTML.replace('*', '');
        }
        this.evaluateDraftState();
    },

    evaluateDraftState() {
        const btn = document.getElementById('btn-save');
        const draftWarning = document.getElementById('draft-warning');
        if (!btn) return;

        // Clear previous error highlights
        document.querySelectorAll('.error-highlight').forEach(el => {
            el.classList.remove('error-highlight', '!border-red-500', 'shadow-[0_0_8px_rgba(239,68,68,0.5)]');
        });

        let isValid = true;
        let errorFields = [];

        if (CreatorState.activeMode === 'card') {
            try {
                const cardObj = buildCardState();
                if (!cardObj.name || cardObj.name.trim() === 'Unnamed Card' || cardObj.name.trim() === '') {
                    isValid = false;
                    errorFields.push('card-name');
                }
                if (cardObj.type === 'unit' && !cardObj.family) {
                    isValid = false;
                    errorFields.push('card-family');
                }
            } catch(e) {
                isValid = false;
            }
        } else if (CreatorState.activeMode === 'ability') {
            try {
                const abObj = getCurrentAbilityState();
                if (!abObj.name || abObj.name.trim() === '') {
                    isValid = false;
                    errorFields.push('ab-name');
                }
                const logicErrors = validateAbilityLogic(abObj);
                if (logicErrors.length > 0) {
                    isValid = false;
                }
            } catch(e) {
                isValid = false;
            }
        }

        // Apply error highlights
        errorFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('error-highlight', '!border-red-500', 'shadow-[0_0_8px_rgba(239,68,68,0.5)]');
            }
        });

        if (isValid) {
            btn.innerHTML = btn.innerHTML.replace('Save Draft', 'Save');
            btn.classList.remove('bg-amber-600');
            btn.classList.add('bg-amber-500');
            if (draftWarning) draftWarning.classList.add('hidden');
        } else {
            if (!btn.innerHTML.includes('Draft')) btn.innerHTML = btn.innerHTML.replace('Save', 'Save Draft');
            btn.classList.remove('bg-amber-500');
            btn.classList.add('bg-amber-600');
            if (draftWarning) draftWarning.classList.remove('hidden');
        }
    },

    async handleTest() {
        if (CreatorState.isDirty) {
            showToast('Please save your changes before testing.', 'warning');
            return;
        }
        const topbar = document.getElementById('global-topbar');
        if (topbar) topbar.setLoading('test', true);

        try {
            if (CreatorState.activeMode === 'card') {
                const cardObj = buildCardState();
                await launchSandboxMatch(cardObj, 'card');
            } else if (CreatorState.activeMode === 'ability') {
                const abObj = getCurrentAbilityState();
                await launchSandboxMatch(abObj, 'ability');
            }
        } catch (e) {
            console.error("Test match launch failed:", e);
            showToast('Failed to launch test match.', 'error');
        }
        if (topbar) topbar.setLoading('test', false);
    },

    handleClone() {
        if (!CreatorState.activeId) return;
        
        if (CreatorState.activeMode === 'card') {
            const currentConfig = buildCardState();
            this.switchWorkspace('card', null);
            document.getElementById('workspace-title').innerText = "⚡ Editing Card (Cloned)";
            document.getElementById('card-name').value = currentConfig.name + ' (Copy)';
        } else if (CreatorState.activeMode === 'ability') {
            const currentConfig = getCurrentAbilityState();
            this.switchWorkspace('ability', null);
            document.getElementById('workspace-title').innerText = "⚡ Editing Ability (Cloned)";
            document.getElementById('ab-name').value = currentConfig.name + ' (Copy)';
        }
        
        this.markDirty();
        window.updatePreview();
        showToast(`${CreatorState.activeMode === 'card' ? 'Card' : 'Ability'} cloned! Save to keep it.`, 'info');
    },

    async handleDelete() {
        if (!CreatorState.activeId) return;
        
        const topbar = document.getElementById('global-topbar');
        topbar.setLoading('delete', true);
        
        if (CreatorState.activeMode === 'card') {
            await deleteCardFromCatalog(CreatorState.activeId);
            CardState.allCards = CardState.allCards.filter(c => c.id !== CreatorState.activeId);
            StudioState.allCards = CardState.allCards;
            showToast('Card deleted.', 'success');
        } else if (CreatorState.activeMode === 'ability') {
            await deleteAbilityFromCatalog(CreatorState.activeId);
            StudioState.allAbilities = StudioState.allAbilities.filter(a => a.abilityId !== CreatorState.activeId);
            StudioState.allAbilitiesRegistry = [...StudioState.allAbilities];
            CardState.allAbilities = StudioState.allAbilities;
            CardState.allAbilitiesRegistry = [...StudioState.allAbilities];
            showToast('Ability deleted.', 'success');
        }
        
        topbar.setLoading('delete', false);
        this.switchWorkspace('empty', null);
        this.renderUnifiedCatalog();
    },

    async handleImport(data) {
        const topbar = document.getElementById('global-topbar');
        topbar.setLoading('import', true);
        
        const results = await processBulkImport(data, CardState.allCards, StudioState.allAbilities, CardState.customTribes);
        
        if (results.errors.length > 0) {
            showToast(`Import finished with ${results.errors.length} errors. See console.`, 'warning');
            console.warn("Import Errors:", results.errors);
        } else {
            showToast(`Successfully imported ${results.cardsAdded} cards & ${results.abilitiesAdded} abilities.`, 'success');
        }
        
        const rawAbs = await fetchCustomAbilities();
        StudioState.allAbilities = rawAbs;
        StudioState.allAbilitiesRegistry = [...rawAbs];
        CardState.allAbilities = rawAbs;
        CardState.allAbilitiesRegistry = [...rawAbs];
        
        const customCards = await fetchCustomCards();
        const hydratedCustomCards = customCards.map(c => {
            if (c.abilities) c.abilities = c.abilities.map(ab => hydrateAbility(ab, rawAbs)).filter(Boolean);
            return c;
        });
        CardState.allCards = [...CARD_CATALOG, ...hydratedCustomCards];
        StudioState.allCards = CardState.allCards;
        
        this.renderUnifiedCatalog();
        topbar.setLoading('import', false);
        
        if (results.cardsAdded > 0) {
            const newest = customCards.sort((a,b) => b.updatedAt - a.updatedAt)[0];
            if (newest) this.switchWorkspace('card', newest.id);
        } else if (results.abilitiesAdded > 0) {
            const newest = rawAbs.sort((a,b) => b.updatedAt - a.updatedAt)[0];
            if (newest) this.switchWorkspace('ability', newest.abilityId);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => window.CreatorController.init());

// Bind Global Scope Overrides
window.updatePreview = () => {
    if (CreatorState.activeMode === 'card') {
        updateCardPreview();
        const cardObj = buildCardState();
        window.CreatorController.updateRightPanePreview(cardObj, 'card');
    } else if (CreatorState.activeMode === 'ability') {
        updateAbilityJSONPreview();
        const abObj = getCurrentAbilityState();
        window.CreatorController.updateRightPanePreview(abObj, 'ability');
    }
};
window.copyCardJSON = () => {
    const obj = buildCardState();
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2)).then(() => showToast('JSON Copied!', 'success'));
};
window.copyJSONPreview = () => {
    const obj = getCurrentAbilityState();
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2)).then(() => showToast('JSON Copied!', 'success'));
};