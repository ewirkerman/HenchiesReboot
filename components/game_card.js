import { getIconSvg, getLineIconSvg, SVG_STUNNED, SVG_DAZED, SVG_EXHAUST, SVG_UNREADY, SVG_FREE, getSystemLineAbility } from '../src/ui.js';
import { generateAbilityDescription } from '../src/language_description.js';
import { getTriggerWord } from '../src/language/triggers.js';
import { HoverManager } from '../src/ui/hover_manager.js';
import { renderResourceTextTokens, normalizeResourceTokenName } from '../src/language/utils.js';
import { renderMicro } from './micro_card.js';
import { renderNano } from './nano_card.js';
import { renderStandard, renderStandardAbilities } from './standard_card.js';
import { renderJumbo } from './jumbo_card.js';
import { resolveAssetUrl } from '../src/asset_paths.js';

// --- Global State Helpers (DRY) ---
const getGlobalList = (...properties) => {
    if (typeof window === 'undefined') return [];
    const states = [window.ClientState, window.StudioState, window.CardState];
    for (const state of states) {
        if (!state) continue;
        for (const prop of properties) {
            if (state[prop] && state[prop].length > 0) return state[prop];
        }
    }
    return [];
};

// --- Utilities ---
export const hasEngineFlag = (card, flag) => {
    if (!card) return false;
    return !!(
        card.passiveFlags?.includes(flag) ||
        card.abilities?.some(a => a.passiveFlags?.includes(flag)) ||
        card.activeEffects?.some(e => e.type === flag)
    );
};

const isValidStat = (val) => val !== undefined && val !== null && val !== '' && val !== 'null' && !isNaN(Number(val));

// --- Game Logic Formatting ---
function getLiveTribeStyle(tribeName) {
    const globalTribes = getGlobalList('customTribesList', 'customTribes');
    const searchStr = (tribeName || 'generic').toLowerCase().replace('tribe_', '');
    const prettyName = tribeName ? tribeName.replace('tribe_', '') : 'Generic';
    const finalName = prettyName.charAt(0).toUpperCase() + prettyName.slice(1);

    const match = globalTribes.find(t =>
        (t.id || '').toLowerCase() === searchStr ||
        (t.name || '').toLowerCase() === searchStr ||
        (t.id || '').toLowerCase() === `tribe_${searchStr}`
    );

    const t = match || {};
    return {
        bg: t.colorBgClass || t.bgClass || 'bg-slate-800',
        lightBg: t.colorLightBgClass || t.lightBgClass || 'bg-slate-900/90',
        border: t.colorBorderClass || t.borderClass || 'border-black',
        text: t.colorTextClass || t.textClass || 'text-slate-300',
        hexBg: t.colorBgHex || t.hexBg || null,
        hexLightBg: t.colorLightBgHex || t.hexLightBg || null,
        hexBorder: t.colorBorderHex || t.hexBorder || null,
        iconSvg: t.iconSvg || null,
        name: t.name || finalName,
        bgImageUrl: t.bgImageUrl || null,
        bgImageX: t.bgImageX || 0,
        bgImageY: t.bgImageY || 0,
        bgImageScale: t.bgImageScale || 100
    };
}

export function formatAbilityCostBadge(cost, cardTribe) {
    if (!cost) return '';

    let badgeParts = [];
    const carnieCost = cost.carnie || cost.tent || 0;

    if (carnieCost > 0) badgeParts.push(...Array(carnieCost).fill('[RESOURCE:tent]'));
    if (cost.power > 0) badgeParts.push(`${cost.power}[STAT:power]`);

    if (cost.tribeAmount > 0) {
        const tType = cost.tribeType || cardTribe || 'Generic';
        if (tType && tType !== 'NONE' && tType !== 'Generic') {
            const tribeTokenName = normalizeResourceTokenName(`tribe_${String(tType).replace(/^tribe_/, '').toLowerCase()}`);
            const style = getLiveTribeStyle(tType);

            badgeParts.push(...Array(cost.tribeAmount).fill(`[RESOURCE:${tribeTokenName}]`));

            if (!style.iconSvg) {
                const tribeName = style.name ? style.name : tType;
                badgeParts.push(`${tribeName.charAt(0).toUpperCase()}`);
            }
        } else {
            badgeParts.push(...Array(cost.tribeAmount).fill('[RESOURCE:tribe_generic]'));
        }
    }

    if (cost.readinessCost === 'EXHAUSTS') badgeParts.push(SVG_EXHAUST);
    if (cost.readinessCost === 'UNREADIES') badgeParts.push(SVG_UNREADY);
    if (cost.freeAction) badgeParts.push(SVG_FREE);

    const badgeText = badgeParts.join(' ').trim();
    if (!badgeText) return '';

    const badgeHtml = renderResourceTextTokens(badgeText, {
        colorClass: 'text-purple-400',
        tribeStyle: getLiveTribeStyle(cost.tribeType || cardTribe || 'Generic'),
        iconSizeClass: ''
    });
    return `<span class="inline-flex items-center gap-0.5 opacity-90">${badgeHtml}</span>`;
}

