// filepath: src/studio/card/preview.js

import { CardState } from './state.js';
import { buildCardState } from './form.js';
import { renderAssignedAbilities } from './abilities.js';
import { openInspectionModal, renderJSONPreview, showToast } from '../../ui.js';

export function copyCardJSON() {
    const card = buildCardState();
    navigator.clipboard.writeText(JSON.stringify(card, null, 2)).then(() => {
        showToast('Card JSON Copied!', 'success');
    });
}

export function inspectMiniPreview() {
    const card = buildCardState();
    openInspectionModal(card, CardState.allAbilitiesRegistry);
}

export function updatePreview() {
    const card = buildCardState();
    const container = document.getElementById('card-preview-container');
    
    container.innerHTML = `<card-preview card-data="${encodeURIComponent(JSON.stringify(card)).replace(/'/g, "%27")}"></card-preview>`;
    
    renderJSONPreview('json-preview-container', card, 'copyCardJSON');
}

export function initImagePanning() {
    const previewContainer = document.getElementById('card-preview-container');
    let isDraggingArt = false;
    let startMouseX, startMouseY, startArtX, startArtY;

    previewContainer.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.group') || !document.getElementById('card-art').value) return;
        isDraggingArt = true;
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        startArtX = parseInt(document.getElementById('card-art-x').value) || 50;
        startArtY = parseInt(document.getElementById('card-art-y').value) || 50;
        previewContainer.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDraggingArt) return;
        const deltaX = (e.clientX - startMouseX) * -0.5;
        const deltaY = (e.clientY - startMouseY) * -0.5;
        
        document.getElementById('card-art-x').value = Math.max(0, Math.min(100, startArtX + deltaX));
        document.getElementById('card-art-y').value = Math.max(0, Math.min(100, startArtY + deltaY));
        updatePreview();
    });

    window.addEventListener('mouseup', () => { isDraggingArt = false; previewContainer.style.cursor = 'grab'; });
    window.addEventListener('mouseleave', () => { isDraggingArt = false; previewContainer.style.cursor = 'grab'; });
}

// Bind to window
window.copyCardJSON = copyCardJSON;
window.inspectMiniPreview = inspectMiniPreview;