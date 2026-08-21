// filepath: src/tabletop/renderer.js
import { ClientState } from './client_state.js';
import { renderHistorySlider, renderCardHTML, getLineIconSvg } from '../ui.js';
import { canPlayCard, cloneGameState, LINES } from '../engine/index.js';

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
        document.getElementById('active-lock-notice').className = state.winner === localPlayerRole ? "text-[10px] font-bold text-emerald-400" : "text-[10px] font-bold text-red-400";
        document.getElementById('active-lock-notice').classList.remove('hidden');
    } else {
        document.getElementById('active-lock-notice').innerText = "🔒 Opponent's Turn - Locked";
        document.getElementById('active-lock-notice').className = "text-[10px] font-bold text-yellow-400 hidden";
        document.getElementById('active-lock-notice').classList.toggle('hidden', !isLocked);
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
}

function renderEquator(equatorItems) {
    const container = document.getElementById('equator-cards-container');
    if (!equatorItems || equatorItems.length === 0) {
      container.innerHTML = '<span class="text-xs text-slate-500 italic" id="equator-empty-msg">No unattached items in equator.</span>';
      return;
    }

    container.innerHTML = equatorItems.map((item, idx) => {
      const json = encodeURIComponent(JSON.stringify(item)).replace(/'/g, "%27");
      const isAttacker = ClientState.pendingAbility && ClientState.pendingAbility.entityId === item.instanceId;
      const isTargetable = ClientState.validTargets.some(t => t.id === item.instanceId);

      return renderCardHTML(item, {
        readiness: item.readiness,
        isSelected: isAttacker,
        isTargetable: isTargetable,
        onClick: `window.handleEntityClick('equator', 'equator', '${item.instanceId}')`,
        onInspect: `window.inspectCard('${json}')`,
        abilityUses: ClientState.gameState?.abilityUses || {}
      });
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
        if (ClientState.pendingAbility && ClientState.validTargets.some(t => t.line === 'discard' && t.playerId === player.id)) {
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

    for (const line of LINES) {
      const lineEl = document.getElementById(`${prefix}-line-${line}`);
      if (!lineEl) continue;

      lineEl.classList.add('relative'); // Ensure absolute icon positioning works

      const units = player.lines[line] || [];
      
      const isNarrowColumn = ['avatar', 'bodyguard', 'sideline'].includes(line);
      const isTaunt = line === 'taunt';
      
      let microThreshold = 5;
      let nanoThreshold = 15;

      if (isNarrowColumn) {
          microThreshold = 2;
          nanoThreshold = 6;
      } else if (isTaunt) {
          microThreshold = 6;
          nanoThreshold = 12;
      } else {
          // Dynamic thresholds based on vertical space sharing
          if (centerOccupiedCount === 1) {
              microThreshold = 10;
              nanoThreshold = 20;
          } else if (centerOccupiedCount === 2) {
              microThreshold = 5;
              nanoThreshold = 12;
          } else {
              microThreshold = 3;
              nanoThreshold = 8;
          }
      }

      const useNano = units.length > nanoThreshold;
      const useMicro = units.length > microThreshold && !useNano;

      if (useNano || useMicro) {
          lineEl.classList.remove('content-center', 'items-center');
          lineEl.classList.add('content-start', 'items-start');
      } else {
          lineEl.classList.add('content-center', 'items-center');
          lineEl.classList.remove('content-start', 'items-start');
      }

      const bgIcon = `<div class="absolute top-2 left-2 w-8 h-8 sm:w-12 sm:h-12 text-slate-500/50 pointer-events-none z-0 drop-shadow-md">${getLineIconSvg(line)}</div>`;

      const cardsHtml = units.map(u => {
        const json = encodeURIComponent(JSON.stringify(u)).replace(/'/g, "%27");
        const isAttacker = ClientState.pendingAbility && ClientState.pendingAbility.entityId === u.instanceId;
        const isTargetable = ClientState.validTargets.some(t => t.id === u.instanceId);

        return renderCardHTML(u, {
          readiness: u.readiness,
          isSelected: isAttacker,
          isTargetable: isTargetable,
          isMicro: useMicro,
          isNano: useNano,
          onClick: `window.handleEntityClick('${prefix}', '${line}', '${u.instanceId}')`,
          onInspect: `window.inspectCard('${json}')`,
          abilityUses: ClientState.gameState?.abilityUses || {}
        });
      }).join('');
      
      lineEl.innerHTML = bgIcon + cardsHtml;
    }
}

function renderHand(handCards) {
    const container = document.getElementById('player-hand-container');
    document.getElementById('hand-card-count').innerText = handCards.length;

    if (handCards.length === 0) {
      container.innerHTML = `<span class="text-xs text-slate-500 italic mx-auto self-center">Your hand is empty.</span>`;
      return;
    }

    container.innerHTML = handCards.map(c => {
      const json = encodeURIComponent(JSON.stringify(c)).replace(/'/g, "%27");
      const cardRefId = c.instanceId || c.id;
      const isSelected = ClientState.selectedCardId === cardRefId;
      const playable = ClientState.gameState.turnPhase === 'ACTION_PHASE' ? canPlayCard(ClientState.gameState, ClientState.localPlayerRole, c).success : false;
      const isTargetable = ClientState.pendingAbility && ClientState.validTargets.some(t => t.id === cardRefId);

      return renderCardHTML(c, {
        isHand: true,
        isSelected: isSelected,
        isTargetable: isTargetable,
        isPlayable: playable,
        onClick: `window.handleHandCardClick('${cardRefId}')`,
        onInspect: `window.inspectCard('${json}', true)`,
        abilityUses: ClientState.gameState?.abilityUses || {}
      });
    }).join('');
}