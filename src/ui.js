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

export const CARD_BASE_CLASSES = "w-[128px] sm:w-[144px] aspect-[5/7]";

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
  const carnieCost = cost.carnie || cost.tent || 0;
  if (carnieCost > 0) badgeStr += `${carnieCost}🎪`;
  if (cost.power > 0) badgeStr += `${cost.power}⚡`;
  if (cost.tribeAmount > 0) {
      const tType = cost.tribeType || cardTribe || 'Generic';
      if (tType && tType !== 'NONE' && tType !== 'Generic') {
          badgeStr += `${cost.tribeAmount}${tType.charAt(0)}`;
      } else {
          badgeStr += `${cost.tribeAmount}💎`;
      }
  }
  if (cost.readinessCost === 'EXHAUSTS') badgeStr += `🔄`;
  if (cost.readinessCost === 'UNREADIES') badgeStr += `⤵️`;
  
  return badgeStr.trim() ? `<span class="text-[9px] text-amber-300 font-bold ml-1 tracking-tighter whitespace-nowrap opacity-90">[${badgeStr}]</span>` : '';
}

function getLineIconSvg(line) {
    const svgs = {
        avatar: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-full h-full"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>`,
        bodyguard: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-full h-full"><path d="M12 1L3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4zm4.5 14h-9l-1-4 3 1.5L12 9l2.5 3.5L17.5 11l-1 4z"/></svg>`,
        front: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-full h-full"><path d="M12 1L3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4z"/></svg>`,
        mid: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-full h-full"><path d="M12 2l-2 4v10H7v2h4v4h2v-4h4v-2h-3V6l-2-4z"/></svg>`,
        back: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-full h-full"><path d="M21 12.8c-1.3.8-2.8 1.2-4.5 1.2-5 0-9-4-9-9 0-1.7.4-3.2 1.2-4.5C4.2 1.8 1 5.5 1 10c0 6.1 4.9 11 11 11 4.5 0 8.2-3.2 9-7.2z"/></svg>`,
        sheltered: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-full h-full"><circle cx="12" cy="12" r="10"/></svg>`,
        sideline: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-full h-full"><path d="M4 2v20h2v-8h14l-4-5 4-5H6V2H4z"/></svg>`,
        taunt: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-full h-full"><path d="M4 21h16V9h-3v3h-2V9h-2v3h-2V9h-2v3H9V9H7v3H5V9H4v12zm6-6h4v6h-4v-6z"/></svg>`
    };
    return svgs[line.toLowerCase()] || svgs.mid;
}

