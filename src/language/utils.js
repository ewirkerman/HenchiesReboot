/**
 * src/language/utils.js
 * Linguistic Foundations, Pronoun Tracking, Entity Resolution & Resource Token Rendering.
 */

import { getIconSvg } from '../glossary.js';
import anExclusions from './an_exclusions.js';

// =========================================
// 1. CONSTANTS & LINGUISTIC MAPS
// =========================================

export const ZONE_NAMES = {
    'FIELD': '[ZONE:field]',
    'EQUATOR': '[ZONE:equator]',
    'HAND': '[ZONE:hand]',
    'DECK': '[ZONE:deck]',
    'DISCARD': '[ZONE:discard]',
    'BANISH': '[ZONE:banish]',
    'ORIGINAL_DECK': '[ZONE:deck]'
};

const ZONE_DISPLAY_NAMES = {
    original_deck: 'original deck',
    field: 'the field',
    equator: 'the equator',
    discard: 'the discard pile',
    banish: 'the banish zone',
    deck: 'the deck'
};

const LEADING_LETTER_REGEX = /^((?:<[^>]+>|\[[^\]]+\]|@\[[^\]]+\]|[^a-zA-Z])*)([a-zA-Z])/;

// =========================================
// 2. PRONOUN & REFERENCE TRACKING
// =========================================

export class ReferenceTracker {
    constructor() {
        this.activeEntities = {};
        this.lastMentionedId = { singular: null, plural: null };
    }

    /**
     * Core reference resolution shared by subject/object and possessive mentions.
     */
    _resolveReference(id, fullDesc, isPlural, singularPronoun, pluralPronoun) {
        const pluralKey = isPlural ? 'plural' : 'singular';
        const isFocused = this.lastMentionedId[pluralKey] === id;
        const samePluralityCount = Object.values(this.activeEntities)
            .filter(e => e.isPlural === isPlural).length;

        this.lastMentionedId[pluralKey] = id;

        if (!this.activeEntities[id]) {
            this.activeEntities[id] = { isPlural, mentions: 1 };
            return fullDesc;
        }

        this.activeEntities[id].mentions++;
        if (samePluralityCount >= 2 && !isFocused) {
            return fullDesc;
        }

        return isPlural ? pluralPronoun : singularPronoun;
    }

    mention(id, fullDesc, isPlural) {
        return this._resolveReference(id, fullDesc, isPlural, 'it', 'them');
    }

    mentionPoss(id, fullDescPoss, isPlural) {
        return this._resolveReference(id, fullDescPoss, isPlural, 'its', 'their');
    }

    hasMentioned(id) {
        return !!this.activeEntities[id];
    }
}

// =========================================
// 3. GLOBAL REGISTRY HELPERS (INTERNAL)
// =========================================

function getGlobalScope() {
    return typeof window !== 'undefined' ? window : globalThis;
}

function getGlobalStateObjects() {
    const scope = getGlobalScope();
    return [scope?.ClientState, scope?.StudioState, scope?.CardState].filter(Boolean);
}

function isUnresolvedCardId(rawId) {
    return rawId.startsWith('card_') || /\d{10,}/.test(rawId) || rawId.toLowerCase().includes('unknown card');
}

function findCardInCollection(collection, rawId) {
    if (!collection) return null;

    let items = collection;
    if (collection instanceof Map || collection instanceof Set) {
        items = Array.from(collection.values());
    } else if (typeof collection === 'object' && !Array.isArray(collection)) {
        items = Object.values(collection);
    }

    for (const item of items) {
        const card = item?.card || item;
        if (card && (card.id === rawId || card.cardId === rawId || card._id === rawId)) {
            return card;
        }
    }
    return null;
}

function resolveTribeStyleForToken(tokenName) {
    const scope = getGlobalScope();
    const sources = [
        ...getGlobalStateObjects().map(state => state.customTribesList || state.customTribes),
        scope?.customTribesList
    ];

    const target = tokenName.toLowerCase().replace(/^tribe_/, '').replace(/_/g, ' ');
    const prefixedTarget = `tribe_${target.replace(/\s+/g, '_')}`;

    for (const list of sources) {
        if (!Array.isArray(list)) continue;
        const match = list.find(t => {
            const id = String(t?.id || '').toLowerCase();
            const name = String(t?.name || '').toLowerCase();
            return id === target || name === target || id === prefixedTarget;
        });
        if (match) return match;
    }

    return null;
}

