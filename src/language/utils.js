/**
 * src/language/utils.js
 * Linguistic Foundations and Pronoun Tracking.
 */

export class ReferenceTracker {
    constructor() {
        this.activeEntities = {};
        this.lastMentionedId = { singular: null, plural: null };
    }

    mention(id, fullDesc, isPlural) {
        const pluralKey = isPlural ? 'plural' : 'singular';
        const isFocused = this.lastMentionedId[pluralKey] === id;
        let samePluralityCount = Object.values(this.activeEntities).filter(e => e.isPlural === isPlural).length;

        if (!this.activeEntities[id]) {
            this.activeEntities[id] = { isPlural, mentions: 1 };
            this.lastMentionedId[pluralKey] = id;
            return fullDesc;
        } else {
            this.activeEntities[id].mentions++;
            if (samePluralityCount >= 2 && !isFocused) {
                this.lastMentionedId[pluralKey] = id;
                return fullDesc;
            }
            this.lastMentionedId[pluralKey] = id;
            return isPlural ? 'them' : 'it';
        }
    }
    
    mentionPoss(id, fullDescPoss, isPlural) {
        const pluralKey = isPlural ? 'plural' : 'singular';
        const isFocused = this.lastMentionedId[pluralKey] === id;
        let samePluralityCount = Object.values(this.activeEntities).filter(e => e.isPlural === isPlural).length;

        if (!this.activeEntities[id]) {
            this.activeEntities[id] = { isPlural, mentions: 1 };
            this.lastMentionedId[pluralKey] = id;
            return fullDescPoss;
        } else {
            this.activeEntities[id].mentions++;
            if (samePluralityCount >= 2 && !isFocused) {
                this.lastMentionedId[pluralKey] = id;
                return fullDescPoss;
            }
            this.lastMentionedId[pluralKey] = id;
            return isPlural ? 'their' : 'its';
        }
    }

    hasMentioned(id) {
        return !!this.activeEntities[id];
    }
}

export const ZONE_NAMES = {
    'FIELD': '[ZONE:field]',
    'EQUATOR': '[ZONE:equator]',
    'HAND': '[ZONE:hand]',
    'DECK': '[ZONE:deck]',
    'DISCARD': '[ZONE:discard]',
    'BANISH': '[ZONE:banish]',
    'ORIGINAL_DECK': '[ZONE:deck]'
};

import { getIconSvg } from '../glossary.js';

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
    let raw = String(resourceName).trim();
    if (!raw) return '';

    let normalized = raw.toLowerCase().replace(/\s+/g, '_');
    normalized = normalized.replace(/[^a-z0-9_]+/g, '_');
    normalized = normalized.replace(/^_+|_+$/g, '');

    if (normalized === 'max_carnie' || normalized === 'maxcarnie') return 'maxCarnie';
    if (normalized === 'carnie' || normalized === 'tent') return 'tent';
    return normalized;
}

function resolveTribeStyleForToken(tokenName) {
    const globalWindow = typeof window !== 'undefined' ? window : globalThis;
    const sources = [
        globalWindow?.ClientState?.customTribesList,
        globalWindow?.StudioState?.customTribesList,
        globalWindow?.CardState?.customTribes,
        globalWindow?.customTribesList
    ];

    const target = tokenName.toLowerCase().replace(/^tribe_/, '').replace(/_/g, ' ');

    for (const list of sources) {
        if (!Array.isArray(list)) continue;
        const match = list.find(t => {
            const id = String(t?.id || '').toLowerCase();
            const name = String(t?.name || '').toLowerCase();
            return id === target || name === target || id === `tribe_${target.replace(/\s+/g, '_')}`;
        });
        if (match) return match;
    }

    return null;
}

