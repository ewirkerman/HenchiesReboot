import { getIconSvg } from '../src/ui.js';

export function renderMicro(ctx) {
  return `
    <div 
      onclick="${ctx.onClick}"
      ${ctx.rightClickAttr}
      title="${ctx.safeTooltip}"
      class="group relative flex-shrink-0 w-[128px] sm:w-[144px] h-[64px] rounded-md ${ctx.style.bg} ${ctx.dynamicBorderClass} ${ctx.stateClasses} cursor-pointer transition-all duration-200 flex flex-col justify-between select-none overflow-hidden shadow-md ${ctx.hiddenClass}"
      style="${ctx.hexBg} ${ctx.dynamicBorderStyle}"
    >
      <div class="absolute inset-0 z-0 flex items-center justify-center ${ctx.fieldDimmingClass}">
        ${ctx.cardArtUrl ? `<img src="${ctx.cardArtUrl}" class="w-full h-full object-contain opacity-90" style="${ctx.artStyle}" draggable="false" />` : ''}
      </div>
      <div class="relative z-10 w-full h-full p-1.5 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/60 ${ctx.fieldDimmingClass}">
        <div class="flex items-center gap-1.5 w-full pr-6">
          ${!ctx.isAvatar ? `<div class="w-4 h-4 rounded-full bg-amber-500 text-black font-black text-[9px] flex items-center justify-center border border-black shadow pointer-events-auto shrink-0">${ctx.card.cost ?? 0}</div>` : ''}
          <div class="text-white text-[11px] font-black truncate drop-shadow-md leading-tight w-full">${ctx.card.name}</div>
        </div>
        ${ctx.showBottomStats ? `
          <div class="flex justify-between items-end w-full px-0.5 mt-auto">
            ${ctx.hasStrength ? `<div class="w-5 h-5 rounded-full bg-yellow-500 border border-black text-black font-black text-[10px] flex items-center justify-center shadow">${Math.max(0, ctx.card.strength)}</div>` : '<div class="w-5 h-5 shrink-0"></div>'}
            ${ctx.hasArmor ? `<div class="w-5 h-5 rounded bg-cyan-600 border border-black text-white font-black text-[9px] flex items-center justify-center shadow"><div class="w-2.5 h-2.5 mr-0.5">${getIconSvg('armor')}</div>${ctx.card.armor}</div>` : '<div class="w-5 h-5 shrink-0"></div>'}
            ${ctx.showHealth ? `<div class="w-5 h-5 rounded-full bg-red-600 border border-black text-white font-black text-[10px] flex items-center justify-center shadow">${ctx.displayHealth}</div>` : '<div class="w-5 h-5 shrink-0"></div>'}
          </div>
        ` : ''}
      </div>
      ${(ctx.hasReadiness && ctx.readiness !== null) ? `
        <div class="absolute top-1 right-1 text-[7px] px-1 py-0.5 rounded font-black uppercase z-20 ${
          ctx.readiness >= 1 ? 'bg-emerald-500 text-black' : 
          ctx.readiness === 0 ? 'bg-yellow-500 text-black' : 'bg-red-950 text-red-400 border border-red-700'
        }">
          ${ctx.readiness > 1 ? 'OVR-RDY' : ctx.readiness === 1 ? 'RDY' : ctx.readiness === 0 ? 'UNRDY' : 'EXH'}
        </div>
      ` : ''}
      ${(ctx.card.attachments && ctx.card.attachments.length > 0) ? `
        <div class="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded bg-fuchsia-600 border border-black text-white font-black text-[8px] flex items-center justify-center z-30 shadow"><div class="w-2.5 h-2.5 mr-px">${getIconSvg('attach')}</div>${ctx.card.attachments.length}</div>
      ` : ''}
      ${ctx.overlayHTML}
      ${ctx.inspectButton}
    </div>
  `;
}