// =========================================
// 4. RESOURCE FORMATTING & TOKEN RENDERING
// =========================================

export function formatResourceAmount(amount) {
    if (!amount || amount <= 0) return '';
    return `${amount} Resource${amount > 1 ? 's' : ''}`;
}

export function formatResource(amount, resourceName) {
    if (!amount || amount <= 0) return '';
    return `${amount} ${resourceName}`;
}

export function normalizeResourceTokenName(resourceName) {
    if (!resourceName && resourceName !== 0) return '';
    const raw = String(resourceName).trim();
    if (!raw) return '';

    const normalized = raw
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '');

    if (normalized === 'max_carnie' || normalized === 'maxcarnie') return 'maxCarnie';
    if (normalized === 'carnie' || normalized === 'tent') return 'tent';
    return normalized;
}

function buildClassList(...classes) {
    return classes.filter(Boolean).join(' ');
}

function renderTribeResourceToken(normalizedName, tribeStyle, iconSizeClass, colorClass) {
    if (tribeStyle?.iconSvg) {
        const cls = buildClassList('resource-token-icon resource-token-icon--tribe', iconSizeClass, colorClass);
        return `<span class="${cls}"><div class="raw-user-svg-container w-full h-full">${tribeStyle.iconSvg}</div></span>`;
    }

    const fallbackLabel = tribeStyle?.name || normalizedName.replace(/^tribe_/, '');
    const cls = buildClassList('resource-token-text', colorClass);
    return `<span class="${cls}">${fallbackLabel.charAt(0).toUpperCase()}</span>`;
}

function renderStandardResourceToken(lowerName, iconSizeClass, colorClass) {
    const iconKey = lowerName === 'maxcarnie' ? 'tent' : lowerName;
    const svg = getIconSvg(iconKey) || getIconSvg('tent');
    const cls = buildClassList('resource-token-icon', iconSizeClass, colorClass);
    return `<span class="${cls}">${svg}</span>`;
}

export function renderResourceTextTokens(text, options = {}) {
    if (!text) return '';

    const iconSizeClass = options.iconSizeClass || '';
    const colorClass = options.colorClass || '';

    return text.replace(/\[(?:RESOURCE|RESOURCES):([^\]]+)\]/gi, (match, tokenName) => {
        const normalizedName = normalizeResourceTokenName(tokenName);
        if (!normalizedName) return match;

        const lowerName = normalizedName.toLowerCase();
        if (lowerName.startsWith('tribe_')) {
            const tribeStyle = options.tribeStyle || resolveTribeStyleForToken(normalizedName);
            return renderTribeResourceToken(normalizedName, tribeStyle, iconSizeClass, colorClass);
        }

        return renderStandardResourceToken(lowerName, iconSizeClass, colorClass);
    });
}

export function formatResourceIcons(amount, resourceName, isX = false) {
    const normalizedName = normalizeResourceTokenName(resourceName);
    if (!normalizedName) return '';

    if (isX) {
        return `X [RESOURCE:${normalizedName}]`;
    }

    return `[RESOURCE:${normalizedName}]`.repeat(Math.max(0, amount || 0));
}

// =========================================
// 5. ENTITY, ABILITY & TRIBE RESOLUTION
// =========================================

export function resolveEntityName(identifier, allCards) {
    if (!identifier) return 'Unknown Card';
    const rawId = String(identifier);

    // Return generic enums as-is
    if (!isUnresolvedCardId(rawId)) {
        return rawId;
    }

    if (!allCards) {
        console.error(`[NLG] Aborting card resolution: allCards dictionary is falsy for ID '${rawId}'. Check your function signatures!`);
        return 'Unknown Card';
    }

    let found = findCardInCollection(allCards, rawId);

    // Fallback to global state lookups for tokens/summons not in the main deck list
    if (!found && typeof window !== 'undefined') {
        const fallbackCollections = [
            ...getGlobalStateObjects().flatMap(s => [s.allCards, s.cards, s.tokens, s.customCards]),
            window.__GAME_CARD_CACHE
        ];
        for (const collection of fallbackCollections) {
            found = findCardInCollection(collection, rawId);
            if (found) break;
        }
    }

    if (found?.name) {
        return `@[${found.name}]`;
    }

    return isUnresolvedCardId(rawId) ? 'Unknown Card' : rawId;
}

