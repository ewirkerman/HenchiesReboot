import { CardState } from './state.js';
import { updatePreview } from './preview.js';
import { renderAssignedAbilities } from './abilities.js';
import { ATTRIBUTE_MANIFEST } from '../../engine/attributes.js';
import { hydrateAbility } from '../../engine/utils.js';
import { generateAbilityDescription } from '../../language_description.js';

export function populateGenuses(tribeId, currentGenus = '') {
    const genusSelect = document.getElementById('card-genus');
    let optionsHtml = '<option value="">None</option>';
    const tribe = CardState.customTribes.find(t => t.id === tribeId || t.name === tribeId);
    if (tribe && tribe.validGenuses && tribe.validGenuses.length > 0) {
        tribe.validGenuses.forEach(g => {
            optionsHtml += `<option value="${g}">${g}</option>`;
        });
    }
    genusSelect.innerHTML = optionsHtml;
    if (currentGenus && genusSelect.querySelector(`option[value="${currentGenus}"]`)) {
        genusSelect.value = currentGenus;
    } else {
        genusSelect.value = '';
    }
}

export function populateFamily(currentFamily = '') {
    const familySelect = document.getElementById('card-family');
    if (!familySelect) return;
    let optionsHtml = '<option value="">None</option>';
    const familyDef = ATTRIBUTE_MANIFEST['family'];
    if (familyDef && familyDef.options) {
        familyDef.options.forEach(f => {
            optionsHtml += `<option value="${f}">${f}</option>`;
        });
    }
    familySelect.innerHTML = optionsHtml;
    if (currentFamily && familySelect.querySelector(`option[value="${currentFamily}"]`)) {
        familySelect.value = currentFamily;
    } else {
        familySelect.value = '';
    }
}

export function toggleStatFields() {
    const type = document.getElementById('card-type').value.toUpperCase();
    
    const fieldMapping = {
        'health': 'stat-health-container',
        'strength': 'stat-strength-container',
        'power': 'stat-power-container',
        'line': 'stat-line-container',
        'family': 'stat-family-container',
        'cost': 'stat-cost-container',
        'genus': 'stat-genus-container'
    };

    const healthInput = document.getElementById('card-health');
    if (type === 'AVATAR' && healthInput.value === '1') {
        healthInput.value = '20';
    } else if (type === 'UNIT' && healthInput.value === '20') {
        healthInput.value = '1';
    } else if (type !== 'AVATAR' && type !== 'UNIT') {
        if (healthInput.value === '1' || healthInput.value === '20') {
            healthInput.value = ''; // Clear it out to show it is optional
        }
    }

    for (const [attr, containerId] of Object.entries(fieldMapping)) {
        const container = document.getElementById(containerId);
        if (!container) continue;
        
        const inputEl = container.querySelector('input, select');
        const manifestDef = ATTRIBUTE_MANIFEST[attr];
        
        if (manifestDef && (manifestDef.allowedTypes.includes('ALL') || manifestDef.allowedTypes.includes(type))) {
            container.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
            if (inputEl) inputEl.disabled = false;
        } else {
            container.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
            if (inputEl) inputEl.disabled = true;
        }
    }

    if (type === 'EQUIPMENT') {
        const attachAb = CardState.allAbilities.find(a => a.name.toLowerCase() === 'attach to a unit' || a.name.toLowerCase() === 'attach');
        if (attachAb && !CardState.currentAbilities.some(a => a.id === attachAb.abilityId)) {
            CardState.currentAbilities.push({ id: attachAb.abilityId, paramX: null });
            renderAssignedAbilities();
            updatePreview();
        }
    }
}

export function resetForm() {
    CardState.currentEditingId = null;
    window.location.hash = '';
    
    const titleEl = document.getElementById('form-title') || document.getElementById('workspace-title');
    if (titleEl) titleEl.innerText = '⚡ Design New Card';
    
    document.getElementById('card-name').value = '';
    
    const tribeEl = document.getElementById('card-tribe');
    if (tribeEl && CardState.customTribes.length > 0) tribeEl.value = CardState.customTribes[0].id;
    
    document.getElementById('card-type').value = 'unit';
    document.getElementById('card-default-line').value = 'mid';
    populateGenuses(tribeEl ? tribeEl.value : '', '');
    populateFamily('');
    document.getElementById('card-cost').value = '1';
    document.getElementById('card-power').value = '0';
    document.getElementById('card-health').value = '1';
    document.getElementById('card-strength').value = '';
    document.getElementById('card-art').value = '';
    
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('card-art-x', 0); setVal('card-art-y', 0); setVal('card-art-scale', 100);
    setVal('card-nano-art-x', 0); setVal('card-nano-art-y', 0); setVal('card-nano-art-scale', 110);
    
    document.getElementById('card-description').value = '';
    const hideDeckbuilderFlag = document.getElementById('card-hide-from-deckbuilder');
    if (hideDeckbuilderFlag) hideDeckbuilderFlag.checked = false;
    
    const seriesDropdown = document.getElementById('card-series');
    if (seriesDropdown) seriesDropdown.value = 'Base Set';
    
    CardState.currentAbilities = [];
    
    const topbar = document.getElementById('global-topbar') || document.getElementById('studio-topbar');
    if (topbar) topbar.showButtons(false);
    
    toggleStatFields();
    renderAssignedAbilities();
    updatePreview();
}

