import { TRIBE_STYLES, CARD_BASE_CLASSES, getIconSvg, getLineIconSvg, hasEngineFlag, formatAbilityCostBadge, SVG_STUNNED, SVG_DAZED } from '../src/ui.js';

export class GameCard extends HTMLElement {
    connectedCallback() {
        this.style.display = 'contents';
        this.render();
    }

    static get observedAttributes() { 
        return ['card-data', 'size', 'is-hand', 'is-selected', 'is-targetable', 'readiness', 'ability-uses']; 
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue && this.isConnected) {
            this.render();
        }
    }

    render() {
        const dataStr = this.getAttribute('card-data');
        if (!dataStr) return;
        
        const card = JSON.parse(decodeURIComponent(dataStr));
        
        const size = this.getAttribute('size');
        const isMicro = size === 'micro';
        const isNano = size === 'nano';
        const isHand = this.getAttribute('is-hand') === 'true';
        const isSelected = this.getAttribute('is-selected') === 'true';
        const isTargetable = this.getAttribute('is-targetable') === 'true';
        
        const readinessAttr = this.getAttribute('readiness');
        const readiness = readinessAttr !== null && readinessAttr !== 'null' && readinessAttr !== 'undefined' ? parseInt(readinessAttr) : null;
        
        const onClick = this.getAttribute('on-click') || '';
        const onInspect = this.getAttribute('on-inspect') || '';
        
        const abilityUsesStr = this.getAttribute('ability-uses');
        const abilityUses = abilityUsesStr ? JSON.parse(decodeURIComponent(abilityUsesStr)) : {};

        const options = { abilityUses, isHand };

        const style = TRIBE_STYLES[card.tribe] || TRIBE_STYLES.Mythic;
        
        const hexBg = style.hexBg ? `background-color: ${style.hexBg};` : '';
        const hexLightBg = style.hexLightBg ? `background-color: ${style.hexLightBg};` : '';
        const hexBorder = style.hexBorder ? `border-color: ${style.hexBorder};` : '';

        const isUnit = card.type === 'unit' || card.type === 'avatar';
        const isAvatar = card.type === 'avatar';
        const isToken = !!card.isToken;
        const activeLine = card.line || card.defaultLine || (isAvatar ? 'avatar' : 'mid');
        const isTempLine = card.line && card.defaultLine && card.line !== card.defaultLine;

        const separatorClass = isToken ? 'border-white/40' : 'border-black';

        const hasStrength = card.strength !== undefined && card.strength !== null;
        const defaultHealth = isAvatar ? 20 : (isUnit ? 1 : null);
        const displayHealth = card.currentHealth ?? card.health ?? defaultHealth;
        const showHealth = displayHealth !== null;
        const hasArmor = card.armor > 0;
        const showBottomStats = hasStrength || showHealth || hasArmor;

        const isStatusApplied = (targetCard, flag, statusNames) => {
            if (targetCard.activeEffects && targetCard.activeEffects.some(e => e.type === flag)) return true;
            if (targetCard.abilities && targetCard.abilities.some(a => statusNames.includes((a.name || '').toLowerCase()))) return true;
            return false;
        };

        const isStunned = isStatusApplied(card, 'BLOCK_ACT', ['stun', 'stunned']);
        const isDazed = isStatusApplied(card, 'BLOCK_RETALIATE', ['daze', 'dazed']) && !isStunned;
        const isHidden = hasEngineFlag(card, 'BLOCK_TARGETING');

        let dynamicBorderClass = isToken ? 'border-2 border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : `border-2 ${style.border}`;
        let dynamicBorderStyle = isToken ? '' : hexBorder;
        
        if (isHidden && !isHand) {
            dynamicBorderClass = 'border-2 border-dashed border-white/80 shadow-[0_0_12px_rgba(255,255,255,0.4)]';
            dynamicBorderStyle = '';
        }

        const hasReadiness = isUnit || card.type === 'equipment' || card.type === 'artifact';
        const isFieldUnready = !isHand && hasReadiness && readiness !== null && readiness === 0;
        const isFieldExhausted = !isHand && hasReadiness && readiness !== null && readiness < 0;
        const isFieldOverReady = !isHand && hasReadiness && readiness !== null && readiness > 1;
        const fieldDimmingClass = (isFieldUnready || isFieldExhausted || isStunned || isDazed) ? 'saturate-[0.25] opacity-90' : '';
        const hiddenClass = isHidden && !isHand ? 'opacity-60 hover:opacity-100' : '';

        let overlayContent = '';
        let isOverReadyOverlay = false;

        if (isStunned) overlayContent = SVG_STUNNED;
        else if (isDazed) overlayContent = SVG_DAZED;
        else if (isFieldExhausted) overlayContent = getIconSvg('hourglass-full');
        else if (isFieldUnready) overlayContent = getIconSvg('hourglass-empty');
        else if (isFieldOverReady) {
            overlayContent = getIconSvg('hourglass-full');
            isOverReadyOverlay = true;
        }

        let overlayHTML = '';
        let overlayScaleClass = isDazed ? 'scale-75' : '';
        if (overlayContent) {
            if (isOverReadyOverlay) {
                overlayHTML = `
                  <div class="absolute inset-0 z-40 flex items-center justify-center pointer-events-none rounded-md">
                    <div class="w-16 h-16 ${overlayScaleClass} opacity-60 drop-shadow-[0_0_8px_rgba(134,239,172,0.9)] [&>svg]:!w-full [&>svg]:!h-full [&>svg]:!m-0 [&>svg]:!text-green-400 [&>svg]:!drop-shadow-none">
                      ${overlayContent}
                    </div>
                  </div>
                `;
            } else {
                overlayHTML = `
                  <div class="absolute inset-0 z-40 flex items-center justify-center pointer-events-none bg-black/30 rounded-md">
                    <div class="w-16 h-16 ${overlayScaleClass} text-white opacity-80 drop-shadow-[0_2px_8px_rgba(0,0,0,1)] [&>svg]:!w-full [&>svg]:!h-full [&>svg]:!m-0">
                      ${overlayContent}
                    </div>
                  </div>
                `;
            }
        }

        const readinessBadge = (hasReadiness && readiness !== null) ? `
          <div class="absolute top-1 right-1 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider z-20 ${
            readiness >= 1 ? 'bg-emerald-500 text-black' : 
            readiness === 0 ? 'bg-yellow-500 text-black' : 'bg-red-950 text-red-400 border border-red-700'
          }">
            ${readiness > 1 ? 'OVER-READY' : readiness === 1 ? 'READY' : readiness === 0 ? 'UNREADY' : 'EXHAUSTED'}
          </div>
        ` : '';

        const inspectButton = onInspect ? `
          <button 
            onclick="event.stopPropagation(); ${onInspect}"
            class="absolute ${(isMicro || isNano) ? 'top-6 right-1 w-4 h-4 text-[8px]' : (readiness !== null ? 'top-6 right-1 w-6 h-6 text-[10px]' : 'top-1 right-1 w-6 h-6 text-[10px]')} rounded-full bg-slate-900/80 hover:bg-slate-700 text-white font-black flex items-center justify-center border border-slate-500 shadow-lg z-30 transition-colors backdrop-blur-sm"
            title="Inspect Card"
          >
            🔍
          </button>
        ` : '';

        const fastBadge = (card.fast > 0) ? `
          <div class="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-yellow-400 border border-black text-black font-black text-[10px] flex items-center justify-center shadow-lg z-30" title="Fast Charges">
            <div class="w-3 h-3 mr-0.5">${getIconSvg('fast')}</div>${card.fast}
          </div>
        ` : '';

        const attachmentsBadge = (card.attachments && card.attachments.length > 0) ? `
          <div class="absolute -top-1.5 -left-1.5 w-6 h-6 rounded bg-fuchsia-600 border border-black text-white font-black text-[10px] flex items-center justify-center shadow-lg z-30" title="Attachments">
            <div class="w-3 h-3 mr-0.5">${getIconSvg('attach')}</div>${card.attachments.length}
          </div>
        ` : '';

        const rightClickAttr = onInspect ? `oncontextmenu="event.preventDefault(); event.stopPropagation(); ${onInspect}"` : '';

        let hoverTooltip = card.name || 'Unknown Card';
        if (card.description) hoverTooltip += `\n"${card.description}"`;

        let abilitiesHTML = '';
        let displayAbilities = card.abilities ? [...card.abilities] : [];
        const defLine = card.defaultLine || 'mid';
        
        if (isUnit && !isAvatar && defLine !== 'mid') {
            displayAbilities.push({
                abilityId: 'sys_line_' + defLine,
                name: defLine.charAt(0).toUpperCase() + defLine.slice(1) + ' Line',
                trigger: 'UNTRIGGERABLE',
                cost: {}
            });
        }

        if (displayAbilities.length > 0) {
            abilitiesHTML = displayAbilities.map(ab => {
                const isAttack = ab.effects && ab.effects.some(g => g.payloads && g.payloads.some(p => p.type === 'ATTACK'));
                const isPlayTrigger = ['PLAY', 'PLAY_OPTIONAL', 'ON_BE_PLAYED', 'WOULD_PLAY', 'WOULD_BE_PLAYED', 'MODIFY_PLAY'].includes(ab.trigger);
                
                const abilityKey = `${card.instanceId}_${ab.abilityId}`;
                const uses = (options.abilityUses || {})[abilityKey] || 0;
                
                let isUsable = true;
                let showHourglass = false;
                
                if (ab.triggerLimit === 'ONCE_PER_ROUND' && uses >= 1) { isUsable = false; showHourglass = true; }
                if (ab.triggerLimit === 'TWICE_PER_ROUND' && uses >= 2) { isUsable = false; showHourglass = true; }

                // Bypass field-state usability checks if the card is in hand or being previewed globally
                if (!options.isHand && card.readiness !== undefined) {
                    const checkBlock = (flag) => {
                        if (!hasEngineFlag(card, flag)) return null;
                        if (card.passiveFlags?.includes(flag)) return 'permanent';
                        if (card.abilities?.some(a => a.passiveFlags?.includes(flag))) return 'permanent';
                        const effect = card.activeEffects?.find(e => e.type === flag);
                        if (effect && ['INDEFINITE', 'PERMANENT', 'WHILE_ATTACHED', 'INSTANT'].includes(effect.duration)) return 'permanent';
                        return 'temporary';
                    };

                    const actBlock = checkBlock('BLOCK_ACT');
                    const attackBlock = checkBlock('BLOCK_ATTACK') || actBlock;

                    if (isAttack && attackBlock) {
                        isUsable = false;
                        if (attackBlock === 'temporary') showHourglass = true;
                    }
                    
                    if (ab.trigger === 'MANUAL') {
                        if (!isAttack && actBlock) {
                            isUsable = false;
                            if (actBlock === 'temporary') showHourglass = true;
                        }
                        
                        if (isUsable) {
                            const cost = ab.cost || {};
                            if (!cost.freeAction && !isAttack && (card.acts === undefined || card.acts < 1)) {
                                isUsable = false;
                                showHourglass = true;
                            }
                        }
                    }
                }

                if (isPlayTrigger && !options.isHand && card.readiness !== undefined) {
                    isUsable = false;
                    showHourglass = false;
                }

                if (options.isHand || card.readiness === undefined) {
                    isUsable = true;
                    showHourglass = false;
                }

                const iconContent = isAttack ? `<span class="inline-block w-2.5 h-2.5 align-middle mr-0.5">${getIconSvg('attack')}</span>` : '';
                const hourglassIcon = (!isUsable && showHourglass) ? `<span class="inline-block w-2.5 h-2.5 align-middle mr-0.5 text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.8)]">${getIconSvg('hourglass-full')}</span>` : '';
                
                const textColorClass = isUsable ? 'text-slate-200' : 'text-slate-500 opacity-80';
                const nameColorClass = isUsable ? '' : 'text-slate-500';
                
                return `
                  <div class="text-[9px] ${textColorClass} font-bold leading-tight truncate w-full text-center">
                    <span>${hourglassIcon}${iconContent}<span class="${nameColorClass}">${ab.name || 'Unknown'}</span></span>${formatAbilityCostBadge(ab.cost, card.tribe)}
                  </div>
                `;
            }).filter(Boolean).join('');
        }
        hoverTooltip += `\n\n(Right-click or tap 🔍 to inspect fully)`;
        const safeTooltip = hoverTooltip.replace(/"/g, '&quot;').replace(/'/g, '&apos;');

        let transX, transY, scale;
        if (isNano) {
            transX = card.nanoArtX ?? 0;
            transY = card.nanoArtY ?? 0;
            scale = card.nanoArtScale ?? 110;
        } else if (isMicro) {
            transX = card.microArtX ?? 0;
            transY = card.microArtY ?? 0;
            scale = card.microArtScale ?? 185;
        } else {
            transX = card.artX ?? 0;
            transY = card.artY ?? 0;
            scale = card.artScale ?? 100;
        }
        
        const artStyle = `object-position: center; transform: translate(${transX}px, ${transY}px) scale(${scale / 100});`;

        if (isNano) {
          this.innerHTML = `
            <div 
              onclick="${onClick}"
              ${rightClickAttr}
              title="${safeTooltip}"
              class="group relative flex-shrink-0 w-[64px] sm:w-[72px] h-[64px] rounded-md ${style.bg} ${dynamicBorderClass} ${isSelected ? 'ring-2 ring-yellow-400 scale-105 z-20' : ''} ${isTargetable ? 'ring-2 ring-cyan-400 animate-pulse z-20 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.6)]' : ''} cursor-pointer transition-all duration-200 flex flex-col justify-between select-none overflow-hidden shadow-md ${hiddenClass}"
              style="${hexBg} ${dynamicBorderStyle}"
            >
              <div class="absolute inset-0 z-0 flex items-center justify-center ${fieldDimmingClass}">
                ${card.artUrl ? `<img src="${card.artUrl}" class="w-full h-full object-contain opacity-90" style="${artStyle}" draggable="false" />` : ''}
              </div>
              <div class="relative z-10 w-full h-full p-1 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/60 ${fieldDimmingClass}">
                <div class="flex items-start justify-between w-full relative z-20">
                  ${!isAvatar ? `<div class="w-4 h-4 rounded-full bg-amber-500 text-black font-black text-[9px] flex items-center justify-center border border-black shadow pointer-events-auto shrink-0">${card.cost ?? 0}</div>` : '<div></div>'}
                  ${(hasReadiness && readiness !== null) ? `
                    <div class="w-2.5 h-2.5 rounded-full ${readiness >= 1 ? 'bg-emerald-500' : readiness === 0 ? 'bg-yellow-500' : 'bg-red-600'} border border-black shadow z-20"></div>
                  ` : ''}
                </div>
                ${!card.artUrl ? `
                <div class="absolute inset-0 flex items-center justify-center p-1 pointer-events-none z-10">
                  <span class="text-[9px] font-bold text-white text-center leading-tight drop-shadow-[0_2px_2px_rgba(0,0,0,1)] break-words w-full px-1">${card.name}</span>
                </div>
                ` : ''}
                ${showBottomStats ? `
                  <div class="flex justify-between items-end w-full mt-auto relative z-20">
                    ${hasStrength ? `<div class="text-yellow-400 font-black text-[11px] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">${Math.max(0, card.strength)}</div>` : '<div class="w-5 h-5 shrink-0"></div>'}
                    ${showHealth ? `<div class="text-red-400 font-black text-[11px] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">${displayHealth}</div>` : '<div class="w-5 h-5 shrink-0"></div>'}
                  </div>
                ` : ''}
              </div>
              ${overlayHTML}
              ${inspectButton}
            </div>
          `;
          return;
        }

        if (isMicro) {
          this.innerHTML = `
            <div 
              onclick="${onClick}"
              ${rightClickAttr}
              title="${safeTooltip}"
              class="group relative flex-shrink-0 w-[128px] sm:w-[144px] h-[64px] rounded-md ${style.bg} ${dynamicBorderClass} ${isSelected ? 'ring-2 ring-yellow-400 scale-105 z-20' : ''} ${isTargetable ? 'ring-2 ring-cyan-400 animate-pulse z-20 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.6)]' : ''} cursor-pointer transition-all duration-200 flex flex-col justify-between select-none overflow-hidden shadow-md ${hiddenClass}"
              style="${hexBg} ${dynamicBorderStyle}"
            >
              <div class="absolute inset-0 z-0 flex items-center justify-center ${fieldDimmingClass}">
                ${card.artUrl ? `<img src="${card.artUrl}" class="w-full h-full object-contain opacity-90" style="${artStyle}" draggable="false" />` : ''}
              </div>
              <div class="relative z-10 w-full h-full p-1.5 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/60 ${fieldDimmingClass}">
                <div class="flex items-center gap-1.5 w-full pr-6">
                  ${!isAvatar ? `<div class="w-4 h-4 rounded-full bg-amber-500 text-black font-black text-[9px] flex items-center justify-center border border-black shadow pointer-events-auto shrink-0">${card.cost ?? 0}</div>` : ''}
                  <div class="text-white text-[11px] font-black truncate drop-shadow-md leading-tight w-full">${card.name}</div>
                </div>
                ${showBottomStats ? `
                  <div class="flex justify-between items-end w-full px-0.5 mt-auto">
                    ${hasStrength ? `<div class="w-5 h-5 rounded-full bg-yellow-500 border border-black text-black font-black text-[10px] flex items-center justify-center shadow">${Math.max(0, card.strength)}</div>` : '<div class="w-5 h-5 shrink-0"></div>'}
                    ${hasArmor ? `<div class="w-5 h-5 rounded bg-cyan-600 border border-black text-white font-black text-[9px] flex items-center justify-center shadow"><div class="w-2.5 h-2.5 mr-0.5">${getIconSvg('armor')}</div>${card.armor}</div>` : '<div class="w-5 h-5 shrink-0"></div>'}
                    ${showHealth ? `<div class="w-5 h-5 rounded-full bg-red-600 border border-black text-white font-black text-[10px] flex items-center justify-center shadow">${displayHealth}</div>` : '<div class="w-5 h-5 shrink-0"></div>'}
                  </div>
                ` : ''}
              </div>
              ${(hasReadiness && readiness !== null) ? `
                <div class="absolute top-1 right-1 text-[7px] px-1 py-0.5 rounded font-black uppercase z-20 ${
                  readiness >= 1 ? 'bg-emerald-500 text-black' : 
                  readiness === 0 ? 'bg-yellow-500 text-black' : 'bg-red-950 text-red-400 border border-red-700'
                }">
                  ${readiness > 1 ? 'OVR-RDY' : readiness === 1 ? 'RDY' : readiness === 0 ? 'UNRDY' : 'EXH'}
                </div>
              ` : ''}
              ${(card.attachments && card.attachments.length > 0) ? `
                <div class="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded bg-fuchsia-600 border border-black text-white font-black text-[8px] flex items-center justify-center z-30 shadow"><div class="w-2.5 h-2.5 mr-px">${getIconSvg('attach')}</div>${card.attachments.length}</div>
              ` : ''}
              ${overlayHTML}
              ${inspectButton}
            </div>
          `;
          return;
        }

        this.innerHTML = `
          <div 
            onclick="${onClick}"
            ${rightClickAttr}
            title="${safeTooltip}"
            class="group relative flex-shrink-0 ${CARD_BASE_CLASSES} rounded-xl ${style.bg} ${dynamicBorderClass} ${isSelected ? 'ring-4 ring-yellow-400 scale-105 z-20' : ''} ${isTargetable ? 'ring-4 ring-cyan-400 animate-pulse z-20 cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.6)]' : ''} cursor-pointer transition-all duration-200 flex flex-col select-none overflow-hidden ${hiddenClass}"
            style="${hexBg} ${dynamicBorderStyle}"
          >
            <div class="absolute inset-0 opacity-10 mix-blend-overlay ${fieldDimmingClass}"></div>
            
            <div class="w-full h-[60%] bg-slate-900 border-b-2 ${separatorClass} shrink-0 relative overflow-hidden flex items-center justify-center ${fieldDimmingClass}">
              ${card.artUrl ? `<img src="${card.artUrl}" class="w-full h-full object-contain" style="${artStyle}" draggable="false" />` : ''}
              <div class="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[90%] flex justify-center z-30 pointer-events-none">
                <div class="bg-black/20 backdrop-blur-sm text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full truncate text-center max-w-full shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-tight uppercase tracking-wide">
                  ${card.name}
                </div>
              </div>
            </div>

            <div class="w-full h-[40%] ${style.lightBg} p-1.5 sm:p-2 flex flex-col relative overflow-hidden ${fieldDimmingClass}" style="${hexLightBg}">
              ${isToken ? '<div class="absolute inset-0 bg-white/5 pointer-events-none"></div>' : ''}
              
              <div class="flex-1 flex flex-col gap-0.5 overflow-hidden w-full relative z-10 pointer-events-none pt-0.5">
                ${abilitiesHTML}
              </div>

              ${showBottomStats ? `
                <div class="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between items-end pointer-events-none">
                  ${hasStrength ? `
                    <div class="w-6 h-6 rounded-full bg-yellow-500 border border-black text-black font-black text-[11px] flex items-center justify-center shadow pointer-events-auto" title="Strength">${Math.max(0, card.strength)}</div>
                  ` : '<div class="w-6 h-6 shrink-0"></div>'}
                  ${hasArmor ? `
                    <div class="w-6 h-6 rounded bg-cyan-600 border border-black text-white font-black text-[10px] flex items-center justify-center shadow pointer-events-auto" title="Armor: ${card.armor}"><div class="w-3 h-3 mr-0.5">${getIconSvg('armor')}</div>${card.armor}</div>
                  ` : '<div class="w-6 h-6 shrink-0"></div>'}
                  ${showHealth ? `
                    <div class="w-6 h-6 rounded-full bg-red-600 border border-black text-white font-black text-[11px] flex items-center justify-center shadow pointer-events-auto" title="Health">${displayHealth}</div>
                  ` : '<div class="w-6 h-6 shrink-0"></div>'}
                </div>
              ` : ''}
            </div>

            <div class="absolute top-1 left-1 flex flex-col items-center gap-1.5 z-10 pointer-events-none">
              ${!isAvatar ? `
                <div class="w-7 h-7 rounded-full bg-amber-500 text-black font-black text-[12px] flex items-center justify-center border border-black shadow pointer-events-auto" title="Cost">
                  ${card.cost ?? 0}
                </div>
              ` : ''}
              ${card.power > 0 ? `
                <div class="w-7 h-7 rounded-full bg-purple-600 text-white font-black text-[12px] flex items-center justify-center border border-black shadow pointer-events-auto" title="Power">
                  ${card.power}
                </div>
              ` : ''}
              ${isUnit ? `
                <div class="w-5 h-5 flex items-center justify-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${isTempLine ? 'text-green-300 drop-shadow-[0_0_6px_rgba(134,239,172,0.9)]' : 'text-white'} pointer-events-auto" title="${isTempLine ? 'Temporary Line: ' : 'Line: '}${activeLine.charAt(0).toUpperCase() + activeLine.slice(1)}">
                  ${getLineIconSvg(activeLine)}
                </div>
              ` : ''}
            </div>
            ${readinessBadge}
            ${attachmentsBadge}
            ${fastBadge}
            ${inspectButton}
            ${overlayHTML}
          </div>
        `;
    }
}

customElements.define('game-card', GameCard);