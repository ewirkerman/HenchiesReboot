import { getIconSvg, getLineIconSvg } from '../src/ui.js';
import { CARD_THEME } from './card_theme.js';

export function renderJumboAbilities(abilitiesData) {
    if (!abilitiesData) return '';
    let html = '<div class="flex flex-col gap-1 mt-1">';
    
    if (abilitiesData.evergreen.length > 0) {
        const namesHtml = abilitiesData.evergreen.map(a => a.name + (a.costBadge ? ' ' + a.costBadge : '')).join(', ');
        html += `<div class="${CARD_THEME.jmbEvergreen}">${namesHtml}</div>`;
    }

    abilitiesData.bespoke.forEach(ab => {
        html += `<div class="${CARD_THEME.jmbBespoke}">${ab.formattedDesc}</div>`;
    });

    abilitiesData.active.forEach(ab => {
        const iconContent = ab.isAttack ? `<span class="inline-block w-4 h-4 align-middle mr-1">${getIconSvg('attack')}</span>` : '';
        const hourglassIcon = (!ab.isUsable && ab.showHourglass) ? `<span class="inline-block w-4 h-4 align-middle mr-1 text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.8)]">${getIconSvg('hourglass-full')}</span>` : '';
        
        const nameColorClass = ab.isUsable ? CARD_THEME.activeUsableName : CARD_THEME.activeUnusableName;
        const textColorClass = ab.isUsable ? CARD_THEME.activeUsableText : CARD_THEME.activeUnusableText;

        const nameContent = `<span class="font-black ${nameColorClass} drop-shadow-sm">${hourglassIcon}${iconContent}${ab.name}</span>`;
        
        html += `
        <div class="${CARD_THEME.jmbActiveWrap}">
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
      <div class="${CARD_THEME.jumboWrapper} border-4 ${inspectBorderClass} ${style.bg}" style="${hexBg} ${inspectBorderStyle}">
        
        <!-- Top Section: Art & Cost (60%) -->
        <div class="h-[60%] ${CARD_THEME.artSection} ${separatorClass}">
          ${bgArtUrl ? `
            <img src="${bgArtUrl}" class="${CARD_THEME.bgArtImage}" style="${bgArtStyle}" draggable="false" />
            <div class="${CARD_THEME.bgArtMute}"></div>
          ` : ''}
          ${cardArtUrl ? `<img src="${cardArtUrl}" alt="${card.name}" class="w-full h-full object-contain relative z-10" style="${artStyle}" draggable="false" />` : `
            <div class="relative z-10 w-full h-full flex items-center justify-center drop-shadow-md text-6xl font-bold">
              ${card.type === 'unit' ? '⚔️' : card.type === 'avatar' ? '👑' : card.type === 'equipment' ? '🛡️' : card.type === 'artifact' ? '🏺' : '📜'}
            </div>
          `}
          
          <div class="bottom-2 ${CARD_THEME.nameWrapper}">
            <div class="${CARD_THEME.nameBadge} text-xl sm:text-2xl px-4 py-1">
                ${card.name}
            </div>
          </div>

          <div class="absolute top-3 left-3 flex flex-col items-center gap-2 z-10">
            ${!isAvatar ? `
              <div class="w-12 h-12 text-2xl ${CARD_THEME.floatingCost}" title="Cost">
                ${card.cost ?? 0}
              </div>
            ` : ''}
            ${card.power > 0 ? `
              <div class="w-12 h-12 text-2xl ${CARD_THEME.floatingPower}" title="Power">
                ${card.power}
              </div>
            ` : ''}
            ${isUnit ? `
              <div class="w-8 h-8 flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isTempLine ? 'text-green-300 drop-shadow-[0_0_8px_rgba(134,239,172,0.9)]' : 'text-white'}" title="${isTempLine ? 'Temporary Line: ' : 'Line: '}${activeLine.charAt(0).toUpperCase() + activeLine.slice(1)}">
                ${getLineIconSvg(activeLine)}
              </div>
            ` : ''}
            ${(card.fast > 0) ? `
              <div class="w-8 h-8 rounded-full bg-yellow-400 text-black font-black text-sm flex items-center justify-center border-2 border-black shadow-lg mt-1" title="Fast Charges">
                <div class="w-4 h-4 mr-0.5">${getIconSvg('fast')}</div>${card.fast}
              </div>
            ` : ''}
          </div>

          ${(hasReadiness && readiness !== undefined && readiness !== null) ? `
            <div class="absolute top-3 right-3 text-sm px-2.5 py-1 rounded-md font-black uppercase tracking-wider z-20 border-2 border-black shadow-lg ${
              readiness >= 1 ? 'bg-emerald-500 text-black' : 
              readiness === 0 ? 'bg-yellow-500 text-black' : 'bg-red-950 text-red-400 border-red-700'
            }">
              ${readiness > 1 ? 'OVER-READY' : readiness === 1 ? 'READY' : readiness === 0 ? 'UNREADY' : 'EXHAUSTED'}
            </div>
          ` : ''}
        </div>

        <!-- Bottom Section: Details & Abilities (40%) -->
        <div class="w-full h-[40%] ${style.lightBg} p-2 sm:p-3 flex flex-col relative overflow-hidden" style="${hexLightBg}">
          ${isToken ? '<div class="absolute inset-0 bg-white/5 pointer-events-none"></div>' : ''}
          
          <!-- Type Band -->
          <div class="flex justify-center pb-1 shrink-0 mb-1 z-10 pointer-events-none relative">
            <div class="text-[10px] font-bold text-slate-200 capitalize tracking-wider bg-black/40 px-3 py-0.5 rounded-full shadow-inner">
              ${style.name || card.tribe} • ${card.type}${card.genus ? ` • ${card.genus}` : ''}${card.family ? ` • ${card.family}` : ''}
            </div>
          </div>

          <!-- Scrollable Traits & Abilities Box -->
          <div class="flex-1 flex flex-col gap-1.5 overflow-y-auto pb-16 minimal-scrollbar pr-1 pointer-events-auto relative z-10">

            <!-- Full Abilities with Registry Lookup -->
            ${renderJumboAbilities(ctx.abilitiesData)}

          </div>

          <!-- Combined Footer (Stats & Flavor Text) Anchored to Extreme Bottom -->
          <div class="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none z-20">
            
            <!-- Left: Strength -->
            ${hasStrength ? `
              <div class="w-12 h-12 text-xl ${CARD_THEME.floatingStrength}" title="Strength">${Math.max(0, card.strength)}</div>
            ` : '<div class="w-12 h-12 shrink-0"></div>'}
            
            <!-- Center: Armor & Flavor Text -->
            <div class="flex-1 flex flex-col items-center justify-end pb-1 px-1 gap-1 pointer-events-none">
              ${hasArmor ? `
                <div class="w-10 h-10 text-base ${CARD_THEME.floatingArmor}" title="Armor: ${card.armor}"><div class="w-4 h-4 mr-0.5">${getIconSvg('armor')}</div>${card.armor}</div>
              ` : ''}
              ${card.description ? `
                <div class="text-xs sm:text-sm italic text-slate-300 text-center leading-snug w-full opacity-90 drop-shadow-md">
                  "${card.description}"
                </div>
              ` : ''}
            </div>
            
            <!-- Right: Health -->
            ${showHealth ? `
              <div class="w-12 h-12 text-xl ${CARD_THEME.floatingHealth}" title="Health">${displayHealth}</div>
            ` : '<div class="w-12 h-12 shrink-0"></div>'}
          </div>

        </div>
      </div>
    `;
}