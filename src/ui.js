/**
 * Henchies 2 Shared UI Rendering Components, Modals & Toast System
 * 5:7 Ratio Physical Card Layout, Lighter Bottom Area, Double-Click Inspection, Armor Badge.
 */

export const TRIBE_STYLES = {
  Robot: { bg: 'bg-pink-900', lightBg: 'bg-pink-950/90', border: 'border-black', text: 'text-pink-300' },
  Mythic: { bg: 'bg-emerald-900', lightBg: 'bg-emerald-950/90', border: 'border-black', text: 'text-emerald-300' },
  Elemental: { bg: 'bg-orange-900', lightBg: 'bg-orange-950/90', border: 'border-black', text: 'text-orange-300' },
  Pirate: { bg: 'bg-amber-900', lightBg: 'bg-amber-950/90', border: 'border-black', text: 'text-amber-300' },
  Undead: { bg: 'bg-slate-800', lightBg: 'bg-slate-900/90', border: 'border-black', text: 'text-blue-300' },
  Carnie: { bg: 'bg-purple-900', lightBg: 'bg-purple-950/90', border: 'border-black', text: 'text-purple-300' },
  Viking: { bg: 'bg-cyan-900', lightBg: 'bg-cyan-950/90', border: 'border-black', text: 'text-cyan-300' },
  Ninja: { bg: 'bg-slate-900', lightBg: 'bg-slate-950/90', border: 'border-black', text: 'text-slate-300' },
  Stalker: { bg: 'bg-red-900', lightBg: 'bg-red-950/90', border: 'border-black', text: 'text-red-300' },
  Alien: { bg: 'bg-lime-900', lightBg: 'bg-lime-950/90', border: 'border-black', text: 'text-lime-300' },
  Luchador: { bg: 'bg-yellow-900', lightBg: 'bg-yellow-950/90', border: 'border-black', text: 'text-yellow-300' }
};

