import { getIconSvg, getLineIconSvg, SVG_STUNNED, SVG_DAZED, SVG_EXHAUST, SVG_UNREADY, SVG_FREE, getSystemLineAbility } from '../src/ui.js';
import { generateAbilityDescription } from '../src/language_description.js';
import { getTriggerWord } from '../src/language/triggers.js';
import { renderNano } from './nano_card.js';
import { renderStandard, renderStandardAbilities } from './standard_card.js';
import { renderJumbo } from './jumbo_card.js';
import { CARD_THEME } from './card_theme.js';

/*
  TAILWIND CDN SAFELIST (Ensures default DB seeded classes are compiled even if not explicitly in HTML)
  bg-pink-900 bg-pink-950/90 text-pink-300
  bg-emerald-900 bg-emerald-950/90 text-emerald-300
  bg-orange-900 bg-orange-950/90 text-orange-300
  bg-amber-900 bg-amber-950/90 text-amber-300
  bg-slate-800 bg-slate-900 bg-slate-900/90 text-blue-300
  bg-purple-900 bg-purple-950/90 text-purple-300
  bg-cyan-900 bg-cyan-950/90 text-cyan-300
  bg-slate-950/90 text-slate-300
  bg-red-900 bg-red-950/90 text-red-300
  bg-lime-900 bg-lime-950/90 text-lime-300
  bg-yellow-900 bg-yellow-950/90 text-yellow-300
*/

function getLiveTribeStyle(tribeName) {
    const globalTribes = (typeof window !== 'undefined') ? ((window.ClientState && window.ClientState.customTribesList) || (window.StudioState && window.StudioState.customTribesList) || (window.CardState && window.CardState.customTribes) || []) : [];
    
    const searchStr = (tribeName || 'generic').toLowerCase().replace('tribe_', '');

    const match = globalTribes.find(t => 
        (t.id || '').toLowerCase() === searchStr || 
        (t.name || '').toLowerCase() === searchStr ||
        (t.id || '').toLowerCase() === `tribe_${searchStr}`
    );
    
    if (match) {
        return {
            bg: match.colorBgClass || match.bgClass || 'bg-slate-800', 
            lightBg: match.colorLightBgClass || match.lightBgClass || 'bg-slate-900/90', 
            border: match.colorBorderClass || match.borderClass || 'border-black', 
            text: match.colorTextClass || match.textClass || 'text-slate-300',
            hexBg: match.colorBgHex || match.hexBg || null, 
            hexLightBg: match.colorLightBgHex || match.hexLightBg || null, 
            hexBorder: match.colorBorderHex || match.hexBorder || null,
            iconSvg: match.iconSvg || null, 
            name: match.name || tribeName, 
            bgImageUrl: match.bgImageUrl || null,
            bgImageX: match.bgImageX || 0, 
            bgImageY: match.bgImageY || 0, 
            bgImageScale: match.bgImageScale || 100
        };
    }
    
    const prettyName = tribeName ? tribeName.replace('tribe_', '') : 'Generic';
    const finalName = prettyName.charAt(0).toUpperCase() + prettyName.slice(1);
    
    return {
        bg: 'bg-slate-800', lightBg: 'bg-slate-900/90', border: 'border-black', text: 'text-slate-300',
        hexBg: null, hexLightBg: null, hexBorder: null, iconSvg: null, name: finalName, bgImageUrl: null, bgImageX: 0, bgImageY: 0, bgImageScale: 100
    };
}

