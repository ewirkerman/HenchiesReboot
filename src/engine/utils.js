/**
 * src/engine/utils.js
 * Shared utilities and helpers for the Henchies 2 Game Engine.
 */

import { generateId } from './prandom.js';

export const CARD_CATALOG = []; // Will be hydrated by deckbuilder/firebase

export const GLOBAL_UNDO_POLICY = 'ALLOWED'; // Options: 'ALLOWED', 'FORCED_ON', 'FORCED_OFF'

export const TRAITS = [];
export const LINES = ['taunt', 'bodyguard', 'avatar', 'front', 'mid', 'back', 'sheltered', 'sideline'];
export const FIELD_ZONES = ['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar', 'equator'];

export function isFieldZone(zone) {
    if (!zone) return false;
    return FIELD_ZONES.includes(String(zone).toLowerCase());
}

export class Card { }
export class UnitInstance { }
export class Avatar { }

function drawCandidatesAreEquivalent(candidates, state) {
    if (candidates.length < 2) return true;

    const normalize = (value, isRoot = false) => {
        if (Array.isArray(value)) return value.map(item => normalize(item));
        if (!value || typeof value !== 'object') return value;

        return Object.fromEntries(
            Object.keys(value)
                .filter(key => key !== 'instanceId' && !(isRoot && key === 'readiness'))
                .sort()
                .map(key => [key, normalize(value[key])])
        );
    };

    const signature = candidate => JSON.stringify({
        entity: normalize(candidate, true),
        abilityUses: (candidate.abilities || []).map(ability => state?.abilityUses?.[ability.instanceId] || 0)
    });
    const firstCandidate = signature(candidates[0]);
    return candidates.every(candidate => signature(candidate) === firstCandidate);
}

