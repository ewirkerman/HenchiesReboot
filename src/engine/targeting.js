/**
 * src/engine/targeting.js
 * Logic for determining valid targets and available actions.
 */

import { hasEngineFlag, resolveResourceKey, LINES, isUndoable, findEntity, canAffordCost, getAttackCost, isEntityOnBoard, isAutoCast, getAvatar } from './utils.js';
import { GameEngine } from './index.js';

function getStat(entity, statKey) {
    const val = Number(entity[statKey]);
    return isNaN(val) ? 0 : val;
}

function extractQuickTargeting(ability) {
    if (ability?.activation?.quickTargeting) {
        return ability.activation.quickTargeting;
    }
    return  null;
}

function deduplicateTargets(targets) {
    return targets.filter((t, index, self) => index === self.findIndex(o => o.id === t.id));
}

function isHidden(state, entity) {
    return hasEngineFlag(state, entity, 'BLOCK_TARGETING');
}

function hasPerception(state, entity) {
    return hasEngineFlag(state, entity, 'IGNORE_BLOCK_TARGETING');
}

function isTimidAgainst(state, attacker, target) {
    return target.type === 'avatar' && hasEngineFlag(state, attacker, 'BLOCK_TARGET_AVATAR');
}

function isFriendly(ownerA, ownerB) {
    return ownerA === ownerB;
}

function matchesAlignment(targetOwnerId, sourceOwnerId, qt) {
    if (!qt.alignment || qt.alignment.length === 0) return true;
    
    const friendly = isFriendly(targetOwnerId, sourceOwnerId);
    if (friendly && !qt.alignment.includes('FRIENDLY')) return false;
    if (!friendly && !qt.alignment.includes('ENEMY')) return false;
    return true;
}

function matchesEntityType(target, qt) {
    const entType = target.type ? target.type.toUpperCase() : 'UNIT';
    if (qt.entityType && qt.entityType.length > 0 && !qt.entityType.includes(entType)) return false;
    return true;
}

function isPlayTrigger(trigger) {
    return ['PLAY', 'PLAY_OPTIONAL', 'ON_BE_PLAYED', 'WOULD_PLAY', 'WOULD_BE_PLAYED', 'MODIFY_PLAY'].includes(trigger);
}

function checkAttackTargetValidity(state, attacker, target, usePerception) {
    if (target.type === 'boon') return false;
    if (isTimidAgainst(state, attacker, target)) return false;
    if (isHidden(state, target) && !usePerception) return false;
    return true;
}

function getFieldTargets(state, targetPlayerId, isValidTarget, enforceBattlelines = false) {
    const player = state.players[targetPlayerId];
    const logicalLines = { taunt: [], bodyguard: [], avatar: [], front: [], mid: [], back: [], sheltered: [], sideline: [] };
    let allValidTargets = [];

    for (const line of Object.keys(logicalLines)) {
        if (player.lines[line]) {
            player.lines[line].forEach(u => {
                if (isValidTarget(u)) {
                    const targetObj = { id: u.instanceId || u.id, line: u.line || line, playerId: targetPlayerId };
                    allValidTargets.push(targetObj);
                    logicalLines[u.line || line].push(targetObj);
                }
            });
        }
    }

    if (!enforceBattlelines) return allValidTargets;
    return getBattlelineTargets(logicalLines);
}

function getBattlelineTargets(logicalLines) {
    if (logicalLines['taunt'].length > 0) {
        if (logicalLines['sideline'].length > 0) return [...logicalLines['taunt'], ...logicalLines['sideline']];
        return logicalLines['taunt'];
    }

    const validTargets = [];
    for (const line of ['front', 'mid', 'back', 'sheltered']) {
        if (logicalLines[line].length > 0) {
            validTargets.push(...logicalLines[line]);
            break;
        }
    }

    if (logicalLines['bodyguard'].length > 0) {
        validTargets.push(...logicalLines['bodyguard']);
    } else if (logicalLines['avatar'].length > 0) {
        validTargets.push(...logicalLines['avatar']);
    }

    if (logicalLines['sideline'].length > 0) {
        validTargets.push(...logicalLines['sideline']);
    }

    return validTargets;
}

