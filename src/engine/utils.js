/**
 * src/engine/utils.js
 * Shared utilities and helpers for the Henchies 2 Game Engine.
 */

export const CARD_CATALOG = []; // Will be hydrated by deckbuilder/firebase

export const GLOBAL_UNDO_POLICY = 'ALLOWED'; // Options: 'ALLOWED', 'FORCED_ON', 'FORCED_OFF'

export const TRAITS = [];
export const LINES = ['taunt', 'bodyguard', 'avatar', 'front', 'mid', 'back', 'sheltered', 'sideline'];
export class Card {}
export class UnitInstance {}
export class Avatar {}

export function isUndoable(state, ability) {
    if (state && state.status === 'finished') return false;
    if (!ability || !ability.effects) return true;

    for (const group of ability.effects) {
        if (group.targetMethod === 'AUTO_RANDOM') return false;
        
        if (group.payloads) {
            for (const payload of group.payloads) {
                if (['DRAW_CARD', 'SHUFFLE', 'DISCARD', 'DISCARD_CARD', 'MILL', 'CUSTOM_SCRIPT'].includes(payload.type)) {
                    return false;
                }
            }
        }
    }
    return true;
}

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
        if (flagName === 'BLOCK_ACT' && (name === 'dazed' || name === 'stunned' || name === 'stun' || name === 'mindless')) return true;
        if (flagName === 'BLOCK_ATTACK' && (name === 'unaggressive' || name === 'pacified' || name === 'pacify' || name === 'stunned' || name === 'stun')) return true;
        if (flagName === 'BLOCK_RETALIATE' && (name === 'dazed' || name === 'daze' || name === 'stunned' || name === 'stun')) return true;
        if (flagName === 'BLOCK_TARGETING' && name === 'hidden') return true;
        if (flagName === 'BLOCK_TARGET_AVATAR' && name === 'timid') return true;
        if (flagName === 'IGNORE_BLOCK_TARGETING' && name === 'perception') return true;
        if (flagName === 'STRIKE_FAST' && (name === 'swift' || name === 'first strike' || name === 'fast')) return true;
        if (flagName === 'STRIKE_SLOW' && name === 'slow') return true;
        if (flagName === 'ATTACK_EXHAUSTS' && (name === 'sluggish' || name === 'heavy attack' || name === 'cumbersome')) return true;
        if (flagName === 'UNIQUE_ENTITY' && (name === 'unique' || name === 'legendary')) return true;

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
    
    // Items on the Equator (Artifacts, unequipped Equipment) are shared and act for the Active Player
    if (state.equator && state.equator.some(i => i.instanceId === ent.instanceId)) {
        return state.activePlayerId;
    }

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

export function hydrateAbility(abRef, catalogAbs) {
    const abId = typeof abRef === 'string' ? abRef : abRef.abilityId;
    const match = catalogAbs.find(a => 
        a.abilityId === abId || 
        (a.name && a.name.toLowerCase() === String(abId).toLowerCase())
    );
    if (!match) return null;
    
    let cloned = JSON.parse(JSON.stringify(match));
    if (typeof abRef === 'object') {
        if (abRef.paramX !== undefined && abRef.paramX !== null) {
            cloned.paramX = abRef.paramX;
            if (cloned.effects) {
                cloned.effects.forEach(g => {
                    if (g.payloads) {
                        g.payloads.forEach(p => {
                            if (p.amountIsX) {
                                p.amount = (p.amount < 0) ? -abRef.paramX : abRef.paramX;
                                delete p.amountIsX;
                            }
                            if (p.grantedAbilityParamXIsX) {
                                p.grantedAbilityParamX = abRef.paramX;
                                delete p.grantedAbilityParamXIsX;
                            }
                            if (p.nestedGroup && p.nestedGroup.payloads) {
                                p.nestedGroup.payloads.forEach(np => {
                                    if (np.amountIsX) {
                                        np.amount = (np.amount < 0) ? -abRef.paramX : abRef.paramX;
                                        delete np.amountIsX;
                                    }
                                    if (np.grantedAbilityParamXIsX) {
                                        np.grantedAbilityParamX = abRef.paramX;
                                        delete np.grantedAbilityParamXIsX;
                                    }
                                });
                            }
                        });
                    }
                });
            }
            cloned.name = `${cloned.name} (${abRef.paramX})`;
        }
        if (abRef.description) cloned.description = abRef.description;
    }
    return cloned;
}

export function cloneGameState(state) {
    const clone = JSON.parse(JSON.stringify(state));
    if (state.abilityCatalog) Object.defineProperty(clone, 'abilityCatalog', { value: state.abilityCatalog, enumerable: false, configurable: true });
    if (state.catalog) Object.defineProperty(clone, 'catalog', { value: state.catalog, enumerable: false, configurable: true });
    if (state.tribeCatalog) Object.defineProperty(clone, 'tribeCatalog', { value: state.tribeCatalog, enumerable: false, configurable: true });
    return clone;
}

// -----------------------------------------------------------------------------
// CENTRALIZED RESOURCE & TARGETING UTILS (CONSOLIDATED)
// -----------------------------------------------------------------------------