export function isUndoable(state, ability, context = {}) {
    if (state && state.status === 'finished') return false;
    if (!ability) return true;

    const logicTreeIsUndoable = (node) => {
        if (!node) return true;
        if (node.type === 'condition' && node.attribute === 'customScript' && node.undoSafe === false) return false;
        return !Array.isArray(node.children) || node.children.every(logicTreeIsUndoable);
    };

    const randomGroupIsUndoable = (group, parentPayload = null) => {
        if (!group.payloads?.length) return true;
        const candidateCount = context.getRandomTargetCount?.(group, parentPayload);
        return candidateCount === 0 || candidateCount === 1;
    };

    const payloadsAreUndoable = (payloads, group, drawTargetGroup = group) => {
        for (const payload of payloads || []) {
            const nestedGroup = payload.nestedGroup;
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
                if (method !== 'PLAYER_CHOICE') {
                    const candidates = context.getDrawTargetPool?.(drawTargetGroup);
                    if (!Array.isArray(candidates) || !drawCandidatesAreEquivalent(candidates, state)) return false;
                }
            }

            if (nestedGroup) {
                if (nestedGroup.targetMethod === 'AUTO_RANDOM' && !randomGroupIsUndoable(nestedGroup, payload)) return false;
                if (!logicTreeIsUndoable(nestedGroup.logicTree)) return false;
                const nestedDrawTargetGroup = payload.type === 'CONDITIONAL' ? drawTargetGroup : nestedGroup;
                if (!payloadsAreUndoable(nestedGroup.payloads, nestedGroup, nestedDrawTargetGroup)) return false;
                if (payload.type === 'CONDITIONAL' && Array.isArray(payload.elsePayloads) && !payloadsAreUndoable(payload.elsePayloads, nestedGroup, nestedDrawTargetGroup)) return false;
            } else if (Array.isArray(payload.payloads) && !payloadsAreUndoable(payload.payloads, group, drawTargetGroup)) {
                return false;
            }
        }
        return true;
    };

    for (const group of ability.effects || []) {
        if (group.targetMethod === 'AUTO_RANDOM' && !randomGroupIsUndoable(group)) return false;
        if (!logicTreeIsUndoable(group.logicTree)) return false;
        if (!payloadsAreUndoable(group.payloads, group, group)) return false;
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
        const abilityKey = ability.instanceId || `${entity.instanceId}_${ability.abilityId}_${index}`;
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

export function getReadinessFloor(state, entity) {
    return hasEngineFlag(state, entity, 'TIRELESS') ? 0 : -1;
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
        if (abRef.tribe !== undefined && abRef.tribe !== null) {
            cloned.tribe = abRef.tribe;
            if (cloned.cost && typeof cloned.cost === 'object') {
                cloned.cost.tribe = abRef.tribe;
            }
        }
        if (abRef.cost?.tribe !== undefined && abRef.cost?.tribe !== null) {
            cloned.cost = {
                ...(cloned.cost && typeof cloned.cost === 'object' ? cloned.cost : {}),
                tribe: abRef.cost.tribe
            };
        }
        if (abRef.paramX !== undefined && abRef.paramX !== null) {
            cloned.paramX = abRef.paramX;
            if (cloned.effects) {
                cloned.effects.forEach(g => {
                    if (g.targetCountIsX) {
                        g.targetCount = abRef.paramX;
                        // Flag is now preserved for future re-hydration
                    }
                    if (g.payloads) {
                        g.payloads.forEach(p => {
                            if (p.amountIsX) {
                                p.amount = abRef.paramX;
                            }
                            if (p.grantedAbilityParamXIsX) {
                                p.grantedAbilityParamX = abRef.paramX;
                            }
                            if (p.nestedGroup) {
                                if (p.nestedGroup.targetCountIsX) {
                                    p.nestedGroup.targetCount = abRef.paramX;
                                }
                                if (p.nestedGroup.payloads) {
                                    p.nestedGroup.payloads.forEach(np => {
                                        if (np.amountIsX) {
                                            np.amount = abRef.paramX;
                                        }
                                        if (np.grantedAbilityParamXIsX) {
                                            np.grantedAbilityParamX = abRef.paramX;
                                        }
                                    });
                                }
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

export function updateAbilityLevel(state, target, abilityId, newParamX) {
    if (!target) return false;
    let uiNeedsUpdate = false;

    // 1. Update the tracker in activeEffects (if it exists)
    if (target.activeEffects) {
        const effectIdx = target.activeEffects.findIndex(e =>
            e.grantedAbilityId === abilityId ||
            (e.grantedAbility && e.grantedAbility.abilityId === abilityId)
        );

        if (effectIdx !== -1) {
            const newEffect = { ...target.activeEffects[effectIdx] };
            newEffect.grantedAbilityParamX = newParamX;
            newEffect.paramX = newParamX;

            const newEffectsArr = target.activeEffects.slice();
            newEffectsArr[effectIdx] = newEffect;
            target.activeEffects = newEffectsArr;
            uiNeedsUpdate = true;
        }
    }

    // 2. Update the live ability and re-map dynamic payloads
    if (target.abilities) {
        const liveAbIdx = target.abilities.findIndex(a =>
            a.abilityId === abilityId ||
            (a.name && a.name.toLowerCase().startsWith(abilityId.toLowerCase()))
        );

        if (liveAbIdx !== -1) {
            const newAb = JSON.parse(JSON.stringify(target.abilities[liveAbIdx]));
            newAb.paramX = newParamX;

            // Format name cleanly for UI and Logging
            if (newAb.name) {
                newAb.name = newAb.name.replace(/\s*\(\d+\)$/, '') + ` (${newParamX})`;
            }

            // Re-hydrate any X-dependent payloads dynamically based on preserved flags
            if (newAb.effects) {
                newAb.effects.forEach(g => {
                    if (g.targetCountIsX) g.targetCount = newParamX;
                    if (g.payloads) {
                        g.payloads.forEach(p => {
                            if (p.amountIsX) p.amount = newParamX;
                            if (p.grantedAbilityParamXIsX) p.grantedAbilityParamX = newParamX;

                            if (p.nestedGroup) {
                                if (p.nestedGroup.targetCountIsX) p.nestedGroup.targetCount = newParamX;
                                if (p.nestedGroup.payloads) {
                                    p.nestedGroup.payloads.forEach(np => {
                                        if (np.amountIsX) np.amount = newParamX;
                                        if (np.grantedAbilityParamXIsX) np.grantedAbilityParamX = newParamX;
                                    });
                                }
                            }
                        });
                    }
                });
            }

            const newAbsArr = target.abilities.slice();
            newAbsArr[liveAbIdx] = newAb;
            target.abilities = newAbsArr;
            uiNeedsUpdate = true;
        }
    }

    return uiNeedsUpdate;
}

export function getAbilityCooldownGroup(ability) {
    for (const group of [ability?.cooldownGroup, ability?.origin]) {
        if (typeof group !== 'string' || !group.trim()) continue;
        const normalized = group.trim();
        if (normalized.toLowerCase() === 'unique') {
            return `$unique:${ability.abilityId || ability.instanceId || 'unknown'}`;
        }
        if (normalized.toLowerCase() === 'unique+') {
            return `$unique-instance:${ability.instanceId || ability.abilityId || 'unknown'}`;
        }
        return normalized;
    }
    return 'innate';
}

export function isAttackAbility(ability) {
    return !!ability?.effects?.some(group =>
        group?.payloads?.some(payload => payload?.type === 'ATTACK')
    );
}

export function normalizeEntityCooldownGroups(entity) {
    if (!entity || typeof entity !== 'object') return;

    delete entity.maxActs;
    if (Array.isArray(entity.activeEffects)) {
        entity.activeEffects = entity.activeEffects.filter(effect => effect?.stat !== 'acts' && effect?.stat !== 'maxActs');
    }
    if (entity.statSources) {
        delete entity.statSources.acts;
        delete entity.statSources.maxActs;
    }
    const existing = entity.acts;
    const tracksCooldowns = existing !== undefined ||
        (Array.isArray(entity.abilities) && entity.abilities.length > 0) ||
        ['unit', 'avatar', 'equipment', 'artifact'].includes(entity.type);
    if (!tracksCooldowns) return;

    const usedGroups = {};
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        for (const [group, used] of Object.entries(existing)) {
            if (used) Object.defineProperty(usedGroups, group, { value: true, enumerable: true, writable: true, configurable: true });
        }
    }
    entity.acts = usedGroups;
}

export function hasUsedCooldownGroup(entity, group) {
    return !!entity?.acts && Object.prototype.hasOwnProperty.call(entity.acts, group) && !!entity.acts[group];
}

export function canReuseAbilityCooldownGroup(state, ability) {
    const cost = ability?.cost;
    return !!(
        cost?.readinessCost &&
        cost.readinessCost !== 'NONE' &&
        cost.reuseIgnoresReadiness &&
        ability.instanceId &&
        (state?.abilityUses?.[ability.instanceId] || 0) > 0
    );
}

export function markCooldownGroupUsed(entity, group) {
    normalizeEntityCooldownGroups(entity);
    Object.defineProperty(entity.acts, group, { value: true, enumerable: true, writable: true, configurable: true });
}

export function instantiateEntity(cardData, abilityCatalog, engineState = null, ownerId = null) {
    if (!cardData) return null;

    if (typeof cardData === 'object' && cardData.instanceId) {
        const instance = JSON.parse(JSON.stringify(cardData));
        normalizeEntityCooldownGroups(instance);
        return instance;
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
    normalizeEntityCooldownGroups(instance);
    instance.originalPower = instance.power || 0;
    instance.originalStrength = instance.strength !== undefined ? instance.strength : null;
    instance.attackedThisTurn = false;

    if (instance.abilities) {
        instance.abilities = instance.abilities.map(ab =>
            ({ ...instantiateAbility(ab, abilityCatalog, engineState), origin: 'innate' })
        ).filter(Boolean);
    }

    return instance;
}

export function cloneGameState(state) {
    const clone = JSON.parse(JSON.stringify(state));
    const entities = queryState(clone, {
        players: ['player1', 'player2'],
        zones: ['ALL'],
        target: () => true,
        findAll: true
    });
    for (const location of entities) normalizeEntityCooldownGroups(location.array[location.index]);
    for (const player of Object.values(clone.players || {})) {
        if (player.avatar) normalizeEntityCooldownGroups(player.avatar);
        if (player.unplayedAvatar) normalizeEntityCooldownGroups(player.unplayedAvatar);
    }
    for (const item of clone.equator || []) normalizeEntityCooldownGroups(item);
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
        const entity = loc.array[loc.index];
        normalizeEntityCooldownGroups(entity);
        return entity;
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

export function checkReadinessAffordability(state, entity, cost, abilityKey, isHandAct = false) {
    if (isHandAct || cost?.requiresNoReadiness) return true;
    if (cost?.readinessCost && cost.readinessCost !== 'NONE' && cost.reuseIgnoresReadiness && (state?.abilityUses?.[abilityKey] || 0) > 0) return true;
    const readiness = Number(entity?.readiness);
    return (!isNaN(readiness) ? readiness : 0) >= 1;
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

    // Prioritize the tribe stamped on the cost object itself, falling back to the entity
    const sourceTribe = costObj?.tribe ?? entity?.tribe;
    const entityTribe = resolveResourceKey(state, player, sourceTribe);

    // console.log(`[Resource Math] Evaluating cost for ${entity?.name}. Source Tribe: ${sourceTribe || 'None'} -> Resolved: ${entityTribe}`);
    // console.log(`[Resource Math] Available ${entityTribe}: ${player.resources[entityTribe]?.current || 0} | Available Carnie: ${player.resources['Carnie']?.current || 0}`);

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
                if (!isCardPlay) {
                    return { success: false, reason: `Not enough resources (Need ${tCost})` };
                }
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
    const currentLocation = findEntityLocation(engine, target);
    markHiddenInformationReveal(engine, currentLocation, destPlayerId, destZone);

    removeFromCurrentLocation(engine, target);
    resetEntityStateForBoard(target, destZone);
    resetEntityReadinessForPile(target, destZone);
    addToDestination(engine, target, destPlayerId, destZone);
}

export function markHiddenInformationReveal(engine, sourceLocation, destinationPlayerId, destinationZone) {
    if (!sourceLocation || !['hand', 'deck'].includes(sourceLocation.zone)) return;
    const actingPlayerId = engine.currentActionActorId || engine.state.activePlayerId;
    if (sourceLocation.playerId === actingPlayerId) return;
    const isPublicZone = LINES.includes(destinationZone) || ['field', 'board', 'equator', 'discard', 'banish'].includes(destinationZone);
    if (isPublicZone || destinationPlayerId === actingPlayerId) engine.state._irreversibleActionOccurred = true;
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
        const ownerId = target.ownerId || target.originalOwnerId || destPlayerId;
        if (ownerId) {
            target.ownerId ||= ownerId;
            target.originalOwnerId ||= ownerId;
        }
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

export function createReadOnlyProxy(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;

    return new Proxy(obj, {
        get(target, prop) {
            const val = target[prop];
            // Recursively wrap nested objects on-the-fly as they are accessed
            if (typeof val === 'object' && val !== null) {
                return createReadOnlyProxy(val);
            }
            return typeof val === 'function' ? val.bind(target) : val;
        },
        set(target, prop, value) {
            console.warn(`[Sandbox] Blocked mutation attempt on property: ${String(prop)}`);
            return true; // Return true to fail silently without throwing a fatal error
        },
        deleteProperty(target, prop) {
            console.warn(`[Sandbox] Blocked deletion attempt on property: ${String(prop)}`);
            return true;
        }
    });
}