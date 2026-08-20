import { CardState } from './state.js';
import { buildCardState, resetForm, toggleStatFields, populateGenuses } from './form.js';
import { updatePreview } from './preview.js';
import { renderAssignedAbilities } from './abilities.js';
import { saveCardToCatalog, deleteCardFromCatalog } from '../../firebase.js';
import { showToast } from '../../ui.js';
import { launchSandboxMatch } from '../../testing.js';

export async function saveCard() {
    const card = buildCardState();
    if (!card.name || card.name.trim() === 'Unnamed Card') {
        showToast('Please provide a name for the card.', 'error');
        return;
    }
    if (card.type === 'unit' && !card.family) {
        showToast('Units must have a Family assigned.', 'error');
        return;
    }

    const btn = document.getElementById('save-card-btn');
    const origText = btn.innerHTML;
    btn.innerHTML = 'Saving...';
    btn.disabled = true;
    
    const topbar = document.getElementById('studio-topbar');
    if (topbar && topbar.setLoading) topbar.setLoading('save', true);

    const cloudSaveSuccess = await saveCardToCatalog(card);
    
    CardState.allCards = [...CardState.allCards.filter(c => c.id !== card.id), card];
    CardState.currentEditingId = card.id;
    
    document.getElementById('form-title').innerText = `⚡ Edit: ${card.name}`;
    document.getElementById('studio-topbar').showButtons(true);

    btn.innerHTML = origText;
    btn.disabled = false;
    
    if (topbar && topbar.setLoading) topbar.setLoading('save', false);

    if (cloudSaveSuccess) {
        showToast(`Card '${card.name}' saved successfully!`, 'success');
    } else {
        showToast(`⚠️ Cloud save failed! Card '${card.name}' saved locally.`, 'error');
    }
    renderCatalog();
}

export function cloneCard() {
    if (!CardState.currentEditingId) return;
    CardState.currentEditingId = null;
    document.getElementById('form-title').innerText = `⚡ Design New Card (Cloned)`;
    document.getElementById('card-name').value += ' (Copy)';
    document.getElementById('studio-topbar').showButtons(false);
    updatePreview();
    showToast('Card cloned! Save to keep it.', 'info');
}

export async function deleteCard() {
    if (!CardState.currentEditingId) return;
    await deleteCardFromCatalog(CardState.currentEditingId);
    CardState.allCards = CardState.allCards.filter(c => c.id !== CardState.currentEditingId);
    showToast('Card deleted.', 'success');
    resetForm();
    renderCatalog();
}

export async function launchTestMatch() {
    const card = buildCardState();
    const topbar = document.getElementById('studio-topbar');
    if (topbar && topbar.setLoading) topbar.setLoading('test', true);

    await launchSandboxMatch(card, 'card');
    
    if (topbar && topbar.setLoading) topbar.setLoading('test', false);
}

export function renderCatalog() {
    const catalogEl = document.getElementById('card-catalog');
    if (!catalogEl) return;
    
    catalogEl.setItems(CardState.allCards, (c) => {
        const matchedTribe = CardState.customTribes.find(t => t.id === c.tribe || t.name === c.tribe);
        const tribeName = matchedTribe ? matchedTribe.name : c.tribe;
        return `
        <div onclick="window.loadCard('${c.id}')" class="p-2 bg-slate-900 border border-slate-800 hover:border-amber-500 rounded-xl text-xs flex justify-between items-center cursor-pointer transition">
            <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded bg-amber-500 text-black font-extrabold flex items-center justify-center text-[10px]">${c.cost || 0}</span>
                <div class="flex flex-col">
                    <span class="font-bold text-amber-300">${c.name}</span>
                    <span class="text-[9px] text-slate-400 capitalize">${tribeName} • ${c.type}</span>
                </div>
            </div>
            ${c.abilities && c.abilities.length > 0 ? `<span class="text-[9px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-900">${c.abilities.length} Abil</span>` : ''}
        </div>
        `;
    });
}

export function loadCard(id) {
    const card = CardState.allCards.find(c => c.id === id);
    if (!card) return;

    CardState.currentEditingId = card.id;
    window.location.hash = id;
    document.getElementById('form-title').innerText = `⚡ Edit: ${card.name}`;
    document.getElementById('card-name').value = card.name;
    
    let mappedTribe = card.tribe || 'Generic';
    if (!mappedTribe.startsWith('tribe_')) {
        const match = CardState.customTribes.find(t => t.name.toLowerCase() === mappedTribe.toLowerCase());
        if (match) mappedTribe = match.id;
    }
    document.getElementById('card-tribe').value = mappedTribe;
    populateGenuses(mappedTribe, card.genus || '');

    document.getElementById('card-type').value = card.type || 'unit';
    document.getElementById('card-default-line').value = card.defaultLine || 'mid';
    document.getElementById('card-genus').value = card.genus || '';
    document.getElementById('card-family').value = card.family || '';
    document.getElementById('card-cost').value = card.cost || 0;
    document.getElementById('card-power').value = card.power || 0;
    document.getElementById('card-health').value = card.maxHealth || card.health || 1;
    document.getElementById('card-strength').value = (card.strength !== undefined && card.strength !== null) ? card.strength : '';
    document.getElementById('card-art').value = card.artUrl || '';
    
    document.getElementById('card-art-x').value = card.artX ?? 0;
    document.getElementById('card-art-y').value = card.artY ?? 0;
    const sScale = document.getElementById('card-art-scale');
    if (sScale) sScale.value = card.artScale ?? 100;
    
    const mX = document.getElementById('card-micro-art-x');
    if (mX) mX.value = card.microArtX ?? card.artX ?? 0;
    const mY = document.getElementById('card-micro-art-y');
    if (mY) mY.value = card.microArtY ?? card.artY ?? 0;
    const mScale = document.getElementById('card-micro-art-scale');
    if (mScale) mScale.value = card.microArtScale ?? card.artScale ?? 125;
    
    const nX = document.getElementById('card-nano-art-x');
    if (nX) nX.value = card.nanoArtX ?? card.artX ?? 0;
    const nY = document.getElementById('card-nano-art-y');
    if (nY) nY.value = card.nanoArtY ?? card.artY ?? 0;
    const nScale = document.getElementById('card-nano-art-scale');
    if (nScale) nScale.value = card.nanoArtScale ?? card.artScale ?? 110;
    
    document.getElementById('card-description').value = card.description || '';
    
    CardState.currentAbilities = (card.abilities || []).map(a => {
        if (typeof a === 'string') return { id: a, paramX: null };
        return { id: a.abilityId || a.id, paramX: a.paramX !== undefined ? a.paramX : null };
    });
    
    document.getElementById('studio-topbar').showButtons(true);
    
    toggleStatFields();
    renderAssignedAbilities();
    updatePreview();
}

// Bind to window
window.loadCard = loadCard;
window.launchTestMatch = launchTestMatch;