export function findEntity(state, playerId, entityId) {
    let entity = state.equator?.find(i => i.instanceId === entityId || i.id === entityId);
    if (entity) return entity;
    
    const p = state.players[playerId];
    if (p && p.lines) {
        for (const line of LINES) {
            entity = p.lines[line]?.find(u => u.instanceId === entityId || u.id === entityId);
            if (entity) return entity;
        }
    }
    
    if (p) {
        const zonesToSearch = ['hand', 'discard', 'deck', 'banish'];
        for (const zone of zonesToSearch) {
            if (p[zone]) {
                entity = p[zone].find(c => c.instanceId === entityId || c.id === entityId);
                if (entity) return entity;
            }
        }
    }
    return null;
}

export function isEntityOnBoard(state, card) {
    let found = false;
    for (const pId of ['player1', 'player2']) {
        const p = state.players[pId];
        for (const line of LINES) {
            if (p.lines[line]?.some(u => u.name === card.name || u.id === card.id)) return true;
        }
    }
    if (state.equator?.some(i => i.name === card.name || i.id === card.id)) return true;
    return false;
}

export function getAttackCost(state, entity) {
    return { readinessCost: hasEngineFlag(state, entity, 'ATTACK_EXHAUSTS') ? 'EXHAUSTS' : 'UNREADIES' };
}

function normalizeCostObject(costObj, isCardPlay, entityTribe) {
    if (isCardPlay) {
        let baseCost = typeof costObj === 'number' ? costObj : ((costObj && costObj.tribeAmount > 0) ? costObj.tribeAmount : ((costObj && costObj.carnie) || (costObj && costObj.tent) || 0));
        if (entityTribe !== 'Carnie' && entityTribe !== 'Generic') {
            return { tribeAmount: baseCost };
        } else {
            return { carnie: baseCost };
        }
    }
    return typeof costObj === 'number' ? { carnie: costObj } : (costObj || { carnie: 0 });
}

export function calculateEscalatedCostValues(costObj, escalateAmt) {
    let cCost = (costObj.carnie || costObj.tent || 0);
    let pCost = (costObj.power || 0);
    let tCost = (costObj.tribeAmount || 0);

    if (costObj.escalates) {
        if (pCost > 0) pCost += escalateAmt;
        else if (tCost > 0) tCost += escalateAmt;
        else cCost += escalateAmt;
    }
    return { cCost, pCost, tCost };
}

export function canAffordCost(state, player, entity, costObj, escalateAmt = 0, isCardPlay = false) {
    if (!player) return { success: false, reason: "Player not found" };

    const entityTribe = resolveResourceKey(state, player, entity?.tribe);
    const normalizedCost = normalizeCostObject(costObj, isCardPlay, entityTribe);
    const { cCost, pCost, tCost } = calculateEscalatedCostValues(normalizedCost, escalateAmt);

    if (cCost > 0 && (player.resources['Carnie']?.current || 0) < cCost) return { success: false, reason: `Not enough Carnie (Need ${cCost})` };
    if (pCost > 0 && (entity?.power || 0) < pCost) return { success: false, reason: `Not enough Power (Need ${pCost})` };

    if (tCost > 0) {
        const entityTribe = resolveResourceKey(state, player, entity?.tribe);
        const remainingCarnie = Math.max(0, (player.resources['Carnie']?.current || 0) - cCost);

        if (entityTribe === 'Carnie') {
            if (remainingCarnie < tCost) return { success: false, reason: `Not enough Carnie (Need ${tCost})` };
        } else {
            const tribeRes = player.resources[entityTribe] ? player.resources[entityTribe].current : 0;
            if (isCardPlay && tribeRes < 1) return { success: false, reason: `Must use at least 1 Tribe Resource for the card` };
            
            const maxCarnieConversion = Math.floor(remainingCarnie / 3);
            if (tribeRes + maxCarnieConversion < tCost) return { success: false, reason: `Not enough resources (Need ${tCost})` };
        }
    }
    return { success: true };
}

export function payCost(state, player, entity, costObj, escalateAmt = 0, isCardPlay = false) {
    const entityTribe = resolveResourceKey(state, player, entity?.tribe);
    const normalizedCost = normalizeCostObject(costObj, isCardPlay, entityTribe);
    const { cCost, pCost, tCost } = calculateEscalatedCostValues(normalizedCost, escalateAmt);

    if (cCost > 0 && player.resources['Carnie']) player.resources['Carnie'].current -= cCost;
    if (pCost > 0 && entity) entity.power -= pCost;

    if (tCost > 0) {
        const entityTribe = resolveResourceKey(state, player, entity?.tribe);
        if (entityTribe === 'Carnie') {
            if (player.resources['Carnie']) player.resources['Carnie'].current -= tCost;
        } else {
            let costRemaining = tCost;
            let tribeResToUse = Math.min(player.resources[entityTribe]?.current || 0, costRemaining);
            costRemaining -= tribeResToUse;
            
            if (player.resources[entityTribe]) player.resources[entityTribe].current -= tribeResToUse;
            if (costRemaining > 0 && player.resources['Carnie']) {
                player.resources['Carnie'].current -= (costRemaining * 3);
            }
        }
    }
}