export function renderCardHTML(card, options = {}) {
  const { isHand = false, isSelected = false, isTargetable = false, readiness = null, onClick = '', onInspect = '' } = options;
  const style = TRIBE_STYLES[card.tribe] || TRIBE_STYLES.Mythic;
  const isUnit = card.type === 'unit' || card.type === 'avatar';
  const isAvatar = card.type === 'avatar';
  const isToken = !!card.isToken;
  const activeLine = card.line || card.defaultLine || (isAvatar ? 'avatar' : 'mid');
  const isTempLine = card.line && card.defaultLine && card.line !== card.defaultLine;

  const isFieldUnready = !isHand && isUnit && readiness !== null && readiness === 0;
  const isFieldExhausted = !isHand && isUnit && readiness !== null && readiness < 0;
  const fieldDimmingClass = (isFieldUnready || isFieldExhausted) ? 'saturate-[0.25] opacity-90' : '';

  const tokenBorderClass = isToken ? 'border border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.25)]' : 'border border-black shadow-md';
  const separatorClass = isToken ? 'border-white/40' : 'border-black';

  const unreadySvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full"><path d="M9 3v8.29a3.71 3.71 0 0 0 3.71 3.71h8.29"/><path d="m16 10 5 5-5 5"/></svg>`;
  const exhaustedSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>`;

  const overlayHTML = (isFieldUnready || isFieldExhausted) ? `
    <div class="absolute inset-0 z-40 flex items-center justify-center pointer-events-none bg-black/30 rounded-md">
      <div class="w-16 h-16 text-white opacity-80 drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">
        ${isFieldUnready ? unreadySvg : exhaustedSvg}
      </div>
    </div>
  ` : '';

  const readinessBadge = readiness !== null ? `
    <div class="absolute top-1 right-1 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider z-20 ${
      readiness === 1 ? 'bg-emerald-500 text-black' : 
      readiness === 0 ? 'bg-yellow-500 text-black' : 'bg-red-950 text-red-400 border border-red-700'
    }">
      ${readiness === 1 ? 'READY' : readiness === 0 ? 'UNREADY' : 'EXHAUSTED'}
    </div>
  ` : '';

  const inspectButton = onInspect ? `
    <button 
      onclick="event.stopPropagation(); ${onInspect}"
      class="absolute ${readiness !== null ? 'top-6' : 'top-1'} right-1 w-6 h-6 rounded-full bg-slate-900/80 hover:bg-slate-700 text-white font-black text-[10px] flex items-center justify-center border border-slate-500 shadow-lg z-30 transition-colors backdrop-blur-sm"
      title="Inspect Card"
    >
      🔍
    </button>
  ` : '';

  const fastBadge = (card.fast > 0) ? `
    <div class="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-yellow-400 border border-black text-black font-black text-[10px] flex items-center justify-center shadow-lg z-30" title="Fast Charges">
      ⚡${card.fast}
    </div>
  ` : '';

  const attachmentsBadge = (card.attachments && card.attachments.length > 0) ? `
    <div class="absolute -top-1.5 -left-1.5 w-6 h-6 rounded bg-fuchsia-600 border border-black text-white font-black text-[10px] flex items-center justify-center shadow-lg z-30" title="Attachments">
      🔗${card.attachments.length}
    </div>
  ` : '';

  const rightClickAttr = onInspect ? `oncontextmenu="event.preventDefault(); event.stopPropagation(); ${onInspect}"` : '';

  let abilitiesHTML = '';
  if (card.abilities && card.abilities.length > 0) {
      abilitiesHTML = card.abilities.map(ab => `
          <div class="text-[9px] text-slate-200 font-bold leading-tight truncate w-full text-center">
        <span>⚡ ${ab.name || 'Unknown'}</span>${formatAbilityCostBadge(ab.cost, card.tribe)}
      </div>
  `).join('');
  }

  return `
    <div 
      onclick="${onClick}"
      ${rightClickAttr}
      title="Right-click or tap 🔍 to inspect"
      class="group relative flex-shrink-0 ${CARD_BASE_CLASSES} rounded-md ${style.bg} ${tokenBorderClass} ${isSelected ? 'ring-2 ring-yellow-400 scale-105 z-20' : ''} ${isTargetable ? 'ring-2 ring-cyan-400 animate-pulse z-20 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.6)]' : ''} cursor-pointer hover:scale-105 transition-all duration-200 flex flex-col justify-between select-none overflow-hidden"
    >
      <div class="relative w-full h-[52%] overflow-hidden bg-slate-900 border-b ${separatorClass}">
        ${card.artUrl ? `<img src="${card.artUrl}" alt="${card.name}" class="w-full h-full object-cover ${fieldDimmingClass}" />` : `
          <div class="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400 text-3xl font-bold ${fieldDimmingClass}">
            ${card.type === 'unit' ? '⚔️' : card.type === 'avatar' ? '👑' : card.type === 'boon' ? '✨' : card.type === 'buff' ? '🛡️' : '📜'}
          </div>
        `}
        <div class="absolute bottom-1 left-1/2 -translate-x-1/2 w-[92%] flex justify-center z-10 pointer-events-none">
          <div class="bg-black/50 backdrop-blur-sm text-white text-[11px] font-black px-2 py-0.5 rounded-full truncate text-center w-full shadow-md leading-tight border-none">
            ${card.name}
          </div>
        </div>
      </div>

      <div class="w-full h-[48%] ${style.lightBg} p-1 flex flex-col justify-between ${fieldDimmingClass} relative">
        ${isToken ? '<div class="absolute inset-0 bg-white/5 pointer-events-none"></div>' : ''}
        <div class="flex-1 flex flex-col gap-0 overflow-hidden justify-start items-center pt-0.5 relative z-10">
            ${abilitiesHTML}
        </div>

        ${isUnit ? `
          <div class="flex justify-between items-end w-full pt-1 px-1 pb-0.5 shrink-0 relative z-10">
            ${(!isAvatar && card.strength !== undefined && card.strength !== null) ? `
              <div class="w-6 h-6 rounded-full bg-yellow-500 border border-black text-black font-black text-[11px] flex items-center justify-center shadow" title="Strength">${card.strength}</div>
            ` : '<div></div>'}
            ${(card.armor > 0) ? `
              <div class="w-6 h-6 rounded bg-cyan-600 border border-black text-white font-black text-[10px] flex items-center justify-center shadow" title="Armor: ${card.armor}">🛡️${card.armor}</div>
            ` : '<div></div>'}
            <div class="w-6 h-6 rounded-full bg-red-600 border border-black text-white font-black text-[11px] flex items-center justify-center shadow" title="Health">${card.currentHealth ?? card.health ?? (isAvatar ? 20 : 1)}</div>
          </div>
        ` : ''}
      </div>

      <div class="absolute top-1 left-1 flex flex-col items-center gap-1.5 z-10 pointer-events-none">
        ${!isAvatar ? `
          <div class="w-7 h-7 rounded-full bg-amber-500 text-black font-black text-[12px] flex items-center justify-center border border-black shadow pointer-events-auto" title="Cost">
            ${card.cost ?? 0}
          </div>
        ` : ''}
        ${isUnit ? `
          <div class="w-5 h-5 flex items-center justify-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${isTempLine ? 'text-green-300 drop-shadow-[0_0_6px_rgba(134,239,172,0.9)]' : 'text-white'} pointer-events-auto" title="${isTempLine ? 'Temporary Line: ' : 'Line: '}${activeLine.charAt(0).toUpperCase() + activeLine.slice(1)}">
            ${getLineIconSvg(activeLine)}
          </div>
        ` : ''}
      </div>
      ${readinessBadge}
      ${attachmentsBadge}
      ${fastBadge}
      ${inspectButton}
      ${overlayHTML}
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
  const isToken = !!cardOrUnit.isToken;
  const style = TRIBE_STYLES[cardOrUnit.tribe] || TRIBE_STYLES.Mythic;
  const activeLine = cardOrUnit.line || cardOrUnit.defaultLine || (isAvatar ? 'avatar' : 'mid');
  const isTempLine = cardOrUnit.line && cardOrUnit.defaultLine && cardOrUnit.line !== cardOrUnit.defaultLine;
  
  const inspectBorderClass = isToken ? 'border-white/50 shadow-[0_0_24px_rgba(255,255,255,0.25)]' : style.border;
  const separatorClass = isToken ? 'border-white/40' : 'border-black';
  
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
        <div class="relative h-[75vh] min-h-[450px] max-h-[750px] aspect-[5/7] rounded-2xl overflow-hidden border-4 ${inspectBorderClass} shadow-2xl flex flex-col shrink-0 ${style.bg} transition-transform duration-300">
          
          <!-- Top Half: Art & Cost (50%) -->
          <div class="relative w-full h-[50%] bg-slate-900 border-b-2 ${separatorClass} shrink-0 overflow-hidden">
            ${cardOrUnit.artUrl ? `<img src="${cardOrUnit.artUrl}" alt="${cardOrUnit.name}" class="w-full h-full object-cover" />` : `
              <div class="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400 text-6xl font-bold">
                ${cardOrUnit.type === 'unit' ? '⚔️' : cardOrUnit.type === 'avatar' ? '👑' : cardOrUnit.type === 'boon' ? '✨' : cardOrUnit.type === 'buff' ? '🛡️' : '📜'}
              </div>
            `}
            
            <div class="absolute bottom-2 left-1/2 -translate-x-1/2 w-[90%] flex justify-center z-30 pointer-events-none">
               <div class="bg-black/50 backdrop-blur-md text-white text-xl sm:text-2xl font-black px-4 py-1 rounded-full truncate text-center w-full shadow-[0_4px_12px_rgba(0,0,0,0.8)] leading-tight uppercase tracking-wide border-none">
                  ${cardOrUnit.name}
               </div>
            </div>

            <div class="absolute top-3 left-3 flex flex-col items-center gap-2 z-10">
              ${!isAvatar ? `
                <div class="w-12 h-12 rounded-full bg-amber-500 text-black font-black text-2xl flex items-center justify-center border-2 border-black shadow-lg" title="Cost">
                  ${cardOrUnit.cost ?? 0}
                </div>
              ` : ''}
              ${isUnit ? `
                <div class="w-8 h-8 flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isTempLine ? 'text-green-300 drop-shadow-[0_0_8px_rgba(134,239,172,0.9)]' : 'text-white'}" title="${isTempLine ? 'Temporary Line: ' : 'Line: '}${activeLine.charAt(0).toUpperCase() + activeLine.slice(1)}">
                  ${getLineIconSvg(activeLine)}
                </div>
              ` : ''}
              ${(cardOrUnit.fast > 0) ? `
                <div class="w-8 h-8 rounded-full bg-yellow-400 text-black font-black text-sm flex items-center justify-center border-2 border-black shadow-lg mt-1" title="Fast Charges">
                  ⚡${cardOrUnit.fast}
                </div>
              ` : ''}
            </div>

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
          <div class="w-full h-[50%] ${style.lightBg} p-2 sm:p-3 flex flex-col relative overflow-hidden">
            ${isToken ? '<div class="absolute inset-0 bg-white/5 pointer-events-none"></div>' : ''}
            
            <!-- Type Band -->
            <div class="flex justify-center pb-1 shrink-0 mb-1 z-10 pointer-events-none relative">
              <div class="text-[10px] font-bold text-slate-200 capitalize tracking-wider bg-black/40 px-3 py-0.5 rounded-full shadow-inner">
                ${cardOrUnit.tribe} • ${cardOrUnit.type} ${cardOrUnit.genus ? `• ${cardOrUnit.genus}` : ''}
              </div>
            </div>

            <!-- Scrollable Traits & Abilities Box -->
            <div class="flex-1 flex flex-col gap-1.5 overflow-y-auto pb-16 minimal-scrollbar pr-1 pointer-events-auto relative z-10">

              <!-- Traits -->
              ${cardOrUnit.traits && cardOrUnit.traits.length > 0 ? `
                <div class="flex flex-wrap justify-center gap-1.5 mt-1">
                  ${cardOrUnit.traits.map(t => `<span class="text-[10px] bg-slate-900/80 text-cyan-300 px-2 py-1 rounded border border-cyan-800 font-extrabold uppercase tracking-wider shadow-sm">${t}</span>`).join('')}
                </div>
              ` : ''}

              <!-- Attachments -->
              ${cardOrUnit.attachments && cardOrUnit.attachments.length > 0 ? `
                <div class="flex flex-wrap justify-center gap-1.5 mt-1">
                  ${cardOrUnit.attachments.map(a => `<span class="text-[10px] bg-fuchsia-950/80 text-fuchsia-200 px-2 py-1 rounded border border-fuchsia-800 font-extrabold uppercase tracking-wider shadow-sm">🔗 ${a.name}</span>`).join('')}
                </div>
              ` : ''}

              <!-- Full Abilities with Registry Lookup -->
              ${cardOrUnit.abilities && cardOrUnit.abilities.length > 0 ? `
                <div class="flex flex-col gap-1 mt-1">
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
                    <div class="bg-black/30 backdrop-blur-sm p-1.5 rounded border border-white/5 shadow-sm text-[10px] sm:text-[11px] text-slate-200 leading-snug">
                      <span class="font-black text-amber-400 drop-shadow-sm">⚡ ${regMatch.name || a.name || a.abilityId}</span>${formatAbilityCostBadge(a.cost, cardOrUnit.tribe)}<span class="text-[8px] bg-slate-800 text-slate-300 px-1 py-px rounded font-bold uppercase tracking-widest mx-1.5 shadow-inner opacity-90">${a.trigger || 'MANUAL'}</span><span>${formattedDesc}</span>
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

export function renderJSONPreview(containerId, jsonObject, copyCallbackName) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
      <div class="glass-panel rounded-2xl p-4 flex flex-col gap-2 shadow-2xl border border-slate-800 h-full max-h-full overflow-hidden">
         <div class="flex justify-between items-center border-b border-slate-800 pb-1">
           <h2 class="text-[10px] font-black text-slate-400 uppercase tracking-wider">
            Data Structure Preview
           </h2>
           <button type="button" onclick="window.${copyCallbackName}()" class="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded transition shadow font-bold">
             📋 Copy JSON
           </button>
         </div>
    <pre class="text-[9px] text-cyan-500 font-mono overflow-y-auto overflow-x-auto h-full pb-6 custom-scrollbar">${JSON.stringify(jsonObject, null, 2)}</pre>
  </div>
`;
}

