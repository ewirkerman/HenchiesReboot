export function renderNano(ctx) {
  return `
    <div 
      onclick="${ctx.onClick}"
      ${ctx.rightClickAttr}
      title="${ctx.safeTooltip}"
      class="group relative flex-shrink-0 w-[80px] sm:w-[90px] h-[80px] rounded-md ${ctx.style.bg} ${ctx.dynamicBorderClass} ${ctx.stateClasses} cursor-pointer transition-all duration-200 flex flex-col justify-between select-none overflow-hidden shadow-md ${ctx.hiddenClass}"
      style="${ctx.hexBg} ${ctx.dynamicBorderStyle}"
    >
      <div class="absolute inset-0 z-0 flex items-center justify-center ${ctx.fieldDimmingClass}">
        ${ctx.cardArtUrl ? `<img src="${ctx.cardArtUrl}" class="w-full h-full object-contain opacity-90" style="${ctx.artStyle}" draggable="false" />` : ''}
      </div>
      <div class="relative z-10 w-full h-full p-1 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/60 ${ctx.fieldDimmingClass}">
        <div class="flex items-start justify-between w-full relative z-20">
          ${!ctx.isAvatar ? `<div class="w-4 h-4 rounded-full bg-amber-500 text-black font-black text-[9px] flex items-center justify-center border border-black shadow pointer-events-auto shrink-0">${ctx.card.cost ?? 0}</div>` : '<div></div>'}
          ${(ctx.hasReadiness && ctx.readiness !== null) ? `
            <div class="w-2.5 h-2.5 rounded-full ${ctx.readiness >= 1 ? 'bg-emerald-500' : ctx.readiness === 0 ? 'bg-yellow-500' : 'bg-red-600'} border border-black shadow z-20"></div>
          ` : ''}
        </div>
        ${!ctx.cardArtUrl ? `
        <div class="absolute inset-0 flex items-center justify-center p-1 pointer-events-none z-10">
          <span class="text-[9px] font-bold text-white text-center leading-tight drop-shadow-[0_2px_2px_rgba(0,0,0,1)] break-words w-full px-1">${ctx.card.name}</span>
        </div>
        ` : ''}
        ${ctx.showBottomStats ? `
          <div class="flex justify-between items-end w-full mt-auto relative z-20">
            ${ctx.hasStrength ? `<div class="text-yellow-400 font-black text-[11px] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">${Math.max(0, ctx.card.strength)}</div>` : '<div class="w-5 h-5 shrink-0"></div>'}
            ${ctx.showHealth ? `<div class="text-red-400 font-black text-[11px] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">${ctx.displayHealth}</div>` : '<div class="w-5 h-5 shrink-0"></div>'}
          </div>
        ` : ''}
      </div>
      ${ctx.overlayHTML}
      ${ctx.inspectButton}
    </div>
  `;
}