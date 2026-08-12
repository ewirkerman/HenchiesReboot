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

  export const CARD_BASE_CLASSES = "w-[128px] h-[179px] sm:w-[144px] sm:h-[201px]";

  import { SVG_CLASS, SVG_EXHAUST, SVG_UNREADY, SVG_FREE, SVG_DAZED, SVG_STUNNED, SYSTEM_GLOSSARY } from './glossary.js';
  export { SVG_CLASS, SVG_EXHAUST, SVG_UNREADY, SVG_FREE, SVG_DAZED, SVG_STUNNED, SYSTEM_GLOSSARY };

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
    if (carnieCost > 0) badgeStr += `${carnieCost}<span class="inline-block w-[11px] h-[11px] align-middle ml-px mr-0.5 text-purple-400 drop-shadow-sm">${getIconSvg('tent')}</span>`;
    if (cost.power > 0) badgeStr += `${cost.power}⚡`;
        if (cost.tribeAmount > 0) {
            const tType = cost.tribeType || cardTribe || 'Generic';
            if (tType && tType !== 'NONE' && tType !== 'Generic') {
                badgeStr += `${cost.tribeAmount}${tType.charAt(0)}`;
            } else {
                badgeStr += `${cost.tribeAmount}💎`;
            }
        }
        
        if (cost.readinessCost === 'EXHAUSTS') badgeStr += SVG_EXHAUST;
        if (cost.readinessCost === 'UNREADIES') badgeStr += SVG_UNREADY;
        if (cost.freeAction) badgeStr += SVG_FREE;
        
        return badgeStr.trim() ? `<span class="text-[9px] text-amber-300 font-bold ml-1 tracking-tighter whitespace-nowrap opacity-90">[${badgeStr}]</span>` : '';
      }

      export function getIconSvg(icon) {
          const svgs = {
              attack: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full"><path d="m2.75 9.25 1.5 2.5 2 1.5m-4.5 0 1 1m1.5-2.5-1.5 1.5m3-1 8.5-8.5v-2h-2l-8.5 8.5"/><path d="M10.25 12.25 8 10m2-2 2.25 2.25m1-1-1.5 2.5-2 1.5m4.5 0-1 1m-1.5-2.5 1.5 1.5M6 8 1.75 3.75v-2h2L8 6"/></svg>`,
              armor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>`,
              fast: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>`,
              attach: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>`,
              'hourglass-empty': `<svg viewBox="-32 -32 320 320" class="w-full h-full fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M200 75.641V40a16.02 16.02 0 0 0-16-16H72a16.02 16.02 0 0 0-16 16v36a16.08 16.08 0 0 0 6.4 12.8l52.267 39.2L62.4 167.2a16.06 16.06 0 0 0-6.348 11.923A8 8 0 0 0 56 180v36a16.02 16.02 0 0 0 16 16h112a16.02 16.02 0 0 0 16-16v-35.641a8 8 0 0 0-.053-.893 16.07 16.07 0 0 0-6.299-11.87L141.267 128l52.381-39.595A16.09 16.09 0 0 0 200 75.641M82.597 172.052l45.384-34.038 45.366 34.293ZM184 75.642l-56.019 42.344L72 76V40h112Z"/></svg>`,
              'hourglass-full': `<svg viewBox="-32 -32 320 320" class="w-full h-full fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M200 75.641V40a16.02 16.02 0 0 0-16-16H72a16.02 16.02 0 0 0-16 16v36a16.08 16.08 0 0 0 6.4 12.8l52.267 39.2L62.4 167.2A16.08 16.08 0 0 0 56 180v36a16.02 16.02 0 0 0 16 16h112a16.02 16.02 0 0 0 16-16v-35.641a16.09 16.09 0 0 0-6.352-12.764L141.267 128l52.381-39.595A16.09 16.09 0 0 0 200 75.641M184 40v23.996H72V40Zm0 176H72v-36l55.981-41.986L184 180.36Z"/></svg>`,
              tent: `<svg viewBox="0 0 24 24" class="w-full h-full fill-current" xmlns="http://www.w3.org/2000/svg"><defs><mask id="tent-mask"><path fill="#fff" d="M0 0h24v24H0z"/><path d="M16.93 20.63 13.86 13a2 2 0 0 0-3.72 0l-3.07 7.63A1 1 0 0 0 8 22h8a1 1 0 0 0 .93-1.37"/></mask></defs><path d="M21.2 8c-4.58-.92-8.38-5.6-8.42-5.64a1 1 0 0 0-1.56 0S7.38 7.1 2.8 8a1 1 0 0 0 .4 2c.23-.05.45-.13.68-.19l-.79 10.03a2 2 0 0 0 2 2.16h13.83a2 2 0 0 0 2-2.16l-.79-10c.23.06.45.14.68.19h.2a1 1 0 0 0 .2-2Z" mask="url(#tent-mask)"/></svg>`
          };
          return svgs[icon] || '';
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

  const hasEngineFlag = (card, flag) => {
      if (!card) return false;
      if (card.passiveFlags && card.passiveFlags.includes(flag)) return true;
      if (card.abilities && card.abilities.some(a => a.passiveFlags && a.passiveFlags.includes(flag))) return true;
      if (card.activeEffects && card.activeEffects.some(e => e.type === flag)) return true;
      return false;
  };

  export function renderCardHTML(card, options = {}) {
    const { isHand = false, isSelected = false, isTargetable = false, readiness = null, onClick = '', onInspect = '', isMicro = false, isNano = false } = options;
    const style = TRIBE_STYLES[card.tribe] || TRIBE_STYLES.Mythic;
    const isUnit = card.type === 'unit' || card.type === 'avatar';
    const isAvatar = card.type === 'avatar';
    const isToken = !!card.isToken;
    const activeLine = card.line || card.defaultLine || (isAvatar ? 'avatar' : 'mid');
    const isTempLine = card.line && card.defaultLine && card.line !== card.defaultLine;

    const separatorClass = isToken ? 'border-white/40' : 'border-black';

    // Only show giant overlays and dimming for temporary status effects, not inherent native passive flags (like Mindless)
    const isStatusApplied = (targetCard, flag, statusNames) => {
        if (targetCard.activeEffects && targetCard.activeEffects.some(e => e.type === flag)) return true;
        if (targetCard.abilities && targetCard.abilities.some(a => statusNames.includes((a.name || '').toLowerCase()))) return true;
        return false;
    };

    const isStunned = isStatusApplied(card, 'BLOCK_ACT', ['stun', 'stunned']);
    const isDazed = isStatusApplied(card, 'BLOCK_RETALIATE', ['daze', 'dazed']) && !isStunned;
    const isHidden = hasEngineFlag(card, 'BLOCK_TARGETING');

    let dynamicBorderClass = isToken ? 'border-2 border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : `border-2 ${style.border}`;
    if (isHidden && !isHand) dynamicBorderClass = 'border-2 border-dashed border-white/80 shadow-[0_0_12px_rgba(255,255,255,0.4)]';

    const hasReadiness = isUnit || card.type === 'equipment' || card.type === 'artifact';
    const isFieldUnready = !isHand && hasReadiness && readiness !== null && readiness === 0;
    const isFieldExhausted = !isHand && hasReadiness && readiness !== null && readiness < 0;
    const isFieldOverReady = !isHand && hasReadiness && readiness !== null && readiness > 1;
    const fieldDimmingClass = (isFieldUnready || isFieldExhausted || isStunned || isDazed) ? 'saturate-[0.25] opacity-90' : '';
    const hiddenClass = isHidden && !isHand ? 'opacity-60 hover:opacity-100' : '';

    let overlayContent = '';
    let isOverReadyOverlay = false;

    if (isStunned) overlayContent = SVG_STUNNED;
    else if (isDazed) overlayContent = SVG_DAZED;
    else if (isFieldExhausted) overlayContent = getIconSvg('hourglass-full');
    else if (isFieldUnready) overlayContent = getIconSvg('hourglass-empty');
    else if (isFieldOverReady) {
        overlayContent = getIconSvg('hourglass-full');
        isOverReadyOverlay = true;
    }

    let overlayHTML = '';
    let overlayScaleClass = isDazed ? 'scale-75' : '';
    if (overlayContent) {
        if (isOverReadyOverlay) {
            overlayHTML = `
              <div class="absolute inset-0 z-40 flex items-center justify-center pointer-events-none rounded-md">
                <div class="w-16 h-16 ${overlayScaleClass} opacity-60 drop-shadow-[0_0_8px_rgba(134,239,172,0.9)] [&>svg]:!w-full [&>svg]:!h-full [&>svg]:!m-0 [&>svg]:!text-green-400 [&>svg]:!drop-shadow-none">
                  ${overlayContent}
                </div>
              </div>
            `;
        } else {
            overlayHTML = `
              <div class="absolute inset-0 z-40 flex items-center justify-center pointer-events-none bg-black/30 rounded-md">
                <div class="w-16 h-16 ${overlayScaleClass} text-white opacity-80 drop-shadow-[0_2px_8px_rgba(0,0,0,1)] [&>svg]:!w-full [&>svg]:!h-full [&>svg]:!m-0">
                  ${overlayContent}
                </div>
              </div>
            `;
        }
    }

    const readinessBadge = (hasReadiness && readiness !== null) ? `
      <div class="absolute top-1 right-1 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider z-20 ${
        readiness >= 1 ? 'bg-emerald-500 text-black' : 
        readiness === 0 ? 'bg-yellow-500 text-black' : 'bg-red-950 text-red-400 border border-red-700'
      }">
        ${readiness > 1 ? 'OVER-READY' : readiness === 1 ? 'READY' : readiness === 0 ? 'UNREADY' : 'EXHAUSTED'}
      </div>
    ` : '';

    const inspectButton = onInspect ? `
      <button 
        onclick="event.stopPropagation(); ${onInspect}"
        class="absolute ${(isMicro || isNano) ? 'top-6 right-1 w-4 h-4 text-[8px]' : (readiness !== null ? 'top-6 right-1 w-6 h-6 text-[10px]' : 'top-1 right-1 w-6 h-6 text-[10px]')} rounded-full bg-slate-900/80 hover:bg-slate-700 text-white font-black flex items-center justify-center border border-slate-500 shadow-lg z-30 transition-colors backdrop-blur-sm"
        title="Inspect Card"
      >
        🔍
      </button>
    ` : '';

    const fastBadge = (card.fast > 0) ? `
      <div class="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-yellow-400 border border-black text-black font-black text-[10px] flex items-center justify-center shadow-lg z-30" title="Fast Charges">
        <div class="w-3 h-3 mr-0.5">${getIconSvg('fast')}</div>${card.fast}
      </div>
    ` : '';

    const attachmentsBadge = (card.attachments && card.attachments.length > 0) ? `
      <div class="absolute -top-1.5 -left-1.5 w-6 h-6 rounded bg-fuchsia-600 border border-black text-white font-black text-[10px] flex items-center justify-center shadow-lg z-30" title="Attachments">
        <div class="w-3 h-3 mr-0.5">${getIconSvg('attach')}</div>${card.attachments.length}
      </div>
    ` : '';

    const rightClickAttr = onInspect ? `oncontextmenu="event.preventDefault(); event.stopPropagation(); ${onInspect}"` : '';

    let hoverTooltip = card.name || 'Unknown Card';
    if (card.description) hoverTooltip += `\n"${card.description}"`;

    let abilitiesHTML = '';
    if (card.abilities && card.abilities.length > 0) {
        abilitiesHTML = card.abilities.map(ab => {
            const isAttack = ab.effects && ab.effects.some(g => g.payloads && g.payloads.some(p => p.type === 'ATTACK'));
            
            const abilityKey = `${card.instanceId}_${ab.abilityId}`;
            const uses = (options.abilityUses || {})[abilityKey] || 0;
            let isUsable = true;
            if (ab.triggerLimit === 'ONCE_PER_ROUND' && uses >= 1) isUsable = false;
            if (ab.triggerLimit === 'TWICE_PER_ROUND' && uses >= 2) isUsable = false;

            const isBlockedAct = hasEngineFlag(card, 'BLOCK_ACT');
            const isBlockedAttack = hasEngineFlag(card, 'BLOCK_ATTACK') || isBlockedAct;

            if (isAttack && isBlockedAttack) isUsable = false;
            
            if (ab.trigger === 'MANUAL') {
                if (!isAttack && isBlockedAct) isUsable = false;
                
                if (isUsable) {
                    const cost = ab.cost || {};
                    // UI explicitly ignores readiness when graying out abilities
                    if (!cost.freeAction && !isAttack && (card.acts === undefined || card.acts < 1)) isUsable = false;
                }
            }

            if (options.isHand) isUsable = true;

            const iconContent = isAttack ? `<span class="inline-block w-2.5 h-2.5 align-middle mr-0.5">${getIconSvg('attack')}</span>` : '';
            const hourglassIcon = !isUsable ? `<span class="inline-block w-2.5 h-2.5 align-middle mr-0.5 text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.8)]">${getIconSvg('hourglass-full')}</span>` : '';
            
            const textColorClass = isUsable ? 'text-slate-200' : 'text-slate-500 opacity-80';
            const nameColorClass = isUsable ? '' : 'text-slate-500';
            
            return `
              <div class="text-[9px] ${textColorClass} font-bold leading-tight truncate w-full text-center">
                <span>${hourglassIcon}${iconContent}<span class="${nameColorClass}">${ab.name || 'Unknown'}</span></span>${formatAbilityCostBadge(ab.cost, card.tribe)}
              </div>
            `;
        }).filter(Boolean).join('');
    }
    hoverTooltip += `\n\n(Right-click or tap 🔍 to inspect fully)`;
    const safeTooltip = hoverTooltip.replace(/"/g, '&quot;').replace(/'/g, '&apos;');

    if (isNano) {
      return `
        <div 
          onclick="${onClick}"
          ${rightClickAttr}
          title="${safeTooltip}"
          class="group relative flex-shrink-0 w-[64px] sm:w-[72px] h-[64px] rounded-md ${style.bg} ${dynamicBorderClass} ${isSelected ? 'ring-2 ring-yellow-400 scale-105 z-20' : ''} ${isTargetable ? 'ring-2 ring-cyan-400 animate-pulse z-20 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.6)]' : ''} cursor-pointer hover:scale-110 transition-all duration-200 flex flex-col justify-between select-none overflow-hidden shadow-md ${hiddenClass}"
        >
          <div class="absolute inset-0 z-0 ${fieldDimmingClass}">
            ${card.artUrl ? `<img src="${card.artUrl}" class="w-full h-full object-cover opacity-75" style="object-position: ${card.artX ?? 50}% ${card.artY ?? 50}%;" draggable="false" />` : ''}
          </div>
          <div class="relative z-10 w-full h-full p-1 flex flex-col justify-between bg-gradient-to-t from-black/95 via-transparent to-black/85 ${fieldDimmingClass}">
            <div class="flex items-start justify-between w-full relative z-20">
              ${!isAvatar ? `<div class="w-4 h-4 rounded-full bg-amber-500 text-black font-black text-[9px] flex items-center justify-center border border-black shadow pointer-events-auto shrink-0">${card.cost ?? 0}</div>` : '<div></div>'}
              ${(hasReadiness && readiness !== null) ? `
                <div class="w-2.5 h-2.5 rounded-full ${readiness >= 1 ? 'bg-emerald-500' : readiness === 0 ? 'bg-yellow-500' : 'bg-red-600'} border border-black shadow z-20"></div>
              ` : ''}
            </div>
            ${!card.artUrl ? `
            <div class="absolute inset-0 flex items-center justify-center p-1 pointer-events-none z-10">
              <span class="text-[9px] font-bold text-white text-center leading-tight drop-shadow-[0_2px_2px_rgba(0,0,0,1)] break-words w-full px-1">${card.name}</span>
            </div>
            ` : ''}
            ${isUnit ? `
              <div class="flex justify-between items-end w-full mt-auto relative z-20">
                ${(!isAvatar && card.strength !== undefined && card.strength !== null) ? `<div class="text-yellow-400 font-black text-[11px] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">${Math.max(0, card.strength)}</div>` : '<div></div>'}
                <div class="text-red-400 font-black text-[11px] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">${card.currentHealth ?? card.health ?? (isAvatar ? 20 : 1)}</div>
              </div>
            ` : ''}
          </div>
          ${overlayHTML}
          ${inspectButton}
        </div>
      `;
    }

    if (isMicro) {
      return `
        <div 
          onclick="${onClick}"
          ${rightClickAttr}
          title="${safeTooltip}"
          class="group relative flex-shrink-0 w-[128px] sm:w-[144px] h-[64px] rounded-md ${style.bg} ${dynamicBorderClass} ${isSelected ? 'ring-2 ring-yellow-400 scale-105 z-20' : ''} ${isTargetable ? 'ring-2 ring-cyan-400 animate-pulse z-20 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.6)]' : ''} cursor-pointer hover:scale-105 transition-all duration-200 flex flex-col justify-between select-none overflow-hidden shadow-md ${hiddenClass}"
        >
          <div class="absolute inset-0 z-0 ${fieldDimmingClass}">
            ${card.artUrl ? `<img src="${card.artUrl}" class="w-full h-full object-cover opacity-75" style="object-position: ${card.artX ?? 50}% ${card.artY ?? 50}%;" draggable="false" />` : ''}
          </div>
          <div class="relative z-10 w-full h-full p-1.5 flex flex-col justify-between bg-gradient-to-t from-black/95 via-transparent to-black/85 ${fieldDimmingClass}">
            <div class="flex items-center gap-1.5 w-full pr-6">
              ${!isAvatar ? `<div class="w-4 h-4 rounded-full bg-amber-500 text-black font-black text-[9px] flex items-center justify-center border border-black shadow pointer-events-auto shrink-0">${card.cost ?? 0}</div>` : ''}
              <div class="text-white text-[11px] font-black truncate drop-shadow-md leading-tight w-full">${card.name}</div>
            </div>
            ${isUnit ? `
              <div class="flex justify-between items-end w-full px-0.5 mt-auto">
                ${(!isAvatar && card.strength !== undefined && card.strength !== null) ? `<div class="w-5 h-5 rounded-full bg-yellow-500 border border-black text-black font-black text-[10px] flex items-center justify-center shadow">${Math.max(0, card.strength)}</div>` : '<div></div>'}
                ${(card.armor > 0) ? `<div class="w-5 h-5 rounded bg-cyan-600 border border-black text-white font-black text-[9px] flex items-center justify-center shadow"><div class="w-2.5 h-2.5 mr-0.5">${getIconSvg('armor')}</div>${card.armor}</div>` : '<div></div>'}
                <div class="w-5 h-5 rounded-full bg-red-600 border border-black text-white font-black text-[10px] flex items-center justify-center shadow">${card.currentHealth ?? card.health ?? (isAvatar ? 20 : 1)}</div>
              </div>
            ` : ''}
          </div>
          ${(hasReadiness && readiness !== null) ? `
            <div class="absolute top-1 right-1 text-[7px] px-1 py-0.5 rounded font-black uppercase z-20 ${
              readiness >= 1 ? 'bg-emerald-500 text-black' : 
              readiness === 0 ? 'bg-yellow-500 text-black' : 'bg-red-950 text-red-400 border border-red-700'
            }">
              ${readiness > 1 ? 'OVR-RDY' : readiness === 1 ? 'RDY' : readiness === 0 ? 'UNRDY' : 'EXH'}
            </div>
          ` : ''}
          ${(card.attachments && card.attachments.length > 0) ? `
            <div class="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded bg-fuchsia-600 border border-black text-white font-black text-[8px] flex items-center justify-center z-30 shadow"><div class="w-2.5 h-2.5 mr-px">${getIconSvg('attach')}</div>${card.attachments.length}</div>
          ` : ''}
          ${overlayHTML}
          ${inspectButton}
        </div>
      `;
    }

    return `
      <div 
        onclick="${onClick}"
        ${rightClickAttr}
        title="${safeTooltip}"
        class="group relative flex-shrink-0 ${CARD_BASE_CLASSES} rounded-xl ${style.bg} ${dynamicBorderClass} ${isSelected ? 'ring-4 ring-yellow-400 scale-105 z-20' : ''} ${isTargetable ? 'ring-4 ring-cyan-400 animate-pulse z-20 cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.6)]' : ''} cursor-pointer hover:scale-105 transition-all duration-200 flex flex-col select-none overflow-hidden ${hiddenClass}"
      >
        <div class="absolute inset-0 opacity-10 mix-blend-overlay ${fieldDimmingClass}"></div>
        
        <div class="w-full h-1/2 bg-slate-900 border-b-2 ${separatorClass} shrink-0 relative overflow-hidden ${fieldDimmingClass}">
          ${card.artUrl ? `<img src="${card.artUrl}" class="w-full h-full object-cover" style="object-position: ${card.artX ?? 50}% ${card.artY ?? 50}%;" draggable="false" />` : ''}
          <div class="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[90%] flex justify-center z-30 pointer-events-none">
            <div class="bg-black/20 backdrop-blur-sm text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full truncate text-center max-w-full shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-tight uppercase tracking-wide">
              ${card.name}
            </div>
          </div>
        </div>

        <div class="w-full h-1/2 ${style.lightBg} p-1.5 sm:p-2 flex flex-col relative overflow-hidden ${fieldDimmingClass}">
          ${isToken ? '<div class="absolute inset-0 bg-white/5 pointer-events-none"></div>' : ''}
          
          <div class="flex-1 flex flex-col gap-0.5 overflow-hidden w-full relative z-10 pointer-events-none pt-0.5">
            ${abilitiesHTML}
          </div>

          ${isUnit ? `
            <div class="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between items-end pointer-events-none">
              ${(!isAvatar && card.strength !== undefined && card.strength !== null) ? `
                <div class="w-6 h-6 rounded-full bg-yellow-500 border border-black text-black font-black text-[11px] flex items-center justify-center shadow" title="Strength">${Math.max(0, card.strength)}</div>
              ` : '<div></div>'}
              ${(card.armor > 0) ? `
                <div class="w-6 h-6 rounded bg-cyan-600 border border-black text-white font-black text-[10px] flex items-center justify-center shadow" title="Armor: ${card.armor}"><div class="w-3 h-3 mr-0.5">${getIconSvg('armor')}</div>${card.armor}</div>
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
          ${card.power > 0 ? `
            <div class="w-7 h-7 rounded-full bg-purple-600 text-white font-black text-[12px] flex items-center justify-center border border-black shadow pointer-events-auto" title="Power">
              ${card.power}
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

  function extractGlossary(baseAbilities, allAbilitiesRegistry, cardText = '') {
      if (!allAbilitiesRegistry || allAbilitiesRegistry.length === 0) return [];
      
      let glossaryMap = new Map();
      let systemMap = new Map();
      let baseIds = new Set((baseAbilities || []).map(a => a.abilityId));

      function processAbility(current) {
          if (!current) return;
          const text = (current.displayDescription || current.description || '');

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

    const isUnit = cardOrUnit.type === 'unit' || cardOrUnit.type === 'avatar' || cardOrUnit.currentHealth !== undefined;
    const isAvatar = cardOrUnit.type === 'avatar';
    const isToken = !!cardOrUnit.isToken;
    const style = TRIBE_STYLES[cardOrUnit.tribe] || TRIBE_STYLES.Mythic;
    const activeLine = cardOrUnit.line || cardOrUnit.defaultLine || (isAvatar ? 'avatar' : 'mid');
    const isTempLine = cardOrUnit.line && cardOrUnit.defaultLine && cardOrUnit.line !== cardOrUnit.defaultLine;
    const hasReadiness = isUnit || cardOrUnit.type === 'equipment' || cardOrUnit.type === 'artifact';
    
    const isHidden = hasEngineFlag(cardOrUnit, 'BLOCK_TARGETING');

    let inspectBorderClass = isToken ? 'border-white/50 shadow-[0_0_24px_rgba(255,255,255,0.25)]' : style.border;
    if (isHidden && !isHand) inspectBorderClass = 'border-dashed border-white/80 shadow-[0_0_15px_rgba(255,255,255,0.4)]';
    
    const separatorClass = isToken ? 'border-white/40' : 'border-black';
    
    // Extract Glossary
    const glossaryAbilities = extractGlossary(cardOrUnit.abilities || [], allAbilitiesRegistry, cardOrUnit.description);

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
          <div class="relative h-[75vh] min-h-[450px] max-h-[750px] aspect-[5/7] rounded-2xl overflow-hidden border-4 ${inspectBorderClass} shadow-2xl flex flex-col shrink-0 ${style.bg} transition-transform duration-300">
            
            <!-- Top Half: Art & Cost (50%) -->
            <div class="relative w-full h-[50%] bg-slate-900 border-b-2 ${separatorClass} shrink-0 overflow-hidden">
              ${cardOrUnit.artUrl ? `<img src="${cardOrUnit.artUrl}" alt="${cardOrUnit.name}" class="w-full h-full object-cover" style="object-position: ${cardOrUnit.artX ?? 50}% ${cardOrUnit.artY ?? 50}%;" draggable="false" />` : `
                <div class="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400 text-6xl font-bold">
                  ${cardOrUnit.type === 'unit' ? '⚔️' : cardOrUnit.type === 'avatar' ? '👑' : cardOrUnit.type === 'boon' ? '✨' : cardOrUnit.type === 'buff' ? '🛡️' : '📜'}
                </div>
              `}
              
              <div class="absolute bottom-2 left-1/2 -translate-x-1/2 w-[90%] flex justify-center z-30 pointer-events-none">
                <div class="bg-black/20 backdrop-blur-sm text-white text-xl sm:text-2xl font-black px-4 py-1 rounded-full truncate text-center max-w-full shadow-[0_4px_8px_rgba(0,0,0,0.8)] leading-tight uppercase tracking-wide border-none">
                    ${cardOrUnit.name}
                </div>
              </div>

              <div class="absolute top-3 left-3 flex flex-col items-center gap-2 z-10">
                ${!isAvatar ? `
                  <div class="w-12 h-12 rounded-full bg-amber-500 text-black font-black text-2xl flex items-center justify-center border-2 border-black shadow-lg" title="Cost">
                    ${cardOrUnit.cost ?? 0}
                  </div>
                ` : ''}
                ${cardOrUnit.power > 0 ? `
                  <div class="w-12 h-12 rounded-full bg-purple-600 text-white font-black text-2xl flex items-center justify-center border-2 border-black shadow-lg" title="Power">
                    ${cardOrUnit.power}
                  </div>
                ` : ''}
                ${isUnit ? `
                  <div class="w-8 h-8 flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isTempLine ? 'text-green-300 drop-shadow-[0_0_8px_rgba(134,239,172,0.9)]' : 'text-white'}" title="${isTempLine ? 'Temporary Line: ' : 'Line: '}${activeLine.charAt(0).toUpperCase() + activeLine.slice(1)}">
                    ${getLineIconSvg(activeLine)}
                  </div>
                ` : ''}
                ${(cardOrUnit.fast > 0) ? `
                  <div class="w-8 h-8 rounded-full bg-yellow-400 text-black font-black text-sm flex items-center justify-center border-2 border-black shadow-lg mt-1" title="Fast Charges">
                    <div class="w-4 h-4 mr-0.5">${getIconSvg('fast')}</div>${cardOrUnit.fast}
                  </div>
                ` : ''}
              </div>

              ${(hasReadiness && cardOrUnit.readiness !== undefined && cardOrUnit.readiness !== null) ? `
                <div class="absolute top-3 right-3 text-sm px-2.5 py-1 rounded-md font-black uppercase tracking-wider z-20 border-2 border-black shadow-lg ${
                  cardOrUnit.readiness >= 1 ? 'bg-emerald-500 text-black' : 
                  cardOrUnit.readiness === 0 ? 'bg-yellow-500 text-black' : 'bg-red-950 text-red-400 border-red-700'
                }">
                  ${cardOrUnit.readiness > 1 ? 'OVER-READY' : cardOrUnit.readiness === 1 ? 'READY' : cardOrUnit.readiness === 0 ? 'UNREADY' : 'EXHAUSTED'}
                </div>
              ` : ''}
            </div>

            <!-- Bottom Half: Details & Abilities (50%) -->
            <div class="w-full h-[50%] ${style.lightBg} p-2 sm:p-3 flex flex-col relative overflow-hidden">
              ${isToken ? '<div class="absolute inset-0 bg-white/5 pointer-events-none"></div>' : ''}
              
              <!-- Type Band -->
              <div class="flex justify-center pb-1 shrink-0 mb-1 z-10 pointer-events-none relative">
                <div class="text-[10px] font-bold text-slate-200 capitalize tracking-wider bg-black/40 px-3 py-0.5 rounded-full shadow-inner">
                  ${cardOrUnit.tribe} • ${cardOrUnit.type}${cardOrUnit.genus ? ` • ${cardOrUnit.genus}` : ''}${cardOrUnit.family ? ` • ${cardOrUnit.family}` : ''}
                </div>
              </div>

              <!-- Scrollable Traits & Abilities Box -->
              <div class="flex-1 flex flex-col gap-1.5 overflow-y-auto pb-16 minimal-scrollbar pr-1 pointer-events-auto relative z-10">

                <!-- Attachments -->
                ${cardOrUnit.attachments && cardOrUnit.attachments.length > 0 ? `
                  <div class="flex flex-wrap justify-center gap-1.5 mt-1">
                    ${cardOrUnit.attachments.map(a => {
                      const aJson = encodeURIComponent(JSON.stringify(a)).replace(/'/g, "%27");
                      let rBadge = '';
                      if (a.readiness !== undefined && a.readiness < 1) {
                          rBadge = a.readiness < 0 ? '<span class="text-red-400 ml-1 drop-shadow-md">[EXH]</span>' : '<span class="text-yellow-400 ml-1 drop-shadow-md">[UNRDY]</span>';
                      }
                      return `<span oncontextmenu="event.preventDefault(); event.stopPropagation(); window.inspectNestedCard('${aJson}')" onclick="event.stopPropagation(); window.inspectNestedCard('${aJson}')" class="text-xs sm:text-sm bg-fuchsia-950/80 text-fuchsia-200 px-2 py-1 rounded border border-fuchsia-800 font-extrabold uppercase tracking-wider shadow-sm cursor-pointer hover:bg-fuchsia-900 transition-colors flex items-center" title="Inspect ${a.name}"><div class="w-3.5 h-3.5 mr-1">${getIconSvg('attach')}</div> ${a.name}${rBadge}</span>`;
                    }).join('')}
                  </div>
                ` : ''}

                <!-- Full Abilities with Registry Lookup -->
                ${cardOrUnit.abilities && cardOrUnit.abilities.length > 0 ? `
                  <div class="flex flex-col gap-2 mt-1">
                    ${cardOrUnit.abilities.map(a => {
                      const regMatch = allAbilitiesRegistry.find(reg => reg.abilityId === a.abilityId) || a;
                      let finalDesc = regMatch.displayDescription || regMatch.description || 'Executes effects on trigger.';
                      if (cardOrUnit.type === 'spell') {
                          finalDesc = finalDesc.replace(/^When played,\s*/i, '');
                          if (finalDesc) finalDesc = finalDesc.charAt(0).toUpperCase() + finalDesc.slice(1);
                      }
                      
                      let formattedDesc = finalDesc.replace(/@\[(.*?)\]/g, (match, p1) => {
                          let displayName = p1;
                          const foundAb = allAbilitiesRegistry.find(reg => reg.abilityId === p1 || reg.name.toLowerCase() === p1.toLowerCase());
                          if (foundAb) displayName = foundAb.name;
                          return `<span class="text-fuchsia-400 font-bold cursor-help border-b border-fuchsia-400/30" title="See Glossary">${displayName}</span>`;
                      });
                      formattedDesc = formattedDesc.replace(/\{Unready\}/g, SVG_UNREADY).replace(/\{Exhaust\}/g, SVG_EXHAUST).replace(/\{Power.*?\}/g, '').replace(/\{Resource.*?\}/g, '').replace(/\{Tent.*?\}/g, '').replace(/\{Free Action\}/g, '');
                      
                      const isAttack = a.effects && a.effects.some(g => g.payloads && g.payloads.some(p => p.type === 'ATTACK'));
                      
                      const abilityKey = `${cardOrUnit.instanceId}_${a.abilityId}`;
                      const uses = (abilityUses || {})[abilityKey] || 0;
                      let isUsable = true;
                      if (a.triggerLimit === 'ONCE_PER_ROUND' && uses >= 1) isUsable = false;
                      if (a.triggerLimit === 'TWICE_PER_ROUND' && uses >= 2) isUsable = false;

                      const isBlockedAct = hasEngineFlag(cardOrUnit, 'BLOCK_ACT');
                      const isBlockedAttack = hasEngineFlag(cardOrUnit, 'BLOCK_ATTACK') || isBlockedAct;

                      if (isAttack && isBlockedAttack) isUsable = false;
                      
                      if (a.trigger === 'MANUAL') {
                          if (!isAttack && isBlockedAct) isUsable = false;
                          
                          if (isUsable) {
                              const cost = a.cost || {};
                              // UI explicitly ignores readiness when graying out abilities
                              if (!cost.freeAction && !isAttack && (cardOrUnit.acts === undefined || cardOrUnit.acts < 1)) isUsable = false;
                          }
                      }

                      if (isHand) isUsable = true;

                      const iconContent = isAttack ? `<span class="inline-block w-4 h-4 align-middle mr-1">${getIconSvg('attack')}</span>` : '';
                      const hourglassIcon = !isUsable ? `<span class="inline-block w-4 h-4 align-middle mr-1 text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.8)]">${getIconSvg('hourglass-full')}</span>` : '';
                      
                      const nameColorClass = isUsable ? 'text-amber-400' : 'text-slate-500';
                      const textColorClass = isUsable ? 'text-slate-200' : 'text-slate-500 opacity-80';

                      const nameContent = `<span class="font-black ${nameColorClass} drop-shadow-sm">${hourglassIcon}${iconContent}${regMatch.name || a.name || a.abilityId}</span>`;
                      const costBadge = formatAbilityCostBadge(a.cost, cardOrUnit.tribe);
                      const triggerPill = `<span class="text-[9px] sm:text-[10px] bg-slate-800 text-slate-300 px-1 py-px rounded font-bold uppercase tracking-widest mx-1.5 shadow-inner opacity-90">${a.trigger || 'MANUAL'}</span>`;
                      
                      return `
                      <div class="bg-black/30 backdrop-blur-sm p-2 rounded border border-white/5 shadow-sm text-xs sm:text-sm ${textColorClass} leading-snug">
                        ${nameContent}${costBadge}${triggerPill}<span>${formattedDesc}</span>
                      </div>
                    `}).join('')}
                  </div>
                ` : ''}

              </div>

              <!-- Combined Footer (Stats & Flavor Text) Anchored to Extreme Bottom -->
              <div class="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none z-20">
                
                <!-- Left: Strength -->
                ${(isUnit && !isAvatar && cardOrUnit.strength !== undefined && cardOrUnit.strength !== null) ? `
                  <div class="w-12 h-12 rounded-full bg-yellow-500 border-2 border-black text-black font-black text-xl flex items-center justify-center shadow-xl pointer-events-auto shrink-0" title="Strength">${Math.max(0, cardOrUnit.strength)}</div>
                ` : '<div class="w-12 h-12 shrink-0"></div>'}
                
                <!-- Center: Armor & Flavor Text -->
                <div class="flex-1 flex flex-col items-center justify-end pb-1 px-1 gap-1 pointer-events-none">
                  ${isUnit && (cardOrUnit.armor > 0) ? `
                    <div class="w-10 h-10 rounded bg-cyan-600 border-2 border-black text-white font-black text-base flex items-center justify-center shadow-xl pointer-events-auto shrink-0" title="Armor: ${cardOrUnit.armor}"><div class="w-4 h-4 mr-0.5">${getIconSvg('armor')}</div>${cardOrUnit.armor}</div>
                  ` : ''}
                  ${cardOrUnit.description ? `
                    <div class="text-xs sm:text-sm italic text-slate-300 text-center leading-snug w-full opacity-90 drop-shadow-md">
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
                  return `
                  <div class="glossary-item bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-2xl flex-col gap-1.5 transform transition-transform hover:scale-[1.02]" data-is-system="${isSystem}" style="display: ${displayStyle};">
                    <div class="flex justify-between items-center border-b border-slate-700/50 pb-1.5">
                        <div class="font-black text-fuchsia-300 text-sm drop-shadow-md">${a.name || a.abilityId || a.id}</div>
                        <span class="text-[9px] bg-slate-950 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-bold uppercase tracking-wider">${a.trigger || 'MANUAL'}</span>
                    </div>
                    <div class="text-slate-200 text-xs leading-snug">${a.displayDescription || a.description || 'No details.'}</div>
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