function getPrefixColor(prefix, type) {
    if (!prefix) return '';
    const lower = prefix.toLowerCase();

    if (type === 'stat') {
        if (/(?:gain|heal|recover|harvest|\+)/.test(lower)) return 'text-emerald-400';
        if (/(?:lose|deal|take|pay|\-)/.test(lower)) return 'text-red-400';
    } else if (type === 'battleline') {
        if (/(?:move|return|draw)/.test(lower)) return 'text-sky-400';
        if (/(?:discard|banish|trash)/.test(lower)) return 'text-red-400';
        if (/(?:shuffle)/.test(lower)) return 'text-fuchsia-400';
    }
    return 'text-slate-200';
}

export function formatCardText(text, allAbilitiesRegistry = []) {
    if (!text) return '';
    let formatted = text;

    formatted = formatted.replace(/\*\*([\s\S]*?)\*\*/g, '<span class="font-black text-amber-400">$1</span>');

    const statMap = {
        'strength': getIconSvg('attack'), 'health': getIconSvg('health'), 'maxhealth': getIconSvg('health'),
        'power': getIconSvg('power'), 'armor': getIconSvg('armor'), 'acts': getIconSvg('fast'),
        'carnie': getIconSvg('tent'), 'tent': getIconSvg('tent'), 'readiness': getIconSvg('hourglass-full')
    };

    formatted = renderResourceTextTokens(formatted, { colorClass: 'text-purple-400' });

    formatted = formatted.replace(/((?:(?:gain|lose|heal|deal|take|pay|recover|harvest)\s*)?[+-]?\s*\d*\s*)\[\[?(?:STAT|RESOURCE|RESOURCES):([a-zA-Z]+)\]\]?/gi, (match, prefix, p1) => {
        const key = p1.toLowerCase();
        const svg = statMap[key];
        const tokenColor = (key === 'carnie' || key === 'tent') ? 'text-purple-400' : 'text-amber-300';
        const prefixHtml = prefix ? `<span class="${getPrefixColor(prefix, 'stat')} font-bold drop-shadow-sm">${prefix}</span>` : '';

        if (svg) {
            return `<span class="whitespace-nowrap">${prefixHtml}<span class="inline-block w-[1.1em] h-[1.1em] align-middle -translate-y-[0.1em] ml-0.5 ${tokenColor} drop-shadow-md">${svg}</span></span>`;
        }
        return `<span class="whitespace-nowrap">${prefixHtml}<span class="font-bold ${tokenColor} uppercase">${p1}</span></span>`;
    });

    formatted = formatted.replace(/((?:(?:move|return|shuffle|draw|discard|banish|trash)\s*)?(?:to|from|in|into)?\s*)\[BATTLELINE:([a-zA-Z_]+)\]/gi, (match, prefix, p1) => {
        const svg = getLineIconSvg(p1.toLowerCase());
        const prefixHtml = prefix ? `<span class="${getPrefixColor(prefix, 'battleline')} font-bold drop-shadow-sm">${prefix}</span>` : '';

        if (svg) {
            return `<span class="whitespace-nowrap">${prefixHtml}<span class="inline-block w-[1.1em] h-[1.1em] align-middle -translate-y-[0.1em] ml-0.5 text-sky-300 drop-shadow-md">${svg}</span></span>`;
        }
        return `<span class="whitespace-nowrap">${prefixHtml}<span class="font-bold text-sky-300 uppercase">${p1.replace(/_/g, ' ')}</span></span>`;
    });

    formatted = formatted.replace(/@\[(.*?)\]/g, (match, p1) => {
        let displayName = p1;
        if (p1.startsWith('ability_')) {
            const found = allAbilitiesRegistry.find(a => a.abilityId === p1);
            if (found && found.name) displayName = found.name;
        }
        return `<span class="text-fuchsia-400 font-bold cursor-help border-b border-fuchsia-400/30" title="See Glossary: ${displayName}">${displayName}</span>`;
    });

    return formatted;
}