export function buildCardState(forceId = null) {
    const strVal = document.getElementById('card-strength').value;
    const cardType = document.getElementById('card-type').value;
    const typeUpper = cardType.toUpperCase();

    const isAllowed = (attr) => {
        const def = ATTRIBUTE_MANIFEST[attr];
        return def && (def.allowedTypes.includes('ALL') || def.allowedTypes.includes(typeUpper));
    };
    
    const parsedHealth = parseInt(document.getElementById('card-health').value);
    let defaultHealth = null;
    if (typeUpper === 'AVATAR') defaultHealth = 20;
    else if (typeUpper === 'UNIT') defaultHealth = 1;
    
    const finalHealth = isAllowed('health') ? (!isNaN(parsedHealth) ? parsedHealth : defaultHealth) : null;
    
    const valX = parseInt(document.getElementById('card-art-x')?.value) || 0;
    const valY = parseInt(document.getElementById('card-art-y')?.value) || 0;
    const valScale = parseInt(document.getElementById('card-art-scale')?.value);
    
    const nanoX = parseInt(document.getElementById('card-nano-art-x')?.value) || 0;
    const nanoY = parseInt(document.getElementById('card-nano-art-y')?.value) || 0;
    const nanoScale = parseInt(document.getElementById('card-nano-art-scale')?.value);
    
    const searchId = forceId || CardState.currentEditingId;
    const existingCard = CardState.allCards.find(c => c.id === searchId);
    const hideDeckbuilderCheckbox = document.getElementById('card-hide-from-deckbuilder');
    const seriesDropdown = document.getElementById('card-series');
    
    const state = {
        id: searchId || ('card_' + Date.now()),
        updatedAt: existingCard ? existingCard.updatedAt : Date.now(),
        name: document.getElementById('card-name').value || 'Unnamed Card',
        tribe: document.getElementById('card-tribe').value,
        type: cardType,
        series: seriesDropdown ? seriesDropdown.value : 'Base Set',
        genus: isAllowed('genus') ? (document.getElementById('card-genus').value || '') : '',
        family: isAllowed('family') ? (document.getElementById('card-family').value || '') : '',
        cost: isAllowed('cost') ? (parseInt(document.getElementById('card-cost').value) || 0) : 0,
        power: isAllowed('power') ? (parseInt(document.getElementById('card-power').value) || 0) : 0,
        health: finalHealth,
        maxHealth: finalHealth,
        strength: isAllowed('strength') && strVal !== '' ? parseInt(strVal) : null,
        description: document.getElementById('card-description').value || '',
        artUrl: document.getElementById('card-art').value || '',
        hideFromDeckBuilder: !!(hideDeckbuilderCheckbox && hideDeckbuilderCheckbox.checked),
        artX: valX,
        artY: valY,
        artScale: !isNaN(valScale) ? valScale : 100,
        nanoArtX: nanoX,
        nanoArtY: nanoY,
        nanoArtScale: !isNaN(nanoScale) ? nanoScale : 110,
        abilities: (CardState.currentAbilities || []).map(obj => {
            const ab = CardState.allAbilities.find(a => a.abilityId === obj.id);
            if (!ab) return null;
            
            let hasX = false;
            if (ab.effects) {
                hasX = ab.effects.some(g => g.payloads && g.payloads.some(p => p.amountIsX || p.grantedAbilityParamXIsX || (p.nestedGroup && p.nestedGroup.payloads && p.nestedGroup.payloads.some(np => np.amountIsX || np.grantedAbilityParamXIsX))));
            }
            
            let pX = obj.paramX;
            if (hasX && (pX === null || pX === undefined)) pX = 1;
            
            let hydrated = hydrateAbility({ abilityId: obj.id, paramX: pX }, CardState.allAbilities);
            if (!hydrated) return null;
            
            try {
                hydrated.displayDescription = generateAbilityDescription(hydrated, CardState.allAbilities, CardState.allCards, CardState.customTribes);
            } catch(e) {
                console.warn("Failed to generate description for hydrated ability", e);
            }
            
            return hydrated;
        }).filter(Boolean)
    };

    if (isAllowed('line')) {
        state.defaultLine = document.getElementById('card-default-line').value;
    }
    
    return state;
}

// Bind for HTML calls
window.populateGenuses = populateGenuses;
window.populateFamily = populateFamily;