import { TRIBE_STYLES, CARD_BASE_CLASSES, getIconSvg, getLineIconSvg, hasEngineFlag, formatAbilityCostBadge, SVG_STUNNED, SVG_DAZED, formatCardText } from '../src/ui.js';

export class GameCard extends HTMLElement {
    connectedCallback() {
        this.style.display = 'contents';
        this.render();
    }

    static get observedAttributes() { 
        return ['card-data', 'size', 'is-hand', 'is-selected', 'is-targetable', 'is-casting', 'readiness', 'ability-uses']; 
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
        const isCasting = this.getAttribute('is-casting') === 'true';
        
        const readinessAttr = this.getAttribute('readiness');
        const readiness = readinessAttr !== null && readinessAttr !== 'null' && readinessAttr !== 'undefined' ? parseInt(readinessAttr) : null;
        
        const onClick = this.getAttribute('on-click') || '';
        const onInspect = this.getAttribute('on-inspect') || '';
        
        const abilityUsesStr = this.getAttribute('ability-uses');
        const abilityUses = abilityUsesStr ? JSON.parse(decodeURIComponent(abilityUsesStr)) : {};

        const options = { abilityUses, isHand };

        const style = TRIBE_STYLES[card.tribe] || TRIBE_STYLES.Mythic;
        const cardArtUrl = card.artUrl;
        const bgArtUrl = style.bgImageUrl;
        
        const bgTransX = style.bgImageX ?? 0;
        const bgTransY = style.bgImageY ?? 0;
        const bgScale = style.bgImageScale ?? 100;
        const bgArtStyle = `object-position: center; transform: translate(${bgTransX}px, ${bgTransY}px) scale(${bgScale / 100});`;

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
          <div class="absolute top-0 right-7 sm:right-8 text-[8px] sm:text-[9px] px-2 py-0.5 rounded-b-lg font-black uppercase tracking-wider z-20 border-x-2 border-b-2 border-black shadow-md ${
            readiness >= 1 ? 'bg-emerald-500 text-black' : 
            readiness === 0 ? 'bg-yellow-500 text-black' : 'bg-red-950 text-red-400'
          }">
            ${readiness > 1 ? 'OVER-READY' : readiness === 1 ? 'READY' : readiness === 0 ? 'UNREADY' : 'EXHAUSTED'}
          </div>
        ` : '';

        const inspectButton = onInspect ? `
          <button 
            onclick="event.stopPropagation(); ${onInspect}"
            class="absolute top-0 right-0 ${(isMicro || isNano) ? 'w-[18px] h-[20px] text-[8px]' : 'w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] text-[10px] sm:text-xs'} rounded-bl-lg bg-slate-900/80 hover:bg-slate-700 text-white font-black flex items-start justify-end pt-[1px] pr-[2px] sm:pt-[2px] sm:pr-[3px] border-l-2 border-b-2 border-slate-500 shadow-lg z-30 transition-colors backdrop-blur-sm leading-none"
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
                isKeyword: true,
                cost: {}
            });
        }

        if (displayAbilities.length > 0) {
            const evergreen = [];
            const bespoke = [];
            const active = [];

            // Bucket 1: Sorting
            displayAbilities.forEach(ab => {
                const isKeyword = ab.isKeyword || (ab.trigger === 'UNTRIGGERABLE' && (!ab.effects || ab.effects.length === 0 || ab.passiveFlags?.length > 0));
                if (isKeyword) {
                    evergreen.push(ab);
                } else if (ab.trigger === 'MANUAL') {
                    active.push(ab);
                } else {
                    bespoke.push(ab);
                }
            });

            // Bucket 2: Rendering Evergreen Keywords
            if (evergreen.length > 0) {
                const names = evergreen.map(a => a.name).join(', ');
                const tooltips = evergreen.map(a => `${a.name}: ${a.displayDescription || a.description || 'System Keyword'}`).join('\n\n');
                abilitiesHTML += `<div class="text-[10px] sm:text-[11px] font-black text-amber-300 text-center leading-tight mb-1.5 cursor-help drop-shadow-md" title="${tooltips.replace(/"/g, '&quot;')}">${names}</div>`;
            }

            // Bucket 3: Rendering Bespoke Automated Triggers
            if (bespoke.length > 0) {
                bespoke.forEach(ab => {
                    let desc = ab.displayDescription || ab.description || '';
                    
                    // Strip the redundant Ability Name from the start of the auto-generated string if it exists
                    if (ab.name && desc.startsWith(ab.name)) {
                        desc = desc.substring(ab.name.length).trim();
                        if (desc.startsWith(':') || desc.startsWith('-')) desc = desc.substring(1).trim();
                    }
                    
                    const formatted = formatCardText(desc);
                    const safeTooltip = (ab.name ? ab.name + ': ' : '') + desc.replace(/"/g, '&quot;');
                    abilitiesHTML += `<div class="text-[9px] text-slate-200 leading-snug mb-1 text-center drop-shadow-sm" title="${safeTooltip}">${formatted}</div>`;
                });
            }

            // Bucket 4: Rendering Active Manual Buttons
            if (active.length > 0) {
                active.forEach(ab => {
                    const abilityKey = `${card.instanceId}_${ab.abilityId}`;
                    const uses = (options.abilityUses || {})[abilityKey] || 0;
                    
                    let isUsable = true;
                    let showHourglass = false;
                    
                    if (ab.triggerLimit === 'ONCE_PER_ROUND' && uses >= 1) { isUsable = false; showHourglass = true; }
                    if (ab.triggerLimit === 'TWICE_PER_ROUND' && uses >= 2) { isUsable = false; showHourglass = true; }

                    const isAttack = ab.effects && ab.effects.some(g => g.payloads && g.payloads.some(p => p.type === 'ATTACK'));

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

                    if (options.isHand || card.readiness === undefined) {
                        isUsable = true;
                        showHourglass = false;
                    }

                    const iconContent = isAttack ? `<span class="inline-block w-2.5 h-2.5 align-middle mr-0.5">${getIconSvg('attack')}</span>` : '';
                    const hourglassIcon = (!isUsable && showHourglass) ? `<span class="inline-block w-2.5 h-2.5 align-middle mr-0.5 text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.8)]">${getIconSvg('hourglass-full')}</span>` : '';
                    
                    const textColorClass = isUsable ? 'text-slate-200' : 'text-slate-500 opacity-80';
                    const safeTooltip = (ab.displayDescription || ab.description || '').replace(/"/g, '&quot;');
                    
                    abilitiesHTML += `
                      <div class="text-[9px] ${textColorClass} font-bold leading-tight truncate w-full text-center mt-0.5 cursor-help bg-black/20 rounded py-0.5 border border-white/5" title="${safeTooltip}">
                        <span>${hourglassIcon}${iconContent}</span>${formatAbilityCostBadge(ab.cost, card.tribe)}
                      </div>
                    `;
                });
            }
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
              class="group relative flex-shrink-0 w-[80px] sm:w-[90px] h-[80px] rounded-md ${style.bg} ${dynamicBorderClass} ${isSelected ? 'ring-2 ring-yellow-400 scale-105 z-20' : ''} ${isTargetable ? 'ring-2 ring-cyan-400 animate-pulse z-20 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.6)]' : ''} ${isCasting ? 'ring-4 ring-fuchsia-500 shadow-[0_0_25px_rgba(217,70,239,0.8)] scale-105 z-30' : ''} cursor-pointer transition-all duration-200 flex flex-col justify-between select-none overflow-hidden shadow-md ${hiddenClass}"
              style="${hexBg} ${dynamicBorderStyle}"
            >
              <div class="absolute inset-0 z-0 flex items-center justify-center ${fieldDimmingClass}">
                ${cardArtUrl ? `<img src="${cardArtUrl}" class="w-full h-full object-contain opacity-90" style="${artStyle}" draggable="false" />` : ''}
              </div>
              <div class="relative z-10 w-full h-full p-1 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/60 ${fieldDimmingClass}">
                <div class="flex items-start justify-between w-full relative z-20">
                  ${!isAvatar ? `<div class="w-4 h-4 rounded-full bg-amber-500 text-black font-black text-[9px] flex items-center justify-center border border-black shadow pointer-events-auto shrink-0">${card.cost ?? 0}</div>` : '<div></div>'}
                  ${(hasReadiness && readiness !== null) ? `
                    <div class="w-2.5 h-2.5 rounded-full ${readiness >= 1 ? 'bg-emerald-500' : readiness === 0 ? 'bg-yellow-500' : 'bg-red-600'} border border-black shadow z-20"></div>
                  ` : ''}
                </div>
                ${!cardArtUrl ? `
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
              class="group relative flex-shrink-0 w-[128px] sm:w-[144px] h-[64px] rounded-md ${style.bg} ${dynamicBorderClass} ${isSelected ? 'ring-2 ring-yellow-400 scale-105 z-20' : ''} ${isTargetable ? 'ring-2 ring-cyan-400 animate-pulse z-20 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.6)]' : ''} ${isCasting ? 'ring-4 ring-fuchsia-500 shadow-[0_0_25px_rgba(217,70,239,0.8)] scale-105 z-30' : ''} cursor-pointer transition-all duration-200 flex flex-col justify-between select-none overflow-hidden shadow-md ${hiddenClass}"
              style="${hexBg} ${dynamicBorderStyle}"
            >
              <div class="absolute inset-0 z-0 flex items-center justify-center ${fieldDimmingClass}">
                ${cardArtUrl ? `<img src="${cardArtUrl}" class="w-full h-full object-contain opacity-90" style="${artStyle}" draggable="false" />` : ''}
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
            class="group relative flex-shrink-0 ${CARD_BASE_CLASSES} rounded-xl ${style.bg} ${dynamicBorderClass} ${isSelected ? 'ring-4 ring-yellow-400 scale-105 z-20' : ''} ${isTargetable ? 'ring-4 ring-cyan-400 animate-pulse z-20 cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.6)]' : ''} ${isCasting ? 'ring-4 ring-fuchsia-500 shadow-[0_0_25px_rgba(217,70,239,0.8)] scale-105 z-30' : ''} cursor-pointer transition-all duration-200 flex flex-col select-none overflow-hidden ${hiddenClass}"
            style="${hexBg} ${dynamicBorderStyle}"
          >
            <div class="absolute inset-0 opacity-10 mix-blend-overlay ${fieldDimmingClass}"></div>
            
            <div class="w-full h-[60%] bg-slate-900 border-b-2 ${separatorClass} shrink-0 relative overflow-hidden flex items-center justify-center ${fieldDimmingClass}">
              ${bgArtUrl ? `<img src="${bgArtUrl}" class="absolute inset-0 w-full h-full object-cover object-center z-0 opacity-60 mix-blend-overlay" style="${bgArtStyle}" draggable="false" />` : ''}
              ${cardArtUrl ? `<img src="${cardArtUrl}" class="w-full h-full object-contain relative z-10" style="${artStyle}" draggable="false" />` : ''}
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
                <div class="absolute bottom-0 left-0 right-0 flex justify-between items-end pointer-events-none z-20">
                  ${hasStrength ? `
                    <div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] rounded-tr-lg bg-yellow-500 border-r-2 border-t-2 border-black text-black font-black text-sm sm:text-base flex items-end justify-start pb-[1px] pl-[2px] sm:pb-[2px] sm:pl-[3px] shadow-lg pointer-events-auto leading-none" title="Strength">${Math.max(0, card.strength)}</div>
                  ` : '<div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] shrink-0"></div>'}
                  ${hasArmor ? `
                    <div class="h-[20px] sm:h-[24px] px-1 rounded-t-lg bg-cyan-600 border-x-2 border-t-2 border-black text-white font-black text-[9px] sm:text-[10px] flex items-end justify-center pb-[1px] sm:pb-[2px] shadow-lg pointer-events-auto leading-none" title="Armor: ${card.armor}"><div class="w-2.5 h-2.5 mr-0.5">${getIconSvg('armor')}</div>${card.armor}</div>
                  ` : ''}
                  ${showHealth ? `
                    <div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] rounded-tl-lg bg-red-600 border-l-2 border-t-2 border-black text-white font-black text-sm sm:text-base flex items-end justify-end pb-[1px] pr-[2px] sm:pb-[2px] sm:pr-[3px] shadow-lg pointer-events-auto leading-none" title="Health">${displayHealth}</div>
                  ` : '<div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] shrink-0"></div>'}
                </div>
              ` : ''}
            </div>

            <div class="absolute top-0 left-0 flex flex-col items-start z-10 pointer-events-none">
              ${!isAvatar ? `
                <div class="w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] rounded-br-lg bg-amber-500 text-black font-black text-sm sm:text-base flex items-start justify-start pt-[1px] pl-[2px] sm:pt-[2px] sm:pl-[3px] border-r-2 border-b-2 border-black shadow-lg pointer-events-auto leading-none" title="Cost">
                  ${card.cost ?? 0}
                </div>
              ` : ''}
              ${card.power > 0 ? `
                <div class="w-[16px] h-[18px] sm:w-[20px] sm:h-[22px] rounded-br-lg bg-purple-600 text-white font-black text-[10px] sm:text-xs flex items-start justify-start pt-[1px] pl-[2px] sm:pt-[2px] sm:pl-[3px] border-r-2 border-b-2 border-black shadow-lg pointer-events-auto leading-none -mt-0.5" title="Power">
                  ${card.power}
                </div>
              ` : ''}
              ${isUnit ? `
                <div class="w-5 h-5 sm:w-6 sm:h-6 mt-1 ml-1 flex items-center justify-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${isTempLine ? 'text-green-300 drop-shadow-[0_0_6px_rgba(134,239,172,0.9)]' : 'text-white'} pointer-events-auto" title="${isTempLine ? 'Temporary Line: ' : 'Line: '}${activeLine.charAt(0).toUpperCase() + activeLine.slice(1)}">
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