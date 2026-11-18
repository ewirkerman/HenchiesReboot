import { getIconSvg, getLineIconSvg } from '../src/glossary.js';
import { renderResourceTextTokens } from '../src/language/utils.js';

const STAT_ICON_KEYS = {
    strength: 'attack',
    health: 'health',
    maxhealth: 'health',
    power: 'power',
    armor: 'armor',
    acts: 'fast',
    carnie: 'tent',
    tent: 'tent',
    readiness: 'hourglass-full'
};

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

export function capitalizeDescription(text) {
    const description = String(text || '');
    if (/^\[(?:BATTLELINE|RESOURCE|RESOURCES|STAT):[^\]]+\]/i.test(description)) {
        return description;
    }

    return description.replace(
        /^((?:<[^>]+>|\[[^\]]+\]|@\[[^\]]+\]|[^a-zA-Z@<\[])*)([a-zA-Z])/,
        (match, prefix, letter) => prefix + letter.toUpperCase()
    );
}

export function renderStatAndResourceTokens(text, resourceOptions = {}) {
    const withResources = renderResourceTextTokens(text, resourceOptions);

    return withResources.replace(/((?:(?:gain|lose|heal|deal|take|pay|recover|harvest)\s*)?[+-]?\s*\d*\s*)\[\[?(?:STAT|RESOURCE|RESOURCES):([a-zA-Z]+)\]\]?/gi, (match, prefix, statName) => {
        const key = statName.toLowerCase();
        const iconKey = STAT_ICON_KEYS[key];
        const tokenColor = key === 'carnie' || key === 'tent' ? 'text-purple-400' : 'text-amber-300';
        const prefixHtml = prefix ? `<span class="${getPrefixColor(prefix, 'stat')} font-bold drop-shadow-sm">${prefix}</span>` : '';

        if (!iconKey) {
            return `<span class="whitespace-nowrap">${prefixHtml}<span class="font-bold ${tokenColor} uppercase">${statName}</span></span>`;
        }

        const icon = getIconSvg(iconKey);
        return `<span class="whitespace-nowrap">${prefixHtml}<span class="inline-block w-[1.1em] h-[1.1em] align-middle -translate-y-[0.1em] ml-0.5 ${tokenColor} drop-shadow-md">${icon}</span></span>`;
    });
}

export function formatCardText(text, allAbilitiesRegistry = [], paramX = 'X') {
    if (!text) return '';
    let formatted = text;

    const xDisplay = (paramX !== undefined && paramX !== null && paramX !== 'X' && !isNaN(Number(paramX))) ? `X (${paramX})` : 'X';

    formatted = formatted.replace(/\{paramX\}/g, paramX);
    formatted = formatted.replace(/\bX\b(?!\s*\()/g, xDisplay);
    formatted = formatted.replace(/\*\*([\s\S]*?)\*\*/g, '<span class="font-black text-amber-400">$1</span>');

    formatted = renderStatAndResourceTokens(formatted, { colorClass: 'text-purple-400' });

    formatted = formatted.replace(/((?:(?:move|return|shuffle|draw|discard|banish|trash)\s*)?(?:to|from|in|into)?\s*)\[BATTLELINE:([a-zA-Z_]+)\]/gi, (match, prefix, line) => {
        const svg = getLineIconSvg(line.toLowerCase());
        const prefixHtml = prefix ? `<span class="${getPrefixColor(prefix, 'battleline')} font-bold drop-shadow-sm">${prefix}</span>` : '';

        if (svg) {
            return `<span class="whitespace-nowrap">${prefixHtml}<span class="inline-block w-[1.1em] h-[1.1em] align-middle -translate-y-[0.1em] ml-0.5 text-sky-300 drop-shadow-md">${svg}</span></span>`;
        }
        return `<span class="whitespace-nowrap">${prefixHtml}<span class="font-bold text-sky-300 uppercase">${line.replace(/_/g, ' ')}</span></span>`;
    });

    formatted = formatted.replace(/@\[(.*?)\]/g, (match, reference) => {
        const ability = allAbilitiesRegistry.find(item => (item.abilityId || item.id) === reference);
        const displayName = ability?.name || reference;
        return `<span class="text-fuchsia-400 font-bold cursor-help border-b border-fuchsia-400/30" title="See Glossary: ${displayName}">${displayName}</span>`;
    });

    return formatted;
}