export function resolveAbility(abilityId, allAbilities) {
    let match = null;

    if (Array.isArray(allAbilities)) {
        match = allAbilities.find(a => a.abilityId === abilityId || a.id === abilityId) || null;
    } else if (typeof window !== 'undefined' && typeof getAbility === 'function') {
        match = getAbility(abilityId);
    }

    return {
        name: match ? match.name : abilityId,
        abilityId: match ? (match.abilityId || match.id) : abilityId,
        isManual: match ? match.trigger === 'MANUAL' : false
    };
}

export function resolveTribeName(tribeId, allTribes) {
    const resName = tribeId || 'resource';
    if (resName === 'maxCarnie') return 'Max Carnie';

    if (Array.isArray(allTribes)) {
        const match = allTribes.find(t => t.id === resName || t.name.toLowerCase() === resName.toLowerCase());
        if (match) return match.name;
    } else if (resName.toLowerCase().startsWith('tribe_')) {
        return resName
            .substring(6)
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    return resName;
}

// =========================================
// 6. GRAMMAR, ZONE & STATE LINGUISTICS
// =========================================

export function joinWithAnd(arr) {
    if (!arr || arr.length === 0) return '';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
    return `${arr.slice(0, -1).join(', ')}, and ${arr[arr.length - 1]}`;
}

export function formatArrayToString(arr, fallback = 'any') {
    if (!arr || arr.length === 0) return fallback;
    return arr.map(s => s.toLowerCase().replace(/_/g, ' ')).join(' or ');
}

export function getIndefiniteArticle(word) {
    if (!word) return 'a';
    const cleanWord = word.replace(/^@\[/, '').replace(/\]$/, '').toLowerCase().trim();
    const matchesExclusion = (list) => list.some(exc =>
        cleanWord === exc || cleanWord.startsWith(`${exc} `) || cleanWord.startsWith(`${exc}-`)
    );

    if (matchesExclusion(anExclusions.vowel_starts_requiring_a)) return 'a';
    if (matchesExclusion(anExclusions.consonant_starts_requiring_an)) return 'an';

    return /^[aeiou]/i.test(cleanWord) ? 'an' : 'a';
}

export function getReadinessConditionState(operator, value) {
    const val = Number(value);
    if (isNaN(val)) return null;

    if ((operator === '>' && val === 0) || (operator === '>=' && val === 1) || (operator === '==' && val === 1)) return 'ready';
    if ((operator === '<' && val === 1) || (operator === '<=' && val === 0) || (operator === '==' && val === 0)) return 'unready';
    if ((operator === '<' && val === 0) || (operator === '<=' && val === -1) || (operator === '==' && val === -1)) return 'exhausted';
    if ((operator === '>' && val === 1) || (operator === '>=' && val === 2) || (operator === '==' && val === 2)) return 'over-ready';

    return null;
}

export function getZoneLinguistics(rawZone) {
    const val = String(rawZone).toLowerCase();
    const prep = (val === 'field' || val === 'equator') ? 'on' : 'in';
    return { name: ZONE_DISPLAY_NAMES[val] || val, prep };
}

function transformLeadingLetter(str, transformFn) {
    if (!str) return str;
    return str.replace(LEADING_LETTER_REGEX, (_, prefix, letter) => prefix + transformFn(letter));
}

export function capitalizeSentence(str) {
    return transformLeadingLetter(str, l => l.toUpperCase());
}

export function lowercaseSentence(str) {
    return transformLeadingLetter(str, l => l.toLowerCase());
}

export function formatXValue(paramX) {
    if (paramX === undefined || paramX === null || isNaN(Number(paramX))) {
        return 'X';
    }
    return `X (${paramX})`;
}