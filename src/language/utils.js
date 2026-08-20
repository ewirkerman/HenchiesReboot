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
    'FIELD': 'the field',
    'EQUATOR': 'the equator',
    'HAND': 'hand',
    'DECK': 'deck',
    'DISCARD': 'the discard pile',
    'BANISH': 'the banish zone',
    'ORIGINAL_DECK': 'their original deck'
};

export function formatResourceAmount(amount) {
    if (!amount || amount <= 0) return '';
    return `${amount} Resource${amount > 1 ? 's' : ''}`;
}

export function formatResource(amount, resourceName) {
    if (!amount || amount <= 0) return '';
    return `${amount} ${resourceName}`;
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