// --- Window Cache Init ---
if (typeof window !== 'undefined') {
    window.__GAME_CARD_CACHE = window.__GAME_CARD_CACHE || new Map();
    window.inspectFromCache = (cacheId) => {
        const cachedCard = window.__GAME_CARD_CACHE.get(cacheId);
        if (cachedCard && typeof window.inspectCard === 'function') {
            const json = encodeURIComponent(JSON.stringify(cachedCard)).replace(/'/g, "%27");
            window.inspectCard(json);
        }
    };
}

export function renderCardHTML(card, options = {}) {
    const cacheId = card.instanceId || card.id || ('temp_' + Math.random().toString(36).substring(2, 9));
    if (typeof window !== 'undefined' && window.__GAME_CARD_CACHE) {
        window.__GAME_CARD_CACHE.set(cacheId, card);
    }

    let attrs = [`cache-id="${cacheId}"`, `data-instance-id="${card.instanceId || card.id}"`];

    const toggleAttr = (condition, attrName, value = "true") => {
        if (condition) attrs.push(`${attrName}="${value}"`);
    };

    toggleAttr(options.size === 'jumbo', 'size', 'jumbo');
    toggleAttr(options.isMicro, 'size', 'micro');
    toggleAttr(options.isNano, 'size', 'nano');
    toggleAttr(options.isHand, 'is-hand');
    toggleAttr(options.isSelected, 'is-selected');
    toggleAttr(options.isTargetable, 'is-targetable');
    toggleAttr(options.isCasting, 'is-casting');
    toggleAttr(options.isTargetingMode, 'is-targeting-mode');
    toggleAttr(options.isForceHover, 'is-force-hover');
    toggleAttr(options.onMouseLeave, 'onmouseleave', options.onMouseLeave?.replace(/"/g, '&quot;'));
    toggleAttr(options.actionState, 'action-state', options.actionState);
    toggleAttr(options.readiness !== undefined && options.readiness !== null, 'readiness', options.readiness);
    toggleAttr(options.onClick, 'on-click', options.onClick?.replace(/"/g, '&quot;'));
    toggleAttr(options.abilityUses, 'ability-uses', encodeURIComponent(JSON.stringify(options.abilityUses)));

    let cleanInspect = options.onInspect;
    if (cleanInspect && cleanInspect.includes('window.inspectCard(')) {
        cleanInspect = `window.inspectFromCache('${cacheId}')`;
    }
    toggleAttr(cleanInspect, 'on-inspect', cleanInspect?.replace(/"/g, '&quot;'));

    return `<game-card ${attrs.join(' ')}></game-card>`;
}

// --- Ability Logic ---
function getActionBlockStatus(card, blockFlag) {
    if (!hasEngineFlag(card, blockFlag)) return null;
    if (card.passiveFlags?.includes(blockFlag) || card.abilities?.some(a => a.passiveFlags?.includes(blockFlag))) return 'permanent';
    const effect = card.activeEffects?.find(e => e.type === blockFlag);
    if (effect && ['INDEFINITE', 'PERMANENT', 'WHILE_ATTACHED', 'INSTANT'].includes(effect.duration)) return 'permanent';
    return 'temporary';
}

function checkAbilityUsable(card, ab, options, isAttack) {
    if (options.isHand || card.readiness === undefined) return { isUsable: true, showHourglass: false };

    let isUsable = true;
    let showHourglass = false;

    const uses = (options.abilityUses || {})[`${card.instanceId}_${ab.abilityId}`] || 0;
    if (ab.triggerLimit === 'ONCE_PER_ROUND' && uses >= 1) { isUsable = false; showHourglass = true; }
    if (ab.triggerLimit === 'TWICE_PER_ROUND' && uses >= 2) { isUsable = false; showHourglass = true; }

    const blockStatus = getActionBlockStatus(card, isAttack ? 'BLOCK_ATTACK' : 'BLOCK_ACT');
    if (blockStatus) {
        isUsable = false;
        if (blockStatus === 'temporary') showHourglass = true;
    }

    if (isUsable) {
        const cost = ab.cost || {};
        if (!cost.freeAction && !isAttack && (!card.acts || card.acts < 1)) {
            isUsable = false;
            showHourglass = true;
        }
    }
    return { isUsable, showHourglass };
}

export function computeAbilitiesData(card, options, allAbilitiesRegistry = []) {
    let displayAbilities = card.abilities ? [...card.abilities] : [];
    const isUnit = card.type === 'unit' || card.type === 'avatar';

    let globalCards = getGlobalList('allCards', 'cards');
    const globalTribes = getGlobalList('customTribesList', 'customTribes');

    if (globalCards.length === 0 && typeof window !== 'undefined' && window.__GAME_CARD_CACHE) {
        globalCards = Array.from(window.__GAME_CARD_CACHE.values());
    }

    if (isUnit && card.type !== 'avatar' && (card.defaultLine || 'mid') !== 'mid') {
        const lineAb = getSystemLineAbility(card.defaultLine || 'mid');
        if (lineAb) displayAbilities.push({ ...lineAb, isKeyword: true });
    }

    const data = { evergreen: [], bespoke: [], active: [] };
    if (displayAbilities.length === 0) return data;

    displayAbilities.forEach(a => {
        const regMatch = allAbilitiesRegistry.find(reg => reg.abilityId === a.abilityId) || {};
        const ab = { ...regMatch, ...a };

        const isKeyword = ab.isKeyword || (ab.trigger === 'UNTRIGGERABLE' && (!ab.effects?.length || ab.passiveFlags?.length > 0));

        let rawDesc = ab.displayDescription || ab.description || '';
        if (!rawDesc) {
            try { rawDesc = generateAbilityDescription(ab, allAbilitiesRegistry, globalCards, globalTribes); } catch (e) { console.error(e); }
        }

        // Ensure the description starts with a capital letter natively (ignoring HTML tags/tokens)
        if (rawDesc) {
            rawDesc = rawDesc.replace(/^((?:<[^>]+>|\[[^\]]+\]|@\[[^\]]+\]|[^a-zA-Z])*)([a-zA-Z])/, (m, prefix, letter) => prefix + letter.toUpperCase());
        }

        const costBadge = formatAbilityCostBadge(ab.cost, card.tribe);

        if (isKeyword) {
            data.evergreen.push({ name: ab.name || 'System Keyword', costBadge, rawDesc: rawDesc || 'System Keyword' });
        } else if (ab.trigger === 'MANUAL') {
            const isAttack = ab.effects?.some(g => g.payloads?.some(p => p.type === 'ATTACK'));
            const { isUsable, showHourglass } = checkAbilityUsable(card, ab, options, isAttack);

            data.active.push({
                name: ab.name || 'Action', costBadge, rawDesc,
                formattedDesc: formatCardText(rawDesc, allAbilitiesRegistry),
                isUsable, showHourglass, isAttack
            });
        } else {
            let desc = rawDesc || (ab.name ? `**${ab.name}**` : '');
            const isSpellPlay = card.type === 'spell' && ['PLAY', 'ON_BE_PLAYED', 'ON_PLAYED'].includes(ab.trigger);
            let event = getTriggerWord(ab.trigger);
            if (event && ab.triggerScope === 'GLOBAL') {
                if (event.toUpperCase().startsWith('BLOCK ')) {
                    event = event.substring(0, 6) + 'ANY ' + event.substring(6);
                } else {
                    event = `ANY ${event}`;
                }
            }

            if (isSpellPlay) {
                desc = costBadge ? `${costBadge} ${desc}` : desc;
            } else {
                desc = `${event ? `<span class="event-trigger">${event}:</span>` : ''}${costBadge ? `${costBadge} ` : ''}${desc}`;
            }

            data.bespoke.push({
                name: ab.name || 'Ability', costBadge, rawDesc,
                formattedDesc: formatCardText(desc, allAbilitiesRegistry),
                event, isSpellPlay
            });
        }
    });

    return data;
}

// --- Web Component Helpers ---
function calculateNetStats(activeEffects) {
    let net = { strength: 0, health: 0, power: 0, acts: 0, hasPositive: false, hasNegative: false };
    if (!activeEffects || activeEffects.length === 0) return net;

    activeEffects.forEach(item => {
        if (item.duration !== 'TEMPORARY' && item.duration !== 'BRIEF') return;

        if (item.type === 'STAT_MODIFIER' || item.type === 'MODIFY_STAT' || item.type === 'SET_STAT') {
            const amt = item.delta !== undefined ? Number(item.delta) :
                (item.type === 'SET_STAT' ? (Number(item.amount) === 0 ? -1 : 1) : (Number(item.amount) || 0));
            const statKey = item.stat === 'maxhealth' ? 'health' : item.stat;
            if (net.hasOwnProperty(statKey)) net[statKey] += amt;
            net.hasPositive = true;
        } else {
            net.hasPositive = true;
        }
    });

    const netTotal = net.strength + net.health + net.power + net.acts;
    if (netTotal < 0) net.hasNegative = true;
    else if (netTotal > 0) net.hasPositive = true;

    return net;
}

function determineStateClasses(options, isEntityTemporary, hasNegativeEffect) {
    if (options.isCasting) return 'ring-4 ring-fuchsia-500 glow-fuchsia scale-105 z-30';

    const isSm = options.isNano || options.isMicro;
    if (options.isTargetable) return `ring-${isSm ? '2' : '4'} ring-cyan-400 glow-cyan${isSm ? '-sm' : ''} z-20 cursor-pointer`;
    if (options.isSelected) return `ring-${isSm ? '2' : '4'} ring-yellow-400 scale-105 z-20`;

    if (options.isForceHover) {
        if (options.actionState === 'single') return 'ring-2 ring-blue-300 glow-blue z-10 cursor-pointer scale-105';
        if (options.actionState === 'multiple') return 'ring-2 ring-yellow-300 glow-yellow z-10 cursor-pointer scale-105';
        return 'scale-105 z-10 cursor-pointer';
    }

    if (options.actionState === 'single') return 'ring-2 ring-blue-400 glow-blue z-10 cursor-pointer hover:ring-blue-300 hover:scale-105';
    if (options.actionState === 'multiple') return 'ring-2 ring-yellow-400 glow-yellow z-10 cursor-pointer hover:ring-yellow-300 hover:scale-105';

    if (isEntityTemporary) return hasNegativeEffect ? 'ring-2 ring-red-500 glow-red' : 'ring-2 ring-green-400 glow-green';

    return '';
}

// --- Component Definition ---
export class GameCard extends HTMLElement {
    constructor() {
        super();
        this._onMouseEnter = this._onMouseEnter.bind(this);
        this._onMouseLeave = this._onMouseLeave.bind(this);
    }

    connectedCallback() {
        this.style.display = 'contents';
        this.render();

        if (this.getAttribute('size') !== 'jumbo') {
            this.addEventListener('mouseenter', this._onMouseEnter);
            this.addEventListener('mouseleave', this._onMouseLeave);
        }
    }

    disconnectedCallback() {
        this.removeEventListener('mouseenter', this._onMouseEnter);
        this.removeEventListener('mouseleave', this._onMouseLeave);

        if (this.getAttribute('size') !== 'jumbo') {
            const cacheId = this.getAttribute('cache-id');
            if (HoverManager.currentCardId === cacheId) HoverManager.forceHide();
        }
    }

    _onMouseEnter() {
        const cacheId = this.getAttribute('cache-id');
        if (cacheId && this.firstElementChild) HoverManager.onMouseEnter(this.firstElementChild, cacheId);
    }

    _onMouseLeave() {
        HoverManager.onMouseLeave(this.getAttribute('cache-id'));
    }

    static get observedAttributes() {
        return ['cache-id', 'card-data', 'size', 'is-hand', 'is-selected', 'is-targetable', 'is-casting', 'action-state', 'readiness', 'ability-uses', 'is-targeting-mode', 'is-force-hover'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue && this.isConnected) this.render();
    }

    _parseCardData() {
        const cacheId = this.getAttribute('cache-id');
        if (cacheId && typeof window !== 'undefined' && window.__GAME_CARD_CACHE?.has(cacheId)) {
            const cachedCard = window.__GAME_CARD_CACHE.get(cacheId);
            this.setAttribute('data-instance-id', cachedCard.instanceId || cachedCard.id);
            return cachedCard;
        }

        const dataStr = this.getAttribute('card-data');
        if (!dataStr) return null;
        const card = JSON.parse(decodeURIComponent(dataStr));
        this.setAttribute('data-instance-id', card.instanceId || card.id);
        return card;
    }

    _parseOptions() {
        const size = this.getAttribute('size');
        const readinessAttr = this.getAttribute('readiness');
        const boolAttr = (attr) => this.getAttribute(attr) === 'true';

        return {
            isJumbo: size === 'jumbo',
            isMicro: size === 'micro',
            isNano: size === 'nano',
            isHand: boolAttr('is-hand'),
            isSelected: boolAttr('is-selected'),
            isTargetable: boolAttr('is-targetable'),
            isCasting: boolAttr('is-casting'),
            isTargetingMode: boolAttr('is-targeting-mode'),
            isForceHover: boolAttr('is-force-hover'),
            actionState: this.getAttribute('action-state'),
            readiness: readinessAttr !== null && readinessAttr !== 'null' && readinessAttr !== 'undefined' ? parseInt(readinessAttr) : null,
            onClick: this.getAttribute('on-click') || '',
            onInspect: this.getAttribute('on-inspect') || '',
            abilityUses: this.getAttribute('ability-uses') ? JSON.parse(decodeURIComponent(this.getAttribute('ability-uses'))) : {}
        };
    }

    _computeStyleContext(card) {
        const style = getLiveTribeStyle(card.tribe);
        return {
            style,
            hexBg: style.hexBg ? `background-color: ${style.hexBg};` : '',
            hexLightBg: style.hexLightBg ? `background-color: ${style.hexLightBg};` : '',
            hexBorder: style.hexBorder ? `border-color: ${style.hexBorder};` : '',
            bgArtUrl: resolveAssetUrl(style.bgImageUrl),
            bgArtStyle: `object-position: center; transform: translate(${style.bgImageX ?? 0}px, ${style.bgImageY ?? 0}px) scale(${(style.bgImageScale ?? 100) / 100});`,
            cardArtUrl: resolveAssetUrl(card.artUrl)
        };
    }

    _computeCardState(card) {
        const isAvatar = card.type === 'avatar';
        return {
            isUnit: card.type === 'unit' || isAvatar,
            isAvatar,
            isToken: !!card.isToken,
            activeLine: card.line || card.defaultLine || (isAvatar ? 'avatar' : 'mid'),
            isTempLine: card.line && card.defaultLine && card.line !== card.defaultLine,
            hasReadiness: ['unit', 'avatar', 'equipment', 'artifact'].includes(card.type)
        };
    }

    _computeStatsContext(card, isAvatar, isUnit) {
        const hasStrength = isUnit && isValidStat(card.strength);
        let displayHealth = isValidStat(card.currentHealth) ? card.currentHealth : (isValidStat(card.health) ? card.health : (isAvatar ? 20 : (isUnit ? 1 : null)));
        const showHealth = isUnit && isValidStat(displayHealth);
        const hasArmor = isUnit && Number(card.armor) > 0;

        return { hasStrength, showHealth, displayHealth, hasArmor, showBottomStats: hasStrength || showHealth || hasArmor };
    }

    _computeVisualClasses(card, options, styleContext, cardState) {
        const isStatusApplied = (flag, statusNames) =>
            card.activeEffects?.some(e => e.type === flag) ||
            card.abilities?.some(a => statusNames.includes((a.name || '').toLowerCase()));

        const isStunned = isStatusApplied('BLOCK_ACT', ['stun', 'stunned']);
        const isDazed = isStatusApplied('BLOCK_RETALIATE', ['daze', 'dazed']) && !isStunned;
        const isHidden = hasEngineFlag(card, 'BLOCK_TARGETING');

        const net = options.isHand ? { strength: 0, health: 0 } : calculateNetStats(card.activeEffects);
        const isEntityTemporary = card.duration === 'TEMPORARY' || card.duration === 'BRIEF';

        const baseCls = 'stat-text-base', buffCls = 'stat-text-buff', debuffCls = 'stat-text-debuff';
        const getStatClass = (netVal) => netVal > 0 ? buffCls : (netVal < 0 ? debuffCls : baseCls);

        const stateClasses = determineStateClasses(options, isEntityTemporary, net.hasNegative);

        let dynamicBorderClass = cardState.isToken ? 'border-2 border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : `border-2 ${styleContext.style.border}`;
        let dynamicBorderStyle = cardState.isToken ? '' : styleContext.hexBorder;

        if (isHidden && !options.isHand) {
            dynamicBorderClass = 'border-2 border-dashed border-white/80 shadow-[0_0_12px_rgba(255,255,255,0.4)]';
            dynamicBorderStyle = '';
        }

        const isFieldState = (stateCheck) => !options.isHand && cardState.hasReadiness && options.readiness !== null && stateCheck;
        const isFieldUnready = isFieldState(options.readiness === 0);
        const isFieldExhausted = isFieldState(options.readiness < 0);
        const isFieldOverReady = isFieldState(options.readiness > 1);

        return {
            isStunned, isDazed, isFieldUnready, isFieldExhausted, isFieldOverReady,
            hasNegativeEffect: net.hasNegative, hasPositiveEffect: net.hasPositive, isEntityTemporary,
            lineGlowClass: cardState.isTempLine ? '[&>svg]:!text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,1)] z-20' : '',
            strengthClass: getStatClass(net.strength), healthClass: getStatClass(net.health),
            costClass: baseCls, powerClass: baseCls, armorClass: baseCls,
            stateClasses, dynamicBorderClass, dynamicBorderStyle,
            fieldDimmingClass: (isFieldUnready || isFieldExhausted || isStunned || isDazed) ? 'saturate-[0.25] opacity-90' : '',
            hiddenClass: isHidden && !options.isHand ? 'opacity-60 hover:opacity-100' : '',
            separatorClass: cardState.isToken ? 'border-white/40' : 'border-black'
        };
    }

    _buildOverlayHTML(visuals, options) {
        let overlayContent = '';
        let bgClass = 'bg-black/30', glowClass = '', iconColor = 'text-white';

        if (visuals.isStunned) overlayContent = SVG_STUNNED;
        else if (visuals.isDazed) overlayContent = SVG_DAZED;
        else if (visuals.isFieldExhausted) { overlayContent = getIconSvg('exhausted') || getIconSvg('hourglass-full'); bgClass = 'bg-black/50'; iconColor = 'text-slate-300'; }
        else if (visuals.isFieldUnready) { overlayContent = getIconSvg('unready') || getIconSvg('hourglass-empty'); bgClass = 'bg-black/50'; iconColor = 'text-slate-300'; }
        else if (visuals.isFieldOverReady) {
            overlayContent = getIconSvg('overready') || getIconSvg('hourglass-full');
            bgClass = 'bg-emerald-400/20'; iconColor = 'text-emerald-400';
            glowClass = (options.isMicro || options.isNano) ? `overlay-glow-${visuals.hasNegativeEffect ? 'red' : 'green'}-sm` : `overlay-glow-${visuals.hasNegativeEffect ? 'red' : 'green'}`;
        }

        if (!overlayContent) return '';

        const isSm = options.isMicro || options.isNano;
        const opacityCls = isSm ? (visuals.isStunned || visuals.isDazed ? 'opacity-50' : 'opacity-80') : (visuals.isStunned || visuals.isDazed ? 'opacity-80' : 'opacity-90');

        return `<div class="absolute inset-0 z-[40] flex items-center justify-center pointer-events-none ${bgClass} rounded-md">
            <div class="${visuals.isDazed ? 'scale-75' : ''} ${opacityCls} ${isSm ? 'drop-shadow-[0_2px_6px_rgba(0,0,0,1)]' : 'drop-shadow-[0_4px_12px_rgba(0,0,0,1)]'} overlay-svg-container ${glowClass} ${iconColor} [&>svg]:w-full [&>svg]:h-full [&>svg]:m-0 flex items-center justify-center">
            ${overlayContent}
            </div>
        </div>`;
    }

    _buildBadges(card, options) {
        return {
            readinessBadge: '', attachmentsBadge: '',
            inspectButton: options.onInspect ? `<button onclick="event.stopPropagation(); ${options.onInspect}" class="absolute top-0 right-0 ${(options.isMicro || options.isNano) ? 'w-[18px] h-[20px] text-[8px]' : 'w-[18px] h-[20px] sm:w-[22px] sm:h-[24px] text-[10px] sm:text-xs'} pt-[1px] pr-[2px] sm:pt-[2px] sm:pr-[3px] bg-black/50 hover:bg-black text-white rounded-bl-md border-l border-b border-white/20 transition-colors pointer-events-auto" title="Inspect Card">🔍</button>` : '',
            fastBadge: (card.fast > 0) ? `<div class="absolute -top-1.5 -right-1.5 w-6 h-6 text-[10px] flex items-center justify-center rounded-full bg-yellow-400 text-black font-black border-black shadow-lg pointer-events-auto" title="Fast Charges"><div class="w-3 h-3 mr-0.5">${getIconSvg('fast')}</div>${card.fast}</div>` : ''
        };
    }

    _getCardArtStyle(card) {
        return `object-position: center; transform: translate(${((card.artX ?? 0) / 128) * 100}%, ${((card.artY ?? 0) / 179) * 100}%) scale(${(card.artScale ?? 100) / 100});`;
    }

    _getCameraStyle(card, options) {
        if (!card.artUrl) return '';
        const tX = (options.isNano || options.isMicro) ? (card.nanoArtX ?? 0) : 0;
        const tY = (options.isNano || options.isMicro) ? (card.nanoArtY ?? 0) : 0;
        const s = (options.isNano || options.isMicro) ? (card.nanoArtScale ?? 110) : 100;
        return (s === 100 && tX === 0 && tY === 0) ? '' : `transform: translate(${tX}px, ${tY}px) scale(${s / 100});`;
    }

    render() {
        const card = this._parseCardData();
        if (!card) return;

        const options = this._parseOptions();
        const styleContext = this._computeStyleContext(card);
        const cardState = this._computeCardState(card);
        const statsContext = this._computeStatsContext(card, cardState.isAvatar, cardState.isUnit);
        const visuals = this._computeVisualClasses(card, options, styleContext, cardState);
        const overlayHTML = this._buildOverlayHTML(visuals, options);
        const badges = this._buildBadges(card, options);

        const rightClickAttr = options.onInspect ? `oncontextmenu="event.preventDefault(); event.stopPropagation(); ${options.onInspect}"` : '';

        let safeTooltip = '';
        if (typeof window === 'undefined' || !window.__GAME_CARD_CACHE) {
            safeTooltip = `${card.name || 'Unknown Card'}${card.description ? `\n"${card.description}"` : ''}\n\n(Right-click or tap 🔍 to inspect fully)`.replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        }

        const abilitiesData = computeAbilitiesData(card, options, getGlobalList('allAbilitiesRegistry'));

        const ctx = {
            card, ...options, ...styleContext, ...cardState, ...statsContext, ...visuals, ...badges,
            overlayHTML, rightClickAttr, safeTooltip, abilitiesData, abilitiesHTML: renderStandardAbilities(abilitiesData),
            artStyle: this._getCardArtStyle(card), cameraStyle: this._getCameraStyle(card, options)
        };

        this.innerHTML = options.isJumbo ? renderJumbo(ctx) : options.isMicro ? renderMicro(ctx) : options.isNano ? renderNano(ctx) : renderStandard(ctx);
    }
}

customElements.define('game-card', GameCard);