export function renderResourceTextTokens(text, options = {}) {
    if (!text) return '';
    const iconSizeClass = options.iconSizeClass || 'w-[1.1em] h-[1.1em]';
    return text.replace(/\[(?:RESOURCE|RESOURCES):([^\]]+)\]/gi, (match, tokenName) => {
        const normalizedName = normalizeResourceTokenName(tokenName);
        const lowerName = normalizedName.toLowerCase();
        const tribeStyle = options.tribeStyle || resolveTribeStyleForToken(normalizedName);

        if (!normalizedName) return match;

        if (lowerName.startsWith('tribe_')) {
            if (tribeStyle && tribeStyle.iconSvg) {
                return `<span class="inline-block ${iconSizeClass} overflow-hidden align-middle -translate-y-[0.1em] ${options.colorClass || 'text-purple-400'} drop-shadow-sm"><div class="raw-user-svg-container w-full h-full">${tribeStyle.iconSvg}</div></span>`;
            }
            if (tribeStyle && tribeStyle.name) {
                return `<span class="inline-block whitespace-nowrap font-bold ${options.colorClass || 'text-purple-400'} drop-shadow-sm">${tribeStyle.name.charAt(0).toUpperCase()}</span>`;
            }
            return `<span class="inline-block whitespace-nowrap font-bold ${options.colorClass || 'text-purple-400'} drop-shadow-sm">${normalizedName.replace(/^tribe_/, '').charAt(0).toUpperCase()}</span>`;
        }

        let svg = getIconSvg(lowerName === 'maxcarnie' ? 'tent' : lowerName);
        if (!svg) {
            svg = getIconSvg('tent');
        }

        return `<span class="inline-block ${iconSizeClass} align-middle -translate-y-[0.1em] ${options.colorClass || 'text-purple-400'} drop-shadow-sm">${svg}</span>`;
    });
}

export function formatResourceIcons(amount, resourceName, isX = false) {
    let normalizedName = normalizeResourceTokenName(resourceName);
    if (!normalizedName) return '';

    if (isX) {
        return `X [RESOURCE:${normalizedName}]`;
    }

    let iconStr = `[RESOURCE:${normalizedName}]`;
    let result = '';
    for(let i=0; i < Math.max(0, amount || 0); i++) {
        result += iconStr;
    }
    return result;
}

export function joinWithAnd(arr) {
    if (!arr || arr.length === 0) return '';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
    return arr.slice(0, -1).join(', ') + ', and ' + arr[arr.length - 1];
}

export function formatArrayToString(arr, fallback = 'any') {
    if (!arr || arr.length === 0) return fallback;
    return arr.map(s => s.toLowerCase().replace(/_/g, ' ')).join(' or ');
}

import anExclusions from './an_exclusions.js';

export function getIndefiniteArticle(word) {
    if (!word) return 'a';
    let cleanWord = word.replace(/^@\[/, '').replace(/\]$/, '').toLowerCase().trim();
    
    for (const exc of anExclusions.vowel_starts_requiring_a) {
        if (cleanWord === exc || cleanWord.startsWith(exc + ' ') || cleanWord.startsWith(exc + '-')) return 'a';
    }
    for (const exc of anExclusions.consonant_starts_requiring_an) {
        if (cleanWord === exc || cleanWord.startsWith(exc + ' ') || cleanWord.startsWith(exc + '-')) return 'an';
    }
    
    return /^[aeiou]/i.test(cleanWord) ? 'an' : 'a';
}

export function resolveEntityName(identifier, allCards) {
    if (!identifier) return 'Unknown Card';
    let rawId = String(identifier);

    // If it's a generic enum, return it as-is
    if (!rawId.startsWith('card_') && !/\d{10,}/.test(rawId) && !rawId.toLowerCase().includes('unknown card')) {
        return rawId;
    }

    if (!allCards) {
        console.error(`[NLG] Aborting card resolution: allCards dictionary is falsy for ID '${rawId}'. Check your function signatures!`);
        return 'Unknown Card';
    }

    const findInArray = (arr) => {
        if (!arr) return null;
        let iter = arr;
        if (arr instanceof Map || arr instanceof Set) iter = Array.from(arr.values());
        else if (typeof arr === 'object' && !Array.isArray(arr)) iter = Object.values(arr);
        
        for (const item of iter) {
            const card = item?.card || item; // Handle nested wrappers if they exist
            if (card && (card.id === rawId || card.cardId === rawId || card._id === rawId)) {
                return card;
            }
        }
        return null;
    };

    let found = findInArray(allCards);

    // Fallback to global state lookups for tokens/summons not in the main deck list
    if (!found && typeof window !== 'undefined') {
        const sources = [
            window.ClientState?.allCards, window.ClientState?.cards, window.ClientState?.tokens, window.ClientState?.customCards,
            window.StudioState?.allCards, window.StudioState?.cards, window.StudioState?.tokens, window.StudioState?.customCards,
            window.CardState?.allCards, window.CardState?.cards, window.CardState?.tokens, window.CardState?.customCards,
            window.__GAME_CARD_CACHE
        ];
        for (const src of sources) {
            found = findInArray(src);
            if (found) break;
        }
    }

    if (found && found.name) {
        return `@[${found.name}]`;
    }
    
    // Clean up ugly IDs if still missing to prevent "Unknown Card 1785522839644s"
    if (rawId.startsWith('card_') || /\d{10,}/.test(rawId) || rawId.toLowerCase().includes('unknown card')) {
        return 'Unknown Card';
    }
    
    return rawId;
}