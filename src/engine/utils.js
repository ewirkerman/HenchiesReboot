/**
 * src/engine/utils.js
 * Shared utilities and helpers for the Henchies 2 Game Engine.
 */

import { generateId } from './prandom.js';

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
        // Auto-random targeting is always unsafe
        if (group.targetMethod === 'AUTO_RANDOM') return false;
        
        if (group.payloads) {
            for (const payload of group.payloads) {
                // 1. Inherently unsafe payloads (FIXED 'this.type' to 'payload.type')
                if (['SHUFFLE', 'MILL', 'CUSTOM_SCRIPT', 'TOP_DECK'].includes(payload.type)) {
                    return false;
                }
                
                
                // 2. DISCARD evaluation (unsafe if targeting enemy hand)
                if (['DISCARD', 'DISCARD_CARD'].includes(payload.type)) {
                    let qt = group.quickTargeting;
                    if (group.targetMethod === 'SAME_AS_ACTIVATION' && ability.activation) {
                        qt = ability.activation.quickTargeting || qt;
                    }
                    
                    if (qt) {
                        const aligns = qt.alignment || [];
                        const zones = qt.zones || [];
                        const targetsEnemy = aligns.includes('ENEMY') || aligns.includes('ANY');
                        const targetsHand = zones.includes('HAND') || zones.includes('ANY');
                        
                        if (targetsEnemy && targetsHand) {
                            return false;
                        }
                    }
                }

                // 3. DRAW_CARD evaluation (STRICT ALLOWLIST)
                if (payload.type === 'DRAW_CARD') {
                    // Resolve targeting method in strict priority order
                    let method = payload.targetMethod || 'NONE';
                    if (method === 'NONE') method = group.targetMethod || 'NONE';
                    if (method === 'SAME_AS_ACTIVATION' && ability.activation) {
                        method = ability.activation.method || 'NONE';
                    }
                    if (method === 'NONE') method = payload.drawMethod || 'NONE';

                    // ONLY 'PLAYER_CHOICE' is considered a safe, targeted draw.
                    // If the ability has 'NONE', 'SELF', 'AUTO_FIRST', 'RANDOM', etc., it is blind/unsafe.
                    if (method !== 'PLAYER_CHOICE') {
                        return false; 
                    }
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
    
    // 1. ALWAYS prioritize matching the exact keys currently used in the player's resource pool
    if (player && player.resources) {
        const baseKey = getResKey(tribeKey);
        if (baseKey === 'Carnie') return 'Carnie';
        if (player.resources[baseKey]) return baseKey;
        
        // Deep normalized scan (strips 'tribe_' and spaces to safely match 'tribe_pirate' to 'Pirate')
        const tkNorm = t.replace(/^(tribe_)/, '').replace(/[\s_]+/g, '');
        for (const key in player.resources) {
            const kNorm = key.toLowerCase().replace(/^(tribe_)/, '').replace(/[\s_]+/g, '');
            if (kNorm === tkNorm) {
                return key; // Perfectly returns 'Pirate' instead of 'tribe_pirate'
            }
        }
    }
    
    // 2. Fallback to Catalog ID if the player doesn't have the resource active yet
    if (state && state.tribeCatalog) {
        const match = state.tribeCatalog.find(tc => tc.id.toLowerCase() === t || tc.name.toLowerCase() === t);
        if (match) {
            if (match.name === 'Carnie') return 'Carnie';
            if (match.name === 'Generic') return 'Generic';
            return match.id;
        }
    }
    
    return getResKey(tribeKey);
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

    const checkAbility = (ability, index) => {
        const abilityKey = `${entity.instanceId}_${ability.abilityId}_${index}`;
        if (ability.passiveFlags && ability.passiveFlags.includes(flagName)) {
            
            if (ability.triggerLimit && ability.triggerLimit !== 'UNLIMITED') {
                // Append the index to create a unique key per instance
                
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
        return false;
    };

if (entity.abilities) {
        for (let index = 0; index < entity.abilities.length; index++) {
            const a = entity.abilities[index];
            if (typeof a === 'string') {
                const catAb = state.abilityCatalog?.find(ca => ca.abilityId === a);
                if (catAb && checkAbility(catAb, index)) return true;
            } else {
                if (checkAbility(a, index)) return true;
            }
        }
    }

    return false;
}

export function getOwnerId(state, entity) {
    if (!entity) return null;
    
    // 1. Standard entity properties (Fastest)
    if (entity.ownerId) return entity.ownerId;
    if (entity.originalOwnerId) return entity.originalOwnerId;
    if (entity.playerId) return entity.playerId;

    // 2. Avatar specific parsing (Avatars are system entities)
    const isAvatar = entity.type?.toLowerCase() === 'avatar' || (entity.id && entity.id.includes('avatar'));
    if (isAvatar && entity.id) {
        const parsed = entity.id.replace('_avatar', '').replace('avatar_', '');
        if (['player1', 'player2'].includes(parsed)) return parsed;
    }

    // 3. Physical State Search (The missing structural truth!)
    if (state && state.players && entity.instanceId) {
        for (const pId of ['player1', 'player2']) {
            const p = state.players[pId];
            if (!p) continue;
            
            // Check board lines
            if (p.lines) {
                for (const line in p.lines) {
                    if (p.lines[line]?.some(e => e.instanceId === entity.instanceId)) return pId;
                }
            }
            
            // Check piles
            for (const zone of ['hand', 'deck', 'discard', 'banish']) {
                if (p[zone]?.some(e => e.instanceId === entity.instanceId)) return pId;
            }
        }
    }

    // 4. Desperate Instance ID fallback parsing
    if (entity.instanceId) {
        if (entity.instanceId.includes('player1')) return 'player1';
        if (entity.instanceId.includes('player2')) return 'player2';
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

export function instantiateAbility(abRef, catalogAbs, engineState = null) {
    const hydrated = hydrateAbility(abRef, catalogAbs);
    
    if (!hydrated) {
        // Fallback for completely unresolved abilities
        const fallbackId = typeof abRef === 'string' ? abRef : (abRef.abilityId || 'Unknown');
        const fallback = { abilityId: fallbackId, name: "Unresolved: " + fallbackId, trigger: 'MANUAL' };
        const randStr = engineState ? generateId(engineState, 8) : Math.random().toString(36).substring(2, 11);
        fallback.instanceId = 'ab_inst_' + randStr;
        return fallback;
    }
    
    // Deep clone to ensure unique instance references across duplicate abilities
    const instance = JSON.parse(JSON.stringify(hydrated));
    
    // Assign UUID using deterministic engine PRNG if available, otherwise standard random
    const randStr = engineState ? generateId(engineState, 8) : Math.random().toString(36).substring(2, 11);
    instance.instanceId = 'ab_inst_' + randStr;
    
    return instance;
}

export function instantiateEntity(cardData, abilityCatalog, engineState = null, ownerId = null) {
    if (!cardData) return null;
    
    // Deep clone the base card data
    const instance = JSON.parse(JSON.stringify(cardData));
    
    // Assign UUID
    const randStr = engineState ? generateId(engineState, 8) : Math.random().toString(36).substring(2, 11);
    const prefix = instance.isToken ? 'sum_' : (instance.type === 'unit' || instance.type === 'avatar' ? 'ent_' : 'item_');
    instance.instanceId = prefix + randStr;
    
    if (ownerId) {
        instance.ownerId = ownerId;
        instance.originalOwnerId = ownerId;
    }

    // Initialize Stats safely
    instance.maxHealth = instance.maxHealth || instance.health || 1;
    if (instance.health === undefined || instance.health <= 0) instance.health = instance.maxHealth;
    instance.readiness = 0; 
    instance.acts = instance.maxActs !== undefined ? instance.maxActs : 1;
    instance.originalPower = instance.power || 0;
    instance.originalStrength = instance.strength !== undefined ? instance.strength : null;

    // Hydrate and assign UUIDs to all abilities
    if (instance.abilities) {
        instance.abilities = instance.abilities.map(ab => 
            instantiateAbility(ab, abilityCatalog, engineState)
        ).filter(Boolean);
    }
    
    return instance;
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
            if (p.lines[line]?.some(u => u.id === card.id)) return true;
        }
    }
    if (state.equator?.some(i => i.id === card.id)) return true;
    return false;
}

export function getAttackCost(state, entity) {
    return { readinessCost: hasEngineFlag(state, entity, 'ATTACK_EXHAUSTS') ? 'EXHAUSTS' : 'UNREADIES' };
}

function normalizeCostObject(costObj, isCardPlay, entityTribe) {
    // 1. Raw numbers
    if (typeof costObj === 'number') {
        if (isCardPlay && entityTribe !== 'Carnie' && entityTribe !== 'Generic') {
            return { tribeAmount: costObj, carnie: 0, power: 0 };
        }
        return { carnie: costObj, tribeAmount: 0, power: 0 };
    }
    
    // 2. Objects (Preserve distinct cost channels!)
    if (costObj) {
        let tAmt = costObj.tribeAmount || 0;
        let cAmt = costObj.carnie || costObj.tent || 0;
        let pAmt = costObj.power || 0;
        let escalates = costObj.escalates || false;

        if (isCardPlay) {
            if (entityTribe !== 'Carnie' && entityTribe !== 'Generic') {
                // It's a non-generic card: 
                // tribeAmount remains Tribe cost, carnie remains pure Carnie cost!
                return { tribeAmount: tAmt, carnie: cAmt, power: pAmt, escalates };
            } else {
                // It's a Carnie/Generic card: 
                // All tribeAmount requirements collapse into pure Carnie cost
                return { tribeAmount: 0, carnie: tAmt + cAmt, power: pAmt, escalates };
            }
        } else {
            // Not a card play (e.g. board ability). We preserve everything exactly as authored.
            return { tribeAmount: tAmt, carnie: cAmt, power: pAmt, escalates };
        }
    }
    
    return { carnie: 0, tribeAmount: 0, power: 0 };
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

export function moveEntity(engine, target, destPlayerId, destZone) {
    destZone = String(destZone || 'discard').toLowerCase();

    removeFromCurrentLocation(engine, target);
    resetEntityStateForBoard(target, destZone);
    resetEntityReadinessForPile(target, destZone);
    addToDestination(engine, target, destPlayerId, destZone);
}
function removeFromCurrentLocation(engine, target) {
    const loc = findEntityLocation(engine, target);
    if (loc && loc.array) loc.array.splice(loc.index, 1);
}
function resetEntityStateForBoard(target, destZone) {
    const boardZones = ['hand', 'deck', 'back', 'front', 'mid', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'equator', 'attachment'];
    if (boardZones.includes(destZone)) {
        target._isDying = false;
        if (target.health !== undefined && target.health !== null && target.health <= 0) {
            target.health = target.maxHealth || 1;
        }
    }
}
function resetEntityReadinessForPile(target, destZone) {
    if (['deck', 'banish'].includes(destZone)) {
        target.readiness = 0;
    }
}
function addToDestination(engine, target, destPlayerId, destZone) {
    if (destZone === 'equator') {
        if (!engine.state.equator) engine.state.equator = [];
        engine.state.equator.push(target);
        return;
    }

    const p = engine.state.players[destPlayerId];
    if (!p) return;

    if (['hand', 'deck', 'discard', 'banish'].includes(destZone)) {
        p[destZone].push(target);
    } else if (p.lines[destZone]) {
        p.lines[destZone].push(target);
    } else {
        if (!p.lines['back']) p.lines['back'] = [];
        p.lines['back'].push(target);
    }
}export function findEntityLocation(engine, target) {
    if (!target || !target.instanceId) return null;

    let result = searchPlayerZones(engine, target);
    if (result) return result;

    result = searchEquator(engine, target);
    return result;
}
function searchPlayerZones(engine, target) {
    for (const pId of ['player1', 'player2']) {
        const p = engine.state.players[pId];

        let result = searchPlayerLines(p, pId, target);
        if (result) return result;

        result = searchPlayerPiles(p, pId, target);
        if (result) return result;
    }
    return null;
}
function searchPlayerLines(player, playerId, target) {
    for (const line in player.lines) {
        if (!player.lines[line]) continue;

        const idx = player.lines[line].findIndex(c => c.instanceId === target.instanceId);
        if (idx > -1) return { playerId, zone: line, array: player.lines[line], index: idx };

        for (const host of player.lines[line]) {
            const found = searchAttachments(host, playerId, target);
            if (found) return found;
        }
    }
    return null;
}
function searchPlayerPiles(player, playerId, target) {
    const zones = ['hand', 'deck', 'discard', 'banish'];
    for (const z of zones) {
        const idx = player[z].findIndex(c => c.instanceId === target.instanceId);
        if (idx > -1) return { playerId, zone: z, array: player[z], index: idx };

        for (const host of player[z]) {
            const found = searchAttachments(host, playerId, target);
            if (found) return found;
        }
    }
    return null;
}
function searchEquator(engine, target) {
    if (!engine.state.equator) return null;

    const idx = engine.state.equator.findIndex(c => c.instanceId === target.instanceId);
    if (idx > -1) return { playerId: null, zone: 'equator', array: engine.state.equator, index: idx };

    for (const host of engine.state.equator) {
        const found = searchAttachments(host, null, target);
        if (found) return found;
    }
    return null;
}
function searchAttachments(host, playerId, target) {
    if (!host.attachments) return null;

    const aIdx = host.attachments.findIndex(a => a.instanceId === target.instanceId);
    if (aIdx > -1) return { playerId, zone: 'attachment', array: host.attachments, index: aIdx, host: host };

    for (const att of host.attachments) {
        const found = searchAttachments(att, playerId, target);
        if (found) return found;
    }
    return null;
}