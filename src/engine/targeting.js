/**
 * src/engine/targeting.js
 * Logic for determining valid targets and available actions.
 */

import { hasEngineFlag, resolveResourceKey, LINES, isUndoable } from './utils.js';
import { GameEngine } from './index.js';

export function getValidAttackTargets(state, attackerOwnerId, attackerEntity = null) {
    const defenderOwnerId = attackerOwnerId === 'player1' ? 'player2' : 'player1';
    const defPlayer = state.players[defenderOwnerId];
    let targets = [];

    const hasPerception = hasEngineFlag(state, attackerEntity, 'IGNORE_BLOCK_TARGETING');
    const isTimid = hasEngineFlag(state, attackerEntity, 'BLOCK_TARGET_AVATAR');

    const isValidTarget = (u) => {
        if (u.type === 'boon') return false;
        if (isTimid && u.type === 'avatar') return false;
        const isTargetHidden = hasEngineFlag(state, u, 'BLOCK_TARGETING');
        return !isTargetHidden || hasPerception;
    };

    // Group by logical line in case of physical array desync (e.g. from SET_STAT)
    const logicalLines = { taunt: [], bodyguard: [], avatar: [], front: [], mid: [], back: [], sheltered: [], sideline: [] };
    for (const line of ['taunt', 'bodyguard', 'avatar', 'front', 'mid', 'back', 'sheltered', 'sideline']) {
        if (defPlayer.lines[line]) {
            defPlayer.lines[line].forEach(u => {
                const currentLine = u.line || line;
                if (logicalLines[currentLine]) logicalLines[currentLine].push(u);
            });
        }
    }

    if (logicalLines['taunt'].length > 0) {
        logicalLines['taunt'].filter(isValidTarget).forEach(u => targets.push({ id: u.instanceId, line: 'taunt' }));
        return targets;
    }

    if (logicalLines['bodyguard'].length > 0) {
        logicalLines['bodyguard'].filter(isValidTarget).forEach(u => targets.push({ id: u.instanceId, line: 'bodyguard' }));
    } else if (logicalLines['avatar'].length > 0) {
        logicalLines['avatar'].filter(isValidTarget).forEach(u => targets.push({ id: u.instanceId, line: 'avatar' }));
    }

    for (const line of ['front', 'mid', 'back', 'sheltered']) {
        if (logicalLines[line].length > 0) {
            const valid = logicalLines[line].filter(isValidTarget);
            if (valid.length > 0) {
                valid.forEach(u => targets.push({ id: u.instanceId, line: line }));
                break;
            }
        }
    }

    if (logicalLines['sideline'].length > 0) {
        logicalLines['sideline'].filter(isValidTarget).forEach(u => targets.push({ id: u.instanceId, line: 'sideline' }));
    }
    
    return targets;
}

