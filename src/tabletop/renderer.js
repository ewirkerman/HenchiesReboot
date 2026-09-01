import { ClientState } from './client_state.js';
import { renderHistorySlider, renderCardHTML, getLineIconSvg } from '../ui.js';
import { cloneGameState, LINES, getEntityAvailableActions } from '../engine/index.js';
import { triggerAILoop, buildCardActions } from './interactions.js';

let _lastInnerWidth = window.innerWidth;
window.addEventListener('resize', () => {
    if (Math.abs(_lastInnerWidth - window.innerWidth) > 50) {
        _lastInnerWidth = window.innerWidth;
        if (ClientState.gameState) window.updateUI();
    }
});

window.scrubReplay = (step) => {
    ClientState.replayStepIndex = parseInt(step);
    if (ClientState.localReplayStates[ClientState.replayStepIndex]) {
        ClientState.gameState = cloneGameState(ClientState.localReplayStates[ClientState.replayStepIndex]);
        Object.defineProperty(ClientState.gameState, 'abilityCatalog', { value: ClientState.allAbilitiesRegistry, enumerable: false, configurable: true });
        Object.defineProperty(ClientState.gameState, 'catalog', { value: ClientState.allCardsRegistry, enumerable: false, configurable: true });
        Object.defineProperty(ClientState.gameState, 'tribeCatalog', { value: ClientState.customTribesList, enumerable: false, configurable: true });
        updateUI();
    }
};

function formatResourceString(resources) {
    if (!resources) return 'No Resources';
    let resStr = '';
    for (const [resKey, res] of Object.entries(resources)) {
        if (res.max <= 0 && res.current <= 0) continue;
        let name = resKey;
        if (resKey !== 'Carnie' && resKey !== 'Generic') {
            const t = ClientState.customTribesList.find(t => t.id === resKey);
            if (t) name = t.name;
            else if (resKey.startsWith('tribe_')) name = resKey.substring(6).charAt(0).toUpperCase() + resKey.substring(7);
        }
        resStr += `${name}: ${res.current}/${res.max} | `;
    }
    return resStr.replace(/ \| $/, '') || 'No Resources';
}

function toggleDragTetherVisibility() {
    if (!ClientState.pendingAbility && !window._isDragging) {
        const overlay = document.getElementById('drag-tether-overlay');
        if (overlay) overlay.classList.add('hidden');
    }
}

function updateHeaderIndicators(state) {
    document.getElementById('turn-badge').innerText = `Turn ${state.turnNumber}: ${state.players[state.activePlayerId].name}`;
    document.getElementById('phase-badge').innerText = state.turnPhase.replace('_', ' ');
}

function updateTurnLockNotice(state, isLocked, localPlayerRole) {
    const noticeEl = document.getElementById('active-lock-notice');
    if (state.status === 'finished') {
        noticeEl.innerText = state.winner === localPlayerRole ? "🏆 Victory!" : "💀 Defeat!";
        noticeEl.className = "text-[10px] font-bold text-emerald-400";
        noticeEl.classList.remove('hidden');
        document.getElementById('forfeit-match-btn')?.classList.add('hidden');
    } else {
        const activeP = state.players[state.activePlayerId];
        const isAITurn = activeP?.isAI || activeP?.isPassOnlyAI;
        noticeEl.innerText = isAITurn ? "🤖 AI is thinking..." : "🔒 Opponent's Turn - Locked";
        noticeEl.className = "text-[10px] font-bold text-yellow-400 hidden";
        noticeEl.classList.toggle('hidden', !isLocked);
        document.getElementById('forfeit-match-btn')?.classList.remove('hidden');
    }
}

function updateActionButtons(state, isLocked) {
    document.querySelectorAll('#phase3-action-controls button').forEach(btn => btn.disabled = isLocked);
    document.getElementById('cancel-action-btn').classList.toggle('hidden', !ClientState.pendingAbility);
    
    const undoBtn = document.getElementById('undo-action-btn');
    if (undoBtn) {
        const isUndoEnabled = state.rules?.allowUndo;
        undoBtn.classList.toggle('hidden', !isUndoEnabled);
        const canUndo = isUndoEnabled && !isLocked && (state.lastRealActionIndex || 0) > ClientState.lastSafeUndoIndex;
        undoBtn.disabled = !canUndo;
        undoBtn.classList.toggle('opacity-50', !canUndo);
        undoBtn.classList.toggle('cursor-not-allowed', !canUndo);
        undoBtn.classList.toggle('grayscale', !canUndo);
    }

    const restartBtn = document.getElementById('restart-match-btn');
    if (restartBtn) restartBtn.classList.toggle('hidden', !(ClientState.roomCode && ClientState.roomCode.startsWith('TEST_')));
}

