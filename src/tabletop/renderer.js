// filepath: src/tabletop/renderer.js
import { ClientState } from './client_state.js';
import { renderHistorySlider, renderCardHTML, getLineIconSvg } from '../ui.js';
import { canPlayCard, cloneGameState, LINES, getEntityAvailableActions, resolveResourceKey, getValidAbilityTargets } from '../engine/index.js';
import { triggerAILoop } from './interactions.js';

window.scrubReplay = (step) => {
    ClientState.replayStepIndex = parseInt(step);
    if (ClientState.localReplayStates[ClientState.replayStepIndex]) {
        ClientState.gameState = cloneGameState(ClientState.localReplayStates[ClientState.replayStepIndex]);
        // Reapply catalogs
        Object.defineProperty(ClientState.gameState, 'abilityCatalog', { value: ClientState.allAbilitiesRegistry, enumerable: false, configurable: true });
        Object.defineProperty(ClientState.gameState, 'catalog', { value: ClientState.allCardsRegistry, enumerable: false, configurable: true });
        Object.defineProperty(ClientState.gameState, 'tribeCatalog', { value: ClientState.customTribesList, enumerable: false, configurable: true });
        updateUI();
    }
};

export function updateUI() {
    if (!ClientState.gameState) return;

    if (!ClientState.pendingAbility && !window._isDragging) {
        const overlay = document.getElementById('drag-tether-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    const state = ClientState.gameState;
    const localPlayerRole = ClientState.localPlayerRole;
    const myP = state.players[localPlayerRole];
    const oppRole = localPlayerRole === 'player1' ? 'player2' : 'player1';
    const oppP = state.players[oppRole];

    renderHistorySlider(
        document.getElementById('replay-bar-container'), 
        state.history_log, 
        ClientState.replayStepIndex, 
        'window.scrubReplay'
    );

    document.getElementById('turn-badge').innerText = `Turn ${state.turnNumber}: ${state.players[state.activePlayerId].name}`;
    document.getElementById('phase-badge').innerText = state.turnPhase.replace('_', ' ');

    const isLocked = !ClientState.isMyTurn();
    if (state.status === 'finished') {
        document.getElementById('active-lock-notice').innerText = state.winner === localPlayerRole ? "🏆 Victory!" : "💀 Defeat!";
        document.getElementById('active-lock-notice').className = "text-[10px] font-bold text-emerald-400";
        document.getElementById('active-lock-notice').classList.remove('hidden');
        
        const forfeitBtn = document.getElementById('forfeit-match-btn');
        if (forfeitBtn) forfeitBtn.classList.add('hidden');
    } else {
        const activeP = state.players[state.activePlayerId];
        const isAITurn = activeP?.isAI || activeP?.isDummy;
        document.getElementById('active-lock-notice').innerText = isAITurn ? "🤖 AI is thinking..." : "🔒 Opponent's Turn - Locked";
        document.getElementById('active-lock-notice').className = "text-[10px] font-bold text-yellow-400 hidden";
        document.getElementById('active-lock-notice').classList.toggle('hidden', !isLocked);
        
        const forfeitBtn = document.getElementById('forfeit-match-btn');
        if (forfeitBtn) forfeitBtn.classList.remove('hidden');
    }

    const actionInputs = document.querySelectorAll('#phase3-action-controls button');
    actionInputs.forEach(btn => btn.disabled = isLocked);
    
    document.getElementById('cancel-action-btn').classList.toggle('hidden', !ClientState.pendingAbility);
    
    const undoBtn = document.getElementById('undo-action-btn');
    if (undoBtn) {
        const isUndoEnabled = state.rules?.allowUndo;
        undoBtn.classList.toggle('hidden', !isUndoEnabled);
        
        const canUndo = isUndoEnabled && !isLocked && (state.lastRealActionIndex || 0) > ClientState.lastSafeUndoIndex;
        undoBtn.disabled = !canUndo;
        
        if (canUndo) {
            undoBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'grayscale');
        } else {
            undoBtn.classList.add('opacity-50', 'cursor-not-allowed', 'grayscale');
        }
    }

    const restartBtn = document.getElementById('restart-match-btn');
    if (restartBtn) {
        if (ClientState.roomCode && ClientState.roomCode.startsWith('TEST_')) {
            restartBtn.classList.remove('hidden');
        } else {
            restartBtn.classList.add('hidden');
        }
    }

    if (ClientState.pendingAbility) {
        document.getElementById('action-phase-instruction').innerText = "Select a target on the board...";
        document.getElementById('action-phase-instruction').classList.add('text-amber-400', 'animate-pulse');
    } else {
        document.getElementById('action-phase-instruction').innerText = "Phase 2: Play cards, attack targets, or equip items from Equator.";
        document.getElementById('action-phase-instruction').classList.remove('text-amber-400', 'animate-pulse');
    }

    document.getElementById('player-name').innerText = `${myP.name} (${localPlayerRole.toUpperCase()})`;
    
    let myResStr = '';
    if (myP.resources) {
        for (const [resKey, res] of Object.entries(myP.resources)) {
            if (res.max <= 0 && res.current <= 0) continue;
            let name = resKey;
            if (resKey !== 'Carnie' && resKey !== 'Generic') {
                const t = ClientState.customTribesList.find(t => t.id === resKey);
                if (t) name = t.name;
                else if (resKey.startsWith('tribe_')) name = resKey.substring(6).charAt(0).toUpperCase() + resKey.substring(7);
            }
            myResStr += `${name}: ${res.current}/${res.max} | `;
        }
    }
    document.getElementById('player-resources').innerText = myResStr.replace(/ \| $/, '') || 'No Resources';

    let oppAvatar = null;
    for (const line in oppP.lines) {
        oppAvatar = oppP.lines[line]?.find(u => u.type === 'avatar');
        if (oppAvatar) break;
    }

    document.getElementById('opp-name').innerText = `${oppP.name} (${oppRole.toUpperCase()})`;
    document.getElementById('opp-power').innerText = oppAvatar?.power || 0;
    document.getElementById('opp-hand-count').innerText = oppP.hand.length;
    
    let oppResStr = '';
    if (oppP.resources) {
        for (const [resKey, res] of Object.entries(oppP.resources)) {
            if (res.max <= 0 && res.current <= 0) continue;
            let name = resKey;
            if (resKey !== 'Carnie' && resKey !== 'Generic') {
                const t = ClientState.customTribesList.find(t => t.id === resKey);
                if (t) name = t.name;
                else if (resKey.startsWith('tribe_')) name = resKey.substring(6).charAt(0).toUpperCase() + resKey.substring(7);
            }
            oppResStr += `${name}: ${res.current}/${res.max} | `;
        }
    }
    document.getElementById('opp-resources').innerText = oppResStr.replace(/ \| $/, '') || 'No Resources';

    const isHarvestPhase = state.turnPhase === 'SACRIFICE_DECISION' && ClientState.isMyTurn();
    document.getElementById('harvest-overlay').classList.toggle('hidden', !isHarvestPhase);
    document.getElementById('harvest-overlay').classList.toggle('flex', isHarvestPhase);
    
    const handContainer = document.getElementById('player-hand-container');
    if (handContainer) {
        handContainer.classList.toggle('ring-2', isHarvestPhase);
        handContainer.classList.toggle('ring-amber-500', isHarvestPhase);
        handContainer.classList.toggle('shadow-[0_0_30px_rgba(245,158,11,0.3)]', isHarvestPhase);
        handContainer.classList.toggle('bg-amber-950/20', isHarvestPhase);
    }
    
    const confirmBtn = document.getElementById('overlay-sacrifice-confirm-btn');
    if (confirmBtn) {
        if (ClientState.selectedCardId) {
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            confirmBtn.disabled = true;
            confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    document.getElementById('phase3-action-controls').classList.toggle('hidden', state.turnPhase !== 'ACTION_PHASE');

    renderEquator(state.equator);
    renderPlayerBattlelines(myP, 'player');
    renderPlayerBattlelines(oppP, 'opp');
    renderDeckAndDiscard(myP, 'player');
    renderDeckAndDiscard(oppP, 'opp');
    renderHand(myP.hand);

    const logBox = document.getElementById('history-log-text');
    logBox.innerHTML = state.history_log.map(msg => {
      const text = typeof msg === 'string' ? msg : msg.text;
      const depth = typeof msg === 'object' && msg.depth ? msg.depth : 0;
      let indentClass = '';
      let textClass = 'text-slate-300';
      let iconHtml = '';
      if (depth === 1) {
          indentClass = 'ml-4 pl-2 border-l border-slate-600';
          textClass = 'text-slate-400';
          iconHtml = '<span class="text-slate-500 mr-1 text-[10px]">↳</span>';
      } else if (depth === 2) {
          indentClass = 'ml-8 pl-2 border-l border-slate-700/50';
          textClass = 'text-slate-500';
          iconHtml = '<span class="text-slate-600 mr-1 text-[10px]">↳</span>';
      } else if (depth === 3) {
          indentClass = 'ml-12 pl-2 border-l border-slate-700/30';
          textClass = 'text-slate-500';
          iconHtml = '<span class="text-slate-700 mr-1 text-[10px]">↳</span>';
      } else if (depth === 4) {
          indentClass = 'ml-16 pl-2 border-l border-slate-800/80';
          textClass = 'text-slate-600';
          iconHtml = '<span class="text-slate-700 mr-1 text-[10px]">↳</span>';
      } else if (depth >= 5) {
          indentClass = 'ml-20 pl-2 border-l border-slate-800/50';
          textClass = 'text-slate-600';
          iconHtml = '<span class="text-slate-700 mr-1 text-[10px]">↳</span>';
      }
      return `<div class="py-0.5 border-b border-slate-900/50 ${indentClass} ${textClass}">${iconHtml}${text}</div>`;
    }).join('');
    logBox.scrollTop = logBox.scrollHeight;

    const tickerBox = document.getElementById('action-log-ticker-text');
    if (tickerBox && state.history_log.length > 0) {
      const lastMsg = state.history_log[state.history_log.length - 1];
      tickerBox.innerHTML = typeof lastMsg === 'string' ? lastMsg : lastMsg.text;
    }

    const activeP = state.players[state.activePlayerId];
    if ((activeP?.isAI || activeP?.isDummy) && ClientState.localPlayerRole === 'player1') {
        setTimeout(triggerAILoop, 50);
    }
}
window.updateUI = updateUI;

function getHandActionCount(player, c) {
    if (!ClientState.isMyTurn() || ClientState.gameState.turnPhase !== 'ACTION_PHASE') return 0;
    
    const playCheck = canPlayCard(ClientState.gameState, ClientState.localPlayerRole, c);
    const canPlay = playCheck.success;

    let baseCost = typeof c.cost === 'object' ? (c.cost.tribeAmount > 0 ? c.cost.tribeAmount : (c.cost.carnie || c.cost.tent || 0)) : (c.cost || 0);
    let cTribe = resolveResourceKey(ClientState.gameState, player, c.tribe);
    
    let simCarnie = player.resources['Carnie'] ? player.resources['Carnie'].current : 0;
    let simTribe = (cTribe !== 'Carnie' && player.resources[cTribe]) ? player.resources[cTribe].current : 0;
    
    if (canPlay && baseCost > 0) {
        if (cTribe === 'Carnie') {
            simCarnie -= baseCost;
        } else {
            let costRemaining = baseCost;
            let tribeResToUse = Math.min(simTribe, costRemaining);
            costRemaining -= tribeResToUse;
            simTribe -= tribeResToUse;
            simCarnie -= (costRemaining * 3);
        }
    }

    const canAffordAbility = (abCost) => {
        if (!abCost) return true;
        let reqCarnie = abCost.carnie || abCost.tent || 0;
        let reqTribe = abCost.tribeAmount || 0;
        
        if (reqCarnie === 0 && reqTribe === 0) return true;
        
        let availCarnie = simCarnie;
        let availTribe = simTribe;

        if (reqCarnie > 0) {
            if (availCarnie < reqCarnie) return false;
            availCarnie -= reqCarnie;
        }

        if (reqTribe > 0) {
            if (cTribe === 'Carnie') {
                if (availCarnie < reqTribe) return false;
            } else {
                let maxConversion = Math.floor(availCarnie / 3);
                if ((availTribe + maxConversion) < reqTribe) return false;
            }
        }
        return true;
    };

    const playAbilities = c.abilities ? c.abilities.filter(ab => {
        const t = ab.trigger || 'MANUAL';
        const isPlayTrigger = ['PLAY', 'PLAY_OPTIONAL', 'MODIFY_PLAY', 'ON_PLAYED', 'ON_BE_PLAYED', 'WOULD_PLAY', 'WOULD_BE_PLAYED'].includes(t);
        const requiresTarget = ab.activation?.method === 'PLAYER_CHOICE';
        
        if (t === 'PLAY_OPTIONAL') {
            let hasTargets = true;
            if (requiresTarget) {
                hasTargets = getValidAbilityTargets(ClientState.gameState, ClientState.localPlayerRole, c.instanceId || c.id, ab.abilityId).length > 0;
            }
            return canPlay && canAffordAbility(ab.cost) && hasTargets;
        }

        if (t === 'MANUAL' && ab.passiveFlags?.includes('ACTIVATE_FROM_HAND')) {
            let rawCarnie = player.resources['Carnie'] ? player.resources['Carnie'].current : 0;
            let rawTribe = (cTribe !== 'Carnie' && player.resources[cTribe]) ? player.resources[cTribe].current : 0;
            
            let reqCarnie = ab.cost?.carnie || ab.cost?.tent || 0;
            let reqTribe = ab.cost?.tribeAmount || 0;
            
            if (reqCarnie === 0 && reqTribe === 0) return true;
            
            if (reqCarnie > 0) {
                if (rawCarnie < reqCarnie) return false;
                rawCarnie -= reqCarnie;
            }
            
            if (reqTribe > 0) {
                if (cTribe === 'Carnie') {
                    if (rawCarnie < reqTribe) return false;
                } else {
                    let maxConversion = Math.floor(rawCarnie / 3);
                    if ((rawTribe + maxConversion) < reqTribe) return false;
                }
            }
            return true;
        }
        
        return canPlay && isPlayTrigger && requiresTarget;
    }) : [];

    const hasMandatoryTarget = playAbilities.some(ab => ['PLAY', 'MODIFY_PLAY', 'ON_PLAYED', 'ON_BE_PLAYED'].includes(ab.trigger) && ab.activation?.method === 'PLAYER_CHOICE');
    const showPlayNormally = canPlay && !hasMandatoryTarget;

    let totalActs = playAbilities.length;
    if (showPlayNormally) totalActs++;
    
    return totalActs;
}

function renderAttachmentsRecursive(attachments, prefix, line, isLocalPlayer, depth = 1) {
    if (!attachments || attachments.length === 0) return '';
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
            isNano: true,
            onClick: `if(event) event.stopPropagation(); window.handleEntityClick('${prefix}', '${line}', '${att.instanceId}')`,
            onInspect: `window.inspectCard('${attJson}')`,
            abilityUses: ClientState.gameState?.abilityUses || {}
        });

        const nestedHtml = renderAttachmentsRecursive(att.attachments, prefix, line, isLocalPlayer, depth + 1);
        
        const yTranslate = depth * -6;
        const zIndex = 20 - i + (depth * 2);

        return `
            <div class="flex flex-row items-start relative drop-shadow-md shrink-0 -ml-14 sm:-ml-16" style="z-index: ${zIndex}; transform: translateY(${yTranslate}px);">
                <div class="relative z-[30] [&>div]:hover:-translate-y-8 cursor-pointer">
                    <div class="transition-transform duration-200">
                        ${attCardHtml}
                    </div>
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

    container.innerHTML = equatorItems.map((item, idx) => {
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
        isNano: true,
        onClick: `window.handleEntityClick('equator', 'equator', '${item.instanceId}')`,
        onInspect: `window.inspectCard('${json}')`,
        abilityUses: ClientState.gameState?.abilityUses || {}
      });

      let attachmentsHtml = renderAttachmentsRecursive(item.attachments, 'equator', 'equator', false);

      return `
        <div class="flex flex-row items-start relative group drop-shadow-md shrink-0">
            <div class="relative z-[30]">
                ${hostHtml}
            </div>
            ${attachmentsHtml}
        </div>
      `;
    }).join('');
}

function renderDeckAndDiscard(player, prefix) {
    const deckEl = document.getElementById(`${prefix}-deck-container`);
    const discardEl = document.getElementById(`${prefix}-discard-container`);
    
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
        
        let targetHighlight = '';
        const hasDiscardTarget = (ClientState.pendingAbility && ClientState.validTargets.some(t => t.line === 'discard' && t.playerId === player.id)) || 
                                 (window._isDragging && window._dragTargets && window._dragTargets.some(tid => player.discard.some(c => c.instanceId === tid || c.id === tid)));
        
        if (hasDiscardTarget) {
            targetHighlight = 'ring-2 ring-cyan-400 animate-pulse z-20 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.6)]';
        }

        const cardHtml = renderCardHTML(topCard, {
          onClick: `if(event) event.stopPropagation(); window.openZoneModal('${player.id}', 'discard')`,
          onInspect: `window.inspectCard('${json}', false)`,
          abilityUses: ClientState.gameState?.abilityUses || {}
        });
        
        discardEl.innerHTML = `
          <div class="relative flex-shrink-0 w-[128px] h-[179px] sm:w-[144px] sm:h-[201px] ${targetHighlight}">
            ${cardHtml}
            <div class="absolute -top-2 -right-2 bg-slate-950 text-white font-black text-[12px] w-6 h-6 sm:w-7 sm:h-7 rounded-full shadow-xl border border-slate-600 z-30 flex items-center justify-center pointer-events-none">
              ${player.discard.length}
            </div>
          </div>
        `;
      }
    }
}

function renderPlayerBattlelines(player, prefix) {
    const checkOccupied = (line) => {
      return player.lines[line] && player.lines[line].length > 0;
    };

    const toggleLine = (line, show) => {
      const el = document.getElementById(`${prefix}-line-${line}`);
      if (el) el.classList.toggle('hidden', !show);
    };

    toggleLine('taunt', checkOccupied('taunt'));
    toggleLine('avatar', true); 
    toggleLine('bodyguard', checkOccupied('bodyguard'));
    toggleLine('sideline', true);

    const centerLines = ['front', 'mid', 'back', 'sheltered'];
    let centerOccupiedCount = 0;
    for (const l of centerLines) {
      if (checkOccupied(l)) {
        centerOccupiedCount++;
        toggleLine(l, true);
      } else {
        toggleLine(l, false);
      }
    }
    if (centerOccupiedCount === 0) {
        toggleLine('front', true);
        centerOccupiedCount = 1;
    }

    const forceMicro = centerOccupiedCount >= 2;
    const forceNano = centerOccupiedCount >= 3;

    for (const line of LINES) {
      const lineEl = document.getElementById(`${prefix}-line-${line}`);
      if (!lineEl) continue;

      lineEl.classList.add('relative'); // Ensure absolute icon positioning works

      const units = player.lines[line] || [];
      const isLocalPlayer = prefix === 'player';
      
      // Force wrap and even spacing for nano cards
      lineEl.classList.remove('justify-center', 'content-center', 'items-center');
      lineEl.classList.add('justify-evenly', 'content-start', 'items-start', 'flex-wrap', 'gap-2');

      const bgIcon = `<div class="absolute top-2 left-2 w-8 h-8 sm:w-12 sm:h-12 text-slate-500/50 pointer-events-none z-0 drop-shadow-md">${getLineIconSvg(line)}</div>`;

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
          isCasting: isCasting,
          isTargetable: isTargetable,
          actionState: actionState,
          isNano: true, // Always force nano sizing
          onClick: `window.handleEntityClick('${prefix}', '${line}', '${u.instanceId}')`,
          onInspect: `window.inspectCard('${json}')`,
          abilityUses: ClientState.gameState?.abilityUses || {}
        });

        let attachmentsHtml = renderAttachmentsRecursive(u.attachments, prefix, line, isLocalPlayer);

        return `
            <div class="flex flex-row items-start relative group drop-shadow-md shrink-0">
                <div class="relative z-[30]">
                    ${hostHtml}
                </div>
                ${attachmentsHtml}
            </div>
        `;
      }).join('');
      
      lineEl.innerHTML = bgIcon + cardsHtml;
    }
}

function renderHand(handCards) {
    const container = document.getElementById('player-hand-container');
    document.getElementById('hand-card-count').innerText = handCards.length;
    
    const isTargetingMode = !!ClientState.pendingAbility || window._isDragging;

    if (handCards.length === 0) {
      container.className = 'flex flex-wrap justify-center gap-2 p-1.5 bg-slate-950/80 rounded-lg border border-slate-800/80 min-h-[64px] items-start transition-all duration-300';
      container.innerHTML = `<span class="text-xs text-slate-500 italic mx-auto self-center">Your hand is empty.</span>`;
      return;
    }

    const isCrowded = handCards.length > 5;
    if (isCrowded) {
        container.className = 'flex flex-nowrap overflow-x-auto overflow-y-visible items-end pb-4 pt-8 px-4 bg-slate-950/80 rounded-lg border border-slate-800/80 min-h-[64px] transition-all duration-300 minimal-scrollbar justify-start sm:justify-center';
    } else {
        container.className = 'flex flex-wrap justify-center gap-2 p-1.5 bg-slate-950/80 rounded-lg border border-slate-800/80 min-h-[64px] items-start transition-all duration-300';
    }

    container.innerHTML = handCards.map((c, idx) => {
      const json = encodeURIComponent(JSON.stringify(c)).replace(/'/g, "%27");
      const cardRefId = c.instanceId || c.id;
      const isSelected = ClientState.selectedCardId === cardRefId;
      const isCasting = (ClientState.pendingAbility && ClientState.pendingAbility.entityId === cardRefId) || ClientState.activeMenuEntityId === cardRefId || (window._isDragging && window._dragCardId === cardRefId);
      const playable = ClientState.gameState.turnPhase === 'ACTION_PHASE' ? canPlayCard(ClientState.gameState, ClientState.localPlayerRole, c).success : false;
      const isTargetable = (ClientState.pendingAbility && ClientState.validTargets.some(t => t.id === cardRefId)) || (window._isDragging && window._dragTargets && window._dragTargets.includes(cardRefId));
      const isForceHover = window._forceHoverCardId === cardRefId;

      let actionState = 'none';
      if (ClientState.isMyTurn() && ClientState.gameState.turnPhase === 'ACTION_PHASE' && !ClientState.pendingAbility && !window._isDragging) {
          const count = getHandActionCount(ClientState.gameState.players[ClientState.localPlayerRole], c);
          if (count === 1) actionState = 'single';
          else if (count > 1) actionState = 'multiple';
      }

      const cardHtml = renderCardHTML(c, {
        isHand: true,
        isSelected: isSelected,
        isCasting: isCasting,
        isTargetable: isTargetable,
        isTargetingMode: isTargetingMode,
        isForceHover: isForceHover,
        actionState: actionState,
        isPlayable: playable,
        onMouseLeave: isForceHover ? `window._forceHoverCardId = null; window.updateUI();` : null,
        onClick: `window.handleHandCardClick('${cardRefId}')`,
        onInspect: `window.inspectCard('${json}', true)`,
        abilityUses: ClientState.gameState?.abilityUses || {}
      });

      let overlapClass = '';
      let wrapperZ = 10 + idx;
      
      if (isCrowded) {
          overlapClass = `relative ${idx > 0 ? '-ml-12 sm:-ml-16' : ''}`;
          
          if (isCasting || isSelected) {
              overlapClass += ' mr-12 sm:mr-16 !z-[110]';
              wrapperZ = 110;
          } else if (isForceHover) {
              overlapClass += ' mr-12 sm:mr-16 hover:!z-[100]';
              wrapperZ = 100;
          } else {
              if (!isTargetingMode || isTargetable) {
                  overlapClass += ' hover:mr-12 sm:hover:mr-16 hover:!z-[100]';
              }
          }
      }

      return isCrowded ? `<div class="${overlapClass}" style="z-index: ${wrapperZ}">${cardHtml}</div>` : cardHtml;
    }).join('');
}