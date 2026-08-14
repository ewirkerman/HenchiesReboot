// filepath: src/studio/card/form.js

import { CardState } from './state.js';
import { updatePreview } from './preview.js';
import { renderAssignedAbilities } from './abilities.js';

export function enforceAttackAbility() {
    const strVal = document.getElementById('card-strength').value;
    const cardType = document.getElementById('card-type').value;
    
    const defaultAtk = CardState.allAbilities.find(a => a.name.toLowerCase() === 'attack');
    if (!defaultAtk) return;
    
    const atkId = defaultAtk.abilityId;

    const hasAlternativeAttack = CardState.currentAbilities.some(abId => {
        if (abId === atkId) return false;
        const ab = CardState.allAbilities.find(a => a.abilityId === abId);
        return ab?.effects?.some(g => g.payloads?.some(p => p.type === 'ATTACK'));
    });

    let changed = false;

    if ((cardType === 'unit' || cardType === 'avatar') && strVal !== '') {
        if (hasAlternativeAttack) {
            const idx = CardState.currentAbilities.indexOf(atkId);
            if (idx > -1) {
                CardState.currentAbilities.splice(idx, 1);
                changed = true;
            }
        } else if (!CardState.currentAbilities.includes(atkId)) {
            CardState.currentAbilities.push(atkId);
            changed = true;
        }
    } else {
        const idx = CardState.currentAbilities.indexOf(atkId);
        if (idx > -1) {
            CardState.currentAbilities.splice(idx, 1);
            changed = true;
        }
    }

    if (changed) {
        renderAssignedAbilities();
    }
}

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

export function toggleStatFields() {
    const type = document.getElementById('card-type').value;
    const hpContainer = document.getElementById('stat-health-container');
    const strContainer = document.getElementById('stat-strength-container');
    const lineContainer = document.getElementById('default-line-container');
    const familyContainer = document.getElementById('family-container');
    
    if (type === 'unit' || type === 'avatar') {
        hpContainer.classList.remove('hidden');
        strContainer.classList.remove('hidden');
    } else {
        hpContainer.classList.add('hidden');
        strContainer.classList.add('hidden');
    }

    if (type === 'unit') {
        lineContainer.classList.remove('hidden');
        familyContainer.classList.remove('hidden');
    } else {
        lineContainer.classList.add('hidden');
        familyContainer.classList.add('hidden');
        document.getElementById('card-family').value = '';
    }

    if (type === 'equipment') {
        const attachAb = CardState.allAbilities.find(a => a.name.toLowerCase() === 'attach to a unit' || a.name.toLowerCase() === 'attach');
        if (attachAb && !CardState.currentAbilities.includes(attachAb.abilityId)) {
            CardState.currentAbilities.push(attachAb.abilityId);
            renderAssignedAbilities();
            updatePreview();
        }
    }
    enforceAttackAbility();
}

export function resetForm() {
    CardState.currentEditingId = null;
    window.location.hash = '';
    document.getElementById('form-title').innerText = '⚡ Design New Card';
    document.getElementById('card-name').value = '';
    if (CardState.customTribes.length > 0) document.getElementById('card-tribe').value = CardState.customTribes[0].id;
    document.getElementById('card-type').value = 'unit';
    document.getElementById('card-default-line').value = 'mid';
    populateGenuses(document.getElementById('card-tribe').value, '');
    document.getElementById('card-family').value = '';
    document.getElementById('card-cost').value = '1';
    document.getElementById('card-power').value = '0';
    document.getElementById('card-health').value = '1';
    document.getElementById('card-strength').value = '';
    document.getElementById('card-art').value = '';
    document.getElementById('card-art-x').value = '50';
    document.getElementById('card-art-y').value = '50';
    document.getElementById('card-description').value = '';
    
    CardState.currentAbilities = [];
    
    document.getElementById('studio-topbar').showButtons(false);
    
    toggleStatFields();
    renderAssignedAbilities();
    updatePreview();
}

export function buildCardState() {
    const strVal = document.getElementById('card-strength').value;
    const cardType = document.getElementById('card-type').value;
    
    const state = {
        id: CardState.currentEditingId || ('card_' + Date.now()),
        updatedAt: Date.now(),
        name: document.getElementById('card-name').value || 'Unnamed Card',
        tribe: document.getElementById('card-tribe').value,
        type: cardType,
        genus: document.getElementById('card-genus').value || '',
        family: cardType === 'unit' ? (document.getElementById('card-family').value || '') : '',
        cost: parseInt(document.getElementById('card-cost').value) || 0,
        power: parseInt(document.getElementById('card-power').value) || 0,
        health: parseInt(document.getElementById('card-health').value) || 1,
        maxHealth: parseInt(document.getElementById('card-health').value) || 1,
        strength: strVal === '' ? null : parseInt(strVal),
        description: document.getElementById('card-description').value || '',
        artUrl: document.getElementById('card-art').value || '',
        artX: parseInt(document.getElementById('card-art-x').value) || 50,
        artY: parseInt(document.getElementById('card-art-y').value) || 50,
        abilities: (CardState.currentAbilities || []).map(id => CardState.allAbilities.find(a => a.abilityId === id)).filter(Boolean)
    };
    
    // Guarantee the primary attack is strictly the first ability
    const attackIdx = state.abilities.findIndex(a => 
        a.name.toLowerCase() === 'attack' ||
        (a.effects && a.effects.some(g => g.payloads && g.payloads.some(p => p.type === 'ATTACK')))
    );
    if (attackIdx > 0) {
        const attackAb = state.abilities.splice(attackIdx, 1)[0];
        state.abilities.unshift(attackAb);
    }

    if (cardType === 'unit') {
        state.defaultLine = document.getElementById('card-default-line').value;
    }
    
    return state;
}

// Bind for HTML calls
window.populateGenuses = populateGenuses;