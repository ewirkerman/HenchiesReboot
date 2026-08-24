import { ClientState } from './client_state.js';
import { renderCardHTML, showToast, openInspectionModal } from '../ui.js';

window.toggleActionLog = () => {
    const container = document.getElementById('action-log-drawer-container');
    const chevron = document.getElementById('action-log-chevron');
    const isOpen = !container.classList.contains('translate-y-[calc(100%-2rem)]');
    
    if (isOpen) {
        container.classList.add('translate-y-[calc(100%-2rem)]');
        chevron.style.transform = 'rotate(0deg)';
    } else {
        container.classList.remove('translate-y-[calc(100%-2rem)]');
        chevron.style.transform = 'rotate(180deg)';
        const logBox = document.getElementById('history-log-text');
        if (logBox) logBox.scrollTop = logBox.scrollHeight;
    }
};

window.openZoneModal = (playerId, zone) => {
    const player = ClientState.gameState.players[playerId];
    if (!player || !player[zone]) return;
    
    // Core Rule: You cannot view the opponent's deck
    if (zone === 'deck' && playerId !== ClientState.localPlayerRole) {
        showToast("You cannot view the opponent's deck.", "error");
        return;
    }
    
    let cards = [...player[zone]];
    
    // Core Rule: Deck contents are displayed in alphabetical order, not draw order
    if (zone === 'deck') {
        cards.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        // Discard/Banish show the most recently added cards first
        cards.reverse();
    }

    const container = document.getElementById('zone-modal-cards');
    const title = document.getElementById('zone-modal-title');
    const subtitle = document.getElementById('zone-modal-subtitle');
    
    title.innerText = `${player.name}'s ${zone.toUpperCase()}`;
    
    if (ClientState.pendingAbility && ClientState.validTargets.some(t => t.line === zone && t.playerId === playerId)) {
        subtitle.innerText = "Select a target for your pending ability.";
        subtitle.classList.add('text-amber-400', 'font-bold', 'animate-pulse');
    } else {
        subtitle.innerText = `${cards.length} cards in ${zone}.`;
        subtitle.classList.remove('text-amber-400', 'font-bold', 'animate-pulse');
    }
    
    const prefix = playerId === ClientState.localPlayerRole ? 'player' : 'opp';

    if (cards.length === 0) {
        container.innerHTML = `<div class="text-slate-500 italic mt-10">This ${zone} is empty.</div>`;
    } else {
        container.innerHTML = cards.map(c => {
            const json = encodeURIComponent(JSON.stringify(c)).replace(/'/g, "%27");
            const isTargetable = ClientState.pendingAbility && ClientState.validTargets.some(t => t.id === (c.instanceId || c.id));
            
            return renderCardHTML(c, {
                isHand: zone !== 'discard',
                isTargetable: isTargetable,
                onClick: `if(event) event.stopPropagation(); window.handleZoneCardClick('${prefix}', '${zone}', '${c.instanceId || c.id}')`,
                onInspect: `window.inspectCard('${json}', ${zone !== 'discard'})`,
                abilityUses: ClientState.gameState?.abilityUses || {}
            });
        }).join('');
    }
    
    document.getElementById('zone-viewer-modal').classList.remove('hidden');
    document.getElementById('zone-viewer-modal').classList.add('flex');
};

window.closeZoneModal = () => {
    document.getElementById('zone-viewer-modal').classList.add('hidden');
    document.getElementById('zone-viewer-modal').classList.remove('flex');
};

window.handleZoneCardClick = (prefix, zone, cardId) => {
    if (ClientState.pendingAbility) {
        if (ClientState.validTargets.some(t => t.id === cardId)) {
            window.closeZoneModal();
            window.handleEntityClick(prefix, zone, cardId);
        } else {
            showToast("This card is not a valid target.", "info");
        }
    }
};

window.openActionModal = (entityId, entityName, actions, isHand = false) => {
    const menu = document.querySelector('unit-action-modal');
    if (menu) menu.open(entityId, entityName, actions, isHand);
};

window.closeUnitActionModal = () => {
    const menu = document.querySelector('unit-action-modal');
    if (menu) menu.close();
};

window.inspectCard = (cardJson, isHand = false) => {
    openInspectionModal(JSON.parse(decodeURIComponent(cardJson)), ClientState.allAbilitiesRegistry, false, ClientState.gameState?.abilityUses || {}, isHand);
};