function resolvePerspectiveTargets(state, defenderId, attacker, usePerception) {
    const isValid = (u) => checkAttackTargetValidity(state, attacker, u, usePerception);
    return getFieldTargets(state, defenderId, isValid, true);
}

export function getValidAttackTargets(state, attackerOwnerId, attackerEntity = null) {
    const defenderId = attackerOwnerId === 'player1' ? 'player2' : 'player1';
    const normalTargets = resolvePerspectiveTargets(state, defenderId, attackerEntity, false);

    if (hasPerception(state, attackerEntity)) {
        const perceptionTargets = resolvePerspectiveTargets(state, defenderId, attackerEntity, true);
        return deduplicateTargets([...normalTargets, ...perceptionTargets]);
    }
    
    return normalTargets;
}

function checkQuickTargetingValidity(state, target, targetOwnerId, source, sourceOwnerId, qt, isPlay) {
    if (!target) return false;
    if (!matchesAlignment(targetOwnerId, sourceOwnerId, qt)) return false;
    if (!matchesEntityType(target, qt)) return false;

    if (!isFriendly(targetOwnerId, sourceOwnerId)) {
        if (isHidden(state, target) && !hasPerception(state, source) && !isPlay) return false;
    }
    return true;
}

function collectFieldTargets(state, pId, source, sourceId, qt, isPlay) {
    const targets = [];
    const p = state.players[pId];
    
    const addIfValid = (ent, line) => {
        if (checkQuickTargetingValidity(state, ent, pId, source, sourceId, qt, isPlay)) {
            targets.push({ id: ent.instanceId || ent.id, line: line, playerId: pId });
        }
    };

    for (const line of LINES) {
        if (!p.lines[line]) continue;
        p.lines[line].forEach(u => {
            // Skip boons unless the ability explicitly requests BOON in its entityType filter
            if (u.type === 'boon' && (!qt.entityType || !qt.entityType.includes('BOON'))) return; 
            
            addIfValid(u, u.line || line);
        });
    }

    if (state.equator) {
        state.equator.forEach(item => {
            if ((item.ownerId || sourceId) === pId) addIfValid(item, 'equator');
        });
    }
    return targets;
}

function collectZoneTargets(state, pId, source, sourceId, qt, isPlay) {
    const targets = [];
    const p = state.players[pId];
    if (!p) return targets;

    const addIfValid = (ent, line) => {
        if (checkQuickTargetingValidity(state, ent, pId, source, sourceId, qt, isPlay)) {
            targets.push({ id: ent.instanceId || ent.id, line: line, playerId: pId });
        }
    };

    ['hand', 'discard', 'deck', 'banish'].forEach(z => {
        if (qt.zones.includes(z.toUpperCase()) && p[z]) {
            p[z].forEach(c => addIfValid(c, z));
        }
    });

    return targets;
}

