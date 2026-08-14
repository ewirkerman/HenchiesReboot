// filepath: src/studio/card/abilities.js

import { CardState } from './state.js';
import { updatePreview } from './preview.js';
import { buildCardState, enforceAttackAbility } from './form.js';
import { saveCardToCatalog } from '../../firebase.js';
import { showToast, getIconSvg } from '../../ui.js';

export function renderAssignedAbilities() {
    const container = document.getElementById('assigned-abilities');
    if (CardState.currentAbilities.length === 0) {
        container.innerHTML = `<span class="text-xs text-slate-500 italic">No abilities assigned.</span>`;
        renderReferencedAbilities();
        return;
    }

    container.innerHTML = CardState.currentAbilities.map((abId, index) => {
        const ab = CardState.allAbilities.find(a => a.abilityId === abId);
        if (!ab) return '';
        return `
            <div draggable="true" 
                 ondragstart="window.handleDragStart(event, ${index})"
                 ondragover="window.handleDragOver(event)"
                 ondrop="window.handleDrop(event, ${index})"
                 ondragend="window.handleDragEnd(event)"
                 class="flex justify-between items-center bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-900 p-2 rounded text-xs cursor-move transition-colors">
                <div class="pointer-events-none flex items-center gap-2">
                    <span class="text-indigo-500/50 text-[10px]">☰</span>
                    <span class="font-bold text-indigo-300">${ab.name}</span>
                    <span class="text-[9px] bg-indigo-900 text-indigo-200 px-1 py-0.5 rounded ml-1">${ab.trigger || 'MANUAL'}</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <button onclick="window.copyAbilityJSON('${ab.abilityId}')" title="Copy JSON" class="text-slate-500 hover:text-amber-400 transition p-1">📋</button>
                    <a href="abilities.html#${ab.abilityId}" onclick="event.stopPropagation()" title="Open Ability in Studio" class="text-indigo-400 hover:text-indigo-200 transition p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                    </a>
                    <button onclick="window.removeAbility(${index})" class="text-red-400 hover:text-red-300 font-black px-1.5">&times;</button>
                </div>
            </div>
        `;
    }).join('');
    
    renderReferencedAbilities();
}

export function renderReferencedAbilities() {
    const container = document.getElementById('referenced-abilities-container');
    const listContainer = document.getElementById('referenced-abilities-list');
    
    const dependentAbilityIds = new Set();
    const queue = [...CardState.currentAbilities];
    const processed = new Set();

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (processed.has(currentId)) continue;
        processed.add(currentId);
        
        const ab = CardState.allAbilitiesRegistry.find(a => a.abilityId === currentId);
        if (!ab) continue;

        const text = (ab.displayDescription || '') + ' ' + (ab.description || '');
        const mentionRegex = /@\[(.*?)\]/g;
        let match;
        while ((match = mentionRegex.exec(text)) !== null) {
            const matchedName = match[1];
            const found = CardState.allAbilitiesRegistry.find(a => a.name.toLowerCase() === matchedName.toLowerCase());
            if (found && !CardState.currentAbilities.includes(found.abilityId)) {
                dependentAbilityIds.add(found.abilityId);
                queue.push(found.abilityId);
            }
        }

        if (ab.effects) {
            ab.effects.forEach(g => {
                if (g.payloads) {
                    g.payloads.forEach(p => {
                        if (p.type === 'GRANT_ABILITY' || p.type === 'REMOVE_ABILITY') {
                            if (p.grantedAbilityId && !CardState.currentAbilities.includes(p.grantedAbilityId)) {
                                dependentAbilityIds.add(p.grantedAbilityId);
                                queue.push(p.grantedAbilityId);
                            }
                        }
                        if (p.nestedGroup && p.nestedGroup.payloads) {
                            p.nestedGroup.payloads.forEach(np => {
                                if (np.type === 'GRANT_ABILITY' || np.type === 'REMOVE_ABILITY') {
                                    if (np.grantedAbilityId && !CardState.currentAbilities.includes(np.grantedAbilityId)) {
                                        dependentAbilityIds.add(np.grantedAbilityId);
                                        queue.push(np.grantedAbilityId);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    }

    if (dependentAbilityIds.size === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    listContainer.innerHTML = Array.from(dependentAbilityIds).map(abId => {
        const ab = CardState.allAbilitiesRegistry.find(a => a.abilityId === abId);
        if (!ab) return '';
        return `
            <div class="flex justify-between items-center bg-slate-900/60 border border-slate-700/50 p-2 rounded text-xs transition-colors group">
                <div class="pointer-events-none flex items-center gap-2">
                    <span class="font-bold text-sky-300">${ab.name}</span>
                    <span class="text-[9px] bg-slate-950 text-slate-400 px-1 py-0.5 rounded ml-1">${ab.trigger || 'MANUAL'}</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <button onclick="window.copyAbilityJSON('${ab.abilityId}')" title="Copy JSON" class="text-slate-500 hover:text-amber-400 transition p-1">📋</button>
                    <a href="abilities.html#${ab.abilityId}" onclick="event.stopPropagation()" title="Open Ability in Studio" class="text-slate-500 hover:text-sky-300 transition p-1 group-hover:text-sky-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

export function removeAbility(index) {
    CardState.currentAbilities.splice(index, 1);
    enforceAttackAbility();
    renderAssignedAbilities();
    updatePreview();
}

export function copyAbilityJSON(abilityId) {
    const ab = CardState.allAbilitiesRegistry.find(a => a.abilityId === abilityId);
    if (ab) {
        navigator.clipboard.writeText(JSON.stringify(ab, null, 2)).then(() => {
            showToast('Ability JSON Copied!', 'success');
        });
    }
}

export function handleDragStart(e, index) {
    CardState.draggedAbilityIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('opacity-50'), 0);
}

export function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

export function handleDrop(e, targetIndex) {
    e.preventDefault();
    if (CardState.draggedAbilityIndex === null || CardState.draggedAbilityIndex === targetIndex) return;
    const draggedItem = CardState.currentAbilities.splice(CardState.draggedAbilityIndex, 1)[0];
    CardState.currentAbilities.splice(targetIndex, 0, draggedItem);
    enforceAttackAbility();
    renderAssignedAbilities();
    updatePreview();
}

export function handleDragEnd(e) {
    CardState.draggedAbilityIndex = null;
    e.target.classList.remove('opacity-50');
    renderAssignedAbilities();
}

export async function createNewAbilityForCard() {
    const card = buildCardState();
    if (!card.name || card.name.trim() === 'Unnamed Card') {
        showToast('Please name the card before creating an ability.', 'error');
        return;
    }
    
    const btn = document.getElementById('create-new-ability-btn');
    btn.innerHTML = 'Saving...';
    btn.disabled = true;

    await saveCardToCatalog(card);
    window.location.href = `abilities.html?returnToCard=${card.id}`;
}

// Bind to window
window.removeAbility = removeAbility;
window.copyAbilityJSON = copyAbilityJSON;
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.handleDragEnd = handleDragEnd;
window.createNewAbilityForCard = createNewAbilityForCard;