import { isUndoable } from '../engine/index.js';

export function isActionUnsafe(state, entity, abilityId) {
    if (!state || !entity) return true;
    const ability = entity.abilities?.find(a => a.abilityId === abilityId);
    if (!ability) return false;
    return !isUndoable(state, ability);
}

export function isDefaultPlayTrigger(ab) {
    const trigger = ab?.trigger || 'MANUAL';
    if (trigger === 'PLAY_OPTIONAL') return false;
    if (trigger === 'MANUAL' && ab?.passiveFlags?.includes('ACTIVATE_FROM_HAND')) return false;
    if (ab?.activation?.method === 'PLAYER_CHOICE') return false;
    return ['PLAY', 'ON_BE_PLAYED', 'PLAYED', 'MODIFY_PLAY', 'WOULD_PLAY', 'WOULD_BE_PLAYED'].includes(trigger);
}

export function isDefaultPlayOptionUnsafe(state, card) {
    if (!state || !card?.abilities) return false;
    for (const ab of card.abilities) {
        if (isDefaultPlayTrigger(ab) && !isUndoable(state, ab)) return true;
    }
    return false;
}

export function isPlayUnsafe(state, card, chosenAbilityId) {
    if (!card) return true;
    if (chosenAbilityId) return isActionUnsafe(state, card, chosenAbilityId);
    return isDefaultPlayOptionUnsafe(state, card);
}
