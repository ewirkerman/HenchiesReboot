import { CARD_THEME } from './card_theme.js';

export function renderMicro(ctx) {
  const forceHoverClass = ctx.isForceHover ? '-translate-y-4 scale-125 !z-[100]' : '';

  // Minimalist readiness indicator (tiny colored dot instead of text)
  let readinessDot = '';
  if (ctx.hasReadiness && ctx.readiness !== null) {
      const color = ctx.readiness > 0 ? 'bg-emerald-500' : ctx.readiness === 0 ? 'bg-yellow-500' : 'bg-red-500';
      readinessDot = `<div class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${color} border border-black shadow-sm z-20 pointer-events-none"></div>`;
  }

  return `
    <div 
      onclick="${ctx.onClick}"
      ${ctx.rightClickAttr}
      title="${ctx.safeTooltip}"
      class="group relative flex-shrink-0 cursor-pointer transition-all duration-200 select-none overflow-hidden w-[60px] h-[40px] rounded-md ${ctx.style.bg} ${ctx.dynamicBorderClass} ${ctx.stateClasses} ${ctx.hiddenClass} ${forceHoverClass}"
      style="${ctx.hexBg} ${ctx.dynamicBorderStyle}"
    >
      <!-- Background Art Layer -->
      <div class="absolute inset-0 z-0 flex items-center justify-center overflow-hidden ${ctx.fieldDimmingClass}">
        <div class="absolute inset-0 flex items-center justify-center transition-transform duration-200" style="${ctx.cameraStyle || ''}">
          ${ctx.bgArtUrl ? `
            <img src="${ctx.bgArtUrl}" class="${CARD_THEME.bgArtImage}" style="${ctx.bgArtStyle}" draggable="false" />
            <div class="${CARD_THEME.bgArtMute}"></div>
          ` : ''}
          ${ctx.cardArtUrl ? `<img src="${ctx.cardArtUrl}" class="w-full h-full object-cover relative z-10 opacity-90" style="${ctx.artStyle}" draggable="false" />` : ``}
        </div>
      </div>

      <!-- Dimming overlay -->
      <div class="absolute inset-0 bg-black/30 pointer-events-none ${ctx.fieldDimmingClass}"></div>

      <!-- Fallback Name if no art -->
      ${!ctx.cardArtUrl ? `
      <div class="absolute inset-0 flex items-center justify-center p-0.5 pointer-events-none z-10">
        <div class="bg-black/60 text-white font-bold text-[6px] px-1 rounded-sm text-center max-w-full truncate">
          ${ctx.card.name}
        </div>
      </div>
      ` : ''}

      <!-- Top-Left: Cost & Power -->
      <div class="absolute top-0 left-0 z-10 flex flex-col pointer-events-none">
        ${!ctx.isAvatar ? `
          <div class="w-[12px] h-[14px] pt-[1px] pl-[1px] text-[8px] bg-amber-500 text-black font-black rounded-br flex items-start justify-start border-r border-b border-black shadow-sm pointer-events-auto leading-none">
            ${ctx.card.cost ?? 0}
          </div>
        ` : ''}
        ${ctx.card.power > 0 ? `
          <div class="w-[10px] h-[12px] pt-[1px] pl-[1px] text-[7px] bg-purple-600 text-white font-black rounded-br flex items-start justify-start border-r border-b border-black shadow-sm pointer-events-auto leading-none -mt-px">
            ${ctx.card.power}
          </div>
        ` : ''}
      </div>

      <!-- Bottom-Left: Strength -->
      ${ctx.hasStrength ? `
        <div class="absolute bottom-0 left-0 z-10 w-[12px] h-[14px] pb-[1px] pl-[1px] text-[8px] bg-yellow-500 text-black font-black rounded-tr flex items-end justify-start border-r border-t border-black shadow-sm pointer-events-auto leading-none">
          ${Math.max(0, ctx.card.strength)}
        </div>
      ` : ''}

      <!-- Bottom-Right: Health & Armor -->
      <div class="absolute bottom-0 right-0 z-10 flex pointer-events-none">
         ${ctx.hasArmor ? `
            <div class="h-[14px] px-0.5 pb-[1px] text-[7px] bg-cyan-600 text-white font-black rounded-tl flex items-end justify-center border-l border-t border-black shadow-sm pointer-events-auto leading-none">
              ${ctx.card.armor}
            </div>
          ` : ''}
          ${ctx.showHealth ? `
            <div class="w-[12px] h-[14px] pb-[1px] pr-[1px] text-[8px] bg-red-600 text-white font-black rounded-tl flex items-end justify-end border-l border-t border-black shadow-sm pointer-events-auto leading-none">
              ${ctx.displayHealth}
            </div>
          ` : ''}
      </div>

      ${readinessDot}

      <!-- Hover Name Banner (Tiny) -->
      <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 pointer-events-none">
         <div class="bg-black/80 backdrop-blur-sm text-white font-black text-[6px] px-1 py-0.5 rounded-sm max-w-[90%] truncate shadow-md border border-white/20">
            ${ctx.card.name}
         </div>
      </div>

      ${ctx.overlayHTML || ''}
    </div>
  `;
}