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

// Bind to window so the Web Component sliders can trigger updates natively
window.updatePreview = updatePreview;

export function updatePreview() {
    const card = buildCardState();
    const container = document.getElementById('card-preview-container');
    
    // Only inject HTML if we are in the standalone card studio. 
    // In the Unified Studio, CreatorController handles the HTML injection.
    if (container) {
        container.innerHTML = `<card-preview card-data="${encodeURIComponent(JSON.stringify(card)).replace(/'/g, "%27")}"></card-preview>`;
    } else if (window.CreatorController && window.CreatorController.updateRightPanePreview) {
        window.CreatorController.updateRightPanePreview(card, 'card');
    }
    
    renderJSONPreview('json-preview-container', card, 'copyCardJSON');
}

export function initImagePanning() {
    // Support both the standalone studio and the unified creator studio IDs
    const previewContainer = document.getElementById('card-preview-container') || document.getElementById('right-preview-container');
    if (!previewContainer) return;
    
    let isDraggingArt = false;
    let startMouseX, startMouseY, startArtX, startArtY;
    let activeXInput, activeYInput;

    previewContainer.addEventListener('mousedown', (e) => {
        const cardEl = e.target.closest('game-card');
        if (!cardEl || !document.getElementById('card-art').value) return;
        
        const size = cardEl.getAttribute('size');
        let prefix = 'card-art';
        if (size === 'micro') prefix = 'card-micro-art';
        if (size === 'nano') prefix = 'card-nano-art';
        
        activeXInput = document.getElementById(`${prefix}-x`);
        activeYInput = document.getElementById(`${prefix}-y`);
        
        if (!activeXInput || !activeYInput) return;

        isDraggingArt = true;
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        startArtX = parseInt(activeXInput.value);
        if (isNaN(startArtX)) startArtX = 0;
        startArtY = parseInt(activeYInput.value);
        if (isNaN(startArtY)) startArtY = 0;
        previewContainer.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDraggingArt || !activeXInput || !activeYInput) return;
        
        const deltaX = (e.clientX - startMouseX) * 0.5;
        const deltaY = (e.clientY - startMouseY) * 0.5;
        
        const newX = startArtX + deltaX;
        const newY = startArtY + deltaY;
        
        if (newX < Number(activeXInput.min)) activeXInput.min = Math.floor(newX - 100);
        if (newX > Number(activeXInput.max)) activeXInput.max = Math.ceil(newX + 100);
        if (newY < Number(activeYInput.min)) activeYInput.min = Math.floor(newY - 100);
        if (newY > Number(activeYInput.max)) activeYInput.max = Math.ceil(newY + 100);

        activeXInput.value = newX;
        activeYInput.value = newY;
        
        if (window.updatePreview) window.updatePreview();
        else updatePreview();
    });

    window.addEventListener('mouseup', () => { isDraggingArt = false; previewContainer.style.cursor = 'grab'; activeXInput = null; activeYInput = null; });
    window.addEventListener('mouseleave', () => { isDraggingArt = false; previewContainer.style.cursor = 'grab'; activeXInput = null; activeYInput = null; });

    previewContainer.addEventListener('wheel', (e) => {
        const cardEl = e.target.closest('game-card');
        if (!cardEl || !document.getElementById('card-art').value) return;
        
        e.preventDefault(); // Prevent page scroll when zooming image
        
        const size = cardEl.getAttribute('size');
        let prefix = 'card-art';
        if (size === 'micro') prefix = 'card-micro-art';
        if (size === 'nano') prefix = 'card-nano-art';
        
        const scaleInput = document.getElementById(`${prefix}-scale`);
        if (!scaleInput) return;

        let currentScale = parseInt(scaleInput.value) || 100;
        let zoomSpeed = 5;
        
        if (e.deltaY < 0) currentScale += zoomSpeed;
        else if (e.deltaY > 0) currentScale -= zoomSpeed;

        currentScale = Math.max(Number(scaleInput.min), Math.min(Number(scaleInput.max), currentScale));
        
        scaleInput.value = currentScale;
        
        if (window.updatePreview) window.updatePreview();
        else updatePreview();
    }, { passive: false });
}

// Bind to window
window.copyCardJSON = copyCardJSON;
window.inspectMiniPreview = inspectMiniPreview;