export function openJSONImportModal(onImport) {
  let modal = document.getElementById('json-import-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'json-import-modal';
    modal.className = 'fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div class="glass-panel rounded-2xl p-6 shadow-2xl border border-slate-700 max-w-lg w-full flex flex-col gap-4 relative">
      <div class="flex justify-between items-center border-b border-slate-800 pb-2">
        <h3 class="text-lg font-black text-emerald-400 uppercase tracking-wider">📥 Import JSON</h3>
        <button onclick="document.getElementById('json-import-modal').classList.add('hidden')" class="text-slate-400 hover:text-white font-bold text-xl leading-none">&times;</button>
      </div>
      <p class="text-xs text-slate-400">Paste your JSON data below to import it into the editor. It will be loaded as an unsaved draft.</p>
      <textarea id="import-json-textarea" rows="10" class="bg-slate-900 border border-slate-700 p-2 rounded text-emerald-300 font-mono text-[10px] w-full focus:outline-none focus:border-emerald-500 custom-scrollbar" placeholder="{...}"></textarea>
      <div class="flex justify-end gap-3 mt-2">
        <button onclick="document.getElementById('json-import-modal').classList.add('hidden')" class="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2 rounded transition">Cancel</button>
        <button id="confirm-import-btn" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded shadow transition">Import Data</button>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');

  document.getElementById('confirm-import-btn').onclick = () => {
    const val = document.getElementById('import-json-textarea').value;
    try {
      const parsed = JSON.parse(val);
      onImport(parsed);
      modal.classList.add('hidden');
    } catch (e) {
      showToast('Invalid JSON format', 'error');
    }
  };
}