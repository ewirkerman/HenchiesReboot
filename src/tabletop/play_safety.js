import { isAbilityUndoable } from '../engine/targeting.js';

export function isActionUnsafe(state, entity, abilityId) {
    if (!state || !entity) return true;
    const ability = entity.abilities?.find(a => a.abilityId === abilityId);
    if (!ability) return false;
    return !isAbilityUndoable(state, ability, entity, entity.ownerId || state.activePlayerId);
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
        //console.log("Trigger Check:", isDefaultPlayTrigger(ab)); // Is this true?
        //console.log("Undoable Check:", isUndoable(state, ab));   // Is this true?
        if (isDefaultPlayTrigger(ab) && !isAbilityUndoable(state, ab, card, card.ownerId || state.activePlayerId)) return true;
    }
    return false;
}

export function isPlayUnsafe(state, card, chosenAbilityId) {
    if (!card) return true;
    if (chosenAbilityId) return isActionUnsafe(state, card, chosenAbilityId);
    return isDefaultPlayOptionUnsafe(state, card);
}
