import { getIconSvg, getLineIconSvg, CARD_BASE_CLASSES } from '../src/ui.js';

export function renderStandardAbilities(abilitiesData) {
  if (!abilitiesData) return '';
  let html = '';

  if (abilitiesData.evergreen.length > 0) {
    const namesHtml = abilitiesData.evergreen.map(a => a.name + (a.costBadge ? ' ' + a.costBadge : '')).join(', ');
    const tooltips = abilitiesData.evergreen.map(a => `${a.name}: ${a.rawDesc}`).join('\n\n');
    html += `<div class="ability-evergreen" title="${tooltips.replace(/"/g, '&quot;')}">${namesHtml}</div>`;
  }

  abilitiesData.bespoke.forEach(ab => {
    html += `<div class="ability-bespoke">${ab.formattedDesc}</div>`;
  });

  abilitiesData.active.forEach(ab => {
    const iconContent = ab.isAttack ? `<span class="inline-block w-2.5 h-2.5 align-middle mr-0.5">${getIconSvg('attack')}</span>` : '';
    const hourglassIcon = (!ab.isUsable && ab.showHourglass) ? `<span class="inline-block w-2.5 h-2.5 align-middle mr-0.5 text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.8)]">${getIconSvg('hourglass-full')}</span>` : '';

    const textColorClass = ab.isUsable ? 'ability-text-usable' : 'ability-text-unusable';
    const safeTooltip = ab.rawDesc.replace(/"/g, '&quot;');

    html += `
          <div class="ability-active-wrap ${textColorClass}" title="${safeTooltip}">
            <div class="flex items-center gap-0.5 truncate pr-1">
                ${hourglassIcon}${iconContent}
                <span class="truncate">${ab.name}</span>
            </div>
            <div class="shrink-0 flex items-center">
                ${ab.costBadge}
            </div>
          </div>
        `;
  });

  return html;
}

export function renderStandard(ctx) {
  const handHoverClass = (ctx.isHand && (!ctx.isTargetingMode || ctx.isTargetable) && !ctx.isCasting && !ctx.isSelected) ? 'hover:-translate-y-6 hover:!z-[100]' : '';
  const handCastingClass = (ctx.isHand && (ctx.isCasting || ctx.isSelected)) ? '-translate-y-6 !z-[110]' : '';
  const forceHoverClass = ctx.isForceHover ? '-translate-y-6 !z-[100]' : '';

  return `
    <div 
      onclick="${ctx.onClick}"
      ${ctx.rightClickAttr}
      title="${ctx.safeTooltip}"
      class="card-wrapper-std ${CARD_BASE_CLASSES} ${ctx.style.bg} ${ctx.dynamicBorderClass} ${ctx.stateClasses} ${ctx.hiddenClass} ${handHoverClass} ${handCastingClass} ${forceHoverClass}"
      style="${ctx.hexBg} ${ctx.dynamicBorderStyle}"
    >
      <div class="absolute inset-0 opacity-10 mix-blend-overlay ${ctx.fieldDimmingClass}"></div>
      
      <div class="h-[60%] card-art-section ${ctx.separatorClass} ${ctx.fieldDimmingClass}">
        ${ctx.bgArtUrl ? `
          <img src="${ctx.bgArtUrl}" class="bg-art-image" style="${ctx.bgArtStyle}" draggable="false" />
          <div class="bg-art-mute"></div>
        ` : ''}
        ${ctx.cardArtUrl ? `<img src="${ctx.cardArtUrl}" class="w-full h-full object-contain relative z-10" style="${ctx.artStyle}" draggable="false" />` : `
          <div class="relative z-10 w-full h-full flex items-center justify-center drop-shadow-md text-3xl sm:text-4xl font-bold">
            ${ctx.card.type === 'unit' ? '⚔️' : ctx.card.type === 'avatar' ? '👑' : ctx.card.type === 'equipment' ? '🛡️' : ctx.card.type === 'artifact' ? '🏺' : '📜'}
          </div>
        `}
        <div class="bottom-1.5 card-name-wrapper">
          <div class="name-badge text-[9px] sm:text-[10px] px-2 py-0.5">
            ${ctx.card.name}
          </div>
        </div>
        ${ctx.overlayHTML}
      </div>

      <div class="h-[40%] p-1.5 sm:p-2 card-text-section ${ctx.style.lightBg} ${ctx.fieldDimmingClass}" style="${ctx.hexLightBg}">
        ${ctx.isToken ? '<div class="absolute inset-0 bg-white/5 pointer-events-none"></div>' : ''}
        
        <div class="flex-1 flex flex-col gap-0.5 overflow-hidden w-full relative z-10 pointer-events-none pt-0.5">
          ${renderStandardAbilities(ctx.abilitiesData)}
        </div>

        ${ctx.showBottomStats ? `
          <div class="absolute bottom-0 left-0 right-0 flex justify-between items-end pointer-events-none z-20">
            ${ctx.hasStrength ? `
              <div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] stat-box corner-badge corner-strength text-sm sm:text-base ${ctx.strengthClass || ''}" title="Strength">
                <span>${Math.max(0, ctx.card.strength)}</span>
              </div>
            ` : '<div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] shrink-0"></div>'}
            ${ctx.hasArmor ? `
              <div class="h-[20px] sm:h-[24px] px-1 stat-box corner-badge corner-armor text-[9px] sm:text-[10px] ${ctx.armorClass || ''}" title="Armor: ${ctx.card.armor}">
                <div class="w-2.5 h-2.5 mr-0.5">${getIconSvg('armor')}</div>
                <span>${ctx.card.armor}</span>
              </div>
            ` : ''}
            ${ctx.showHealth ? `
              <div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] stat-box corner-badge corner-health text-sm sm:text-base ${ctx.healthClass || ''}" title="Health">
                <span>${ctx.displayHealth}</span>
              </div>
            ` : '<div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] shrink-0"></div>'}
          </div>
        ` : ''}
      </div>

      <div class="absolute top-0 left-0 flex flex-col items-start z-10 pointer-events-none">
        ${!ctx.isAvatar ? `
          <div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] stat-box corner-badge corner-cost text-sm sm:text-base ${ctx.costClass || ''}" title="Cost">
            <span>${ctx.card.cost ?? 0}</span>
          </div>
        ` : ''}
        ${ctx.card.power > 0 ? `
          <div class="w-[16px] h-[18px] sm:w-[20px] sm:h-[22px] stat-box corner-badge corner-power text-[10px] sm:text-xs -mt-0.5 ${ctx.powerClass || ''}" title="Power">
            <span>${ctx.card.power}</span>
          </div>
        ` : ''}
        ${ctx.isUnit ? `
          <div class="w-5 h-5 sm:w-6 sm:h-6 mt-1 ml-1 stat-box drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${ctx.isTempLine ? 'text-green-300 drop-shadow-[0_0_6px_rgba(134,239,172,0.9)]' : 'text-white'} pointer-events-auto" title="${ctx.isTempLine ? 'Temporary Line: ' : 'Line: '}${ctx.activeLine.charAt(0).toUpperCase() + ctx.activeLine.slice(1)}">
            ${getLineIconSvg(ctx.activeLine)}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}