import { getIconSvg, getLineIconSvg, CARD_BASE_CLASSES } from '../src/ui.js';
import { CARD_THEME } from './card_theme.js';

export function renderStandardAbilities(abilitiesData) {
    if (!abilitiesData) return '';
    let html = '';
    
    if (abilitiesData.evergreen.length > 0) {
        const namesHtml = abilitiesData.evergreen.map(a => a.name + (a.costBadge ? ' ' + a.costBadge : '')).join(', ');
        const tooltips = abilitiesData.evergreen.map(a => `${a.name}: ${a.rawDesc}`).join('\n\n');
        html += `<div class="${CARD_THEME.stdEvergreen}" title="${tooltips.replace(/"/g, '&quot;')}">${namesHtml}</div>`;
    }

    abilitiesData.bespoke.forEach(ab => {
        html += `<div class="${CARD_THEME.stdBespoke}">${ab.formattedDesc}</div>`;
    });

    abilitiesData.active.forEach(ab => {
        const iconContent = ab.isAttack ? `<span class="inline-block w-2.5 h-2.5 align-middle mr-0.5">${getIconSvg('attack')}</span>` : '';
        const hourglassIcon = (!ab.isUsable && ab.showHourglass) ? `<span class="inline-block w-2.5 h-2.5 align-middle mr-0.5 text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.8)]">${getIconSvg('hourglass-full')}</span>` : '';
        
        const textColorClass = ab.isUsable ? CARD_THEME.activeUsableText : CARD_THEME.activeUnusableText;
        const safeTooltip = ab.rawDesc.replace(/"/g, '&quot;');
        
        html += `
          <div class="${CARD_THEME.stdActiveWrap} ${textColorClass}" title="${safeTooltip}">
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
      class="${CARD_THEME.standardWrapper} ${CARD_BASE_CLASSES} ${ctx.style.bg} ${ctx.dynamicBorderClass} ${ctx.stateClasses} ${ctx.hiddenClass} ${handHoverClass} ${handCastingClass} ${forceHoverClass}"
      style="${ctx.hexBg} ${ctx.dynamicBorderStyle}"
    >
      <div class="absolute inset-0 opacity-10 mix-blend-overlay ${ctx.fieldDimmingClass}"></div>
      
      <div class="h-[60%] ${CARD_THEME.artSection} ${ctx.separatorClass} ${ctx.fieldDimmingClass}">
        ${ctx.bgArtUrl ? `
          <img src="${ctx.bgArtUrl}" class="${CARD_THEME.bgArtImage}" style="${ctx.bgArtStyle}" draggable="false" />
          <div class="${CARD_THEME.bgArtMute}"></div>
        ` : ''}
        ${ctx.cardArtUrl ? `<img src="${ctx.cardArtUrl}" class="w-full h-full object-contain relative z-10" style="${ctx.artStyle}" draggable="false" />` : `
          <div class="relative z-10 w-full h-full bg-slate-800/60 flex items-center justify-center text-slate-400 text-3xl sm:text-4xl font-bold">
            ${ctx.card.type === 'unit' ? '⚔️' : ctx.card.type === 'avatar' ? '👑' : ctx.card.type === 'equipment' ? '🛡️' : ctx.card.type === 'artifact' ? '🏺' : '📜'}
          </div>
        `}
        <div class="bottom-1.5 ${CARD_THEME.nameWrapper}">
          <div class="${CARD_THEME.nameBadge} text-[9px] sm:text-[10px] px-2 py-0.5">
            ${ctx.card.name}
          </div>
        </div>
      </div>

      <div class="h-[40%] p-1.5 sm:p-2 ${CARD_THEME.textSection} ${ctx.style.lightBg} ${ctx.fieldDimmingClass}" style="${ctx.hexLightBg}">
        ${ctx.isToken ? '<div class="absolute inset-0 bg-white/5 pointer-events-none"></div>' : ''}
        
        <div class="flex-1 flex flex-col gap-0.5 overflow-hidden w-full relative z-10 pointer-events-none pt-0.5">
          ${renderStandardAbilities(ctx.abilitiesData)}
        </div>

        ${ctx.showBottomStats ? `
          <div class="absolute bottom-0 left-0 right-0 flex justify-between items-end pointer-events-none z-20">
            ${ctx.hasStrength ? `
              <div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] pb-[1px] pl-[2px] sm:pb-[2px] sm:pl-[3px] text-sm sm:text-base ${CARD_THEME.cornerStrength}" title="Strength">${Math.max(0, ctx.card.strength)}</div>
            ` : '<div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] shrink-0"></div>'}
            ${ctx.hasArmor ? `
              <div class="h-[20px] sm:h-[24px] px-1 pb-[1px] sm:pb-[2px] text-[9px] sm:text-[10px] ${CARD_THEME.cornerArmor}" title="Armor: ${ctx.card.armor}"><div class="w-2.5 h-2.5 mr-0.5">${getIconSvg('armor')}</div>${ctx.card.armor}</div>
            ` : ''}
            ${ctx.showHealth ? `
              <div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] pb-[1px] pr-[2px] sm:pb-[2px] sm:pr-[3px] text-sm sm:text-base ${CARD_THEME.cornerHealth}" title="Health">${ctx.displayHealth}</div>
            ` : '<div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] shrink-0"></div>'}
          </div>
        ` : ''}
      </div>

      <div class="absolute top-0 left-0 flex flex-col items-start z-10 pointer-events-none">
        ${!ctx.isAvatar ? `
          <div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] pt-[1px] pl-[2px] sm:pt-[2px] sm:pl-[3px] text-sm sm:text-base ${CARD_THEME.cornerCost}" title="Cost">
            ${ctx.card.cost ?? 0}
          </div>
        ` : ''}
        ${ctx.card.power > 0 ? `
          <div class="w-[16px] h-[18px] sm:w-[20px] sm:h-[22px] pt-[1px] pl-[2px] sm:pt-[2px] sm:pl-[3px] text-[10px] sm:text-xs -mt-0.5 ${CARD_THEME.cornerPower}" title="Power">
            ${ctx.card.power}
          </div>
        ` : ''}
        ${ctx.isUnit ? `
          <div class="w-5 h-5 sm:w-6 sm:h-6 mt-1 ml-1 flex items-center justify-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${ctx.isTempLine ? 'text-green-300 drop-shadow-[0_0_6px_rgba(134,239,172,0.9)]' : 'text-white'} pointer-events-auto" title="${ctx.isTempLine ? 'Temporary Line: ' : 'Line: '}${ctx.activeLine.charAt(0).toUpperCase() + ctx.activeLine.slice(1)}">
            ${getLineIconSvg(ctx.activeLine)}
          </div>
        ` : ''}
      </div>
      ${ctx.inspectButton}
      ${ctx.overlayHTML}
    </div>
  `;
}