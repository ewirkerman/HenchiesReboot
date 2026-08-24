/**
 * src/language/tokens.js
 * Handles the replacement of grammar placeholders ({TARGET}, {POSS}, {SELF}) with tracked pronouns.
 */

export function resolveTokens(text, formatCtx) {
    const { tracker, groupId, targetStr, possessiveStr, isPlural, singularDesc, group } = formatCtx;

    text = text.replace(/\{SELF_POSS\}/g, () => tracker.mentionPoss('self', "this card's", false));
    text = text.replace(/\{SELF\}/g, () => tracker.mention('self', "this card", false));

    text = text.replace(/\{REFLEXIVE_POSS\}/g, isPlural ? 'their own' : 'its own');
    text = text.replace(/\{REFLEXIVE\}/g, isPlural ? 'themselves' : 'itself');

    if (text.includes('{OMIT_TARGET}')) {
        tracker.mention(groupId, targetStr, isPlural);
        text = text.replace(/\{OMIT_TARGET\}/g, '');
    }

    if (text.includes('{PER_TARGET}')) {
        tracker.mention(groupId, targetStr, isPlural);
        if (['this card', 'it', 'the triggering card', 'the targeted card', 'the attacker', 'the defender', 'the damaged character', 'the damage source', 'the healed character', 'the target', 'your avatar', 'the enemy avatar'].includes(targetStr) || targetStr.startsWith('a ') || targetStr.startsWith('an ')) {
            text = text.replace(/\{PER_TARGET\}/g, '');
        } else if (group.targetMethod === 'AUTO_ALL') {
            text = text.replace(/\{PER_TARGET\}/g, ` for each ${singularDesc}`);
        } else {
            text = text.replace(/\{PER_TARGET\}/g, ` for each of ${targetStr}`);
        }
    }

    text = text.replace(/\{TARGET\}|\{POSS\}/g, (match) => {
        if (match === '{TARGET}') {
            return tracker.mention(groupId, targetStr, isPlural);
        } else if (match === '{POSS}') {
            return tracker.mentionPoss(groupId, possessiveStr, isPlural);
        }
    });

    return text;
}