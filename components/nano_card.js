import { getIconSvg, getLineIconSvg } from '../src/ui.js';

export function renderNano(ctx) {
  const forceHoverClass = ctx.isForceHover ? '-translate-y-4 !z-[100]' : '';

  // Micro cards omit some layout padding/text sizing for extreme density
  return `
    <div 
      onclick="${ctx.onClick}"
      ${ctx.rightClickAttr}
      title="${ctx.safeTooltip}"
      class="group relative flex-shrink-0 rounded-xl cursor-pointer transition-all duration-200 flex flex-col select-none overflow-hidden card-size-nano ${ctx.style.bg} ${ctx.dynamicBorderClass} ${ctx.stateClasses} ${ctx.hiddenClass} ${forceHoverClass}"
      style="${ctx.hexBg} ${ctx.dynamicBorderStyle}"
    >
      <!-- Base Texture Layer -->
      <div class="absolute inset-0 opacity-10 mix-blend-overlay"></div>
      
      <!-- Art Layer & Fallback (With Camera Panning) -->
      <div class="absolute inset-0 z-0 flex items-center justify-center overflow-hidden ${ctx.fieldDimmingClass}">
        <div class="absolute inset-0 flex items-center justify-center transition-transform duration-200" style="${ctx.cameraStyle || ''}">
          ${ctx.bgArtUrl ? `
            <img src="${ctx.bgArtUrl}" class="absolute inset-0 w-full h-full object-cover object-center z-0 opacity-50 pointer-events-none" style="${ctx.bgArtStyle}" draggable="false" />
            <div class="absolute inset-0 bg-black/60 mix-blend-multiply z-0 pointer-events-none"></div>
          ` : ''}
          ${ctx.cardArtUrl ? `<img src="${ctx.cardArtUrl}" class="w-full h-full object-contain relative z-10" style="${ctx.artStyle}" draggable="false" />` : ``}
        </div>
      </div>

      <!-- Edge Overlays (Restricted to edges so background color shines through cleanly in the middle) -->
      <div class="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10 ${ctx.fieldDimmingClass}"></div>
      <div class="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-10 ${ctx.fieldDimmingClass}"></div>

      <!-- Center: Name Badge (Fallback if no art, but cleanly styled) -->
      ${!ctx.cardArtUrl ? `
      <div class="absolute inset-0 flex items-center justify-center p-1 pointer-events-none z-10">
        <div class="bg-black/20 backdrop-blur-sm text-white font-black rounded-full truncate px-1.5 py-[1px] text-center max-w-[95%] shadow-md border-none uppercase tracking-wide leading-tight">
          ${ctx.card.name}
        </div>
      </div>
      ` : ''}

      <!-- Bottom Row: Stats -->
      ${ctx.showBottomStats ? `
        <div class="absolute bottom-0 left-0 right-0 flex justify-between items-end pointer-events-none z-20">
          ${ctx.hasStrength ? `
            <div class="w-[14px] h-[16px] sm:w-[16px] sm:h-[18px] stat-box corner-badge corner-strength ${ctx.strengthClass || ''} pointer-events-auto" title="Strength">
              <span>${Math.max(0, ctx.card.strength)}</span>
            </div>
          ` : '<div class="w-[14px] h-[16px] sm:w-[16px] sm:h-[18px] shrink-0"></div>'}
          
          ${ctx.hasArmor ? `
            <div class="h-[16px] sm:h-[18px] px-0.5 stat-box corner-badge corner-armor ${ctx.armorClass || ''} pointer-events-auto" title="Armor: ${ctx.card.armor}">
              <div class="w-2 h-2 mr-0.5">${getIconSvg('armor')}</div>
              <span>${ctx.card.armor}</span>
            </div>
          ` : ''}

          ${ctx.showHealth ? `
            <div class="w-[14px] h-[16px] sm:w-[16px] sm:h-[18px] stat-box corner-badge corner-health ${ctx.healthClass || ''} pointer-events-auto" title="Health">
              <span>${ctx.displayHealth}</span>
            </div>
          ` : '<div class="w-[14px] h-[16px] sm:w-[16px] sm:h-[18px] shrink-0"></div>'}
        </div>
      ` : ''}

      <!-- Top Row: Cost, Power & Line -->
      <div class="absolute top-0 left-0 flex flex-col items-start z-10 pointer-events-none">
        ${!ctx.isAvatar ? `
          <div class="w-[14px] h-[16px] sm:w-[16px] sm:h-[18px] stat-box corner-badge corner-cost ${ctx.costClass || ''} pointer-events-auto" title="Cost">
            <span>${ctx.card.cost ?? 0}</span>
          </div>
        ` : ''}
        ${ctx.card.power > 0 ? `
          <div class="w-[12px] h-[14px] sm:w-[14px] sm:h-[16px] stat-box -mt-[1px] corner-badge corner-power ${ctx.powerClass || ''} pointer-events-auto" title="Power">
            <span>${ctx.card.power}</span>
          </div>
        ` : ''}
        ${ctx.activeLine && !['deck', 'discard', 'hand', 'equator'].includes(ctx.activeLine) ? `
          <div class="w-[12px] h-[12px] mt-0.5 ml-0.5 stat-box pointer-events-auto drop-shadow-md ${ctx.lineGlowClass || ''}" title="Line: ${ctx.activeLine}">
             <div class="w-full h-full text-white [&>svg]:w-full [&>svg]:h-full [&>svg]:m-0">${getLineIconSvg(ctx.activeLine)}</div>
          </div>
        ` : ''}
      </div>

      <!-- External Overlays -->
      ${ctx.overlayHTML || ''}
    </div>
  `;
}