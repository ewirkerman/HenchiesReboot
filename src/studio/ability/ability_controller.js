// filepath: src/studio/ability/ability_controller.js

import { StudioState } from './state.js';
import { fetchCustomAbilities, fetchCustomCards, fetchCustomTribes, saveAbilityToCatalog } from '../../firebase.js';
import { CARD_CATALOG } from '../../engine/index.js';
import { generateAbilityDescription } from '../../language_description.js';
import { showToast } from '../../ui.js';

import { handleDescriptionInput, handleDescriptionKeydown, closeMentionDropdown } from './mentions.js';
import { handleAddEffectGroup } from './payloads.js';
import { handleSaveAbility, handleCloneAbility, handleDeleteAbility, resetForm, renderCatalogList, loadAbility, updateJSONPreview, initCardAssigner } from './catalog_sync.js';
import { updateTriggerComposite } from './triggers.js';
import { processBulkImport } from '../importer.js';

import '../../../components/main_nav.js';
import '../../../components/catalog.js'; 
import '../../../components/topbar.js';

async function init() {
  const baseTriggerSelect = document.getElementById('ab-base-trigger');
  if (baseTriggerSelect) {
      // Options are injected by renderAdditionalTriggers matching logic natively in triggers.js
      updateTriggerComposite();
  }

  document.getElementById('add-effect-group-btn').addEventListener('click', handleAddEffectGroup);
  document.getElementById('save-ability-btn').addEventListener('click', handleSaveAbility);
  
  const topbar = document.getElementById('studio-topbar');
  topbar.addEventListener('save', handleSaveAbility);
  topbar.addEventListener('clone', handleCloneAbility);
  topbar.addEventListener('test', () => { if(window.launchTestMatch) window.launchTestMatch(); });
  topbar.addEventListener('delete', handleDeleteAbility);
  
  topbar.addEventListener('import', async (e) => {
      topbar.setLoading('import', true);
      document.getElementById('editor-error-banner').classList.add('hidden');
      
      const data = e.detail;
      const results = await processBulkImport(data, StudioState.allCards, StudioState.allAbilities, StudioState.customTribesList);
      
      if (results.errors.length > 0) {
          const errorBanner = document.getElementById('editor-error-banner');
          const errorMessage = document.getElementById('editor-error-message');
          errorMessage.innerText = "Import Errors:\n" + results.errors.join('\n');
          errorBanner.classList.remove('hidden');
          showToast(`Import finished with errors.`, 'warning');
      } else {
          showToast(`Successfully imported ${results.abilitiesAdded} abilities & ${results.cardsAdded} cards.`, 'success');
      }

      // Hard refresh the local state to catch new imports
      const rawAbs = await fetchCustomAbilities();
      StudioState.allAbilities = rawAbs;
      StudioState.allAbilitiesRegistry = [...rawAbs];
      
      renderCatalogList();
      if (results.abilitiesAdded > 0) {
          // If we imported an array, the newest ability will be pushed to the registry. Find it.
          const newest = rawAbs.sort((a,b) => b.updatedAt - a.updatedAt)[0];
          if (newest) loadAbility(newest.abilityId);
          updateJSONPreview();
      }
      
      topbar.setLoading('import', false);
  });
  
  topbar.addEventListener('import-error', (e) => {
      const errorBanner = document.getElementById('editor-error-banner');
      const errorMessage = document.getElementById('editor-error-message');
      errorMessage.innerText = e.detail.message;
      errorBanner.classList.remove('hidden');
  });
  
  const catalogEl = document.getElementById('ability-catalog');
  catalogEl.addEventListener('new-item', resetForm);
  
  document.getElementById('ability-form').addEventListener('input', updateJSONPreview);
  document.getElementById('ability-form').addEventListener('change', updateJSONPreview);

  document.getElementById('ab-base-trigger').addEventListener('change', updateTriggerComposite);
  document.getElementById('ab-trigger-phase').addEventListener('change', updateTriggerComposite);
  document.getElementById('ab-trigger-role').addEventListener('change', updateTriggerComposite);

  window.togglePassiveFlags = () => {
      const container = document.getElementById('passive-flags-container');
      container.classList.toggle('hidden');
  };

  window.updatePassiveFlagsCount = () => {
      const count = document.querySelectorAll('.ab-flag-chk:checked').length;
      const btn = document.getElementById('toggle-flags-btn');
      if (btn) {
          btn.innerHTML = `⚙️ Set Passive Flags (${count} Active)`;
          if (count > 0) {
              btn.classList.add('text-amber-400', 'border-amber-500/50');
              btn.classList.remove('text-slate-300', 'border-slate-600');
          } else {
              btn.classList.remove('text-amber-400', 'border-amber-500/50');
              btn.classList.add('text-slate-300', 'border-slate-600');
          }
      }
  };

  document.querySelectorAll('.ab-flag-chk').forEach(chk => {
      chk.addEventListener('change', window.updatePassiveFlagsCount);
  });

  const descInput = document.getElementById('ab-description');
  descInput.addEventListener('input', handleDescriptionInput);
  descInput.addEventListener('keydown', handleDescriptionKeydown);
  descInput.addEventListener('blur', () => setTimeout(closeMentionDropdown, 200));

  const rawAbilities = await fetchCustomAbilities();
  const customCards = await fetchCustomCards();
  StudioState.customTribesList = await fetchCustomTribes();
  
  if (customCards && customCards.length > 0) {
    const merged = [...CARD_CATALOG, ...customCards];
    StudioState.allCards = Array.from(new Map(merged.map(c => [c.id, c])).values());
  } else {
    StudioState.allCards = [...CARD_CATALOG];
  }

  StudioState.allAbilities = rawAbilities.map(ab => {
    let desc = 'Description unavailable';
    try {
        desc = generateAbilityDescription(ab, rawAbilities, StudioState.allCards, StudioState.customTribesList);
    } catch (e) {
        console.warn(`Failed to generate description for ${ab.name}:`, e);
    }
    return { ...ab, abilityId: ab.abilityId || ab.id, displayDescription: desc };
  });
  
  const urlParams = new URLSearchParams(window.location.search);
  const hashId = window.location.hash.replace('#', '');
  
  // Also check if we were linked here from the Card Studio asking us to return to a card
  const returnToCard = urlParams.get('returnToCard');
  if (returnToCard) {
      StudioState.activeAssignerId = null;
      // Pre-fill the auto-assigner
      setTimeout(() => {
          const assignInput = document.getElementById('assign-card-input');
          if (assignInput) {
              const match = StudioState.allCards.find(c => c.id === returnToCard);
              if (match) assignInput.value = match.name;
              showToast('Card targeted! Save your new ability to attach it.', 'info');
          }
      }, 1500);
  }

  const loadId = urlParams.get('id') || hashId;

  renderCatalogList();
  resetForm();

  if (loadId) {
      setTimeout(() => loadAbility(loadId), 50);
  }

  window.addEventListener('hashchange', () => {
      const newHash = window.location.hash.replace('#', '');
      if (newHash && newHash !== StudioState.currentEditingId) {
          loadAbility(newHash);
      } else if (!newHash && StudioState.currentEditingId) {
          resetForm();
      }
  });

  // Start assigner polling
  setTimeout(initCardAssigner, 1000);
}

// Bootstrap
init();