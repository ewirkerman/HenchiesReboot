/**
 * src/engine/utils.js
 * Shared utilities and helpers for the Henchies 2 Game Engine.
 */

import { generateId } from './prandom.js';

export const CARD_CATALOG = []; // Will be hydrated by deckbuilder/firebase

export const GLOBAL_UNDO_POLICY = 'ALLOWED'; // Options: 'ALLOWED', 'FORCED_ON', 'FORCED_OFF'

export const TRAITS = [];
export const LINES = ['taunt', 'bodyguard', 'avatar', 'front', 'mid', 'back', 'sheltered', 'sideline'];
export class Card { }
export class UnitInstance { }
export class Avatar { }

export function isUndoable(state, ability) {
    if (state && state.status === 'finished') return false;
    if (!ability) return true;

    const logicTreeIsUndoable = (node) => {
        if (!node) return true;
        if (node.type === 'condition' && node.attribute === 'customScript' && node.undoSafe === false) return false;
        return !Array.isArray(node.children) || node.children.every(logicTreeIsUndoable);
    };

    const payloadsAreUndoable = (payloads, group) => {
        for (const payload of payloads || []) {
            if (['SHUFFLE', 'MILL', 'TOP_DECK'].includes(payload.type)) return false;
            if (payload.type === 'CUSTOM_SCRIPT' && payload.undoSafe !== true) return false;
            if (!logicTreeIsUndoable(payload.logicTree)) return false;

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

                    if (targetsEnemy && targetsHand) return false;
                }
            }

            if (payload.type === 'DRAW_CARD') {
                let method = payload.targetMethod || 'NONE';
                if (method === 'NONE') method = group.targetMethod || 'NONE';
                if (method === 'SAME_AS_ACTIVATION' && ability.activation) {
                    method = ability.activation.method || 'NONE';
                }
                if (method === 'NONE') method = payload.drawMethod || 'NONE';
                if (method !== 'PLAYER_CHOICE') return false;
            }

            const nestedGroup = payload.nestedGroup;
            if (nestedGroup) {
                if (nestedGroup.targetMethod === 'AUTO_RANDOM') return false;
                if (!logicTreeIsUndoable(nestedGroup.logicTree)) return false;
                if (!payloadsAreUndoable(nestedGroup.payloads, nestedGroup)) return false;
            } else if (Array.isArray(payload.payloads) && !payloadsAreUndoable(payload.payloads, group)) {
                return false;
            }
        }
        return true;
    };

    for (const group of ability.effects || []) {
        if (group.targetMethod === 'AUTO_RANDOM') return false;
        if (!logicTreeIsUndoable(group.logicTree)) return false;
        if (!payloadsAreUndoable(group.payloads, group)) return false;
    }
    return logicTreeIsUndoable(ability.activation?.logicTree);
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

    if (player && player.resources) {
        const baseKey = getResKey(tribeKey);
        if (baseKey === 'Carnie') return 'Carnie';
        if (player.resources[baseKey]) return baseKey;

        const tkNorm = t.replace(/^(tribe_)/, '').replace(/[\s_]+/g, '');
        for (const key in player.resources) {
            const kNorm = key.toLowerCase().replace(/^(tribe_)/, '').replace(/[\s_]+/g, '');
            if (kNorm === tkNorm) {
                return key;
            }
        }
    }

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

    if (entity.ownerId) return entity.ownerId;
    if (entity.originalOwnerId) return entity.originalOwnerId;
    if (entity.playerId) return entity.playerId;

    const isAvatar = entity.type?.toLowerCase() === 'avatar' || (entity.id && entity.id.includes('avatar'));
    if (isAvatar && entity.id) {
        const parsed = entity.id.replace('_avatar', '').replace('avatar_', '');
        if (['player1', 'player2'].includes(parsed)) return parsed;
    }

    // Consolidated Physical State Search fallback
    if (state && state.players) {
        const loc = findEntityLocation(state, entity);
        if (loc && loc.playerId) return loc.playerId;
    }

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

