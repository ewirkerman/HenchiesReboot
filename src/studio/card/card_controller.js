// filepath: src/studio/card/card_controller.js

import { CardState } from './state.js';
import { fetchCustomTribes, fetchCustomCards, fetchCustomAbilities, saveAbilityToCatalog } from '../../firebase.js';
import { CARD_CATALOG } from '../../engine/index.js';
import { loadUI, showToast } from '../../ui.js';
import { generateAbilityDescription } from '../../language_description.js';
import { renderCatalog, loadCard, saveCard, cloneCard, deleteCard, launchTestMatch } from './catalog_sync.js';
import { populateGenuses, toggleStatFields, resetForm, enforceAttackAbility } from './form.js';
import { updatePreview, initImagePanning } from './preview.js';
import { renderAssignedAbilities } from './abilities.js';
import { processBulkImport } from '../importer.js';
import { hydrateAbility } from '../../engine/utils.js';

import '../../../components/main_nav.js';
import '../../../components/catalog.js'; 
import '../../../components/topbar.js';
import '../../../components/card_preview.js';

async function init() {
    await loadUI();
    
    CardState.customTribes = await fetchCustomTribes();
    const tribeSelect = document.getElementById('card-tribe');
    if (CardState.customTribes.length > 0) {
        tribeSelect.innerHTML = CardState.customTribes.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    } else {
        tribeSelect.innerHTML = `<option value="Generic">Generic</option>`;
    }

    tribeSelect.addEventListener('change', (e) => populateGenuses(e.target.value));

    const fetchedCards = await fetchCustomCards();
    const rawAbilities = await fetchCustomAbilities();
    
    const tempCards = [...CARD_CATALOG, ...fetchedCards];
    CardState.allAbilities = rawAbilities.map(ab => ({ ...ab, displayDescription: generateAbilityDescription(ab, rawAbilities, tempCards, CardState.customTribes) }));
    CardState.allAbilitiesRegistry = [...CardState.allAbilities];

    const hydratedCustomCards = fetchedCards.map(c => {
        if (c.abilities) {
            c.abilities = c.abilities.map(ab => hydrateAbility(ab, rawAbilities)).filter(Boolean);
        }
        return c;
    });
    CardState.allCards = [...CARD_CATALOG, ...hydratedCustomCards];

    const abilityDatalist = document.getElementById('ability-options');
    CardState.allAbilities.forEach(ab => {
        const opt = document.createElement('option');
        opt.value = ab.name;
        abilityDatalist.appendChild(opt);
    });

    document.getElementById('card-strength').addEventListener('input', enforceAttackAbility);

    const inputs = document.querySelectorAll('input:not(#add-ability-input):not(#catalog-search), select, textarea');
    inputs.forEach(el => {
        el.addEventListener('input', updatePreview);
        el.addEventListener('change', updatePreview);
    });

    initImagePanning();

    document.getElementById('card-type').addEventListener('change', toggleStatFields);
    
    const addAbilityInput = document.getElementById('add-ability-input');
    addAbilityInput.addEventListener('change', (e) => {
        const val = e.target.value.toLowerCase().trim();
        const match = CardState.allAbilities.find(a => (a.name || '').toLowerCase().trim() === val);
        
        if (match) {
            const abId = match.abilityId;
            if (abId && !CardState.currentAbilities.some(a => a.id === abId)) {
                CardState.currentAbilities.push({ id: abId, paramX: null });
                enforceAttackAbility();
                renderAssignedAbilities();
                updatePreview();
            }
            e.target.value = '';
            e.target.blur(); 
        }
    });

    const catalogEl = document.getElementById('card-catalog');
    catalogEl.addEventListener('new-item', resetForm);

    document.getElementById('save-card-btn').addEventListener('click', saveCard);
    
    const topbar = document.getElementById('studio-topbar');
    topbar.addEventListener('save', saveCard);
    topbar.addEventListener('clone', cloneCard);
    topbar.addEventListener('test', launchTestMatch);
    topbar.addEventListener('delete', deleteCard);
    
    topbar.addEventListener('import', async (e) => {
        topbar.setLoading('import', true);
        const data = e.detail;
        
        const results = await processBulkImport(data, CardState.allCards, CardState.allAbilities, CardState.customTribes);
        
        if (results.errors.length > 0) {
            showToast(`Import finished with ${results.errors.length} errors. See console.`, 'warning');
            console.warn("Import Errors:", results.errors);
        } else {
            showToast(`Successfully imported ${results.cardsAdded} cards & ${results.abilitiesAdded} abilities.`, 'success');
        }

        // Hard refresh the studio dependencies to catch the newly saved items
        const rawAbs = await fetchCustomAbilities();
        CardState.allAbilities = rawAbs;
        CardState.allAbilitiesRegistry = [...rawAbs];
        
        renderCatalog();
        if (results.cardsAdded > 0) {
             loadCard(CardState.allCards[0].id); // Load the first newly imported card
             updatePreview();
        }
        topbar.setLoading('import', false);
    });

    const urlParams = new URLSearchParams(window.location.search);
    const hashId = window.location.hash.replace('#', '');
    const loadId = urlParams.get('id') || hashId;

    renderCatalog();
    resetForm();

    if (loadId) {
        setTimeout(() => loadCard(loadId), 50);
    }

    window.addEventListener('hashchange', () => {
        const newHash = window.location.hash.replace('#', '');
        if (newHash && newHash !== CardState.currentEditingId) {
            loadCard(newHash);
        } else if (!newHash && CardState.currentEditingId) {
            resetForm();
        }
    });
}

// Bootstrap
init();