function updatePhaseInstructions() {
    const el = document.getElementById('action-phase-instruction');
    if (ClientState.pendingAbility) {
        el.innerText = "Select a target on the board...";
        el.classList.add('text-amber-400', 'animate-pulse');
    } else {
        el.innerText = "Phase 2: Play cards, attack targets, or equip items from Equator.";
        el.classList.remove('text-amber-400', 'animate-pulse');
    }
}

function updateLocalPlayerDashboard(myP, localPlayerRole) {
    document.getElementById('player-name').innerText = `${myP.name} (${localPlayerRole.toUpperCase()})`;
    document.getElementById('player-resources').innerText = formatResourceString(myP.resources);
}

function updateOpponentDashboard(oppP, oppRole) {
    let oppAvatar = null;
    for (const line in oppP.lines) {
        oppAvatar = oppP.lines[line]?.find(u => u.type === 'avatar');
        if (oppAvatar) break;
    }

    document.getElementById('opp-name').innerText = `${oppP.name} (${oppRole.toUpperCase()})`;
    document.getElementById('opp-power').innerText = oppAvatar?.power || 0;
    document.getElementById('opp-hand-count').innerText = oppP.hand.length;
    document.getElementById('opp-resources').innerText = formatResourceString(oppP.resources);
}

function updateHarvestPhaseUI(state, myP) {
    const isHarvestPhase = state.turnPhase === 'SACRIFICE_DECISION' && ClientState.isMyTurn();
    const harvestModal = document.getElementById('harvest-modal');
    if (harvestModal) {
        harvestModal.setAttribute('is-active', isHarvestPhase);
        harvestModal.setAttribute('selected-card', !!ClientState.selectedCardId);
        if (isHarvestPhase && myP.tribe) {
            const t = ClientState.customTribesList.find(t => t.id === myP.tribe);
            harvestModal.setAttribute('tribe-name', t ? t.name : myP.tribe);
        } else {
             harvestModal.removeAttribute('tribe-name');
        }
    }
    
    const handContainer = document.getElementById('player-hand-container');
    if (handContainer) {
        handContainer.classList.toggle('ring-2', isHarvestPhase);
        handContainer.classList.toggle('ring-amber-500', isHarvestPhase);
        handContainer.classList.toggle('shadow-[0_0_30px_rgba(245,158,11,0.3)]', isHarvestPhase);
        handContainer.classList.toggle('bg-amber-950/20', isHarvestPhase);
    }
    
    const confirmBtn = document.getElementById('overlay-sacrifice-confirm-btn');
    if (confirmBtn) {
        confirmBtn.disabled = !ClientState.selectedCardId;
        confirmBtn.classList.toggle('opacity-50', !ClientState.selectedCardId);
        confirmBtn.classList.toggle('cursor-not-allowed', !ClientState.selectedCardId);
    }
}

function updateHistoryLogs(state) {
    const logBox = document.getElementById('history-log-text');
    if (logBox) {
      logBox.innerHTML = state.history_log.map(msg => {
        const text = typeof msg === 'string' ? msg : msg.text;
        const depth = typeof msg === 'object' && msg.depth ? msg.depth : 0;
        let indentClass = '';
        let textClass = 'text-slate-300';
        let iconHtml = '';
        if (depth === 1) { indentClass = 'ml-4 pl-2 border-l border-slate-600'; textClass = 'text-slate-400'; iconHtml = '<span class="text-slate-500 mr-1 text-[10px]">↳</span>'; }
        else if (depth === 2) { indentClass = 'ml-8 pl-2 border-l border-slate-700/50'; textClass = 'text-slate-500'; iconHtml = '<span class="text-slate-600 mr-1 text-[10px]">↳</span>'; }
        else if (depth === 3) { indentClass = 'ml-12 pl-2 border-l border-slate-700/30'; textClass = 'text-slate-500'; iconHtml = '<span class="text-slate-700 mr-1 text-[10px]">↳</span>'; }
        else if (depth === 4) { indentClass = 'ml-16 pl-2 border-l border-slate-800/80'; textClass = 'text-slate-600'; iconHtml = '<span class="text-slate-700 mr-1 text-[10px]">↳</span>'; }
        else if (depth >= 5) { indentClass = 'ml-20 pl-2 border-l border-slate-800/50'; textClass = 'text-slate-600'; iconHtml = '<span class="text-slate-700 mr-1 text-[10px]">↳</span>'; }
        return `<div class="py-0.5 border-b border-slate-900/50 ${indentClass} ${textClass}">${iconHtml}${text}</div>`;
      }).join('');
      logBox.scrollTop = logBox.scrollHeight;
    }

    const tickerBox = document.getElementById('action-log-ticker-text');
    if (tickerBox && state.history_log.length > 0) {
      const lastMsg = state.history_log[state.history_log.length - 1];
      tickerBox.innerHTML = typeof lastMsg === 'string' ? lastMsg : lastMsg.text;
    }
}

