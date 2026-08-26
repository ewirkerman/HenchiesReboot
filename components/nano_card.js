import { getIconSvg, getLineIconSvg } from '../src/ui.js';
import { CARD_THEME } from './card_theme.js';

export function renderNano(ctx) {
  const forceHoverClass = ctx.isForceHover ? '-translate-y-4 !z-[100]' : '';

  return `
    <div 
      onclick="${ctx.onClick}"
      ${ctx.rightClickAttr}
      title="${ctx.safeTooltip}"
      class="group relative flex-shrink-0 w-[80px] sm:w-[90px] h-[80px] rounded-md ${ctx.style.bg} ${ctx.dynamicBorderClass} ${ctx.stateClasses} ${ctx.hiddenClass} ${forceHoverClass} cursor-pointer transition-all duration-200 select-none overflow-hidden shadow-md"
      style="${ctx.hexBg} ${ctx.dynamicBorderStyle}"
    >
      <!-- Base Texture Layer -->
      <div class="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none z-0 ${ctx.fieldDimmingClass}"></div>

      <!-- Token / Dimming Layer -->
      ${ctx.isToken ? '<div class="absolute inset-0 bg-white/10 pointer-events-none z-0"></div>' : ''}
      
      <!-- Art Layer & Fallback (With Camera Panning) -->
      <div class="absolute inset-0 z-0 flex items-center justify-center overflow-hidden ${ctx.fieldDimmingClass}">
        <div class="absolute inset-0 flex items-center justify-center transition-transform duration-200" style="${ctx.cameraStyle || ''}">
          ${ctx.bgArtUrl ? `
            <img src="${ctx.bgArtUrl}" class="${CARD_THEME.bgArtImage}" style="${ctx.bgArtStyle}" draggable="false" />
            <div class="${CARD_THEME.bgArtMute}"></div>
          ` : ''}
          ${ctx.cardArtUrl ? `<img src="${ctx.cardArtUrl}" class="w-full h-full object-contain relative z-10" style="${ctx.artStyle}" draggable="false" />` : `
            <div class="relative z-10 w-full h-full bg-slate-800/60 flex items-center justify-center text-slate-400 text-3xl font-bold">
              ${ctx.card.type === 'unit' ? '⚔️' : ctx.card.type === 'avatar' ? '👑' : ctx.card.type === 'equipment' ? '🛡️' : ctx.card.type === 'artifact' ? '🏺' : '📜'}
            </div>
          `}
        </div>
      </div>

      <!-- Content Overlay (Softened gradient so background color shines through) -->
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none ${ctx.fieldDimmingClass}"></div>

      <!-- Center: Name Badge (Fallback if no art, but cleanly styled) -->
      ${!ctx.cardArtUrl ? `
      <div class="absolute inset-0 flex items-center justify-center p-1 pointer-events-none z-10">
        <div class="${CARD_THEME.nameBadge} text-[7px] sm:text-[8px] px-1.5 py-[1px] text-center max-w-[95%] truncate shadow-md">
          ${ctx.card.name}
        </div>
      </div>
      ` : ''}

      <!-- Bottom Row: Stats -->
      ${ctx.showBottomStats ? `
        <div class="absolute bottom-0 left-0 right-0 flex justify-between items-end pointer-events-none z-20">
          ${ctx.hasStrength ? `
            <div class="w-[14px] h-[16px] sm:w-[16px] sm:h-[18px] pb-[1px] pl-[1.5px] sm:pb-[1px] sm:pl-[2px] text-[9px] sm:text-[10px] ${CARD_THEME.cornerStrength} pointer-events-auto" title="Strength">${Math.max(0, ctx.card.strength)}</div>
          ` : '<div class="w-[14px] h-[16px] sm:w-[16px] sm:h-[18px] shrink-0"></div>'}
          
          ${ctx.hasArmor ? `
            <div class="h-[16px] sm:h-[18px] px-0.5 pb-[1px] text-[7px] sm:text-[8px] ${CARD_THEME.cornerArmor} flex items-center pointer-events-auto" title="Armor: ${ctx.card.armor}">
              <div class="w-2 h-2 mr-0.5">${getIconSvg('armor')}</div>${ctx.card.armor}
            </div>
          ` : ''}

          ${ctx.showHealth ? `
            <div class="w-[14px] h-[16px] sm:w-[16px] sm:h-[18px] pb-[1px] pr-[1.5px] sm:pb-[1px] sm:pr-[2px] text-[9px] sm:text-[10px] ${CARD_THEME.cornerHealth} pointer-events-auto" title="Health">${ctx.displayHealth}</div>
          ` : '<div class="w-[14px] h-[16px] sm:w-[16px] sm:h-[18px] shrink-0"></div>'}
        </div>
      ` : ''}

      <!-- Top Row: Cost, Power & Line -->
      <div class="absolute top-0 left-0 flex flex-col items-start z-10 pointer-events-none">
        ${!ctx.isAvatar ? `
          <div class="w-[14px] h-[16px] sm:w-[16px] sm:h-[18px] pt-[1px] pl-[1.5px] sm:pt-[1px] sm:pl-[2px] text-[9px] sm:text-[10px] ${CARD_THEME.cornerCost} pointer-events-auto" title="Cost">
            ${ctx.card.cost ?? 0}
          </div>
        ` : ''}
        ${ctx.card.power > 0 ? `
          <div class="w-[12px] h-[14px] sm:w-[14px] sm:h-[16px] pt-[1px] pl-[1.5px] sm:pt-[1px] sm:pl-[2px] text-[8px] sm:text-[9px] -mt-[1px] ${CARD_THEME.cornerPower} pointer-events-auto" title="Power">
            ${ctx.card.power}
          </div>
        ` : ''}
      </div>

      <!-- External Overlays -->
      ${ctx.overlayHTML || ''}
    </div>
  `;
}