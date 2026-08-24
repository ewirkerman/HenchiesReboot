import { TRIBE_STYLES, getIconSvg, hasEngineFlag, SVG_STUNNED, SVG_DAZED, buildAbilitiesHTML } from '../src/ui.js';
import { renderNano } from './nano_card.js';
import { renderMicro } from './micro_card.js';
import { renderStandard } from './standard_card.js';

export class GameCard extends HTMLElement {
    connectedCallback() {
        this.style.display = 'contents';
        this.render();
    }

    static get observedAttributes() { 
        return ['card-data', 'size', 'is-hand', 'is-selected', 'is-targetable', 'is-casting', 'action-state', 'readiness', 'ability-uses']; 
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
        const instanceId = card.instanceId || card.id;
        this.setAttribute('data-instance-id', instanceId);
        
        const size = this.getAttribute('size');
        const isMicro = size === 'micro';
        const isNano = size === 'nano';
        const isHand = this.getAttribute('is-hand') === 'true';
        const isSelected = this.getAttribute('is-selected') === 'true';
        const isTargetable = this.getAttribute('is-targetable') === 'true';
        const isCasting = this.getAttribute('is-casting') === 'true';
        const actionState = this.getAttribute('action-state');
        
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

        let stateClasses = '';
        if (isCasting) {
            stateClasses = 'ring-4 ring-fuchsia-500 shadow-[0_0_25px_rgba(217,70,239,0.8)] scale-105 z-30';
        } else if (isTargetable) {
            stateClasses = isNano ? 'ring-2 ring-cyan-400 z-20 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.6)]' : 'ring-4 ring-cyan-400 z-20 cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.6)]';
        } else if (isSelected) {
            stateClasses = isNano ? 'ring-2 ring-yellow-400 scale-105 z-20' : 'ring-4 ring-yellow-400 scale-105 z-20';
        } else if (actionState === 'single') {
            stateClasses = 'ring-2 ring-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.6)] z-10 cursor-pointer hover:ring-blue-300 hover:scale-105';
        } else if (actionState === 'multiple') {
            stateClasses = 'ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)] z-10 cursor-pointer hover:ring-yellow-300 hover:scale-105';
        }

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

        const abilitiesHTML = buildAbilitiesHTML(card, options, false);
        
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

        const ctx = {
            onClick, rightClickAttr, safeTooltip, style, dynamicBorderClass, stateClasses,
            hiddenClass, hexBg, dynamicBorderStyle, fieldDimmingClass, cardArtUrl, artStyle,
            isAvatar, card, hasReadiness, readiness, showBottomStats, hasStrength, showHealth,
            displayHealth, overlayHTML, inspectButton, hasArmor, isToken, separatorClass,
            bgArtUrl, bgArtStyle, abilitiesHTML, isTempLine, activeLine, readinessBadge,
            attachmentsBadge, fastBadge, isHand, isUnit
        };

        if (isNano) {
          this.innerHTML = renderNano(ctx);
          return;
        }

        if (isMicro) {
          this.innerHTML = renderMicro(ctx);
          return;
        }

        this.innerHTML = renderStandard(ctx);
    }
}

customElements.define('game-card', GameCard);