function enforceBattlelinesOnTargets(state, targets, playerId, entity) {
    const defenderId = playerId === 'player1' ? 'player2' : 'player1';
    
    // Check lines physically, ignoring whether the source is a valid physical attacker
    const usePerception = hasPerception(state, entity);
    const validPhysicalTargets = resolvePerspectiveTargets(state, defenderId, null, usePerception);

    return targets.filter(t => {
        if (isFriendly(t.playerId, playerId)) return true; 
        const isFieldLine = ['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(t.line);
        if (!isFieldLine) return true; 
        
        // Boons are intangible non-combat entities, so they are exempt from physical battleline blocking
        const targetEnt = findEntity(state, t.playerId, t.id);
        if (targetEnt && targetEnt.type === 'boon') return true;

        return validPhysicalTargets.some(at => at.id === t.id);
    });
}

function checkSpecificLogicValidity(engine, state, ability, targetObj, sourceEntity) {
    const targetEntity = findEntity(state, targetObj.playerId, targetObj.id);
    if (!targetEntity) return false;
    
    if (ability.activation?.logicTree) {
        if (!engine.evaluateLogicTree(ability.activation.logicTree, targetEntity, sourceEntity, null)) return false;
    }
    
    if (!checkStatCostValidity(targetEntity, ability, 'SAME_AS_ACTIVATION')) return false;
    
    return true;
}

export function getValidAbilityTargets(state, playerId, entityId, abilityId) {
    const entity = findEntity(state, playerId, entityId);
    if (!entity) return [];

    const ability = entity.abilities?.find(a => a.abilityId === abilityId);
    if (!ability || ability.activation?.method !== 'PLAYER_CHOICE') return [];

    const qt = extractQuickTargeting(ability);
    if (!qt) return [];

    const oppId = playerId === 'player1' ? 'player2' : 'player1';
    const isPlay = isPlayTrigger(ability.trigger);
    let targets = [];

    if (qt.zones.includes('FIELD')) {
        targets.push(...collectFieldTargets(state, playerId, entity, playerId, qt, isPlay));
        targets.push(...collectFieldTargets(state, oppId, entity, playerId, qt, isPlay));
    }
    
    targets.push(...collectZoneTargets(state, playerId, entity, playerId, qt, isPlay));
    targets.push(...collectZoneTargets(state, oppId, entity, playerId, qt, isPlay));

    if (qt.zones.includes('FIELD') && !qt.ignoreBattlelines && !isPlay) {
        targets = enforceBattlelinesOnTargets(state, targets, playerId, entity);
    }

    const engine = new GameEngine(state);
    targets = targets.filter(t => checkSpecificLogicValidity(engine, state, ability, t, entity));

    return deduplicateTargets(targets);
}

export function resolveTargetById(state, targetId) {
    if (!targetId) return null;
    const p1 = state.players.player1;
    const p2 = state.players.player2;
    const allEntities = [
        ...Object.values(p1.lines).flat(), ...Object.values(p2.lines).flat(),
        ...(state.equator || []),
        ...p1.hand, ...p1.deck, ...p1.discard, ...p1.banish,
        ...p2.hand, ...p2.deck, ...p2.discard, ...p2.banish
    ].filter(Boolean);
    return allEntities.find(e => e.id === targetId || e.instanceId === targetId) || null;
}

export function acquireTargets(state, ability, source, eventPayload, ownerId) {
    return ability.effects.map((group, index) => {
        if (!group) return [];
        let targets = [];
        
        if (group.targetMethod === 'SELF') targets = [source];
        else if (group.targetMethod === 'EVENT_SOURCE') {
            if (eventPayload?.source) targets = [eventPayload.source];
            else if (eventPayload?.playerId) {
                const av = getAvatar(state, eventPayload.playerId);
                if (av) targets = [av];
            }
        }
        else if (group.targetMethod === 'EVENT_TARGET') {
            if (eventPayload?.target) targets = [eventPayload.target];
            else if (eventPayload?.playerId) {
                const av = getAvatar(state, eventPayload.playerId);
                if (av) targets = [av];
            }
        }
        else if (group.targetMethod === 'AVATAR') {
            const av = getAvatar(state, ownerId);
            targets = av ? [av] : [];
        }
        else if (group.targetMethod === 'ENEMY_AVATAR') {
            const oppId = ownerId === 'player1' ? 'player2' : 'player1';
            const av = getAvatar(state, oppId);
            targets = av ? [av] : [];
        }
        else if (group.targetMethod === 'SAME_AS_ACTIVATION') {
            const tunneledTargetId = eventPayload?.abilityTargetId || eventPayload?.eventContext?.abilityTargetId;
            if (tunneledTargetId) {
                const resolvedTarget = resolveTargetById(state, tunneledTargetId);
                targets = [resolvedTarget || eventPayload.target || source];
            } else if (eventPayload) {
                if (eventPayload.target?.instanceId === source.instanceId && eventPayload.source) targets = [eventPayload.source];
                else targets = [eventPayload.target || source];
            } else {
                targets = [source];
            }
        }
        else if (group.targetMethod?.startsWith('AUTO_')) {
            return []; 
        }
        
        if (targets.length === 0 && group.targetMethod === 'SAME_AS_ACTIVATION' && eventPayload?.target) targets = [eventPayload.target];
        return targets;
    });
}

function isEntityInHand(state, playerId, entity) {
    const p = state.players[playerId];
    if (!p) return false;
    const refId = entity.instanceId || entity.id;
    return ['hand', 'discard', 'deck'].some(z => p[z]?.some(c => (c.instanceId || c.id) === refId));
}

function checkReadinessAffordability(state, entity, cost, abilityKey, isHandAct) {
    if (isHandAct) return true;
    if (cost.readinessCost && cost.readinessCost !== 'NONE' && cost.reuseIgnoresReadiness && (state.abilityUses?.[abilityKey] || 0) > 0) return true;
    return getStat(entity, 'readiness') >= 1;
}

function checkActionAffordability(entity, costObj, isHandAct) {
    if (costObj.freeAction || isHandAct) return true;
    return getStat(entity, 'acts') >= 1;
}

function checkAbilityAffordability(state, playerId, entity, ability, abilityKey) {
    let cost = ability.cost || {};
    const player = state.players[playerId];
    
    const isHandAct = isEntityInHand(state, playerId, entity);
    const isPlayAct = isPlayTrigger(ability.trigger);
    
    if (isHandAct && isPlayAct) {
        const baseCostObj = typeof entity.cost === 'object' && entity.cost !== null 
            ? entity.cost 
            : { tribeAmount: (typeof entity.cost === 'number' ? entity.cost : 0) };
            
        cost = { 
            ...cost, 
            carnie: (cost.carnie || cost.tent || 0) + (baseCostObj.carnie || baseCostObj.tent || 0),
            power: (cost.power || 0) + (baseCostObj.power || 0),
            tribeAmount: (cost.tribeAmount || 0) + (baseCostObj.tribeAmount || 0)
        };
    }
    
    if (!checkReadinessAffordability(state, entity, cost, abilityKey, isHandAct)) return false;

    const lifetimeUses = entity.lifetimeAbilityUses?.[ability.abilityId] || 0;
    const escalateAmt = cost.escalates ? lifetimeUses * cost.escalates : 0;
    
    if (!canAffordCost(state, player, entity, cost, escalateAmt, isHandAct && isPlayAct).success) return false;
    if (!checkActionAffordability(entity, cost, isHandAct)) return false;
    
    return true;
}

function checkStatCostValidity(entity, ability, targetMethod) {
    if (!ability.effects) return true;
    for (const group of ability.effects) {
        if (group.targetMethod === targetMethod && group.payloads) {
            for (const p of group.payloads) {
                if (p.isCost && p.type === 'MODIFY_STAT' && p.amount < 0 && p.stat === 'readiness') {
                    if (getStat(entity, p.stat) + p.amount < -1) {
                        console.log("MOD: p.amount " + p.amount + " entity: " + getStat(entity, p.stat));
                        return false;
                    }
                } else if (p.isCost && p.type === 'SET_STAT' && p.stat === 'readiness') {
                    if (getStat(entity, p.stat) <= p.amount) {
                        console.log("SET: p.amount " + p.amount + " entity: " + getStat(entity, p.stat));
                        return false;
                    }
                }
            }
        }
    }
    return true;
}

function hasValidEffectTargets(engine, state, playerId, entity, ability) {
    if (!ability.effects || ability.effects.length === 0) return true;
    
    for (const group of ability.effects) {
        if (!group) continue;
        
        // These target methods inherently have a valid resolution context
        if (['SELF', 'AVATAR', 'ENEMY_AVATAR'].includes(group.targetMethod)) {
            return true;
        }
        
        // Player choice handles its own validation in getValidAbilityTargets
        if (group.targetMethod === 'SAME_AS_ACTIVATION') {
            return true; 
        }
        
        // For automated targets, simulate the engine's targeting to ensure at least one entity is affected
        if (group.targetMethod?.startsWith('AUTO_')) {
            let pool = engine.findEntitiesInScope(group.quickTargeting, playerId);
            pool = pool.filter(ent => engine.evaluateLogicTree(group.logicTree, ent, entity, null));
            if (pool.length > 0) {
                return true;
            }
        }
        
        // Event driven targets are valid assuming they only trigger on those events
        if (['EVENT_SOURCE', 'EVENT_TARGET'].includes(group.targetMethod)) {
            return true;
        }
    }
    
    return false;
}

function buildPlayAction(state, playerId, entity) {
    if (!isEntityInHand(state, playerId, entity)) return null;

    const player = state.players[playerId];
    if (!canAffordCost(state, player, entity, entity.cost, 0, true).success) return null;

    return {
        type: 'PLAY',
        name: 'Play Normally',
        abilityId: 'native_play',
        undoable: true,
        cost: 0,
        requiresTarget: false,
        validTargets: [],
        isPlayAbility: true
    };
}

function buildAttackAction(state, playerId, entity) {
    if (!isEntityOnBoard(state, entity)) return null;
    if (entity.strength === undefined || entity.strength === null) return null;
    if (hasEngineFlag(state, entity, 'BLOCK_ATTACK')) return null;
    if (getStat(entity, 'readiness') < 1) return null;
    
    const atkTargets = getValidAttackTargets(state, playerId, entity);
    if (atkTargets.length === 0) return null;

    return {
        type: 'ATTACK',
        name: 'Attack',
        abilityId: 'native_attack',
        undoable: true,
        cost: getAttackCost(state, entity),
        requiresTarget: true,
        validTargets: atkTargets,
        isPlayAbility: false
    };
}

function buildAbilityAction(state, playerId, entity, ability) {
    // Hide non-selectable ON_BE_PLAYED actions from the manual selection list.
    // Loosely check truthiness to prevent issues with strict boolean mismatches.
    if (isAutoCast(ability)) return null;

    const validTriggers = ['MANUAL', 'PLAY', 'PLAY_OPTIONAL', 'ON_PLAY', 'ON_BE_PLAYED', 'ON_PLAY_OPTIONAL', 'MODIFY_PLAY', 'WOULD_PLAY', 'WOULD_BE_PLAYED', 'WOULD_PLAY_OPTIONAL'];
    if (!validTriggers.includes(ability.trigger)) return null;
    
    if (hasEngineFlag(state, entity, 'BLOCK_ACT') && ability.trigger == 'MANUAL') return null;

    const inHand = isEntityInHand(state, playerId, entity);
    if (ability.trigger === 'MANUAL' && inHand && !ability.passiveFlags?.includes('ACTIVATE_FROM_HAND')) {
        return null; 
    }

    if (!inHand && ability.trigger !== 'MANUAL') {
        return null; 
    }

    const abilityKey = `${entity.instanceId}_${ability.abilityId}`;
    if (!checkAbilityAffordability(state, playerId, entity, ability, abilityKey)) return null;

    const requiresTarget = ability.activation?.method === 'PLAYER_CHOICE';
    let validTargets = [];
    if (requiresTarget) {
        validTargets = getValidAbilityTargets(state, playerId, entity.instanceId, ability.abilityId);
        if (validTargets.length === 0) return null; 
    }

    // Ensure that at least one effect group will actually find a target when executed
    const engine = new GameEngine(state);
    if (!hasValidEffectTargets(engine, state, playerId, entity, ability)) {
        return null;
    }

    return { 
        type: 'ABILITY', 
        name: ability.name, 
        abilityId: ability.abilityId, 
        undoable: isUndoable(state, ability), 
        cost: ability.cost, 
        requiresTarget,
        validTargets,
        isPlayAbility: isPlayTrigger(ability.trigger)
    };
}

export function getEntityAvailableActions(state, playerId, entityId) {
    const entity = findEntity(state, playerId, entityId);
    if (!entity) return [];

    const actions = [];
    
    const nativePlay = buildPlayAction(state, playerId, entity);
    if (nativePlay) actions.push(nativePlay);
    
    const nativeAttack = buildAttackAction(state, playerId, entity);
    if (nativeAttack) actions.push(nativeAttack);

    let hasSelectablePlayAction = false;

    if (entity.abilities) {
        entity.abilities.forEach(ab => {
            const abilityAction = buildAbilityAction(state, playerId, entity, ab);
            if (abilityAction) {
                actions.push(abilityAction);
                
                // Track if we successfully built ANY valid, selectable play-replacement actions
                if (['ON_BE_PLAYED'].includes(ab.trigger) && !isAutoCast(ab)) {
                    hasSelectablePlayAction = true;
                }
            }
        });
    }
    
    // Only suppress native play if there is a successful, selectable replacement available.
    // If not (e.g. all ON_BE_PLAYED are auto-cast), native play remains the sole option.
    if (hasSelectablePlayAction) {
        return actions.filter(a => a.abilityId !== 'native_play');
    }
    
    return actions;
}