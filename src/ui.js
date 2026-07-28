/**
 * Henchies 2 Shared UI Rendering Components, Modals & Toast System
 * 5:7 Ratio Physical Card Layout, Lighter Bottom Area, Double-Click Inspection, Armor Badge.
 */

// Tribe Color Schemes & Lighter Bottom Shades
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

/**
 * Toast Notification System - Top Center
 */
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

  requestAnimationFrame(() => {
    toast.classList.remove('-translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Render Mini-Card HTML
 * 5:7 Physical Card Ratio, Image fills top area, Cost overlaid top-left,
 * Lighter shade bottom area with Name, Taxonomy (Type/Genus), Stats (Strength, Armor, Health).
 * Double-click / double-tap triggers inspect modal!
 */
export function renderCardHTML(card, options = {}) {
  const {
    isHand = false,
    isSelected = false,
    isTargetable = false,
    readiness = null,
    onClick = '',
    onInspect = ''
  } = options;

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

  const doubleClickAttr = onInspect ? `ondblclick="event.stopPropagation(); ${onInspect}"` : '';

  return `
    <div 
      onclick="${onClick}"
      ${doubleClickAttr}
      title="Double click to inspect"
      class="group relative flex-shrink-0 w-32 h-44 sm:w-36 sm:h-52 aspect-[5/7] rounded-md ${style.bg} border-2 border-black ${isSelected ? 'ring-4 ring-yellow-400 scale-105 z-20' : ''} ${isTargetable ? 'ring-4 ring-red-500 animate-bounce z-20 cursor-pointer' : ''} cursor-pointer hover:scale-105 transition-all duration-200 shadow-md flex flex-col justify-between select-none overflow-hidden"
    >
      <!-- TOP AREA: Full Image & Cost Overlay -->
      <div class="relative w-full h-[52%] overflow-hidden bg-slate-900 border-b border-black">
        ${card.artUrl ? `
          <img src="${card.artUrl}" alt="${card.name}" class="w-full h-full object-cover" />
        ` : `
          <div class="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400 text-2xl font-bold">
            ${card.type === 'unit' ? '⚔️' : card.type === 'avatar' ? '👑' : card.type === 'boon' ? '✨' : card.type === 'buff' ? '🛡️' : '📜'}
          </div>
        `}

        <!-- Cost Overlay (Top Left) - Avatars have no cost -->
        ${!isAvatar ? `
          <div class="absolute top-1 left-1 w-6 h-6 rounded-full bg-amber-500 text-black font-black text-xs flex items-center justify-center border border-black shadow z-10" title="Cost: ${card.cost ?? 0} ${card.tribe} Resource">
            ${card.cost ?? 0}
          </div>
        ` : ''}

        ${readinessBadge}
      </div>

      <!-- BOTTOM AREA: Lighter Shade Container (Name, Taxonomy, Stats) -->
      <div class="w-full h-[48%] ${style.lightBg} p-1.5 flex flex-col justify-between">
        
        <!-- Name & Taxonomy -->
        <div class="flex flex-col items-center justify-center text-center">
          <div class="text-[10px] font-black text-white leading-tight break-words text-center min-h-[22px] flex items-center justify-center">
            ${card.name}
          </div>
          <div class="text-[8px] font-bold text-slate-300 capitalize tracking-tighter truncate max-w-full">
            ${card.type} • ${card.genus || 'Generic'}
          </div>
        </div>

        <!-- Stats Bar (Units & Avatars) -->
        ${isUnit ? `
          <div class="flex justify-between items-end w-full pt-1">
            <!-- Strength (Yellow Circle - Bottom Left, omitted for Avatars) -->
            ${!isAvatar ? `
              <div class="w-5 h-5 rounded-full bg-yellow-500 border border-black text-black font-black text-[11px] flex items-center justify-center shadow" title="Strength">
                ${card.strength ?? 0}
              </div>
            ` : '<div></div>'}

            <!-- Armor (Blue Shield Badge - Bottom Center) -->
            ${(card.armor > 0) ? `
              <div class="w-5 h-5 rounded bg-cyan-600 border border-black text-white font-black text-[10px] flex items-center justify-center shadow" title="Armor: ${card.armor}">
                🛡️${card.armor}
              </div>
            ` : '<div></div>'}

            <!-- Health (Red Circle - Bottom Right) -->
            <div class="w-5 h-5 rounded-full bg-red-600 border border-black text-white font-black text-[11px] flex items-center justify-center shadow" title="Health">
              ${card.currentHealth ?? card.health ?? (isAvatar ? 20 : 1)}
            </div>
          </div>
        ` : `
          <div class="text-[8px] text-slate-400 text-center italic font-semibold">
            Double-click to inspect
          </div>
        `}
      </div>
    </div>
  `;
}

/**
 * Inspection Modal Renderer
 */
export function openInspectionModal(cardOrUnit) {
  let modal = document.getElementById('inspection-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'inspection-modal';
    modal.className = 'fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none';
    document.body.appendChild(modal);
  }

  const isUnit = cardOrUnit.type === 'unit' || cardOrUnit.type === 'avatar' || cardOrUnit.currentHealth !== undefined;
  const style = TRIBE_STYLES[cardOrUnit.tribe] || TRIBE_STYLES.Mythic;

  modal.innerHTML = `
    <div class="relative w-full max-w-md bg-slate-900 border-2 border-black rounded-xl p-6 shadow-2xl text-slate-100 flex flex-col gap-4">
      <button 
        onclick="document.getElementById('inspection-modal').classList.add('hidden')"
        class="absolute top-3 right-3 text-slate-400 hover:text-white text-xl font-bold w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700"
      >
        ✕
      </button>

      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-amber-500 text-black font-black text-xl flex items-center justify-center border border-black shadow">
          ${cardOrUnit.cost ?? 0}
        </div>
        <div>
          <h3 class="text-xl font-black tracking-wide text-white leading-tight">${cardOrUnit.name}</h3>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs px-2 py-0.5 rounded border font-extrabold ${style.bg} ${style.border} ${style.text}">${cardOrUnit.tribe}</span>
            <span class="text-xs text-slate-300 font-bold capitalize">${cardOrUnit.type} • ${cardOrUnit.genus || 'Generic'}</span>
          </div>
        </div>
      </div>

      ${isUnit ? `
        <div class="grid grid-cols-4 gap-2 bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-center">
          <div>
            <div class="text-[9px] text-slate-400 uppercase font-bold">Strength</div>
            <div class="text-lg font-black text-yellow-400">${cardOrUnit.strength ?? 0}</div>
          </div>
          <div>
            <div class="text-[9px] text-slate-400 uppercase font-bold">Armor</div>
            <div class="text-lg font-black text-cyan-400">${cardOrUnit.armor ?? 0}</div>
          </div>
          <div>
            <div class="text-[9px] text-slate-400 uppercase font-bold">Health</div>
            <div class="text-lg font-black text-red-500">${cardOrUnit.currentHealth ?? cardOrUnit.health ?? 20} / ${cardOrUnit.maxHealth ?? cardOrUnit.health ?? 20}</div>
          </div>
          <div>
            <div class="text-[9px] text-slate-400 uppercase font-bold">Readiness</div>
            <div class="text-xs font-bold ${cardOrUnit.readiness === 1 ? 'text-emerald-400' : cardOrUnit.readiness === 0 ? 'text-yellow-400' : 'text-red-400'}">
              ${cardOrUnit.readiness === 1 ? 'Ready' : cardOrUnit.readiness === 0 ? 'Unready' : 'Exhausted'}
            </div>
          </div>
        </div>
      ` : ''}

      <div class="bg-slate-950/60 rounded-xl p-4 border border-slate-800 text-sm leading-relaxed text-slate-300">
        <div class="font-bold text-slate-200 mb-1">Description:</div>
        <p>${cardOrUnit.description || 'No detailed text provided.'}</p>
        
        ${cardOrUnit.traits && cardOrUnit.traits.length > 0 ? `
          <div class="mt-3 flex flex-wrap gap-1">
            ${cardOrUnit.traits.map(t => `<span class="text-[10px] bg-slate-800 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800 font-extrabold">${t}</span>`).join('')}
          </div>
        ` : ''}
      </div>

      ${cardOrUnit.abilities && cardOrUnit.abilities.length > 0 ? `
        <div>
          <h4 class="text-xs uppercase font-extrabold text-slate-400 mb-2">Abilities & Triggers</h4>
          <div class="flex flex-col gap-2 max-h-40 overflow-y-auto">
            ${cardOrUnit.abilities.map(a => `
              <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                <div class="flex justify-between font-bold text-amber-300">
                  <span>${a.name || a.abilityId}</span>
                  <span class="text-[10px] bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded border border-amber-800 font-bold">${a.trigger || 'MANUAL'}</span>
                </div>
                <div class="text-slate-400 mt-1">${a.description || 'Executes effects on trigger.'}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
  modal.classList.remove('hidden');
}

/**
 * Replay Slider Bar
 */
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