export function updateUI() {
    if (!ClientState.gameState) return;

    const state = ClientState.gameState;
    const localPlayerRole = ClientState.localPlayerRole;
    const oppRole = localPlayerRole === 'player1' ? 'player2' : 'player1';
    const myP = state.players[localPlayerRole];
    const oppP = state.players[oppRole];
    const isLocked = !ClientState.isMyTurn();

    toggleDragTetherVisibility();
    renderHistorySlider(document.getElementById('replay-bar-container'), state.history_log, ClientState.replayStepIndex, 'window.scrubReplay');
    updateHeaderIndicators(state);
    updateTurnLockNotice(state, isLocked, localPlayerRole);
    updateActionButtons(state, isLocked);
    updatePhaseInstructions();
    updateLocalPlayerDashboard(myP, localPlayerRole);
    updateOpponentDashboard(oppP, oppRole);
    updateHarvestPhaseUI(state, myP);

    document.getElementById('phase3-action-controls').classList.toggle('hidden', state.turnPhase !== 'ACTION_PHASE');

    renderEquator(state.equator);
    renderPlayerBattlelines(myP, 'player');
    renderPlayerBattlelines(oppP, 'opp');
    renderDeckAndDiscard(myP, 'player');
    renderDeckAndDiscard(oppP, 'opp');
    renderHand(myP.hand);
    updateHistoryLogs(state);

    const activeP = state.players[state.activePlayerId];
    if ((activeP?.isAI || activeP?.isPassOnlyAI) && ClientState.localPlayerRole === 'player1') setTimeout(triggerAILoop, 50);
}
window.updateUI = updateUI;