export function getValidAbilityTargets(state, playerId, entityId, abilityId) {
    let entity = state.equator?.find(i => i.instanceId === entityId);
    if (!entity) {
        const p = state.players[playerId];
        for (const line of LINES) {
            entity = p.lines[line]?.find(u => u.instanceId === entityId);
            if (entity) break;
        }
        if (!entity) entity = p.hand.find(c => c.instanceId === entityId || c.id === entityId);
    }
    if (!entity) return [];

    const ability = entity.abilities?.find(a => a.abilityId === abilityId);
    const qt = ability?.activation?.quickTargeting;
    if (!qt || ability.activation?.method !== 'PLAYER_CHOICE') return [];

    let targets = [];
    const oppId = playerId === 'player1' ? 'player2' : 'player1';
    const isAttack = ability.effects?.some(g => g.payloads?.some(p => p.type === 'ATTACK'));
    const isPlayAbility = ['PLAY', 'PLAY_OPTIONAL', 'ON_BE_PLAYED', 'WOULD_PLAY', 'WOULD_BE_PLAYED', 'MODIFY_PLAY'].includes(ability.trigger);

    if (qt.zones) {
        let alignments = qt.alignment || [];
        if (alignments.length === 0) alignments = ['FRIENDLY', 'ENEMY'];

        const checkPlayer = (pId, isFriendly) => {
            if ((isFriendly && !alignments.includes('FRIENDLY')) || (!isFriendly && !alignments.includes('ENEMY'))) return;
            const p = state.players[pId];
            const hasPerception = hasEngineFlag(state, entity, 'IGNORE_BLOCK_TARGETING');

            const checkEntity = (ent, line) => {
                let entType = 'UNIT';
                if (ent.type === 'avatar') entType = 'AVATAR';
                else if (ent.type === 'equipment') entType = 'EQUIPMENT';
                else if (ent.type === 'artifact') entType = 'ARTIFACT';
                else if (ent.type === 'spell') entType = 'SPELL';
                else if (ent.type === 'boon') entType = 'BOON';
                
                if (!isFriendly) {
                    const isTargetHidden = hasEngineFlag(state, ent, 'BLOCK_TARGETING');
                    if (isTargetHidden && !hasPerception && !isPlayAbility) return;
                }
                if (!qt.entityType || qt.entityType.length === 0 || qt.entityType.includes(entType)) {
                    targets.push({ id: ent.instanceId || ent.id, line: line, playerId: pId });
                }
            };

            if (qt.zones.includes('FIELD')) {
                for (const line of LINES) {
                    if (p.lines[line]) p.lines[line].forEach(u => { 
                        if (u.type !== 'boon') {
                            checkEntity(u, u.line || line);
                            if (u.attachments) {
                                u.attachments.forEach(att => checkEntity(att, 'attachment'));
                            }
                        }
                    });
                }
                if (state.equator) {
                    state.equator.forEach(item => {
                        const itemOwner = item.ownerId || playerId;
                        if (itemOwner === pId) {
                            checkEntity(item, 'equator');
                        }
                    });
                }
            }
            ['hand', 'discard', 'deck', 'banish'].forEach(z => {
                if (qt.zones.includes(z.toUpperCase())) p[z].forEach(c => checkEntity(c, z));
            });
        };
        
        checkPlayer(playerId, true);
        checkPlayer(oppId, false);
        
        if (qt.zones.includes('FIELD') && !qt.ignoreBattlelines) {
            const atkTargets = getValidAttackTargets(state, playerId, entity);
            targets = targets.filter(t => t.playerId === playerId || !['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(t.line) || atkTargets.some(at => at.id === t.id));
        }
    }
    
    const engine = new GameEngine(state);
    const p1 = state.players.player1;
    const p2 = state.players.player2;
    const allEntities = [
        ...Object.values(p1.lines).flat(), ...Object.values(p2.lines).flat(), ...(state.equator || []),
        ...p1.hand, ...p1.deck, ...p1.discard, ...p1.banish,
        ...p2.hand, ...p2.deck, ...p2.discard, ...p2.banish
    ].filter(Boolean);
    
    targets = targets.filter(t => {
        const targetEntity = allEntities.find(e => e.id === t.id || e.instanceId === t.id);
        if (!targetEntity) return false;
        
        if (ability.activation?.logicTree && !engine.evaluateLogicTree(ability.activation.logicTree, targetEntity, entity)) return false;

        if (ability.effects) {
            for (const group of ability.effects) {
                if (group.targetMethod === 'SAME_AS_ACTIVATION' && group.payloads) {
                    for (const p of group.payloads) {
                        if (p.isCost && p.type === 'MODIFY_STAT' && p.amount < 0) {
                            if (p.stat === 'readiness') {
                                const costAmt = Math.abs(p.amount);
                                let currentVal = Number(targetEntity[p.stat]);
                                if (isNaN(currentVal)) currentVal = 0;
                                if (currentVal - costAmt < -1) return false;
                            }
                        }
                    }
                }
            }
        }
        return true;
    });
    
    return targets.filter((t, index, self) => index === self.findIndex(o => o.id === t.id));
}

export function getEntityAvailableActions(state, playerId, entityId) {
    const actions = [];
    let entity = state.equator?.find(i => i.instanceId === entityId);
    if (!entity) {
        for (const line of LINES) {
            entity = state.players[playerId].lines[line]?.find(u => u.instanceId === entityId);
            if (entity) break;
        }
    }
    if (!entity) {
        entity = state.players[playerId].hand.find(c => c.instanceId === entityId || c.id === entityId);
    }
    if (!entity) return actions;

    const hasBlockAct = hasEngineFlag(state, entity, 'BLOCK_ACT');
    const hasBlockAttack = hasEngineFlag(state, entity, 'BLOCK_ATTACK') || hasBlockAct;

    if (entity.abilities) {
        entity.abilities.forEach(ab => {
            if (ab.trigger === 'MANUAL') {
                const isAttack = ab.effects && ab.effects.some(g => g.payloads && g.payloads.some(p => p.type === 'ATTACK'));
                if (isAttack && hasBlockAttack) return;
                if (!isAttack && hasBlockAct) return;

                const cost = ab.cost || {};
                let canAfford = true;
                
                let currentReadiness = Number(entity.readiness);
                if (isNaN(currentReadiness)) currentReadiness = 0;
                
                const abilityKey = `${entity.instanceId}_${ab.abilityId}`;
                const isHandAct = ab.passiveFlags?.includes('ACTIVATE_FROM_HAND') && ['hand', 'discard', 'deck'].some(z => state.players[playerId][z]?.some(c => c.instanceId === entity.instanceId));
                
                let requiresReadiness = true; // All manual actions natively require readiness
                if (isHandAct) {
                    requiresReadiness = false;
                } else if (cost.readinessCost && cost.readinessCost !== 'NONE' && cost.reuseIgnoresReadiness && (state.abilityUses?.[abilityKey] || 0) > 0) {
                    requiresReadiness = false;
                }
                if (requiresReadiness && currentReadiness < 1) canAfford = false;
                
                if (canAfford) {
                    const player = state.players[playerId];
                    
                    const lifetimeUses = entity.lifetimeAbilityUses?.[ab.abilityId] || 0;
                    const escalateAmount = cost.escalates ? lifetimeUses : 0;
                    
                    let cCost = (cost.carnie || cost.tent || 0);
                    let pCost = (cost.power || 0);
                    let tCost = (cost.tribeAmount || 0);

                    if (cost.escalates) {
                        if (pCost > 0) pCost += escalateAmount;
                        else if (tCost > 0) tCost += escalateAmount;
                        else cCost += escalateAmount;
                    }

                    if (cCost > 0 && (player.resources['Carnie']?.current || 0) < cCost) canAfford = false;
                    if (pCost > 0 && (entity.power || 0) < pCost) canAfford = false;
                    
                    if (canAfford && tCost > 0) {
                        const entityTribe = resolveResourceKey(state, player, entity.tribe);
                        const tribeRes = player.resources[entityTribe] ? player.resources[entityTribe].current : 0;
                        if (entityTribe === 'Carnie') {
                            if ((player.resources['Carnie']?.current || 0) < tCost) canAfford = false;
                        } else {
                            if (tribeRes < 1) canAfford = false;
                            else {
                                const carnieRes = player.resources['Carnie'] ? player.resources['Carnie'].current : 0;
                                if (tribeRes + Math.floor(carnieRes / 3) < tCost) canAfford = false;
                            }
                        }
                    }

                    if (canAfford && !cost.freeAction && !isAttack && !isHandAct) {
                        let currentActs = Number(entity.acts);
                        if (isNaN(currentActs)) currentActs = 0;
                        if (currentActs < 1) canAfford = false;
                    }

                    if (canAfford && ab.effects) {
                        for (const group of ab.effects) {
                            if (group.targetMethod === 'SELF' && group.payloads) {
                                for (const p of group.payloads) {
                                    if (p.isCost && p.type === 'MODIFY_STAT' && p.amount < 0) {
                                        if (p.stat === 'readiness') {
                                            const costAmt = Math.abs(p.amount);
                                            let currentVal = Number(entity[p.stat]);
                                            if (isNaN(currentVal)) currentVal = 0;
                                            
                                            if (currentVal - costAmt < -1) {
                                                canAfford = false;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            if (!canAfford) break;
                        }
                    }
                }
                
                if (canAfford) actions.push({ type: isAttack ? 'ATTACK' : 'ABILITY', name: ab.name, abilityId: ab.abilityId, undoable: isUndoable(state, ab) });
            }
        });
    }
    return actions;
}