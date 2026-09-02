/**
 * src/engine/targeting.js
 * Logic for determining valid targets and available actions.
 */

import { hasEngineFlag, resolveResourceKey, LINES, isUndoable } from './utils.js';
import { GameEngine } from './index.js';

function findEntity(state, playerId, entityId) {
    let entity = state.equator?.find(i => i.instanceId === entityId);
    if (entity) return entity;
    
    const p = state.players[playerId];
    for (const line of LINES) {
        entity = p.lines[line]?.find(u => u.instanceId === entityId);
        if (entity) return entity;
    }
    
    return p.hand.find(c => c.instanceId === entityId || c.id === entityId);
}

function getStat(entity, statKey) {
    const val = Number(entity[statKey]);
    return isNaN(val) ? 0 : val;
}

function extractQuickTargeting(ability) {
    // ALWAYS prioritize the explicit activation filter for what the player clicks
    if (ability?.activation?.quickTargeting) {
        return ability.activation.quickTargeting;
    }
    
    // Legacy fallback: Check the effects array if no activation block exists
    const explicitEffectQt = (ability?.effects || []).find(group => group?.quickTargeting)?.quickTargeting;
    return explicitEffectQt || null;
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
    const friendly = isFriendly(targetOwnerId, sourceOwnerId);
    if (friendly && !(qt.alignment || []).includes('FRIENDLY')) return false;
    if (!friendly && !(qt.alignment || []).includes('ENEMY')) return false;
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
    // 1. Taunt protects ALL. If a taunt exists, it is the ONLY valid target.
    if (logicalLines['taunt'].length > 0) return logicalLines['taunt'];

    const validTargets = [];

    // 2. Field Chain: front protects mid protects back protects sheltered
    for (const line of ['front', 'mid', 'back', 'sheltered']) {
        if (logicalLines[line].length > 0) {
            validTargets.push(...logicalLines[line]);
            break;
        }
    }

    // 3. Avatar Chain: bodyguard protects avatar
    if (logicalLines['bodyguard'].length > 0) {
        validTargets.push(...logicalLines['bodyguard']);
    } else if (logicalLines['avatar'].length > 0) {
        validTargets.push(...logicalLines['avatar']);
    }

    // 4. Sideline protects nothing (and is protected by nothing)
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
            if (u.type === 'boon') return; 
            addIfValid(u, u.line || line);
            if (u.attachments) {
                u.attachments.forEach(att => addIfValid(att, 'attachment'));
            }
        });
    }

    if (state.equator) {
        state.equator.forEach(item => {
            const itemOwner = item.ownerId || sourceId;
            if (itemOwner === pId) addIfValid(item, 'equator');
        });
    }
    
    return targets;
}

function collectZoneTargets(state, pId, source, sourceId, qt, isPlay) {
    const targets = [];
    const p = state.players[pId];

    const addIfValid = (ent, line) => {
        if (checkQuickTargetingValidity(state, ent, pId, source, sourceId, qt, isPlay)) {
            targets.push({ id: ent.instanceId || ent.id, line: line, playerId: pId });
        }
    };

    ['hand', 'discard', 'deck', 'banish'].forEach(z => {
        if (qt.zones.includes(z.toUpperCase())) {
            p[z].forEach(c => addIfValid(c, z));
        }
    });

    return targets;
}

