/**
   * Henchies 2 Shared UI Rendering Components, Modals & Toast System
   * 5:7 Ratio Physical Card Layout, Lighter Bottom Area, Double-Click Inspection, Armor Badge.
   */

  import { fetchCustomTribes } from './firebase.js';
  import { generateAbilityDescription } from './language_description.js';

  export const CARD_BASE_CLASSES = "w-[128px] h-[179px] sm:w-[144px] sm:h-[201px]";

  import { SVG_CLASS, SVG_EXHAUST, SVG_UNREADY, SVG_FREE, SVG_DAZED, SVG_STUNNED, SYSTEM_GLOSSARY, getSystemLineAbility, getIconSvg, getLineIconSvg } from './glossary.js';
  export { SVG_CLASS, SVG_EXHAUST, SVG_UNREADY, SVG_FREE, SVG_DAZED, SVG_STUNNED, SYSTEM_GLOSSARY, getSystemLineAbility, getIconSvg, getLineIconSvg };

  import '../components/game_card.js';
  import '../components/card_preview.js';

  export async function loadUI() {
      if (typeof document !== 'undefined' && !document.getElementById('raw-svg-styles')) {
          const style = document.createElement('style');
          style.id = 'raw-svg-styles';
          style.innerHTML = `
              @import url('https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700;900&display=swap');
              .font-roboto-condensed {
                  font-family: 'Roboto Condensed', sans-serif !important;
              }
          `;
          document.head.appendChild(style);
      }
  }

import { formatAbilityCostBadge, hasEngineFlag, formatCardText, renderCardHTML, computeAbilitiesData } from '../components/game_card.js';
export { formatAbilityCostBadge, hasEngineFlag, formatCardText, renderCardHTML, computeAbilitiesData };

