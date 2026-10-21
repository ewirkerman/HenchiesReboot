import { getIconSvg, getLineIconSvg } from '../src/ui.js';

// Minimal set of base dimensions and anchor positions
const LAYOUT = {
  // Dimensions
  mainBox: "w-6 h-7 stat-box",
  mainText: "text-xl",
  subBox: "w-5 h-6 stat-box",
  subText: "text-base",
  iconBox: "w-7 h-7 stat-box",

  // Positioning
  marginTopLeft: "mt-1 ml-1.5"
};

// Derived element classes ensuring symmetric balance
const JUMBO_CORNER_SIZES = {
  cost: `${LAYOUT.mainBox} ${LAYOUT.mainText}`,
  power: `${LAYOUT.subBox} ${LAYOUT.subText} -mt-0.5`,
  line: `${LAYOUT.iconBox} ${LAYOUT.marginTopLeft}`,
  fast: `${LAYOUT.iconBox} ${LAYOUT.marginTopLeft} text-xs border-[1.5px]`,
  strength: `${LAYOUT.mainBox} ${LAYOUT.mainText}`,
  armor: `h-7 px-1.5 stat-box text-xs`, // Center element uses distinct layout
  health: `${LAYOUT.mainBox} ${LAYOUT.mainText}`,
  placeholder: `${LAYOUT.mainBox} shrink-0` // Mirrors strength to keep armor perfectly centered
};

export function renderJumboAbilities(abilitiesData) {
  if (!abilitiesData) return '';
  let html = '<div class="flex flex-col gap-1 mt-1">';

  if (abilitiesData.evergreen.length > 0) {
    const namesHtml = abilitiesData.evergreen.map(a => a.name + (a.costBadge ? ' ' + a.costBadge : '')).join(', ');
    html += `<div class="jmb-ability-evergreen">${namesHtml}</div>`;
  }

  abilitiesData.bespoke.forEach(ab => {
    html += `<div class="jmb-ability-bespoke">${ab.formattedDesc}</div>`;
  });

  abilitiesData.active.forEach(ab => {
    const iconContent = ab.isAttack ? `<span class="inline-block w-4 h-4 align-middle mr-1">${getIconSvg('attack')}</span>` : '';
    const hourglassIcon = (!ab.isUsable && ab.showHourglass) ? `<span class="inline-block w-4 h-4 align-middle mr-1 text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.8)]">${getIconSvg('hourglass-full')}</span>` : '';

    const nameColorClass = ab.isUsable ? 'ability-name-usable' : 'ability-name-unusable';
    const textColorClass = ab.isUsable ? 'ability-text-usable' : 'ability-text-unusable';

    const nameContent = `<span class="font-black ${nameColorClass} drop-shadow-sm">${hourglassIcon}${iconContent}${ab.name}</span>`;

    html += `
        <div class="jmb-ability-active-wrap">
            <div class="flex items-center gap-2">${nameContent}${ab.costBadge}</div>
            <div class="${textColorClass} text-center leading-snug px-1">${ab.formattedDesc}</div>
        </div>`;
  });

  html += '</div>';
  return html;
}

