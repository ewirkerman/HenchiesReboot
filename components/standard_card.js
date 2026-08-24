import { getIconSvg, getLineIconSvg, CARD_BASE_CLASSES } from '../src/ui.js';

export function renderStandard(ctx) {
  return `
    <div 
      onclick="${ctx.onClick}"
      ${ctx.rightClickAttr}
      title="${ctx.safeTooltip}"
      class="group relative flex-shrink-0 ${CARD_BASE_CLASSES} rounded-xl ${ctx.style.bg} ${ctx.dynamicBorderClass} ${ctx.stateClasses} cursor-pointer transition-all duration-200 flex flex-col select-none overflow-hidden ${ctx.hiddenClass} ${ctx.isHand ? 'hover:-translate-y-6' : ''}"
      style="${ctx.hexBg} ${ctx.dynamicBorderStyle}"
    >
      <div class="absolute inset-0 opacity-10 mix-blend-overlay ${ctx.fieldDimmingClass}"></div>
      
      <div class="w-full h-[60%] bg-slate-900 border-b-2 ${ctx.separatorClass} shrink-0 relative overflow-hidden flex items-center justify-center ${ctx.fieldDimmingClass}">
        ${ctx.bgArtUrl ? `<img src="${ctx.bgArtUrl}" class="absolute inset-0 w-full h-full object-cover object-center z-0 opacity-60 mix-blend-overlay" style="${ctx.bgArtStyle}" draggable="false" />` : ''}
        ${ctx.cardArtUrl ? `<img src="${ctx.cardArtUrl}" class="w-full h-full object-contain relative z-10" style="${ctx.artStyle}" draggable="false" />` : ''}
        <div class="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[90%] flex justify-center z-30 pointer-events-none">
          <div class="bg-black/20 backdrop-blur-sm text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full truncate text-center max-w-full shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-tight uppercase tracking-wide">
            ${ctx.card.name}
          </div>
        </div>
      </div>

      <div class="w-full h-[40%] ${ctx.style.lightBg} p-1.5 sm:p-2 flex flex-col relative overflow-hidden ${ctx.fieldDimmingClass}" style="${ctx.hexLightBg}">
        ${ctx.isToken ? '<div class="absolute inset-0 bg-white/5 pointer-events-none"></div>' : ''}
        
        <div class="flex-1 flex flex-col gap-0.5 overflow-hidden w-full relative z-10 pointer-events-none pt-0.5">
          ${ctx.abilitiesHTML}
        </div>

        ${ctx.showBottomStats ? `
          <div class="absolute bottom-0 left-0 right-0 flex justify-between items-end pointer-events-none z-20">
            ${ctx.hasStrength ? `
              <div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] rounded-tr-lg bg-yellow-500 border-r-2 border-t-2 border-black text-black font-black text-sm sm:text-base flex items-end justify-start pb-[1px] pl-[2px] sm:pb-[2px] sm:pl-[3px] shadow-lg pointer-events-auto leading-none" title="Strength">${Math.max(0, ctx.card.strength)}</div>
            ` : '<div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] shrink-0"></div>'}
            ${ctx.hasArmor ? `
              <div class="h-[20px] sm:h-[24px] px-1 rounded-t-lg bg-cyan-600 border-x-2 border-t-2 border-black text-white font-black text-[9px] sm:text-[10px] flex items-end justify-center pb-[1px] sm:pb-[2px] shadow-lg pointer-events-auto leading-none" title="Armor: ${ctx.card.armor}"><div class="w-2.5 h-2.5 mr-0.5">${getIconSvg('armor')}</div>${ctx.card.armor}</div>
            ` : ''}
            ${ctx.showHealth ? `
              <div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] rounded-tl-lg bg-red-600 border-l-2 border-t-2 border-black text-white font-black text-sm sm:text-base flex items-end justify-end pb-[1px] pr-[2px] sm:pb-[2px] sm:pr-[3px] shadow-lg pointer-events-auto leading-none" title="Health">${ctx.displayHealth}</div>
            ` : '<div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] shrink-0"></div>'}
          </div>
        ` : ''}
      </div>

      <div class="absolute top-0 left-0 flex flex-col items-start z-10 pointer-events-none">
        ${!ctx.isAvatar ? `
          <div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] rounded-br-lg bg-amber-500 text-black font-black text-sm sm:text-base flex items-start justify-start pt-[1px] pl-[2px] sm:pt-[2px] sm:pl-[3px] border-r-2 border-b-2 border-black shadow-lg pointer-events-auto leading-none" title="Cost">
            ${ctx.card.cost ?? 0}
          </div>
        ` : ''}
        ${ctx.card.power > 0 ? `
          <div class="w-[16px] h-[18px] sm:w-[20px] sm:h-[22px] rounded-br-lg bg-purple-600 text-white font-black text-[10px] sm:text-xs flex items-start justify-start pt-[1px] pl-[2px] sm:pt-[2px] sm:pl-[3px] border-r-2 border-b-2 border-black shadow-lg pointer-events-auto leading-none -mt-0.5" title="Power">
            ${ctx.card.power}
          </div>
        ` : ''}
        ${ctx.isUnit ? `
          <div class="w-5 h-5 sm:w-6 sm:h-6 mt-1 ml-1 flex items-center justify-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${ctx.isTempLine ? 'text-green-300 drop-shadow-[0_0_6px_rgba(134,239,172,0.9)]' : 'text-white'} pointer-events-auto" title="${ctx.isTempLine ? 'Temporary Line: ' : 'Line: '}${ctx.activeLine.charAt(0).toUpperCase() + ctx.activeLine.slice(1)}">
            ${getLineIconSvg(ctx.activeLine)}
          </div>
        ` : ''}
      </div>
      ${ctx.readinessBadge}
      ${ctx.attachmentsBadge}
      ${ctx.fastBadge}
      ${ctx.inspectButton}
      ${ctx.overlayHTML}
    </div>
  `;
}