export function isAutoCast(ability) {
    return ability.trigger === 'ON_BE_PLAYED' && !ability.isSelectable && !(ability.activation && ability.activation.method == 'PLAYER_CHOICE');
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
        if (abRef.isSelectable !== undefined) {
            cloned.isSelectable = abRef.isSelectable;
        }
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
    if (typeof abRef === 'object' && abRef.instanceId) {
        return JSON.parse(JSON.stringify(abRef));
    }

    const hydrated = hydrateAbility(abRef, catalogAbs);

    if (!hydrated) {
        const fallbackId = typeof abRef === 'string' ? abRef : (abRef.abilityId || 'Unknown');
        const fallback = { abilityId: fallbackId, name: "Unresolved: " + fallbackId, trigger: 'MANUAL' };
        const randStr = engineState ? generateId(engineState, 8) : Math.random().toString(36).substring(2, 11);
        fallback.instanceId = 'ab_inst_' + randStr;
        return fallback;
    }

    const instance = JSON.parse(JSON.stringify(hydrated));
    const randStr = engineState ? generateId(engineState, 8) : Math.random().toString(36).substring(2, 11);
    instance.instanceId = 'ab_inst_' + randStr;

    return instance;
}

export function instantiateEntity(cardData, abilityCatalog, engineState = null, ownerId = null) {
    if (!cardData) return null;

    if (typeof cardData === 'object' && cardData.instanceId) {
        return JSON.parse(JSON.stringify(cardData));
    }

    const instance = JSON.parse(JSON.stringify(cardData));
    const randStr = engineState ? generateId(engineState, 8) : Math.random().toString(36).substring(2, 11);
    const prefix = instance.isToken ? 'sum_' : (instance.type === 'unit' || instance.type === 'avatar' ? 'ent_' : 'item_');
    instance.instanceId = prefix + randStr;

    if (ownerId) {
        instance.ownerId = ownerId;
        instance.originalOwnerId = ownerId;
    }

    instance.maxHealth = instance.maxHealth || instance.health || 1;
    if (instance.health === undefined || instance.health <= 0) instance.health = instance.maxHealth;
    instance.readiness = 0;
    instance.acts = instance.maxActs !== undefined ? instance.maxActs : 1;
    instance.originalPower = instance.power || 0;
    instance.originalStrength = instance.strength !== undefined ? instance.strength : null;

    if (instance.abilities) {
        instance.abilities = instance.abilities.map(ab =>
            ({ ...instantiateAbility(ab, abilityCatalog, engineState), origin: 'innate' })
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
    const loc = findEntityLocation(state, { instanceId: entityId, id: entityId });
    if (loc && (loc.playerId === playerId || loc.zone === 'equator')) {
        return loc.array[loc.index];
    }
    return null;
}

export function isEntityOnBoard(state, card) {
    return !!queryState(state, { zones: ['BOARD'], target: card });
}

export function isNameOrIdOnBoard(state, playerId, card) {
    if (!card || (!card.id && !card.name)) return false;

    const target = { _matchNameOrId: true, id: card.id, name: card.name };

    // Checks allied lines + explicitly owned equator cards in a single, unified query
    return !!queryState(state, { players: [playerId], zones: ['BOARD'], target, ignoreAttachments: true, ownedBy: playerId });
}

export function getAttackCost(state, entity) {
    return { readinessCost: hasEngineFlag(state, entity, 'ATTACK_EXHAUSTS') ? 'EXHAUSTS' : 'UNREADIES' };
}

function normalizeCostObject(costObj, isCardPlay, entityTribe) {
    if (typeof costObj === 'number') {
        if (isCardPlay && entityTribe !== 'Carnie' && entityTribe !== 'Generic') {
            return { tribeAmount: costObj, carnie: 0, power: 0 };
        }
        return { carnie: costObj, tribeAmount: 0, power: 0 };
    }

    if (costObj) {
        let tAmt = costObj.tribeAmount || 0;
        let cAmt = costObj.carnie || costObj.tent || 0;
        let pAmt = costObj.power || 0;
        let escalates = costObj.escalates || false;

        if (isCardPlay) {
            if (entityTribe !== 'Carnie' && entityTribe !== 'Generic') {
                return { tribeAmount: tAmt, carnie: cAmt, power: pAmt, escalates };
            } else {
                return { tribeAmount: 0, carnie: tAmt + cAmt, power: pAmt, escalates };
            }
        } else {
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

/**
 * Core Strategy for evaluating resource deduction math
 */
export function evaluatePayment(state, player, entity, costObj, escalateAmt = 0, isCardPlay = false) {
    if (!player) return { success: false, reason: "Player not found" };

    const entityTribe = resolveResourceKey(state, player, entity?.tribe);
    const normalizedCost = normalizeCostObject(costObj, isCardPlay, entityTribe);
    const { cCost, pCost, tCost } = calculateEscalatedCostValues(normalizedCost, escalateAmt);

    let finalCarnieDeduction = cCost;
    let finalTribeDeduction = 0;

    if (cCost > 0 && (player.resources['Carnie']?.current || 0) < cCost) {
        return { success: false, reason: `Not enough Carnie (Need ${cCost})` };
    }
    if (pCost > 0 && (entity?.power || 0) < pCost) {
        return { success: false, reason: `Not enough Power (Need ${pCost})` };
    }

    if (tCost > 0) {
        const remainingCarnie = Math.max(0, (player.resources['Carnie']?.current || 0) - cCost);

        if (entityTribe === 'Carnie') {
            if (remainingCarnie < tCost) return { success: false, reason: `Not enough Carnie (Need ${tCost})` };
            finalCarnieDeduction += tCost;
        } else {
            const tribeRes = player.resources[entityTribe] ? player.resources[entityTribe].current : 0;
            if (isCardPlay && tribeRes < 1) return { success: false, reason: `Must use at least 1 Tribe Resource for the card` };

            finalTribeDeduction = Math.min(tribeRes, tCost);
            const costRemaining = tCost - finalTribeDeduction;

            if (costRemaining > 0) {
                const maxCarnieConversion = Math.floor(remainingCarnie / 3);
                if (maxCarnieConversion < costRemaining) {
                    return { success: false, reason: `Not enough resources (Need ${tCost})` };
                }
                finalCarnieDeduction += (costRemaining * 3);
            }
        }
    }

    return {
        success: true,
        entityTribe,
        pCost,
        carnieDeduct: finalCarnieDeduction,
        tribeDeduct: finalTribeDeduction
    };
}

export function canAffordCost(state, player, entity, costObj, escalateAmt = 0, isCardPlay = false) {
    const result = evaluatePayment(state, player, entity, costObj, escalateAmt, isCardPlay);
    return { success: result.success, reason: result.reason };
}

export function payCost(state, player, entity, costObj, escalateAmt = 0, isCardPlay = false) {
    const result = evaluatePayment(state, player, entity, costObj, escalateAmt, isCardPlay);
    if (!result.success) return;

    if (result.carnieDeduct > 0 && player.resources['Carnie']) {
        player.resources['Carnie'].current -= result.carnieDeduct;
    }
    if (result.tribeDeduct > 0 && player.resources[result.entityTribe]) {
        player.resources[result.entityTribe].current -= result.tribeDeduct;
    }
    if (result.pCost > 0 && entity) {
        entity.power -= result.pCost;
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
}

// -----------------------------------------------------------------------------
// GENERAL PURPOSE STATE LOCATOR (LDAP-STYLE)
// -----------------------------------------------------------------------------

/**
 * Powerful centralized search function for querying the game state.
 * @param {Object} state - The game state object.
 * @param {Object} query - The search query configuration.
 * @param {Object|Function} query.target - Entity matching rules (instanceId, id, name) OR a predicate function.
 * @param {Array<string>} [query.players] - Players to search. Defaults to ['player1', 'player2'].
 * @param {Array<string>} [query.zones] - Zones to search (e.g. ['front', 'hand', 'equator']). Aliases: 'ALL', 'BOARD', 'LINES', 'PILES'. Defaults to ['ALL'].
 * @param {boolean} [query.ignoreAttachments] - If true, skips deeply nested attachments. Defaults to false.
 * @param {string} [query.ownedBy] - If provided, filters matches by ownerId or originalOwnerId.
 * @param {boolean} [query.findAll] - If true, returns an array of all matches. Defaults to false (returns first match).
 * @returns {Object|Array<Object>|null} A location object, array of location objects, or null.
 */
export function queryState(state, query) {
    const results = [];
    const playersToSearch = query.players || ['player1', 'player2'];
    const zonesToSearch = query.zones || ['ALL'];
    const ignoreAttachments = query.ignoreAttachments || false;
    const findAll = query.findAll || false;

    // Expand zones (Handle aliases)
    const validZones = new Set();
    for (const z of zonesToSearch) {
        const upper = z.toUpperCase();
        if (upper === 'ALL') {
            ['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar', 'hand', 'deck', 'discard', 'banish', 'equator'].forEach(x => validZones.add(x));
            break;
        }
        if (upper === 'BOARD') {
            ['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar', 'equator'].forEach(x => validZones.add(x));
        } else if (upper === 'LINES') {
            ['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].forEach(x => validZones.add(x));
        } else if (upper === 'PILES') {
            ['hand', 'deck', 'discard', 'banish'].forEach(x => validZones.add(x));
        } else {
            validZones.add(z.toLowerCase());
        }
    }

    // Target Matcher Evaluator
    const target = query.target;
    const isMatch = (c) => {
        if (!target) return false;
        if (typeof target === 'function') return target(c);

        // 0. Name or generic ID lookup (used by uniqueness checks)
        if (target._matchNameOrId) {
            return (target.id && c.id === target.id) || (target.name && c.name === target.name);
        }
        // 1. Fuzzy lookup (used primarily by findEntity wrapper)
        if (target._fuzzyId) {
            return c.instanceId === target._fuzzyId || c.id === target._fuzzyId;
        }
        // 2. Strict Instance ID matching (prevents name-collisions across players)
        if (target.instanceId) {
            return c.instanceId === target.instanceId;
        }
        // 3. Fallback to generic ID only if no instanceId was provided
        return c.id === target.id;
    };

    // Recursive Array Scanner
    const scanArray = (arr, zoneName, ownerId, host = null) => {
        if (!arr) return false;
        for (let i = 0; i < arr.length; i++) {
            const c = arr[i];
            if (isMatch(c)) {
                let ownershipPassed = true;
                if (query.ownedBy) {
                    // Fallback to the zone's ownerId if the card lacks explicit ownership tags
                    const cOwner = c.ownerId || c.originalOwnerId || ownerId;
                    if (cOwner !== query.ownedBy) ownershipPassed = false;
                }

                if (ownershipPassed) {
                    const loc = { playerId: ownerId, zone: host ? 'attachment' : zoneName, array: arr, index: i, host: host };
                    results.push(loc);
                    if (!findAll) return true;
                }
            }

            // Deep scan attachments
            if (!ignoreAttachments && c.attachments) {
                if (scanArray(c.attachments, 'attachment', ownerId, c)) {
                    if (!findAll) return true;
                }
            }
        }
        return false;
    };

    // Search Players
    for (const pId of playersToSearch) {
        const p = state.players[pId];
        if (!p) continue;

        // Search Lines
        if (p.lines) {
            for (const line of Object.keys(p.lines)) {
                if (validZones.has(line)) {
                    if (scanArray(p.lines[line], line, pId)) {
                        if (!findAll) return results[0];
                    }
                }
            }
        }

        // Search Piles
        for (const pile of ['hand', 'deck', 'discard', 'banish']) {
            if (validZones.has(pile)) {
                if (scanArray(p[pile], pile, pId)) {
                    if (!findAll) return results[0];
                }
            }
        }
    }

    // Search Equator
    if (validZones.has('equator') && state.equator) {
        if (scanArray(state.equator, 'equator', null)) {
            if (!findAll) return results[0];
        }
    }

    return findAll ? results : (results[0] || null);
}

export function findEntityLocation(engineOrState, target) {
    if (!target || (!target.instanceId && !target.id && !target._fuzzyId)) return null;

    // Normalize signature: Use state object directly if passed, otherwise extract from engine
    const state = engineOrState.state ? engineOrState.state : engineOrState;

    return queryState(state, { target });
}