export function renderJumbo(ctx) {
  const { card, style, hexBg, hexBorder, hexLightBg, isToken, separatorClass, bgArtUrl, bgArtStyle, cardArtUrl, artStyle, isUnit, isAvatar, isTempLine, activeLine, hasReadiness, readiness, hasStrength, hasArmor, showHealth, displayHealth, abilitiesData, hiddenClass, isHand } = ctx;

  let inspectBorderClass = isToken ? 'border-white/50 shadow-[0_0_24px_rgba(255,255,255,0.25)]' : style.border;
  let inspectBorderStyle = isToken ? '' : hexBorder;
  if (hiddenClass && !isHand) {
    inspectBorderClass = 'border-dashed border-white/80 shadow-[0_0_15px_rgba(255,255,255,0.4)]';
    inspectBorderStyle = '';
  }

  return `
      <div class="card-wrapper-jumbo border-4 ${inspectBorderClass} ${style.bg}" style="${hexBg} ${inspectBorderStyle}">
        
        <!-- Top Section: Art & Cost (60%) -->
        <div class="h-[60%] card-art-section ${separatorClass}">
          ${bgArtUrl ? `
            <img src="${bgArtUrl}" class="bg-art-image" style="${bgArtStyle}" draggable="false" />
            <div class="bg-art-mute"></div>
          ` : ''}
          ${cardArtUrl ? `<img src="${cardArtUrl}" alt="${card.name}" class="w-full h-full object-contain relative z-10" style="${artStyle}" draggable="false" />` : `
            <div class="relative z-10 w-full h-full flex items-center justify-center drop-shadow-md text-6xl font-bold">
              ${card.type === 'unit' ? '⚔️' : card.type === 'avatar' ? '👑' : card.type === 'equipment' ? '🛡️' : card.type === 'artifact' ? '🏺' : '📜'}
            </div>
          `}
          
          <div class="bottom-2 card-name-wrapper">
            <div class="name-badge text-xl sm:text-2xl px-4 py-1">
                ${card.name}
            </div>
          </div>

          <!-- Pushed to Corners -->
          <div class="absolute top-0 left-0 flex flex-col items-start z-10 pointer-events-none">
            ${!isAvatar ? `
              <div class="${JUMBO_CORNER_SIZES.cost} corner-badge corner-cost ${ctx.costClass || ''}" title="Cost">
                <span>${card.cost ?? 0}</span>
              </div>
            ` : ''}
            ${card.power > 0 ? `
              <div class="${JUMBO_CORNER_SIZES.power} corner-badge corner-power ${ctx.powerClass || ''}" title="Power">
                <span>${card.power}</span>
              </div>
            ` : ''}
            ${isUnit ? `
              <div class="${JUMBO_CORNER_SIZES.line} drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isTempLine ? 'text-green-300 drop-shadow-[0_0_8px_rgba(134,239,172,0.9)]' : 'text-white'} pointer-events-auto" title="${isTempLine ? 'Temporary Line: ' : 'Line: '}${activeLine.charAt(0).toUpperCase() + activeLine.slice(1)}">
                ${getLineIconSvg(activeLine)}
              </div>
            ` : ''}
            ${(card.fast > 0) ? `
              <div class="${JUMBO_CORNER_SIZES.fast} rounded-full bg-yellow-400 text-black font-black border-black shadow-lg pointer-events-auto" title="Fast Charges">
                <div class="w-3.5 h-3.5 mr-0.5">${getIconSvg('fast')}</div>${card.fast}
              </div>
            ` : ''}
          </div>

          ${ctx.overlayHTML}
        </div>

        <!-- Bottom Section: Details & Abilities (40%) -->
        <div class="w-full h-[40%] ${style.lightBg} p-2 flex flex-col relative overflow-hidden" style="${hexLightBg}">
          ${isToken ? '<div class="absolute inset-0 bg-white/5 pointer-events-none"></div>' : ''}
          
          <!-- Type Band -->
          <div class="flex justify-center pb-1 shrink-0 mb-1 z-10 pointer-events-none relative">
            <div class="text-[10px] font-bold text-slate-200 capitalize tracking-wider bg-black/40 px-3 py-0.5 rounded-full shadow-inner">
              ${style.name || card.tribe} • ${card.type}${(card.genus && card.genus.toLowerCase() != 'generic') ? ` • ${card.genus}` : ''}${card.family ? ` • ${card.family}` : ''}
            </div>
          </div>

          <!-- Scrollable Traits & Abilities Box -->
          <div class="flex-1 flex flex-col gap-1.5 overflow-y-auto pb-14 minimal-scrollbar pr-1 pointer-events-auto relative z-10">
            ${renderJumboAbilities(ctx.abilitiesData)}
          </div>

          <!-- Pushed to Corners -->
          <div class="absolute bottom-0 left-0 right-0 flex justify-between items-end pointer-events-none z-20">
            
            <!-- Left: Strength -->
            ${hasStrength ? `
              <div class="${JUMBO_CORNER_SIZES.strength} corner-badge corner-strength ${ctx.strengthClass || ''}" title="Strength">
                <span>${Math.max(0, card.strength)}</span>
              </div>
            ` : `<div class="${JUMBO_CORNER_SIZES.placeholder}"></div>`}
            
            <!-- Center: Armor & Flavor Text -->
            <div class="flex-1 flex flex-col items-center justify-end pb-1 px-1 gap-1 pointer-events-none mb-1">
              ${hasArmor ? `
                <div class="${JUMBO_CORNER_SIZES.armor} corner-badge corner-armor ${ctx.armorClass || ''}" title="Armor: ${card.armor}">
                    <div class="w-3.5 h-3.5 mr-0.5">${getIconSvg('armor')}</div>
                    <span>${card.armor}</span>
                </div>
              ` : ''}
              ${card.description ? `
                <div class="text-[11px] italic text-slate-300 text-center leading-snug w-full opacity-90 drop-shadow-md pb-0.5">
                  "${card.description}"
                </div>
              ` : ''}
            </div>
            
            <!-- Right: Health -->
            ${showHealth ? `
              <div class="${JUMBO_CORNER_SIZES.health} corner-badge corner-health ${ctx.healthClass || ''}" title="Health">
                <span>${displayHealth}</span>
              </div>
            ` : `<div class="${JUMBO_CORNER_SIZES.placeholder}"></div>`}
          </div>

        </div>
      </div>
    `;
}