function renderAttachmentsRecursive(attachments, prefix, line, isLocalPlayer, depth = 1) {
    if (!attachments || attachments.length === 0) return '';
    const isMobile = window.innerWidth < 768; 
    
    return attachments.map((att, i) => {
        const attJson = encodeURIComponent(JSON.stringify(att)).replace(/'/g, "%27");
        const attIsCasting = (ClientState.pendingAbility && ClientState.pendingAbility.entityId === att.instanceId) || ClientState.activeMenuEntityId === att.instanceId || (window._isDragging && window._dragCardId === att.instanceId);
        const attIsTargetable = (ClientState.pendingAbility && ClientState.validTargets.some(t => t.id === att.instanceId)) || (window._isDragging && window._dragTargets && window._dragTargets.includes(att.instanceId));

        let attActionState = 'none';
        if (ClientState.gameState.turnPhase === 'ACTION_PHASE' && ClientState.isMyTurn() && !ClientState.pendingAbility && !window._isDragging) {
            const acts = getEntityAvailableActions(ClientState.gameState, ClientState.localPlayerRole, att.instanceId);
            if (acts.length === 1) attActionState = 'single';
            else if (acts.length > 1) attActionState = 'multiple';
        }

        const attCardHtml = renderCardHTML(att, {
            readiness: att.readiness,
            isCasting: attIsCasting,
            isTargetable: attIsTargetable,
            actionState: attActionState,
            isNano: !isMobile,
            isMicro: isMobile,
            onClick: `if(event) event.stopPropagation(); window.handleEntityClick('${prefix}', '${line}', '${att.instanceId}')`,
            onInspect: `window.inspectCard('${attJson}')`,
            abilityUses: ClientState.gameState?.abilityUses || {}
        });

        const nestedHtml = renderAttachmentsRecursive(att.attachments, prefix, line, isLocalPlayer, depth + 1);
        const yTranslate = depth * -6;
        const zIndex = 20 - i + (depth * 2);
        const overlapClass = isMobile ? '-ml-12 sm:-ml-14' : '-ml-14 sm:-ml-16'; 

        return `
            <div class="flex flex-row items-start relative drop-shadow-md shrink-0 ${overlapClass}" style="z-index: ${zIndex}; transform: translateY(${yTranslate}px);">
                <div class="relative z-[30] [&>div]:hover:-translate-y-8 cursor-pointer">
                    <div class="transition-transform duration-200">${attCardHtml}</div>
                </div>
                ${nestedHtml}
            </div>
        `;
    }).join('');
}

function renderEquator(equatorItems) {
    const container = document.getElementById('equator-cards-container');
    if (!equatorItems || equatorItems.length === 0) {
      container.innerHTML = '<span class="text-xs text-slate-500 italic" id="equator-empty-msg">No unattached items in equator.</span>';
      return;
    }

    const isMobile = window.innerWidth < 768; 
    container.innerHTML = equatorItems.map((item) => {
      const json = encodeURIComponent(JSON.stringify(item)).replace(/'/g, "%27");
      const isCasting = (ClientState.pendingAbility && ClientState.pendingAbility.entityId === item.instanceId) || ClientState.activeMenuEntityId === item.instanceId || (window._isDragging && window._dragCardId === item.instanceId);
      const isTargetable = (ClientState.pendingAbility && ClientState.validTargets.some(t => t.id === item.instanceId)) || (window._isDragging && window._dragTargets && window._dragTargets.includes(item.instanceId));

      let actionState = 'none';
      if (ClientState.gameState.turnPhase === 'ACTION_PHASE' && ClientState.isMyTurn() && !ClientState.pendingAbility && !window._isDragging) {
          const acts = getEntityAvailableActions(ClientState.gameState, ClientState.localPlayerRole, item.instanceId);
          if (acts.length === 1) actionState = 'single';
          else if (acts.length > 1) actionState = 'multiple';
      }

      const hostHtml = renderCardHTML(item, {
        readiness: item.readiness,
        isCasting: isCasting,
        isTargetable: isTargetable,
        actionState: actionState,
        isNano: !isMobile,
        isMicro: isMobile,
        onClick: `window.handleEntityClick('equator', 'equator', '${item.instanceId}')`,
        onInspect: `window.inspectCard('${json}')`,
        abilityUses: ClientState.gameState?.abilityUses || {}
      });

      let attachmentsHtml = renderAttachmentsRecursive(item.attachments, 'equator', 'equator', false);

      return `
        <div class="flex flex-row items-start relative group drop-shadow-md shrink-0">
            <div class="relative z-[30]">${hostHtml}</div>
            ${attachmentsHtml}
        </div>
      `;
    }).join('');
}

function renderDeckAndDiscard(player, prefix) {
    const deckEl = document.getElementById(`${prefix}-deck-container`);
    const discardEl = document.getElementById(`${prefix}-discard-container`);
    
    if (document.getElementById(`${prefix}-deck-count-badge`)) document.getElementById(`${prefix}-deck-count-badge`).innerText = player.deck.length;
    if (document.getElementById(`${prefix}-discard-count-badge`)) document.getElementById(`${prefix}-discard-count-badge`).innerText = player.discard ? player.discard.length : 0;

    if (deckEl) {
      deckEl.innerHTML = `
        <div onclick="if(event) event.stopPropagation(); window.openZoneModal('${player.id}', 'deck')" class="group relative flex-shrink-0 w-[128px] h-[179px] sm:w-[144px] sm:h-[201px] rounded-md bg-slate-800 border-2 border-slate-950 shadow-xl flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer hover:border-amber-500 transition-colors">
          <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle at 2px 2px, white 1px, transparent 0); background-size: 8px 8px;"></div>
          <span class="text-4xl sm:text-5xl relative z-10 drop-shadow-lg">🎴</span>
          <span class="text-[10px] sm:text-[12px] font-black text-amber-400 mt-3 uppercase tracking-widest bg-slate-950/90 px-2 py-1 rounded border border-amber-900/50 relative z-10 shadow">Deck: ${player.deck.length}</span>
        </div>
      `;
    }

    if (discardEl) {
      if (!player.discard || player.discard.length === 0) {
        discardEl.innerHTML = `
          <div onclick="if(event) event.stopPropagation(); window.openZoneModal('${player.id}', 'discard')" class="cursor-pointer group relative flex-shrink-0 w-[128px] h-[179px] sm:w-[144px] sm:h-[201px] rounded-md bg-slate-900/40 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center select-none text-slate-500 shadow-inner hover:border-amber-500 transition-colors">
            <span class="text-3xl sm:text-4xl opacity-50 mb-2">🗑️</span>
            <span class="text-[10px] sm:text-[12px] font-black uppercase tracking-widest">Discard</span>
          </div>
        `;
      } else {
        const topCard = player.discard[player.discard.length - 1];
        const json = encodeURIComponent(JSON.stringify(topCard)).replace(/'/g, "%27");
        const hasDiscardTarget = (ClientState.pendingAbility && ClientState.validTargets.some(t => t.line === 'discard' && t.playerId === player.id)) || (window._isDragging && window._dragTargets && window._dragTargets.some(tid => player.discard.some(c => c.instanceId === tid || c.id === tid)));
        const targetHighlight = hasDiscardTarget ? 'ring-2 ring-cyan-400 animate-pulse z-20 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.6)]' : '';

        const cardHtml = renderCardHTML(topCard, {
          onClick: `if(event) event.stopPropagation(); window.openZoneModal('${player.id}', 'discard')`,
          onInspect: `window.inspectCard('${json}', false)`,
          abilityUses: ClientState.gameState?.abilityUses || {}
        });
        
        discardEl.innerHTML = `
          <div class="relative flex-shrink-0 w-[128px] h-[179px] sm:w-[144px] sm:h-[201px] ${targetHighlight}">
            ${cardHtml}
            <div class="absolute -top-2 -right-2 bg-slate-950 text-white font-black text-[12px] w-6 h-6 sm:w-7 sm:h-7 rounded-full shadow-xl border border-slate-600 z-30 flex items-center justify-center pointer-events-none">${player.discard.length}</div>
          </div>
        `;
      }
    }
}

function renderPlayerBattlelines(player, prefix) {
    const checkOccupied = (line) => player.lines[line] && player.lines[line].length > 0;
    const toggleLine = (line, show) => { const el = document.getElementById(`${prefix}-line-${line}`); if (el) el.classList.toggle('hidden', !show); };

    toggleLine('taunt', checkOccupied('taunt'));
    toggleLine('avatar', true); 
    toggleLine('bodyguard', checkOccupied('bodyguard'));
    
    const isSidelineOccupied = checkOccupied('sideline');
    toggleLine('sideline', isSidelineOccupied);
    
    const sidelineCol = document.getElementById(`${prefix}-col-sideline`);
    if (sidelineCol) {
        sidelineCol.classList.toggle('flex', isSidelineOccupied);
        sidelineCol.classList.toggle('hidden', !isSidelineOccupied);
    }

    const centerLines = ['front', 'mid', 'back', 'sheltered'];
    let centerOccupiedCount = 0;
    for (const l of centerLines) {
      if (checkOccupied(l)) { centerOccupiedCount++; toggleLine(l, true); } else { toggleLine(l, false); }
    }
    if (centerOccupiedCount === 0) { toggleLine('front', true); centerOccupiedCount = 1; }

    const isMobile = window.innerWidth < 768; 

    for (const line of LINES) {
      const lineEl = document.getElementById(`${prefix}-line-${line}`);
      if (!lineEl) continue;

      lineEl.classList.add('relative'); 
      lineEl.classList.remove('justify-center', 'content-center', 'items-center');
      lineEl.classList.add('justify-evenly', 'content-start', 'items-start', 'flex-wrap', 'gap-2');

      const bgIcon = `<div class="absolute top-1 left-2 w-8 h-8 sm:w-12 sm:h-12 text-slate-500/50 pointer-events-none z-0 drop-shadow-md">${getLineIconSvg(line)}</div>`;
      const units = player.lines[line] || [];
      const isLocalPlayer = prefix === 'player';

      const cardsHtml = units.map(u => {
        const json = encodeURIComponent(JSON.stringify(u)).replace(/'/g, "%27");
        const isCasting = (ClientState.pendingAbility && ClientState.pendingAbility.entityId === u.instanceId) || ClientState.activeMenuEntityId === u.instanceId || (window._isDragging && window._dragCardId === u.instanceId);
        const isTargetable = (ClientState.pendingAbility && ClientState.validTargets.some(t => t.id === u.instanceId)) || (window._isDragging && window._dragTargets && window._dragTargets.includes(u.instanceId));

        let actionState = 'none';
        if (isLocalPlayer && ClientState.gameState.turnPhase === 'ACTION_PHASE' && ClientState.isMyTurn() && !ClientState.pendingAbility && !window._isDragging) {
            const acts = getEntityAvailableActions(ClientState.gameState, ClientState.localPlayerRole, u.instanceId);
            if (acts.length === 1) actionState = 'single';
            else if (acts.length > 1) actionState = 'multiple';
        }

        const hostHtml = renderCardHTML(u, {
          readiness: u.readiness,
          isCasting, isTargetable, actionState,
          isNano: !isMobile, isMicro: isMobile,
          onClick: `window.handleEntityClick('${prefix}', '${line}', '${u.instanceId}')`,
          onInspect: `window.inspectCard('${json}')`,
          abilityUses: ClientState.gameState?.abilityUses || {}
        });

        let attachmentsHtml = renderAttachmentsRecursive(u.attachments, prefix, line, isLocalPlayer);

        return `<div class="flex flex-row items-start relative group drop-shadow-md shrink-0"><div class="relative z-[30]">${hostHtml}</div>${attachmentsHtml}</div>`;
      }).join('');
      
      lineEl.innerHTML = bgIcon + cardsHtml;
    }
}

function renderHand(handCards) {
    const container = document.getElementById('player-hand-container');
    const isTargetingMode = !!ClientState.pendingAbility || window._isDragging;
    const total = handCards.length;

    if (total === 0) {
      container.className = 'pointer-events-none flex flex-row justify-center items-start w-full h-[30px]';
      container.innerHTML = ``;
      return;
    }

    container.className = 'pointer-events-none touch-none flex flex-row justify-center items-end transition-all duration-300 w-full overflow-visible relative h-[1px] mb-2';

    const isMobile = window.innerWidth < 768;
    const cardWidth = isMobile ? 128 : 144; 
    const containerWidth = window.innerWidth - 16; 
    let overlap = isMobile ? 25 : 35; 

    if (total > 1) {
        const rawWidth = total * cardWidth;
        if (rawWidth > containerWidth) {
            overlap = (rawWidth - containerWidth) / (total - 1);
            if (overlap > cardWidth - 28) overlap = cardWidth - 28; 
        }
    }

    container.innerHTML = handCards.map((c, idx) => {
      const json = encodeURIComponent(JSON.stringify(c)).replace(/'/g, "%27");
      const cardRefId = c.instanceId || c.id;
      const isSelected = ClientState.selectedCardId === cardRefId;
      const isCasting = (ClientState.pendingAbility && ClientState.pendingAbility.entityId === cardRefId) || ClientState.activeMenuEntityId === cardRefId || (window._isDragging && window._dragCardId === cardRefId);
      const isTargetable = (ClientState.pendingAbility && ClientState.validTargets.some(t => t.id === cardRefId)) || (window._isDragging && window._dragTargets && window._dragTargets.includes(cardRefId));
      const isForceHover = window._forceHoverCardId === cardRefId;

      let actionState = 'none';
      let playable = false;

      // PERFECTED ENGINE INTEGRATION: Exactly 1 call per card!
      if (ClientState.isMyTurn() && ClientState.gameState.turnPhase === 'ACTION_PHASE' && !ClientState.pendingAbility && !window._isDragging) {
          const actions = buildCardActions(cardRefId, c);
          playable = actions.length > 0;
          if (actions.length === 1) actionState = 'single';
          else if (actions.length > 1) actionState = 'multiple';
      }

      const cardHtml = renderCardHTML(c, {
        isHand: true, isSelected, isCasting, isTargetable, isTargetingMode, isForceHover, actionState, isPlayable: playable,
        onMouseLeave: isForceHover ? `window._forceHoverCardId = null; window.updateUI();` : null,
        onClick: `window.handleHandCardClick('${cardRefId}')`,
        onInspect: `window.inspectCard('${json}', true)`,
        abilityUses: ClientState.gameState?.abilityUses || {}
      });

      const baseDrop = 85; 
      let dynamicMarginStyle = idx > 0 ? `margin-left: -${overlap}px;` : '';
      const isFocused = isCasting || isSelected || isForceHover;
      let wrapperZ = isFocused ? 110 : (10 + idx);
      let transformStyle = isFocused ? `transform: translateY(-40px) scale(1.15); z-index: ${wrapperZ}; ${dynamicMarginStyle}` : `transform: translateY(${baseDrop}px) scale(0.95); z-index: ${wrapperZ}; ${dynamicMarginStyle}`;

      let wrapperClass = `relative pointer-events-auto transition-all duration-300 ease-out origin-bottom cursor-pointer`;
      if (!isTargetingMode || isTargetable) wrapperClass += ' hover:z-[100]';

      return `<div class="${wrapperClass}" style="${transformStyle}">${cardHtml}</div>`;
    }).join('');
}