export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none max-w-md w-full px-4 items-center';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bgClass = type === 'error' ? 'bg-red-950 border-red-500 text-red-200' :
                  type === 'success' ? 'bg-emerald-950 border-emerald-500 text-emerald-200' :
                  'bg-slate-900 border-amber-500 text-amber-200';

  toast.className = `pointer-events-auto px-4 py-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-between gap-3 shadow-2xl backdrop-blur-md transition-all duration-300 transform -translate-y-2 opacity-0 w-full max-w-sm ${bgClass}`;
  
  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <span>${type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span>
      <span>${message}</span>
    </div>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white font-black text-sm">✕</button>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.remove('-translate-y-2', 'opacity-0'));

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatAbilityCostBadge(cost, cardTribe) {
  if (!cost) return '';
  let badgeStr = '';
  if (cost.tent > 0) badgeStr += `${cost.tent}⛺ `;
  if (cost.power > 0) badgeStr += `${cost.power}⚡ `;
  if (cost.tribeAmount > 0) {
      const tType = cost.tribeType || cardTribe;
      if (tType && tType !== 'NONE') {
          badgeStr += `${cost.tribeAmount} ${tType.charAt(0)} `;
      } else {
          badgeStr += `${cost.tribeAmount}💎 `;
      }
  }
  if (cost.readinessCost === 'EXHAUSTS') badgeStr += `🔄 `;
  if (cost.readinessCost === 'UNREADIES') badgeStr += `⤵️ `;
  
  return badgeStr.trim() ? `<span class="text-[8px] bg-slate-900 text-amber-300 px-1 rounded border border-slate-700 ml-1 font-bold whitespace-nowrap">${badgeStr.trim()}</span>` : '';
}

export function renderCardHTML(card, options = {}) {
  const { isSelected = false, isTargetable = false, readiness = null, onClick = '', onInspect = '' } = options;
  const style = TRIBE_STYLES[card.tribe] || TRIBE_STYLES.Mythic;
  const isUnit = card.type === 'unit' || card.type === 'avatar';
  const isAvatar = card.type === 'avatar';

  const readinessBadge = readiness !== null ? `
    <div class="absolute top-1 right-1 text-[8px] px-1 py-0.5 rounded font-black uppercase tracking-wider z-20 ${
      readiness === 1 ? 'bg-emerald-500 text-black' : 
      readiness === 0 ? 'bg-yellow-500 text-black' : 'bg-red-950 text-red-400 border border-red-700'
    }">
      ${readiness === 1 ? 'READY' : readiness === 0 ? 'UNREADY' : 'EXHAUSTED'}
    </div>
  ` : '';

  const inspectButton = onInspect ? `
    <button 
      onclick="event.stopPropagation(); ${onInspect}"
      class="absolute ${readiness !== null ? 'top-8' : 'top-1'} right-1 w-6 h-6 rounded-full bg-slate-900/80 hover:bg-slate-700 text-white font-black text-[10px] flex items-center justify-center border border-slate-500 shadow-lg z-30 transition-colors backdrop-blur-sm"
      title="Inspect Card"
    >
      🔍
    </button>
  ` : '';

  const rightClickAttr = onInspect ? `oncontextmenu="event.preventDefault(); event.stopPropagation(); ${onInspect}"` : '';

  let abilitiesHTML = '';
  if (card.abilities && card.abilities.length > 0) {
      abilitiesHTML = card.abilities.map(ab => `
          <div class="text-[8px] text-slate-200 font-bold leading-tight truncate flex items-center justify-center gap-0.5">
            <span class="truncate">⚡ ${ab.name}</span>
            ${formatAbilityCostBadge(ab.cost, card.tribe)}
          </div>
      `).join('');
  }

  return `
    <div 
      onclick="${onClick}"
      ${rightClickAttr}
      title="Right-click or tap 🔍 to inspect"
      class="group relative flex-shrink-0 w-32 h-44 sm:w-36 sm:h-52 aspect-[5/7] rounded-md ${style.bg} border-2 border-black ${isSelected ? 'ring-4 ring-yellow-400 scale-105 z-20' : ''} ${isTargetable ? 'ring-4 ring-red-500 animate-bounce z-20 cursor-pointer' : ''} cursor-pointer hover:scale-105 transition-all duration-200 shadow-md flex flex-col justify-between select-none overflow-hidden"
    >
      <div class="relative w-full h-[52%] overflow-hidden bg-slate-900 border-b border-black">
        ${card.artUrl ? `<img src="${card.artUrl}" alt="${card.name}" class="w-full h-full object-cover" />` : `
          <div class="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400 text-2xl font-bold">
            ${card.type === 'unit' ? '⚔️' : card.type === 'avatar' ? '👑' : card.type === 'boon' ? '✨' : card.type === 'buff' ? '🛡️' : '📜'}
          </div>
        `}
        ${!isAvatar ? `
          <div class="absolute top-1 left-1 w-6 h-6 rounded-full bg-amber-500 text-black font-black text-xs flex items-center justify-center border border-black shadow z-10" title="Cost">
            ${card.cost ?? 0}
          </div>
        ` : ''}
        ${readinessBadge}
        ${inspectButton}
      </div>

      <div class="w-full h-[48%] ${style.lightBg} p-1.5 flex flex-col justify-between">
        <div class="flex flex-col items-center justify-center text-center">
          <div class="text-[10px] font-black text-white leading-tight break-words text-center min-h-[22px] flex items-center justify-center">
            ${card.name}
          </div>
          <div class="text-[8px] font-bold text-slate-300 capitalize tracking-tighter truncate max-w-full">
            ${card.type} • ${card.genus || 'Generic'}
          </div>
        </div>

        <div class="flex-1 flex flex-col gap-0.5 mt-1 overflow-hidden">
            ${abilitiesHTML}
        </div>

        ${isUnit ? `
          <div class="flex justify-between items-end w-full pt-1">
            ${(!isAvatar && card.strength !== undefined && card.strength !== null) ? `
              <div class="w-5 h-5 rounded-full bg-yellow-500 border border-black text-black font-black text-[11px] flex items-center justify-center shadow" title="Strength">${card.strength}</div>
            ` : '<div></div>'}
            ${(card.armor > 0) ? `
              <div class="w-5 h-5 rounded bg-cyan-600 border border-black text-white font-black text-[10px] flex items-center justify-center shadow" title="Armor: ${card.armor}">🛡️${card.armor}</div>
            ` : '<div></div>'}
            <div class="w-5 h-5 rounded-full bg-red-600 border border-black text-white font-black text-[11px] flex items-center justify-center shadow" title="Health">${card.currentHealth ?? card.health ?? (isAvatar ? 20 : 1)}</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function extractGlossary(baseAbilities, allAbilitiesRegistry) {
    if (!allAbilitiesRegistry || allAbilitiesRegistry.length === 0) return [];
    
    let glossaryMap = new Map();
    let queue = [...(baseAbilities || [])];
    
    // Create a set of base IDs to exclude them from the sidebar (so we only show nested definitions)
    let baseIds = new Set(queue.map(a => a.abilityId));

    while(queue.length > 0) {
        let current = queue.shift();
        if (!current) continue;
        
        // Find mentions in description (e.g., @[Walker])
        const text = (current.displayDescription || current.description || '');
        const mentionRegex = /@\[(.*?)\]/g;
        let match;
        while ((match = mentionRegex.exec(text)) !== null) {
            const matchedName = match[1];
            const found = allAbilitiesRegistry.find(a => a.name.toLowerCase() === matchedName.toLowerCase());
            if (found && !glossaryMap.has(found.abilityId) && !baseIds.has(found.abilityId)) {
                glossaryMap.set(found.abilityId, found);
                queue.push(found);
            }
        }

        // Find deeply nested GRANT_ABILITY effects
        if (current.effects) {
            current.effects.forEach(group => {
                if (group.payloads) {
                    group.payloads.forEach(eff => {
                        if (eff.type === 'GRANT_ABILITY') {
                            const found = allAbilitiesRegistry.find(a => a.abilityId === eff.grantedAbilityId || a.name === eff.grantedAbilityId);
                            if (found && !glossaryMap.has(found.abilityId) && !baseIds.has(found.abilityId)) {
                                glossaryMap.set(found.abilityId, found);
                                queue.push(found);
                            }
                        }
                        if (eff.nestedGroup && eff.nestedGroup.payloads) {
                            eff.nestedGroup.payloads.forEach(neff => {
                                if (neff.type === 'GRANT_ABILITY') {
                                    const found = allAbilitiesRegistry.find(a => a.abilityId === neff.grantedAbilityId || a.name === neff.grantedAbilityId);
                                    if (found && !glossaryMap.has(found.abilityId) && !baseIds.has(found.abilityId)) {
                                        glossaryMap.set(found.abilityId, found);
                                        queue.push(found);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    }

    return Array.from(glossaryMap.values());
}

export function openInspectionModal(cardOrUnit, allAbilitiesRegistry = []) {
  let modal = document.getElementById('inspection-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'inspection-modal';
    modal.className = 'fixed inset-0 z-50 bg-black/20 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none';
    
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
    modal.oncontextmenu = (e) => { if (e.target === modal) { e.preventDefault(); modal.classList.add('hidden'); } };
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
      }
    });
    
    document.body.appendChild(modal);
  }

  const isUnit = cardOrUnit.type === 'unit' || cardOrUnit.type === 'avatar' || cardOrUnit.currentHealth !== undefined;
  const isAvatar = cardOrUnit.type === 'avatar';
  const style = TRIBE_STYLES[cardOrUnit.tribe] || TRIBE_STYLES.Mythic;
  
  // Extract Glossary
  const glossaryAbilities = extractGlossary(cardOrUnit.abilities || [], allAbilitiesRegistry);

  modal.innerHTML = `
    <!-- Close Button (Fixed Top Right) -->
    <button 
      onclick="document.getElementById('inspection-modal').classList.add('hidden')"
      class="fixed top-4 right-4 sm:top-6 sm:right-6 text-slate-400 hover:text-white text-xl font-bold w-10 h-10 rounded-full bg-slate-900/80 backdrop-blur flex items-center justify-center border border-slate-700 z-[60] shadow-2xl transition-transform hover:scale-110 pointer-events-auto"
    >✕</button>

    <div class="w-full h-full max-w-7xl text-slate-100 flex flex-col md:grid md:grid-cols-3 items-center justify-center gap-6 pointer-events-none">
      
      <!-- LEFT SPACER (Forces card to perfect center) -->
      <div class="hidden md:block pointer-events-none"></div>

      <!-- CENTER: The Giant 5x7 Card Layout -->
      <div class="flex items-center justify-center pointer-events-auto">
        <div class="relative h-[75vh] min-h-[450px] max-h-[750px] aspect-[5/7] rounded-2xl overflow-hidden border-4 ${style.border} shadow-2xl flex flex-col shrink-0 ${style.bg} transition-transform duration-300">
          
          <!-- Top Half: Art & Cost (50%) -->
          <div class="relative w-full h-[50%] bg-slate-900 border-b-2 border-black shrink-0 overflow-hidden">
            ${cardOrUnit.artUrl ? `<img src="${cardOrUnit.artUrl}" alt="${cardOrUnit.name}" class="w-full h-full object-cover" />` : `
              <div class="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400 text-6xl font-bold">
                ${cardOrUnit.type === 'unit' ? '⚔️' : cardOrUnit.type === 'avatar' ? '👑' : cardOrUnit.type === 'boon' ? '✨' : cardOrUnit.type === 'buff' ? '🛡️' : '📜'}
              </div>
            `}
            
            ${!isAvatar ? `
              <div class="absolute top-3 left-3 w-12 h-12 rounded-full bg-amber-500 text-black font-black text-2xl flex items-center justify-center border-2 border-black shadow-lg z-10" title="Cost">
                ${cardOrUnit.cost ?? 0}
              </div>
            ` : ''}

            ${cardOrUnit.readiness !== undefined && cardOrUnit.readiness !== null ? `
              <div class="absolute top-3 right-3 text-sm px-2.5 py-1 rounded-md font-black uppercase tracking-wider z-20 border-2 border-black shadow-lg ${
                cardOrUnit.readiness === 1 ? 'bg-emerald-500 text-black' : 
                cardOrUnit.readiness === 0 ? 'bg-yellow-500 text-black' : 'bg-red-950 text-red-400 border-red-700'
              }">
                ${cardOrUnit.readiness === 1 ? 'READY' : cardOrUnit.readiness === 0 ? 'UNREADY' : 'EXHAUSTED'}
              </div>
            ` : ''}
          </div>

          <!-- Bottom Half: Details & Abilities (50%) -->
          <div class="w-full h-[50%] ${style.lightBg} p-3 sm:p-5 flex flex-col relative overflow-hidden">
            
            <!-- Name & Type Band -->
            <div class="flex flex-col items-center justify-center text-center pb-2 shrink-0 border-b border-black/10 mb-2">
              <h3 class="text-2xl sm:text-3xl font-black text-white leading-tight drop-shadow-md uppercase tracking-wide break-words w-full px-1">
                ${cardOrUnit.name}
              </h3>
              <div class="text-[11px] sm:text-xs font-bold text-slate-200 capitalize tracking-wider mt-1 bg-black/20 px-3 py-0.5 rounded-full border border-black/10 shadow-inner">
                ${cardOrUnit.tribe} • ${cardOrUnit.type} ${cardOrUnit.genus ? `• ${cardOrUnit.genus}` : ''}
              </div>
            </div>

            <!-- Scrollable Traits & Abilities Box -->
            <div class="flex-1 flex flex-col gap-3 overflow-y-auto pb-20 minimal-scrollbar pr-1">

              <!-- Traits -->
              ${cardOrUnit.traits && cardOrUnit.traits.length > 0 ? `
                <div class="flex flex-wrap justify-center gap-1.5 mt-1">
                  ${cardOrUnit.traits.map(t => `<span class="text-[10px] bg-slate-900/80 text-cyan-300 px-2 py-1 rounded border border-cyan-800 font-extrabold uppercase tracking-wider shadow-sm">${t}</span>`).join('')}
                </div>
              ` : ''}

              <!-- Full Abilities with Registry Lookup -->
              ${cardOrUnit.abilities && cardOrUnit.abilities.length > 0 ? `
                <div class="flex flex-col gap-2 mt-1">
                  ${cardOrUnit.abilities.map(a => {
                    const regMatch = allAbilitiesRegistry.find(reg => reg.abilityId === a.abilityId) || a;
                    const finalDesc = regMatch.displayDescription || regMatch.description || 'Executes effects on trigger.';
                    
                    const formattedDesc = finalDesc.replace(/@\[(.*?)\]/g, (match, p1) => {
                        let displayName = p1;
                        const foundAb = allAbilitiesRegistry.find(reg => reg.abilityId === p1 || reg.name.toLowerCase() === p1.toLowerCase());
                        if (foundAb) displayName = foundAb.name;
                        return `<span class="text-fuchsia-400 font-bold cursor-help border-b border-fuchsia-400/30" title="See Glossary">${displayName}</span>`;
                    });
                    
                    return `
                    <div class="bg-black/40 backdrop-blur-sm p-2.5 rounded-lg border border-white/10 shadow-sm flex flex-col gap-1">
                      <div class="flex justify-between items-start border-b border-white/5 pb-1 mb-0.5">
                        <div class="font-black text-amber-400 text-sm sm:text-base drop-shadow-sm flex items-center gap-1 leading-none">
                          ⚡ ${a.name || a.abilityId}
                        </div>
                        <div class="flex items-center gap-1">
                            ${formatAbilityCostBadge(a.cost, cardOrUnit.tribe)}
                            <span class="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600 font-bold uppercase tracking-widest shadow-inner">${a.trigger || 'MANUAL'}</span>
                        </div>
                      </div>
                      <div class="text-slate-200 text-xs sm:text-sm leading-snug">
                        ${formattedDesc}
                      </div>
                    </div>
                  `}).join('')}
                </div>
              ` : ''}

            </div>

            <!-- Combined Footer (Stats & Flavor Text) Anchored to Extreme Bottom -->
            <div class="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none z-20">
              
              <!-- Left: Strength -->
              ${(isUnit && !isAvatar && cardOrUnit.strength !== undefined && cardOrUnit.strength !== null) ? `
                <div class="w-12 h-12 rounded-full bg-yellow-500 border-2 border-black text-black font-black text-xl flex items-center justify-center shadow-xl pointer-events-auto shrink-0" title="Strength">${cardOrUnit.strength}</div>
              ` : '<div class="w-12 h-12 shrink-0"></div>'}
              
              <!-- Center: Armor & Flavor Text -->
              <div class="flex-1 flex flex-col items-center justify-end pb-1 px-1 gap-1 pointer-events-none">
                ${isUnit && (cardOrUnit.armor > 0) ? `
                  <div class="w-10 h-10 rounded bg-cyan-600 border-2 border-black text-white font-black text-base flex items-center justify-center shadow-xl pointer-events-auto shrink-0" title="Armor: ${cardOrUnit.armor}">🛡️${cardOrUnit.armor}</div>
                ` : ''}
                ${cardOrUnit.description ? `
                  <div class="text-[10px] italic text-slate-300 text-center leading-snug w-full opacity-90 drop-shadow-md">
                    "${cardOrUnit.description}"
                  </div>
                ` : ''}
              </div>
              
              <!-- Right: Health -->
              ${isUnit ? `
                <div class="w-12 h-12 rounded-full bg-red-600 border-2 border-black text-white font-black text-xl flex items-center justify-center shadow-xl pointer-events-auto shrink-0" title="Health">${cardOrUnit.currentHealth ?? cardOrUnit.health ?? (isAvatar ? 20 : 1)}</div>
              ` : '<div class="w-12 h-12 shrink-0"></div>'}
            </div>

          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Recursive Glossary Bubbles -->
      <div class="w-full md:w-[350px] flex flex-col gap-4 overflow-y-auto max-h-[85vh] p-2 pointer-events-auto minimal-scrollbar justify-self-start md:ml-4">
        ${glossaryAbilities.length > 0 ? `
          <div class="flex flex-col gap-3">
            ${glossaryAbilities.map(a => `
              <div class="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-2xl flex flex-col gap-1.5 transform transition-transform hover:scale-[1.02]">
                <div class="flex justify-between items-center border-b border-slate-700/50 pb-1.5">
                    <div class="font-black text-fuchsia-300 text-sm drop-shadow-md">${a.name || a.abilityId}</div>
                    <span class="text-[9px] bg-slate-950 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-bold uppercase tracking-wider">${a.trigger || 'MANUAL'}</span>
                </div>
                <div class="text-slate-200 text-xs leading-snug">${a.displayDescription || a.description || 'No details.'}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

    </div>
  `;
  modal.classList.remove('hidden');
}

export function renderHistorySlider(container, historyLog, currentStep, onStepChange) {
  if (!container) return;

  container.innerHTML = `
    <div class="flex items-center gap-3 bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2 shadow-xl backdrop-blur-md">
      <span class="text-xs font-black text-amber-400 uppercase tracking-wider">Replay Scrub:</span>
      <input 
        type="range" 
        min="0" 
        max="${Math.max(0, historyLog.length - 1)}" 
        value="${currentStep}" 
        onchange="${onStepChange}(this.value)"
        class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
      />
      <span class="text-xs text-slate-300 font-mono font-bold whitespace-nowrap">${currentStep} / ${Math.max(0, historyLog.length - 1)}</span>
    </div>
  `;
}