export function formatAbilityCostBadge(cost, cardTribe) {
    if (!cost) return '';
    let badgeStr = '';
    const carnieCost = cost.carnie || cost.tent || 0;
    for (let i = 0; i < carnieCost; i++) {
      badgeStr += `<span class="inline-block w-[1.2em] h-[1.2em] align-middle -translate-y-[0.225em] text-purple-400 drop-shadow-sm">${getIconSvg('tent')}</span>`
    }
    if (cost.power > 0) badgeStr += `${cost.power}⚡`;
    if (cost.tribeAmount > 0) {
        const tType = cost.tribeType || cardTribe || 'Generic';
        if (tType && tType !== 'NONE' && tType !== 'Generic') {
            const style = getLiveTribeStyle(tType);
            if (style && style.iconSvg) {
                badgeStr += `${cost.tribeAmount}<span class="inline-block w-[1.2em] h-[1.2em] overflow-hidden align-middle -translate-y-[0.225em] mr-0.5"><div class="raw-user-svg-container w-full h-full">${style.iconSvg}</div></span>`;
            } else {
                const tribeName = style && style.name ? style.name : tType;
                badgeStr += `${cost.tribeAmount}${tribeName.charAt(0).toUpperCase()}`;
            }
        } else {
            badgeStr += `${cost.tribeAmount}💎`;
        }
    }
    
    if (cost.readinessCost === 'EXHAUSTS') badgeStr += SVG_EXHAUST;
    if (cost.readinessCost === 'UNREADIES') badgeStr += SVG_UNREADY;
    if (cost.freeAction) badgeStr += SVG_FREE;
    
    return badgeStr.trim() ? `<span class="text-[9px] text-amber-300 font-bold ml-0.5 mr-0.5 tracking-tighter whitespace-nowrap opacity-90">${badgeStr}</span>` : '';
}

export const hasEngineFlag = (card, flag) => {
    if (!card) return false;
    if (card.passiveFlags && card.passiveFlags.includes(flag)) return true;
    if (card.abilities && card.abilities.some(a => a.passiveFlags && a.passiveFlags.includes(flag))) return true;
    if (card.activeEffects && card.activeEffects.some(e => e.type === flag)) return true;
    return false;
};

export function formatCardText(text, allAbilitiesRegistry = []) {
    if (!text) return '';
    let formatted = text;

    formatted = formatted.replace(/\*\*([\s\S]*?)\*\*/g, '<span class="font-black text-amber-400">$1</span>');

    const statMap = {
        'strength': getIconSvg('attack'),
        'health': getIconSvg('health'),
        'maxhealth': getIconSvg('health'),
        'power': getIconSvg('power'),
        'armor': getIconSvg('armor'),
        'acts': getIconSvg('fast'),
        'carnie': getIconSvg('tent'),
        'tent': getIconSvg('tent'),
        'readiness': getIconSvg('hourglass-full')
    };

    formatted = formatted.replace(/((?:(?:gain|lose|heal|deal|take|pay|recover|harvest)\s*)?[+-]?\s*\d*\s*)\[\[?(?:STAT|RESOURCE|RESOURCES):([a-zA-Z]+)\]\]?/gi, (match, prefix, p1) => {
        const key = p1.toLowerCase();
        const svg = statMap[key];
        
        let tokenColor = (key === 'carnie' || key === 'tent') ? 'text-purple-400' : 'text-amber-300';
        let prefixColor = 'text-slate-200';
        
        const lowerPrefix = prefix.toLowerCase();
        if (lowerPrefix.includes('+') || lowerPrefix.includes('gain') || lowerPrefix.includes('heal') || lowerPrefix.includes('recover') || lowerPrefix.includes('harvest')) {
            prefixColor = 'text-emerald-400';
        } else if (lowerPrefix.includes('-') || lowerPrefix.includes('lose') || lowerPrefix.includes('deal') || lowerPrefix.includes('take') || lowerPrefix.includes('pay')) {
            prefixColor = 'text-red-400';
        }

        let prefixHtml = prefix ? `<span class="${prefixColor} font-bold drop-shadow-sm">${prefix}</span>` : '';

        if (svg) {
            return `<span class="whitespace-nowrap">${prefixHtml}<span class="inline-block w-[1.1em] h-[1.1em] align-middle -translate-y-[0.1em] ml-0.5 ${tokenColor} drop-shadow-md">${svg}</span></span>`;
        }
        return `<span class="whitespace-nowrap">${prefixHtml}<span class="font-bold ${tokenColor} uppercase">${p1}</span></span>`;
    });

    formatted = formatted.replace(/((?:(?:move|return|shuffle|draw|discard|banish|trash)\s*)?(?:to|from|in|into)?\s*)\[BATTLELINE:([a-zA-Z_]+)\]/gi, (match, prefix, p1) => {
        const line = p1.toLowerCase();
        const svg = getLineIconSvg(line);
        
        let prefixColor = 'text-slate-200';
        const lowerPrefix = prefix.toLowerCase();
        if (lowerPrefix.includes('move') || lowerPrefix.includes('return') || lowerPrefix.includes('draw')) {
            prefixColor = 'text-sky-400';
        } else if (lowerPrefix.includes('discard') || lowerPrefix.includes('banish') || lowerPrefix.includes('trash')) {
            prefixColor = 'text-red-400';
        } else if (lowerPrefix.includes('shuffle')) {
            prefixColor = 'text-fuchsia-400';
        }

        let prefixHtml = prefix ? `<span class="${prefixColor} font-bold drop-shadow-sm">${prefix}</span>` : '';

        if (svg) {
            return `<span class="whitespace-nowrap">${prefixHtml}<span class="inline-block w-[1.1em] h-[1.1em] align-middle -translate-y-[0.1em] ml-0.5 text-sky-300 drop-shadow-md">${svg}</span></span>`;
        }
        return `<span class="whitespace-nowrap">${prefixHtml}<span class="font-bold text-sky-300 uppercase">${p1.replace(/_/g, ' ')}</span></span>`;
    });
    
    formatted = formatted.replace(/@\[(.*?)\]/g, (match, p1) => {
        let displayName = p1;
        if (p1.startsWith('ability_')) {
            const found = allAbilitiesRegistry.find(a => a.abilityId === p1);
            if (found && found.name) {
                displayName = found.name;
            }
        }
        return `<span class="text-fuchsia-400 font-bold cursor-help border-b border-fuchsia-400/30" title="See Glossary: ${displayName}">${displayName}</span>`;
    });

    return formatted;
}