export function extractGlossary(baseAbilities, allAbilitiesRegistry, cardText = '') {
    if (!allAbilitiesRegistry || allAbilitiesRegistry.length === 0) return [];
      
      let glossaryMap = new Map();
      let systemMap = new Map();
      let baseIds = new Set((baseAbilities || []).map(a => a.abilityId));

      if (baseAbilities) {
          baseAbilities.forEach(a => {
              // Automatically extract Evergreen Keywords into the Glossary, even if they aren't explicitly mentioned in text!
              if (a.isKeyword || a.trigger === 'UNTRIGGERABLE') {
                  if (!glossaryMap.has(a.abilityId) && a.name) {
                      glossaryMap.set(a.abilityId, a);
                  }
              }
          });
      }

      function processAbility(current) {
          if (!current) return;
          let text = (current.displayDescription || current.description || '');
          if (!text) {
              try { text = generateAbilityDescription(current, allAbilitiesRegistry); } catch (e) {}
          }

          const mentionRegex = /@\[(.*?)\]/g;
          let match;
          while ((match = mentionRegex.exec(text)) !== null) {
              const matchedName = match[1];
              const found = allAbilitiesRegistry.find(a => a.name.toLowerCase() === matchedName.toLowerCase());
              if (found && !glossaryMap.has(found.abilityId) && !baseIds.has(found.abilityId)) {
                  glossaryMap.set(found.abilityId, found);
                  processAbility(found);
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
                                  processAbility(found);
                              }
                          }
                          if (eff.nestedGroup && eff.nestedGroup.payloads) {
                              eff.nestedGroup.payloads.forEach(neff => {
                                  if (neff.type === 'GRANT_ABILITY') {
                                      const found = allAbilitiesRegistry.find(a => a.abilityId === neff.grantedAbilityId || a.name === neff.grantedAbilityId);
                                      if (found && !glossaryMap.has(found.abilityId) && !baseIds.has(found.abilityId)) {
                                          glossaryMap.set(found.abilityId, found);
                                          processAbility(found);
                                      }
                                  }
                              });
                          }
                      });
                  }
              });
          }

          SYSTEM_GLOSSARY.forEach(sys => {
              if (!systemMap.has(sys.id) && sys.regex.test(text)) {
                  systemMap.set(sys.id, sys);
              }
          });
      }

      if (baseAbilities) {
          baseAbilities.forEach(a => processAbility(a));
      }
      if (cardText) {
          processAbility({ displayDescription: cardText, abilityId: 'card_text_dummy' });
      }

      return [...Array.from(glossaryMap.values()), ...Array.from(systemMap.values())];
  }

  export function openInspectionModal(cardOrUnit, allAbilitiesRegistry = [], isNested = false, abilityUses = {}, isHand = false) {
    if (!window._inspectHistory) window._inspectHistory = [];
    if (!isNested) window._inspectHistory = [];
    
    const currentRef = cardOrUnit.instanceId || cardOrUnit.id || cardOrUnit.name;
    const lastInHistory = window._inspectHistory.length > 0 ? window._inspectHistory[window._inspectHistory.length - 1] : null;
    const lastRef = lastInHistory ? (lastInHistory.card.instanceId || lastInHistory.card.id || lastInHistory.card.name) : null;
    
    if (currentRef !== lastRef) {
        window._inspectHistory.push({ card: cardOrUnit, registry: allAbilitiesRegistry });
    }

    let modal = document.getElementById('inspection-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'inspection-modal';
      modal.className = 'fixed inset-0 z-[100] bg-black/20 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none';
      
      const handleBack = () => {
        if (window._inspectHistory && window._inspectHistory.length > 1) {
          window._inspectHistory.pop();
          const prev = window._inspectHistory[window._inspectHistory.length - 1];
          openInspectionModal(prev.card, prev.registry, true, abilityUses, isHand);
        } else {
          modal.classList.add('hidden');
          window._inspectHistory = [];
        }
      };

      window._handleModalBack = handleBack;
      modal.onclick = (e) => { if (e.target === modal) handleBack(); };
      modal.oncontextmenu = (e) => { if (e.target === modal) { e.preventDefault(); handleBack(); } };
      
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
          handleBack();
        }
      });
      
      document.body.appendChild(modal);
    }

    window.closeInspectionModal = () => {
      window._inspectHistory = [];
      const m = document.getElementById('inspection-modal');
      if (m) m.classList.add('hidden');
    };

    window._toggleGlossaryMode = () => {
      const chk = document.getElementById('glossary-toggle-chk');
      const newMode = chk.checked ? 'full' : 'essentials';
      localStorage.setItem('henchies_glossary_mode', newMode);
      
      const items = document.querySelectorAll('.glossary-item');
      items.forEach(el => {
          if (el.dataset.isSystem === 'true') {
              el.style.display = newMode === 'essentials' ? 'none' : 'flex';
          }
      });
    };

    window.inspectNestedCard = (cardJson) => {
      const card = JSON.parse(decodeURIComponent(cardJson));
      const currentRegistry = window._inspectHistory.length > 0 ? window._inspectHistory[window._inspectHistory.length - 1].registry : [];
      openInspectionModal(card, currentRegistry, true);
    };

    // Extract Glossary
    const glossaryAbilities = extractGlossary(cardOrUnit.abilities || [], allAbilitiesRegistry, cardOrUnit.description);
    
    const cardHtml = renderCardHTML(cardOrUnit, { size: 'jumbo', abilityUses: abilityUses, isHand: isHand });

    modal.innerHTML = `
      <!-- Close Button (Fixed Top Right) -->
      <button 
        onclick="window.closeInspectionModal()"
        class="fixed top-4 right-4 sm:top-6 sm:right-6 text-slate-400 hover:text-white text-xl font-bold w-10 h-10 rounded-full bg-slate-900/80 backdrop-blur flex items-center justify-center border border-slate-700 z-[60] shadow-2xl transition-transform hover:scale-110 pointer-events-auto"
      >✕</button>

      <div class="w-full h-full max-w-[1400px] text-slate-100 flex flex-col md:flex-row items-center justify-center gap-8 pointer-events-none mx-auto" onclick="if(event.target === this) window._handleModalBack()">
        
        <!-- LEFT SPACER (Forces card to perfect center) -->
        <div class="hidden md:block md:w-[350px] shrink-0 pointer-events-none" onclick="if(event.target === this) window._handleModalBack()"></div>

        <!-- CENTER: The Giant 5x7 Card Layout -->
        <div class="flex items-center justify-center pointer-events-auto shrink-0">
          ${cardHtml}
        </div>

        <!-- RIGHT COLUMN: Recursive Glossary Bubbles -->
        <div class="w-full md:w-[350px] flex flex-col h-[75vh] min-h-[450px] max-h-[750px] pointer-events-auto shrink-0" onclick="if(event.target === this) window._handleModalBack()">
          
          <!-- Fixed Sticky Header -->
          <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-700/50 shrink-0">
             <span class="text-xs font-black text-slate-400 uppercase tracking-widest">Glossary</span>
             <label class="relative inline-flex items-center cursor-pointer" title="Toggle System Definitions">
               <input type="checkbox" id="glossary-toggle-chk" onchange="window._toggleGlossaryMode()" class="sr-only peer" ${localStorage.getItem('henchies_glossary_mode') !== 'essentials' ? 'checked' : ''}>
               <div class="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
               <span id="glossary-toggle-label" class="ml-2 text-[10px] font-bold text-slate-300 whitespace-nowrap">Full Glossary</span>
             </label>
          </div>
          
          <!-- Scrollable Items List -->
          <div class="flex-1 overflow-y-auto minimal-scrollbar pr-2 pb-8" onclick="if(event.target === this) window._handleModalBack()">
            ${glossaryAbilities.length > 0 ? `
              <div class="flex flex-col gap-3">
                ${glossaryAbilities.map(a => {
                  const isSystem = a.id && a.id.startsWith('sys_');
                  const displayStyle = localStorage.getItem('henchies_glossary_mode') === 'essentials' && isSystem ? 'none' : 'flex';
                  let rawDesc = a.displayDescription || a.description || '';
                  if (!rawDesc) {
                      try { rawDesc = generateAbilityDescription(a, allAbilitiesRegistry); } catch (e) {}
                  }
                  return `
                  <div class="glossary-item bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-2xl flex-col gap-1.5 transform transition-transform hover:scale-[1.02]" data-is-system="${isSystem}" style="display: ${displayStyle};">
                    <div class="flex justify-between items-center border-b border-slate-700/50 pb-1.5">
                        <div class="font-black text-fuchsia-300 text-sm drop-shadow-md">${a.name || a.abilityId || a.id}</div>
                        <span class="text-[9px] bg-slate-950 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-bold uppercase tracking-wider">${a.trigger || 'MANUAL'}</span>
                    </div>
                    <div class="text-slate-200 text-xs leading-snug">${rawDesc || 'No details.'}</div>
                  </div>
                `}).join('')}
              </div>
            ` : ''}
          </div>
        </div>

      </div>
    `;
    modal.classList.remove('hidden');
  }

  export function renderHistorySlider(container, historyLog, currentStep, onStepChange, label = "Replay Scrub:") {
    if (!container) return;

    container.innerHTML = `
      <div class="flex items-center gap-3 bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2 shadow-xl backdrop-blur-md">
        <span class="text-xs font-black text-amber-400 uppercase tracking-wider">${label}</span>
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

  export function renderJSONPreview(containerId, jsonObject, copyCallbackName, title = "Data Structure Preview") {
      const container = document.getElementById(containerId);
      if (!container) return;
      
      container.innerHTML = `
        <div class="glass-panel rounded-2xl p-4 flex flex-col gap-2 shadow-2xl border border-slate-800 w-full h-full relative flex-1">
          <div class="flex justify-between items-center border-b border-slate-800 pb-1 shrink-0">
            <h2 class="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              ${title}
            </h2>
            <button type="button" onclick="window.${copyCallbackName}()" class="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded transition shadow font-bold border border-slate-600">
              📋 Copy JSON
            </button>
          </div>
          <div class="flex-1 w-full overflow-y-auto minimal-scrollbar bg-slate-950/80 rounded-lg border border-slate-900 shadow-inner p-3 relative">
              <pre id="${containerId}-pre" class="text-[10px] text-cyan-400 font-mono m-0 leading-tight w-full break-all whitespace-pre-wrap selection:bg-cyan-900/50">${JSON.stringify(jsonObject, null, 2)}</pre>
          </div>
        </div>
      `;
  }

  export function openJSONImportModal(onImport) {
  let modal = document.getElementById('json-import-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'json-import-modal';
    modal.className = 'fixed inset-0 z-[120] bg-black/60 backdrop-blur-md flex items-center justify-center p-4';
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
        console.error("Failed to parse JSON for import", e);
        showToast("Invalid JSON data.", "error");
    }
  };
}

export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[150] flex flex-col gap-2 pointer-events-none max-w-md w-full px-4 items-center';
      document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-cyan-600 text-white',
    warning: 'bg-amber-600 text-black'
  };
  const colorClass = bgColors[type] || bgColors.info;
  toast.className = `${colorClass} px-4 py-2 rounded-xl shadow-2xl text-xs font-bold pointer-events-auto transition-all duration-300 z-[150] opacity-0 translate-y-[-1rem]`;
  toast.innerText = message;
  container.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  // Animate out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-1rem)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}