function enforceBattlelinesOnTargets(state, targets, playerId, entity) {
    const atkTargets = getValidAttackTargets(state, playerId, entity);
    return targets.filter(t => {
        if (isFriendly(t.playerId, playerId)) return true; 
        
        const isFieldLine = ['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(t.line);
        if (!isFieldLine) return true; 
        
        return atkTargets.some(at => at.id === t.id);
    });
}

function checkLogicTreeValidity(engine, ability, targetEntity, sourceEntity) {
    if (!ability.activation?.logicTree) return true;
    return engine.evaluateLogicTree(ability.activation.logicTree, targetEntity, sourceEntity);
}

function checkStatCostValidity(entity, ability, targetMethod) {
    if (!ability.effects) return true;
    for (const group of ability.effects) {
        if (group.targetMethod === targetMethod && group.payloads) {
            for (const p of group.payloads) {
                if (p.isCost && p.type === 'MODIFY_STAT' && p.amount < 0 && p.stat === 'readiness') {
                    if (getStat(entity, p.stat) - Math.abs(p.amount) < -1) return false;
                }
            }
        }
    }
    return true;
}

function checkSpecificLogicValidity(engine, state, ability, targetObj, sourceEntity) {
    const targetEntity = findEntity(state, targetObj.playerId, targetObj.id);
    if (!targetEntity) return false;
    
    if (!checkLogicTreeValidity(engine, ability, targetEntity, sourceEntity)) return false;
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

    if (qt.zones.includes('FIELD') && !qt.ignoreBattlelines) {
        targets = enforceBattlelinesOnTargets(state, targets, playerId, entity);
    }

    const engine = new GameEngine(state);
    targets = targets.filter(t => checkSpecificLogicValidity(engine, state, ability, t, entity));

    return deduplicateTargets(targets);
}

function isEntityInHand(state, playerId, entity) {
    const p = state.players[playerId];
    return ['hand', 'discard', 'deck'].some(z => p[z]?.some(c => c.instanceId === entity.instanceId));
}

function checkReadinessAffordability(state, entity, cost, abilityKey, isHandAct) {
    if (isHandAct) return true;
    if (cost.readinessCost && cost.readinessCost !== 'NONE' && cost.reuseIgnoresReadiness && (state.abilityUses?.[abilityKey] || 0) > 0) return true;
    return getStat(entity, 'readiness') >= 1;
}

function calculateEscalatedCostValues(costObj, escalateAmt) {
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

function checkBasicResourceAffordability(player, entity, cCost, pCost) {
    if (cCost > 0 && (player.resources['Carnie']?.current || 0) < cCost) return false;
    if (pCost > 0 && getStat(entity, 'power') < pCost) return false;
    return true;
}

function checkTribeResourceAffordability(state, player, entity, cCost, tCost) {
    if (tCost <= 0) return true;
    
    const entityTribe = resolveResourceKey(state, player, entity.tribe);
    const remainingCarnie = Math.max(0, (player.resources['Carnie']?.current || 0) - cCost);
    
    if (entityTribe === 'Carnie') {
        return remainingCarnie >= tCost;
    } 
    
    const tribeRes = player.resources[entityTribe] ? player.resources[entityTribe].current : 0;
    return tribeRes + Math.floor(remainingCarnie / 3) >= tCost;
}

function checkResourceAffordability(state, player, entity, costObj, escalateAmt) {
    const { cCost, pCost, tCost } = calculateEscalatedCostValues(costObj, escalateAmt);
    
    if (!checkBasicResourceAffordability(player, entity, cCost, pCost)) return false;
    if (!checkTribeResourceAffordability(state, player, entity, cCost, tCost)) return false;
    
    return true;
}

function checkActionAffordability(entity, costObj, isHandAct) {
    if (costObj.freeAction || isHandAct) return true;
    return getStat(entity, 'acts') >= 1;
}

function checkAbilityAffordability(state, playerId, entity, ability, abilityKey) {
    const cost = ability.cost || {};
    const player = state.players[playerId];
    
    const isHandAct = isEntityInHand(state, playerId, entity);
    
    if (!checkReadinessAffordability(state, entity, cost, abilityKey, isHandAct)) return false;

    const lifetimeUses = entity.lifetimeAbilityUses?.[ability.abilityId] || 0;
    const escalateAmt = cost.escalates ? lifetimeUses : 0;
    
    if (!checkResourceAffordability(state, player, entity, cost, escalateAmt)) return false;
    if (!checkActionAffordability(entity, cost, isHandAct)) return false;
    if (!checkStatCostValidity(entity, ability, 'SELF')) return false;

    return true;
}

function checkTargetRequirementValidity(state, playerId, entity, ability) {
    if (ability.activation?.method !== 'PLAYER_CHOICE') return true;
    
    const targets = getValidAbilityTargets(state, playerId, entity.instanceId, ability.abilityId);
    return targets.length > 0;
}

function buildPlayAction(state, playerId, entity) {
    if (!isEntityInHand(state, playerId, entity)) return null;

    return {
        type: 'PLAY_BOARD',
        name: 'Play Normally',
        abilityId: 'native_play',
        undoable: true,
        cost: 0
    };
}

function buildAttackAction(state, playerId, entity) {
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
        cost: { readinessCost: hasEngineFlag(state, entity, 'ATTACK_EXHAUSTS') ? 'EXHAUSTS' : 'UNREADIES' }
    };
}

function buildAbilityAction(state, playerId, entity, ability) {
    const validTriggers = ['MANUAL', 'PLAY', 'PLAY_OPTIONAL', 'ON_PLAY', 'ON_PLAY_OPTIONAL', 'MODIFY_PLAY', 'WOULD_PLAY', 'WOULD_PLAY_OPTIONAL'];
    if (!validTriggers.includes(ability.trigger)) return null;
    
    // Prevent the default native attack from duplicating, but DO NOT block custom 
    // abilities (like Shoot First) just because they contain an ATTACK payload.
    if (ability.abilityId === 'native_attack') return null;

    if (hasEngineFlag(state, entity, 'BLOCK_ACT')) return null;

    const inHand = isEntityInHand(state, playerId, entity);
    if (ability.trigger === 'MANUAL' && inHand && !ability.passiveFlags?.includes('ACTIVATE_FROM_HAND')) {
        return null; // Explicitly block manual abilities from being cast from the hand without permission
    }

    const abilityKey = `${entity.instanceId}_${ability.abilityId}`;
    
    if (!checkAbilityAffordability(state, playerId, entity, ability, abilityKey)) return null;
    if (!checkTargetRequirementValidity(state, playerId, entity, ability)) return null;

    return { 
        type: 'ABILITY', 
        name: ability.name, 
        abilityId: ability.abilityId, 
        undoable: isUndoable(state, ability), 
        cost: ability.cost 
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

    if (entity.abilities) {
        entity.abilities.forEach(ab => {
            const abilityAction = buildAbilityAction(state, playerId, entity, ab);
            if (abilityAction) actions.push(abilityAction);
        });
    }
    
    // If a valid MANDATORY play ability exists, force the user to use it instead of playing normally.
    const hasValidMandatoryPlay = actions.some(a => 
        a.type === 'ABILITY' && 
        entity.abilities?.find(ab => ab.abilityId === a.abilityId)?.trigger === 'PLAY'
    );
    
    if (hasValidMandatoryPlay) {
        return actions.filter(a => a.abilityId !== 'native_play');
    }
    
    return actions;
}