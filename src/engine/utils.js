/**
 * src/utils.js
 * Shared utilities and helpers for the Henchies 2 Game Engine.
 */

export const CARD_CATALOG = []; // Will be hydrated by deckbuilder/firebase

export const TRAITS = [];
export const LINES = ['taunt', 'bodyguard', 'avatar', 'front', 'mid', 'back', 'sheltered', 'sideline'];
export class Card {}
export class UnitInstance {}
export class Avatar {}

export function getResKey(tribeStr) {
    if (!tribeStr) return 'Generic';
    const t = tribeStr.toLowerCase();
    if (t === 'carnie' || t === 'tribe_carnie') return 'Carnie';
    if (t === 'generic' || t === 'tribe_generic') return 'Generic';
    return tribeStr; 
}

export function resolveResourceKey(state, player, tribeKey) {
    if (!tribeKey) return 'Generic';
    const t = tribeKey.toLowerCase();
    
    if (state && state.tribeCatalog) {
        const match = state.tribeCatalog.find(tc => tc.id.toLowerCase() === t || tc.name.toLowerCase() === t);
        if (match) {
            if (match.name === 'Carnie') return 'Carnie';
            if (match.name === 'Generic') return 'Generic';
            return match.id;
        }
    }
    
    const baseKey = getResKey(tribeKey);
    if (baseKey === 'Carnie') return 'Carnie';
    if (player && player.resources[baseKey]) return baseKey;
    
    if (player) {
        const tkLower = baseKey.toLowerCase();
        for (const key in player.resources) {
            const kLower = key.toLowerCase();
            if (kLower === tkLower || kLower === `tribe_${tkLower}` || tkLower === `tribe_${kLower}`) {
                return key;
            }
        }
    }
    return baseKey;
}

export function log(state, msg) {
    if (!state?.isReconstructing) console.log(msg);
}

export function warn(state, msg) {
    if (!state?.isReconstructing) console.warn(msg);
}

export function hasEngineFlag(state, entity, flagName, consume = false) {
    if (!entity) return false;
    
    if (flagName.startsWith('BLOCK_')) {
        const overrideFlag = `IGNORE_${flagName}`;
        if (hasEngineFlag(state, entity, overrideFlag)) return false;
    }

    let found = false;

    if (flagName === 'STRIKE_FAST' && entity.fast > 0) {
        if (consume) entity.fast--;
        found = true;
    }
    if (flagName === 'STRIKE_SLOW' && entity.slow > 0) {
        if (consume) entity.slow--;
        found = true;
    }
    if (found) return true;

    if (entity.activeEffects) {
        for (const e of entity.activeEffects) {
            if (e.type === flagName) found = true;
            if (found) return true;
        }
    }

    const checkAbility = (ability) => {
        if (ability.passiveFlags && ability.passiveFlags.includes(flagName)) {
            if (ability.triggerLimit && ability.triggerLimit !== 'UNLIMITED') {
                const abilityKey = `${entity.instanceId}_${ability.abilityId}`;
                const uses = state.abilityUses?.[abilityKey] || 0;
                if (ability.triggerLimit === 'ONCE_PER_ROUND' && uses >= 1) return false;
                if (ability.triggerLimit === 'TWICE_PER_ROUND' && uses >= 2) return false;
                
                if (consume) {
                    if (!state.abilityUses) state.abilityUses = {};
                    state.abilityUses[abilityKey] = uses + 1;
                }
            }
            return true;
        }
        
        const name = (ability.name || '').toLowerCase();
        if (flagName === 'BLOCK_ACT' && (name === 'dazed' || name === 'stunned' || name === 'stun')) return true;
        if (flagName === 'BLOCK_ATTACK' && name === 'unaggressive') return true;
        if (flagName === 'BLOCK_RETALIATE' && (name === 'dazed' || name === 'stunned' || name === 'stun')) return true;
        if (flagName === 'BLOCK_TARGETING' && name === 'hidden') return true;
        if (flagName === 'BLOCK_TARGET_AVATAR' && name === 'timid') return true;
        if (flagName === 'IGNORE_BLOCK_TARGETING' && name === 'perception') return true;
        if (flagName === 'STRIKE_FAST' && (name === 'swift' || name === 'first strike' || name === 'fast')) return true;
        if (flagName === 'STRIKE_SLOW' && name === 'slow') return true;

        return false;
    };

    if (entity.abilities) {
        for (const a of entity.abilities) {
            if (typeof a === 'string') {
                const catAb = state.abilityCatalog?.find(ca => ca.abilityId === a);
                if (catAb && checkAbility(catAb)) return true;
            } else {
                if (checkAbility(a)) return true;
            }
        }
    }

    if (entity.activeEffects) {
        for (const e of entity.activeEffects) {
            if (e.type === 'GRANT_ABILITY' && e.grantedAbilityId) {
                let catAb = state.abilityCatalog?.find(ca => ca.abilityId === e.grantedAbilityId);
                if (!catAb) catAb = state.abilityCatalog?.find(ca => ca.name === e.grantedAbilityId);
                if (catAb && checkAbility(catAb)) return true;
            }
        }
    }

    return false;
}

export function getOwnerId(state, ent) {
    if (!ent) return null;
    if (ent.ownerId) return ent.ownerId;
    for (const pId of ['player1', 'player2']) {
        const p = state.players[pId];
        if (['hand', 'deck', 'discard', 'banish'].some(z => p[z].some(c => c.instanceId === ent.instanceId))) return pId;
        for (const line of LINES) {
            if (p.lines[line] && p.lines[line].some(c => c.instanceId === ent.instanceId)) return pId;
            if (p.lines[line] && p.lines[line].some(u => u.attachments && u.attachments.some(a => a.instanceId === ent.instanceId))) return pId;
        }
    }
    return null;
}

export function getAvatar(state, playerId) {
    const p = state.players[playerId];
    if (!p) return null;
    for (const line in p.lines) {
        const avatar = p.lines[line]?.find(u => u.type === 'avatar');
        if (avatar) return avatar;
    }
    return null;
}

export function cloneGameState(state) {
    const clone = JSON.parse(JSON.stringify(state));
    if (state.abilityCatalog) Object.defineProperty(clone, 'abilityCatalog', { value: state.abilityCatalog, enumerable: false, configurable: true });
    if (state.catalog) Object.defineProperty(clone, 'catalog', { value: state.catalog, enumerable: false, configurable: true });
    if (state.tribeCatalog) Object.defineProperty(clone, 'tribeCatalog', { value: state.tribeCatalog, enumerable: false, configurable: true });
    return clone;
}