if (typeof window !== 'undefined') {
    // Create a memory cache to store cards instead of dumping them into the DOM
    window.__GAME_CARD_CACHE = window.__GAME_CARD_CACHE || new Map();
    window.inspectFromCache = (cacheId) => {
        const cachedCard = window.__GAME_CARD_CACHE.get(cacheId);
        if (cachedCard && typeof window.inspectCard === 'function') {
            // Generate the inspection string only when clicked
            const json = encodeURIComponent(JSON.stringify(cachedCard)).replace(/'/g, "%27");
            window.inspectCard(json);
        }
    };
}

export function renderCardHTML(card, options = {}) {
    // Save the card in memory
    const cacheId = card.instanceId || card.id || ('temp_' + Math.random().toString(36).substring(2, 9));
    if (typeof window !== 'undefined' && window.__GAME_CARD_CACHE) {
        window.__GAME_CARD_CACHE.set(cacheId, card);
    }

    const instanceId = card.instanceId || card.id;
    let attrs = `cache-id="${cacheId}" data-instance-id="${instanceId}"`;
    
    if (options.size === 'jumbo') attrs += ` size="jumbo"`;
    else if (options.isMicro) attrs += ` size="micro"`;
    else if (options.isNano) attrs += ` size="nano"`;
    if (options.isHand) attrs += ` is-hand="true"`;
    if (options.isSelected) attrs += ` is-selected="true"`;
    if (options.isTargetable) attrs += ` is-targetable="true"`;
    if (options.isCasting) attrs += ` is-casting="true"`;
    if (options.isTargetingMode) attrs += ` is-targeting-mode="true"`;
    if (options.isForceHover) attrs += ` is-force-hover="true"`;
    if (options.onMouseLeave) attrs += ` onmouseleave="${options.onMouseLeave.replace(/"/g, '&quot;')}"`;
    if (options.actionState) attrs += ` action-state="${options.actionState}"`;
    if (options.readiness !== undefined && options.readiness !== null) attrs += ` readiness="${options.readiness}"`;
    if (options.onClick) attrs += ` on-click="${options.onClick.replace(/"/g, '&quot;')}"`;
    
    // Intercept inspect events to hide the JSON blob from the DOM
    let cleanInspect = options.onInspect;
    if (cleanInspect && cleanInspect.includes('window.inspectCard(')) {
        cleanInspect = `window.inspectFromCache('${cacheId}')`;
    }
    if (cleanInspect) attrs += ` on-inspect="${cleanInspect.replace(/"/g, '&quot;')}"`;
    
    if (options.abilityUses) attrs += ` ability-uses="${encodeURIComponent(JSON.stringify(options.abilityUses))}"`;
    
    return `<game-card ${attrs}></game-card>`;
}

export function computeAbilitiesData(card, options, allAbilitiesRegistry = []) {
    let displayAbilities = card.abilities ? [...card.abilities] : [];
    const isUnit = card.type === 'unit' || card.type === 'avatar';
    const isAvatar = card.type === 'avatar';
    const defLine = card.defaultLine || 'mid';
    
    if (isUnit && !isAvatar && defLine !== 'mid') {
        const lineAb = getSystemLineAbility(defLine);
        if (lineAb) {
            displayAbilities.push({ ...lineAb, isKeyword: true });
        }
    }
    
    const data = { evergreen: [], bespoke: [], active: [] };
    if (displayAbilities.length === 0) return data;

    displayAbilities.forEach(a => {
        const ab = allAbilitiesRegistry.length > 0 ? (allAbilitiesRegistry.find(reg => reg.abilityId === a.abilityId) || a) : a;
        const isKeyword = ab.isKeyword || (ab.trigger === 'UNTRIGGERABLE' && (!ab.effects || ab.effects.length === 0 || ab.passiveFlags?.length > 0));
        
        let rawDesc = ab.displayDescription || ab.description || '';
        if (!rawDesc) {
            try { rawDesc = generateAbilityDescription(ab, allAbilitiesRegistry); } catch (e) {}
        }
        
        const costBadge = formatAbilityCostBadge(ab.cost, card.tribe);

        if (isKeyword) {
            data.evergreen.push({
                name: ab.name || 'System Keyword',
                costBadge: costBadge,
                rawDesc: rawDesc || 'System Keyword'
            });
        } else if (ab.trigger === 'MANUAL') {
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
                const attackBlock = checkBlock('BLOCK_ATTACK');

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

            data.active.push({
                name: ab.name || 'Action',
                costBadge: costBadge,
                rawDesc: rawDesc,
                formattedDesc: formatCardText(rawDesc, allAbilitiesRegistry),
                isUsable,
                showHourglass,
                isAttack
            });
        } else {
            let desc = rawDesc;
            if (!rawDesc && ab.name) rawDesc = `**${ab.name}**`;
            
            const isSpellPlay = card.type === 'spell' && ['PLAY', 'ON_BE_PLAYED', 'ON_PLAYED'].includes(ab.trigger);
            const event = getTriggerWord(ab.trigger);
            
            if (isSpellPlay) {
                desc = costBadge ? `${costBadge} ${desc}` : desc;
            } else {
                const badgeStr = costBadge ? `${costBadge} ` : '';
                const eventStr = event ? `<span class="${CARD_THEME.eventName}">${event}:</span>` : '';
                desc = `${eventStr}${badgeStr}${desc}`;
            }

            data.bespoke.push({
                name: ab.name || 'Ability',
                costBadge: costBadge,
                rawDesc: rawDesc,
                formattedDesc: formatCardText(desc, allAbilitiesRegistry),
                event: event,
                isSpellPlay: isSpellPlay
            });
        }
    });

    return data;
}

export class GameCard extends HTMLElement {
    connectedCallback() {
        this.style.display = 'contents';
        this.render();
    }

    static get observedAttributes() { 
        return ['cache-id', 'card-data', 'size', 'is-hand', 'is-selected', 'is-targetable', 'is-casting', 'action-state', 'readiness', 'ability-uses', 'is-targeting-mode', 'is-force-hover']; 
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue && this.isConnected) {
            this.render();
        }
    }

    _parseCardData() {
        // First try to load cleanly from RAM via the cache ID
        const cacheId = this.getAttribute('cache-id');
        if (cacheId && typeof window !== 'undefined' && window.__GAME_CARD_CACHE && window.__GAME_CARD_CACHE.has(cacheId)) {
            const cachedCard = window.__GAME_CARD_CACHE.get(cacheId);
            this.setAttribute('data-instance-id', cachedCard.instanceId || cachedCard.id);
            return cachedCard;
        }

        // Fallback to the old DOM-embedded JSON logic if cache-id isn't present
        const dataStr = this.getAttribute('card-data');
        if (!dataStr) return null;
        const card = JSON.parse(decodeURIComponent(dataStr));
        this.setAttribute('data-instance-id', card.instanceId || card.id);
        return card;
    }

    _parseOptions() {
        const size = this.getAttribute('size');
        const readinessAttr = this.getAttribute('readiness');
        const abilityUsesStr = this.getAttribute('ability-uses');
        
        return {
            isJumbo: size === 'jumbo',
            isMicro: size === 'micro',
            isNano: size === 'nano',
            isHand: this.getAttribute('is-hand') === 'true',
            isSelected: this.getAttribute('is-selected') === 'true',
            isTargetable: this.getAttribute('is-targetable') === 'true',
            isCasting: this.getAttribute('is-casting') === 'true',
            isTargetingMode: this.getAttribute('is-targeting-mode') === 'true',
            isForceHover: this.getAttribute('is-force-hover') === 'true',
            actionState: this.getAttribute('action-state'),
            readiness: readinessAttr !== null && readinessAttr !== 'null' && readinessAttr !== 'undefined' ? parseInt(readinessAttr) : null,
            onClick: this.getAttribute('on-click') || '',
            onInspect: this.getAttribute('on-inspect') || '',
            abilityUses: abilityUsesStr ? JSON.parse(decodeURIComponent(abilityUsesStr)) : {}
        };
    }

    _computeStyleContext(card) {
        const style = getLiveTribeStyle(card.tribe);
        const bgTransX = style.bgImageX ?? 0;
        const bgTransY = style.bgImageY ?? 0;
        const bgScale = style.bgImageScale ?? 100;

        return {
            style,
            hexBg: style.hexBg ? `background-color: ${style.hexBg};` : '',
            hexLightBg: style.hexLightBg ? `background-color: ${style.hexLightBg};` : '',
            hexBorder: style.hexBorder ? `border-color: ${style.hexBorder};` : '',
            bgArtUrl: style.bgImageUrl,
            bgArtStyle: `object-position: center; transform: translate(${bgTransX}px, ${bgTransY}px) scale(${bgScale / 100});`,
            cardArtUrl: card.artUrl
        };
    }

    _computeCardState(card, options) {
        const isUnit = card.type === 'unit' || card.type === 'avatar';
        const isAvatar = card.type === 'avatar';
        const isToken = !!card.isToken;
        const activeLine = card.line || card.defaultLine || (isAvatar ? 'avatar' : 'mid');
        const isTempLine = card.line && card.defaultLine && card.line !== card.defaultLine;
        const hasReadiness = isUnit || card.type === 'equipment' || card.type === 'artifact';

        return { isUnit, isAvatar, isToken, activeLine, isTempLine, hasReadiness };
    }

    _computeStatsContext(card, isAvatar, isUnit) {
        const strVal = card.strength;
        const hasStrength = strVal !== undefined && strVal !== null && strVal !== '' && strVal !== 'null' && !isNaN(Number(strVal));
        
        let displayHealth = card.currentHealth;
        const showHealth = displayHealth !== null && displayHealth !== undefined && displayHealth !== '' && displayHealth !== 'null' && !isNaN(Number(displayHealth));
        const hasArmor = Number(card.armor) > 0;
        
        return {
            hasStrength, showHealth, displayHealth, hasArmor,
            showBottomStats: hasStrength || showHealth || hasArmor
        };
    }

    _computeVisualClasses(card, options, styleContext, cardState) {
        const isStatusApplied = (targetCard, flag, statusNames) => {
            if (targetCard.activeEffects && targetCard.activeEffects.some(e => e.type === flag)) return true;
            if (targetCard.abilities && targetCard.abilities.some(a => statusNames.includes((a.name || '').toLowerCase()))) return true;
            return false;
        };

        const isStunned = isStatusApplied(card, 'BLOCK_ACT', ['stun', 'stunned']);
        const isDazed = isStatusApplied(card, 'BLOCK_RETALIATE', ['daze', 'dazed']) && !isStunned;
        const isHidden = hasEngineFlag(card, 'BLOCK_TARGETING');

        let stateClasses = '';
        if (options.isCasting) {
            stateClasses = 'ring-4 ring-fuchsia-500 shadow-[0_0_25px_rgba(217,70,239,0.8)] scale-105 z-30';
        } else if (options.isTargetable) {
            stateClasses = options.isNano ? 'ring-2 ring-cyan-400 z-20 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.6)]' : 'ring-4 ring-cyan-400 z-20 cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.6)]';
        } else if (options.isSelected) {
            stateClasses = options.isNano ? 'ring-2 ring-yellow-400 scale-105 z-20' : 'ring-4 ring-yellow-400 scale-105 z-20';
        } else if (options.isForceHover && options.actionState === 'single') {
            stateClasses = 'ring-2 ring-blue-300 shadow-[0_0_15px_rgba(96,165,250,0.6)] z-10 cursor-pointer scale-105';
        } else if (options.isForceHover && options.actionState === 'multiple') {
            stateClasses = 'ring-2 ring-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.6)] z-10 cursor-pointer scale-105';
        } else if (options.isForceHover) {
            stateClasses = 'scale-105 z-10 cursor-pointer';
        } else if (options.actionState === 'single') {
            stateClasses = 'ring-2 ring-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.6)] z-10 cursor-pointer hover:ring-blue-300 hover:scale-105';
        } else if (options.actionState === 'multiple') {
            stateClasses = 'ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)] z-10 cursor-pointer hover:ring-yellow-300 hover:scale-105';
        }

        let dynamicBorderClass = cardState.isToken ? 'border-2 border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : `border-2 ${styleContext.style.border}`;
        let dynamicBorderStyle = cardState.isToken ? '' : styleContext.hexBorder;
        
        if (isHidden && !options.isHand) {
            dynamicBorderClass = 'border-2 border-dashed border-white/80 shadow-[0_0_12px_rgba(255,255,255,0.4)]';
            dynamicBorderStyle = '';
        }

        const isFieldUnready = !options.isHand && cardState.hasReadiness && options.readiness !== null && options.readiness === 0;
        const isFieldExhausted = !options.isHand && cardState.hasReadiness && options.readiness !== null && options.readiness < 0;
        const isFieldOverReady = !options.isHand && cardState.hasReadiness && options.readiness !== null && options.readiness > 1;
        const fieldDimmingClass = (isFieldUnready || isFieldExhausted || isStunned || isDazed) ? 'saturate-[0.25] opacity-90' : '';
        const hiddenClass = isHidden && !options.isHand ? 'opacity-60 hover:opacity-100' : '';
        const separatorClass = cardState.isToken ? 'border-white/40' : 'border-black';

        return {
            isStunned, isDazed, isFieldUnready, isFieldExhausted, isFieldOverReady,
            stateClasses, dynamicBorderClass, dynamicBorderStyle, fieldDimmingClass, hiddenClass, separatorClass
        };
    }

    _buildOverlayHTML(visuals) {
        let overlayContent = '';
        let isOverReadyOverlay = false;

        if (visuals.isStunned) overlayContent = SVG_STUNNED;
        else if (visuals.isDazed) overlayContent = SVG_DAZED;
        else if (visuals.isFieldExhausted) overlayContent = getIconSvg('hourglass-full');
        else if (visuals.isFieldUnready) overlayContent = getIconSvg('hourglass-empty');
        else if (visuals.isFieldOverReady) {
            overlayContent = getIconSvg('hourglass-full');
            isOverReadyOverlay = true;
        }

        if (!overlayContent) return '';

        let overlayScaleClass = visuals.isDazed ? 'scale-75' : '';
        if (isOverReadyOverlay) {
            return `
              <div class="absolute inset-0 z-40 flex items-center justify-center pointer-events-none rounded-md">
                <div class="w-16 h-16 ${overlayScaleClass} opacity-60 drop-shadow-[0_0_8px_rgba(134,239,172,0.9)] [&>svg]:!w-full [&>svg]:!h-full [&>svg]:!m-0 [&>svg]:!text-green-400 [&>svg]:!drop-shadow-none">
                  ${overlayContent}
                </div>
              </div>
            `;
        }
        return `
          <div class="absolute inset-0 z-40 flex items-center justify-center pointer-events-none bg-black/30 rounded-md">
            <div class="w-16 h-16 ${overlayScaleClass} text-white opacity-80 drop-shadow-[0_2px_8px_rgba(0,0,0,1)] [&>svg]:!w-full [&>svg]:!h-full [&>svg]:!m-0">
              ${overlayContent}
            </div>
          </div>
        `;
    }

    _buildBadges(card, options, cardState) {
        const rColor = options.readiness > 1 ? CARD_THEME.readinessReady :
                       options.readiness === 1 ? CARD_THEME.readinessReady :
                       options.readiness === 0 ? CARD_THEME.readinessUnready : CARD_THEME.readinessExhausted;
        
        const rClass = options.isJumbo ? CARD_THEME.readinessJumbo : CARD_THEME.readinessBase;

        const readinessBadge = (cardState.hasReadiness && options.readiness !== null) ? `
          <div class="absolute top-0 right-7 sm:right-8 text-[8px] sm:text-[9px] ${rClass} ${rColor}">
            ${options.readiness > 1 ? 'OVER-READY' : options.readiness === 1 ? 'READY' : options.readiness === 0 ? 'UNREADY' : 'EXHAUSTED'}
          </div>
        ` : '';

        const inspectButton = options.onInspect ? `
          <button 
            onclick="event.stopPropagation(); ${options.onInspect}"
            class="absolute top-0 right-0 ${(options.isMicro || options.isNano) ? 'w-[18px] h-[20px] text-[8px]' : 'w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] text-[10px] sm:text-xs'} pt-[1px] pr-[2px] sm:pt-[2px] sm:pr-[3px] ${CARD_THEME.inspectButton}"
            title="Inspect Card"
          >
            🔍
          </button>
        ` : '';

        const fastBadge = (card.fast > 0) ? `
          <div class="absolute -top-1.5 -right-1.5 w-6 h-6 text-[10px] ${CARD_THEME.fastBadge}" title="Fast Charges">
            <div class="w-3 h-3 mr-0.5">${getIconSvg('fast')}</div>${card.fast}
          </div>
        ` : '';

        return { readinessBadge, inspectButton, fastBadge, attachmentsBadge: '' };
    }

    _getCardArtStyle(card) {
        let transX = card.artX ?? 0;
        let transY = card.artY ?? 0;
        let scale = card.artScale ?? 100;
        
        // Convert absolute pixels (based on 128x179 standard card) to percentages
        // This ensures the pan is proportionally identical on Nano and Jumbo sizes!
        let pctX = (transX / 128) * 100;
        let pctY = (transY / 179) * 100;
        
        return `object-position: center; transform: translate(${pctX}%, ${pctY}%) scale(${scale / 100});`;
    }

    _getCameraStyle(card, options) {
        if (!card.artUrl) return ''; // Ignore custom panning if there's no character art to center on
        
        let transX = 0, transY = 0, scale = 100;
        if (options.isNano || options.isMicro) {
            transX = card.nanoArtX ?? 0;
            transY = card.nanoArtY ?? 0;
            scale = card.nanoArtScale ?? 110;
        }
        
        if (scale === 100 && transX === 0 && transY === 0) return '';
        
        return `transform: translate(${transX}px, ${transY}px) scale(${scale / 100});`;
    }

    render() {
        const card = this._parseCardData();
        if (!card) return;
        
        const options = this._parseOptions();
        const styleContext = this._computeStyleContext(card);
        const cardState = this._computeCardState(card, options);
        const statsContext = this._computeStatsContext(card, cardState.isAvatar, cardState.isUnit);
        const visuals = this._computeVisualClasses(card, options, styleContext, cardState);
        const overlayHTML = this._buildOverlayHTML(visuals);
        const badges = this._buildBadges(card, options, cardState);

        const rightClickAttr = options.onInspect ? `oncontextmenu="event.preventDefault(); event.stopPropagation(); ${options.onInspect}"` : '';
        let hoverTooltip = card.name || 'Unknown Card';
        if (card.description) hoverTooltip += `\n"${card.description}"`;
        hoverTooltip += `\n\n(Right-click or tap 🔍 to inspect fully)`;
        const safeTooltip = hoverTooltip.replace(/"/g, '&quot;').replace(/'/g, '&apos;');

        const globalRegistry = (typeof window !== 'undefined') ? ((window.ClientState && window.ClientState.allAbilitiesRegistry) || (window.StudioState && window.StudioState.allAbilitiesRegistry) || (window.CardState && window.CardState.allAbilitiesRegistry) || []) : [];
        
        const abilitiesData = computeAbilitiesData(card, options, globalRegistry);
        const abilitiesHTML = renderStandardAbilities(abilitiesData); // Fallback for nano/micro if they use it
        const artStyle = this._getCardArtStyle(card);
        const cameraStyle = this._getCameraStyle(card, options);

        const ctx = {
            card, ...options, ...styleContext, ...cardState, ...statsContext, ...visuals, ...badges,
            overlayHTML, rightClickAttr, safeTooltip, abilitiesData, abilitiesHTML, artStyle, cameraStyle
        };

        if (options.isJumbo) {
          this.innerHTML = renderJumbo(ctx);
        } else if (options.isNano || options.isMicro) {
          this.innerHTML = renderNano(ctx);
        } else {
          this.innerHTML = renderStandard(ctx);
        }
    }
}

customElements.define('game-card', GameCard);