import { randomInt, shuffleArray as prandomShuffle } from './prandom.js';
import { ACTION_REGISTRY, ACTION_MANIFEST, findEntityLocation } from './actions/index.js';
import { log, warn, hasEngineFlag, getOwnerId, getAvatar, resolveResourceKey, LINES } from './utils.js';
import { getEntityAvailableActions, getValidAttackTargets } from './targeting.js';
import { ATTRIBUTE_MANIFEST } from './attributes.js';

export class GameEngine {
    constructor(state) {
        this.state = state;
        this.stack = [];
        this.processingDepth = 0;
        this.activeChainAbilities = new Set(); // Loop prevention
        
        this.utils = {
            randomInt,
            shuffleArray: prandomShuffle,
            getEntityAvailableActions,
            getValidAttackTargets,
            hasEngineFlag
        };
    }

    emit(eventType, payload) {
        // 1. Interceptors (WOULD_)
        if (!eventType.startsWith('WOULD_') && !eventType.startsWith('MODIFY_') && !eventType.startsWith('ON_')) {
            const wouldEvent = `WOULD_${eventType}`;
            const addedTriggers = this.queueTriggers(wouldEvent, payload);
            if (addedTriggers > 0) {
                log(this.state, `[EVENT BUS] ⚡ Stack resolved immediately for ${wouldEvent} due to interceptors.`);
                this.processStack(addedTriggers, wouldEvent);
            }
            if (payload && payload.cancelled) {
                log(this.state, `[EVENT BUS] 🛑 Event ${eventType} was CANCELLED.`);
                return { cancelled: true };
            }
        }
        
        // 2. Exact Event Triggers
        const addedTriggers = this.queueTriggers(eventType, payload);
        let rootEventCancelled = false;

        if (addedTriggers > 0) {
            log(this.state, `[EVENT BUS] ⚡ Stack resolved immediately for ${eventType}.`);
            rootEventCancelled = this.processStack(addedTriggers, eventType);
        }
        
        const isCancelled = rootEventCancelled || !!(payload && payload.cancelled);
        if (isCancelled && payload) payload.cancelled = true; 
        if (isCancelled) log(this.state, `[EVENT BUS] 🛑 Event ${eventType} was CANCELLED.`);
        
        return { cancelled: isCancelled };
    }

    queueTriggers(eventType, payload) {
        const triggers = [];
        const checkedEntities = new Set();

        // 1. Force-check transit entities in the payload
        if (payload) {
            if (payload.source) this._evaluateTriggerMatch(payload.source, getOwnerId(this.state, payload.source), eventType, payload, checkedEntities, triggers);
            if (payload.target) this._evaluateTriggerMatch(payload.target, getOwnerId(this.state, payload.target), eventType, payload, checkedEntities, triggers);
        }
        
        // 2. Scan Board
        for (const pId of ['player1', 'player2']) {
            const player = this.state.players[pId];
            for (const line of LINES) {
                if (!player.lines[line]) continue;
                for (const unit of player.lines[line]) {
                    this._evaluateTriggerMatch(unit, pId, eventType, payload, checkedEntities, triggers);
                    if (unit.attachments) {
                        unit.attachments.forEach(att => this._evaluateTriggerMatch(att, pId, eventType, payload, checkedEntities, triggers));
                    }
                }
            }
        }
        
        // 3. Scan Equator
        if (this.state.equator) {
            for (const item of this.state.equator) {
                this._evaluateTriggerMatch(item, item.ownerId || this.state.activePlayerId, eventType, payload, checkedEntities, triggers);
            }
        }

        if (triggers.length === 0) return 0;

        // APNAP Sorting
        triggers.sort((a, b) => {
            if (a.owner === this.state.activePlayerId && b.owner !== this.state.activePlayerId) return -1;
            if (a.owner !== this.state.activePlayerId && b.owner === this.state.activePlayerId) return 1;
            return 0; 
        });

        let addedCount = 0;
        triggers.reverse().forEach(t => {
            this.stack.push(t);
            addedCount++;
        });

        return addedCount;
    }

    _evaluateTriggerMatch(ent, ownerId, eventType, payload, checkedEntities, triggers) {
        if (!ent || !ent.instanceId || checkedEntities.has(ent.instanceId)) return;
        checkedEntities.add(ent.instanceId);
        
        let abilitiesToCheck = ent.abilities || [];
        if (payload) {
            if (payload.source && payload.source.instanceId === ent.instanceId && payload._lkiSourceAbilities) {
                abilitiesToCheck = payload._lkiSourceAbilities;
            }
            if (payload.target && payload.target.instanceId === ent.instanceId && payload._lkiTargetAbilities) {
                abilitiesToCheck = payload._lkiTargetAbilities;
            }
        }
        
        if (!abilitiesToCheck || abilitiesToCheck.length === 0) return;

        for (const ability of abilitiesToCheck) {
            const allTriggers = [ability.trigger, ...(ability.additionalTriggers || [])];
            if (allTriggers.includes(eventType) && !this.activeChainAbilities.has(ability.abilityId)) {
                
                let isValid = true;
                const scope = ability.triggerScope || 'PERSONAL';
                
                let isPassive = false;
                let isActive = false;

                for (const actionKey in ACTION_MANIFEST) {
                    const manifest = ACTION_MANIFEST[actionKey];
                    if (eventType === actionKey || eventType.endsWith(`_${actionKey}`)) isActive = true;
                    if (manifest.passiveType && (eventType === manifest.passiveType || eventType.endsWith(`_${manifest.passiveType}`))) isPassive = true;
                }
                
                let eventEntity = null;
                if (payload) {
                    if (isPassive) eventEntity = payload.target;
                    if (isActive && !eventEntity) eventEntity = payload.source;
                }

                if (payload) {
                    if (scope === 'PERSONAL') {
                        if (isPassive && (!payload.target || payload.target.instanceId !== ent.instanceId)) isValid = false;
                        if (isActive && (!payload.source || payload.source.instanceId !== ent.instanceId)) isValid = false;
                        if (['TURN_STARTING', 'TURN_STARTED', 'TURN_ENDING', 'TURN_ENDED'].includes(eventType)) {
                            if (payload.playerId && payload.playerId !== ownerId) isValid = false;
                        }
                    } else if (scope === 'GLOBAL') {
                        if (!eventEntity) {
                            isValid = false;
                        } else {
                            const qt = ability.activation?.quickTargeting;
                            const pool = this.findEntitiesInScope(qt, ownerId);
                            if (!pool.some(p => p.instanceId === eventEntity?.instanceId)) isValid = false;
                        }
                    }
                }

                if (isValid && ability.activation?.logicTree && ability.activation?.method !== 'PLAYER_CHOICE') {
                    const evalEntity = (scope === 'GLOBAL' && eventEntity) ? eventEntity : ent;
                    let evalLKI = null;
                    if (payload) {
                         if (payload.source?.instanceId === evalEntity.instanceId) evalLKI = payload._lkiSourceAbilities;
                         if (payload.target?.instanceId === evalEntity.instanceId) evalLKI = payload._lkiTargetAbilities;
                    }
                    if (!this.evaluateLogicTree(ability.activation.logicTree, evalEntity, ent, payload, evalLKI)) {
                        isValid = false;
                    }
                }

                if (isValid) {
                    const eId = ent.instanceId || ent.id || 'none';
                    log(this.state, `    ↳ 🎯 Triggered '${ability.name}' on '${ent.name} (${eId})' for ${eventType}`);
                    triggers.push({ owner: ownerId || this.state.activePlayerId, source: ent, ability, payload });
                }
            }
        }
    }

    processStack(count, originatingEvent = null) {
        this.processingDepth = (this.processingDepth || 0) + 1;
        let rootEventCancelled = false;
        
        while (count > 0 && this.stack.length > 0) {
            const frame = this.stack.pop();
            count--;
            
            if (frame.payload && (frame.payload.cancelled || frame.payload.eventContext?.cancelled)) {
                log(this.state, `[Engine] Skipping trigger '${frame.ability.name}' because event cancelled.`);
                rootEventCancelled = true;
                continue; 
            }
            
            this.activeChainAbilities.add(frame.ability.abilityId);
            
            // Directly pass the reference so modifiers (like Fire! or Resilient) can mutate the parent event!
            const livePayload = frame.payload;
            
            if (livePayload?.eventContext && rootEventCancelled) {
                 livePayload.eventContext.cancelled = true;
                 livePayload.cancelled = true;
                 continue;
            }

            this.executeAbility(frame.ability, frame.source, livePayload, frame.owner, originatingEvent);
            this.activeChainAbilities.delete(frame.ability.abilityId);
            
            if (livePayload && (livePayload.cancelled || livePayload.eventContext?.cancelled)) {
                rootEventCancelled = true;
            }
        }
        
        this.processingDepth--;
        if (this.processingDepth <= 0) {
            this.activeChainAbilities.clear();
            this.processingDepth = 0;
        }
        
        return rootEventCancelled;
    }

    executeAbility(ability, source, eventPayload, ownerId, originatingEvent = null) {
        const sId = source?.instanceId || source?.id || 'none';
        log(this.state, `  ▶ [ABILITY] '${ability.name}' from source '${source?.name} (${sId})'`);
        try {
            this.state.history_log.push({ text: `✨ ${source.name || 'Entity'} activated '${ability.name}'`, depth: Math.max(0, (this.state._actionDepth || 0) + (this.processingDepth || 0) - 1) });
            
            if (!ability.effects || !Array.isArray(ability.effects)) {
                warn(this.state, `[Engine] Ability '${ability.name}' has no effects array. Skipping.`);
                return;
            }

            ownerId = ownerId || this.state.activePlayerId;
            if (!this._checkAndPayCost(ability, source, ownerId, eventPayload)) return;

            const lockedTargets = this._acquireTargets(ability, source, eventPayload, ownerId);
            this._resolvePayloads(ability, source, eventPayload, ownerId, lockedTargets, originatingEvent);
            
        } catch (error) {
            console.error(`[Engine] CRITICAL ERROR executing ability '${ability?.name}':`, error);
        }
    }

    _checkAndPayCost(ability, source, ownerId, eventPayload) {
        const abilityKey = `${source.instanceId}_${ability.abilityId}`;
        const limit = ability.triggerLimit || 'UNLIMITED';
        
        if (limit === 'ONCE_PER_ROUND' && (this.state.abilityUses?.[abilityKey] || 0) >= 1) return false;
        if (limit === 'TWICE_PER_ROUND' && (this.state.abilityUses?.[abilityKey] || 0) >= 2) return false;

        const p = this.state.players[ownerId];
        const cost = ability.cost || {};
        let canAfford = true;
        
        let currentReadiness = Number(source.readiness);
        if (isNaN(currentReadiness)) currentReadiness = 0;
        
        // 1. The Readiness Prerequisite Gate
        let requiresReadiness = true;
        if (cost.reuseIgnoresReadiness && (this.state.abilityUses?.[abilityKey] || 0) > 0) {
            requiresReadiness = false;
        }
        if (ability.trigger === 'MANUAL' && requiresReadiness && currentReadiness < 1) canAfford = false;
        
        let cCost = cost.carnie || cost.tent || 0;
        if (cCost > 0 && (p.resources['Carnie']?.current || 0) < cCost) canAfford = false;
        if (cost.power > 0 && (source.power || 0) < cost.power) canAfford = false;
        
        let tribeResKey = null;
        if (cost.tribeAmount > 0) {
            const entityTribe = resolveResourceKey(this.state, p, source.tribe);
            if (entityTribe === 'Carnie') {
                if ((p.resources['Carnie']?.current || 0) < cost.tribeAmount) canAfford = false;
            } else {
                tribeResKey = entityTribe;
                if (!p.resources[tribeResKey] || p.resources[tribeResKey].current < cost.tribeAmount) canAfford = false;
            }
        }

        if (!canAfford) {
            log(this.state, `[Engine] Could not afford trigger cost for '${ability.name}'.`);
            if (ability.trigger !== 'MANUAL') this.state.history_log.push({ text: `⚠️ ${source.name} tried to trigger '${ability.name}', but lacked resources.`, depth: this.state._actionDepth || this.processingDepth || 0 });
            return false;
        }

        // --- PAYMENT PHASE ---
        if (!this.state.abilityUses) this.state.abilityUses = {};
        this.state.abilityUses[abilityKey] = (this.state.abilityUses[abilityKey] || 0) + 1;

        // The Readiness Cost
        if (requiresReadiness) {
            if (cost.readinessCost === 'EXHAUSTS') source.readiness -= 2;
            else if (cost.readinessCost === 'UNREADIES') source.readiness -= 1;
        }
        
        if (cCost > 0 && p.resources['Carnie']) p.resources['Carnie'].current -= cCost;
        if (cost.power > 0) source.power -= cost.power;
        
        if (cost.tribeAmount > 0) {
            const entityTribe = resolveResourceKey(this.state, p, source.tribe);
            if (entityTribe === 'Carnie') {
                p.resources['Carnie'].current -= cost.tribeAmount;
            } else if (tribeResKey) {
                p.resources[tribeResKey].current -= cost.tribeAmount;
            }
        }

        return true;
    }

    _acquireTargets(ability, source, eventPayload, ownerId) {
        return ability.effects.map((group, index) => {
            if (!group) return [];
            let targets = [];
            
            if (group.targetMethod === 'SELF') targets = [source];
            else if (group.targetMethod === 'EVENT_SOURCE') targets = eventPayload?.source ? [eventPayload.source] : [];
            else if (group.targetMethod === 'EVENT_TARGET') targets = eventPayload?.target ? [eventPayload.target] : [];
            else if (group.targetMethod === 'AVATAR') {
                const av = getAvatar(this.state, ownerId);
                targets = av ? [av] : [];
            }
            else if (group.targetMethod === 'ENEMY_AVATAR') {
                const oppId = ownerId === 'player1' ? 'player2' : 'player1';
                const av = getAvatar(this.state, oppId);
                targets = av ? [av] : [];
            }
            else if (group.targetMethod === 'SAME_AS_ACTIVATION') {
                const tunneledTargetId = eventPayload?.abilityTargetId || eventPayload?.eventContext?.abilityTargetId;
                if (tunneledTargetId) {
                    const p1 = this.state.players.player1;
                    const p2 = this.state.players.player2;
                    const allEntities = [
                        ...Object.values(p1.lines).flat(), ...Object.values(p2.lines).flat(),
                        ...(this.state.equator || []),
                        ...p1.hand, ...p1.deck, ...p1.discard, ...p1.banish,
                        ...p2.hand, ...p2.deck, ...p2.discard, ...p2.banish
                    ].filter(Boolean);
                    const resolvedTarget = allEntities.find(e => e.id === tunneledTargetId || e.instanceId === tunneledTargetId);
                    targets = [resolvedTarget || eventPayload.target || source];
                } else if (eventPayload) {
                    if (eventPayload.target?.instanceId === source.instanceId && eventPayload.source) targets = [eventPayload.source];
                    else targets = [eventPayload.target || source];
                } else {
                    targets = [source];
                }
            }
            else if (group.targetMethod?.startsWith('AUTO_')) {
                return []; // Deferred to phase 2
            }
            
            if (targets.length === 0 && group.targetMethod === 'SAME_AS_ACTIVATION' && eventPayload?.target) targets = [eventPayload.target];
            return targets;
        });
    }

    _resolvePayloads(ability, source, eventPayload, ownerId, lockedTargets, originatingEvent) {
        ability.effects.forEach((group, index) => {
            if (!group || !Array.isArray(group.payloads)) return;
            
            let targets = lockedTargets[index] || [];
            
            if (group.targetMethod?.startsWith('AUTO_')) {
                let pool = this.findEntitiesInScope(group.quickTargeting, ownerId);
                pool = pool.filter(ent => this.evaluateLogicTree(group.logicTree, ent, source, eventPayload));
                
                if (group.targetMethod === 'AUTO_ALL') targets = pool;
                else if (group.targetMethod === 'AUTO_RANDOM') {
                    this.state._irreversibleActionOccurred = true;
                    targets = prandomShuffle(this.state, [...pool]).slice(0, group.targetCount || 1);
                }
                else if (group.targetMethod === 'AUTO_FIRST') targets = pool.slice(0, group.targetCount || 1);
                else if (group.targetMethod === 'AUTO_LAST') targets = pool.slice(-(group.targetCount || 1));
            }

            for (const payload of group.payloads) {
                const ActionClass = ACTION_REGISTRY[payload.type];
                if (ActionClass) {
                    for (const target of targets) {
                        let currentTarget = target;
                        
                        // Interceptor for tunneled ATTACH actions
                        if (['ATTACH', 'ATTACH_TO'].includes(payload.type) && currentTarget.instanceId === source.instanceId) {
                            if (eventPayload?.abilityTargetId) {
                                const p1 = this.state.players.player1;
                                const p2 = this.state.players.player2;
                                const allEntities = [
                                    ...Object.values(p1.lines).flat(), ...Object.values(p2.lines).flat(),
                                    ...(this.state.equator || []),
                                    ...p1.hand, ...p1.deck, ...p1.discard, ...p1.banish,
                                    ...p2.hand, ...p2.deck, ...p2.discard, ...p2.banish
                                ].filter(Boolean);
                                const altTarget = allEntities.find(e => e.id === eventPayload.abilityTargetId || e.instanceId === eventPayload.abilityTargetId);
                                if (altTarget) currentTarget = altTarget;
                            }
                            if (currentTarget.instanceId === source.instanceId) continue; // Abort self-attach
                        }
                        
                        const actionPayload = { ...payload };
                        if (payload.invertRoles) {
                            actionPayload.source = currentTarget; actionPayload.target = source;
                        } else {
                            actionPayload.source = source; actionPayload.target = currentTarget;
                        }

                        actionPayload.eventContext = eventPayload;
                        actionPayload.sourceAbilityId = ability.abilityId; 
                        
                        const action = new ActionClass(actionPayload);
                        action.run(this);
                    }
                }
            }
        });
    }

    findEntitiesInScope(qt, callingPlayerId) {
        const pool = [];
        const oppId = callingPlayerId === 'player1' ? 'player2' : 'player1';
        
        let alignments = qt?.alignment || [];
        if (alignments.length === 0) alignments = ['FRIENDLY', 'ENEMY'];
        
        const zones = qt?.zones || ['FIELD'];
        const types = qt?.entityType || [];
        
        const playersToCheck = [];
        if (alignments.includes('FRIENDLY')) playersToCheck.push(callingPlayerId);
        if (alignments.includes('ENEMY')) playersToCheck.push(oppId);
        
        playersToCheck.forEach(pId => {
            const p = this.state.players[pId];
            if (zones.includes('FIELD')) {
                for (const line of LINES) {
                    if (p.lines[line]) {
                        pool.push(...p.lines[line]);
                        p.lines[line].forEach(u => { if (u.attachments) pool.push(...u.attachments); });
                    }
                }
                if (this.state.equator) {
                    this.state.equator.forEach(item => {
                        const itemOwner = item.ownerId || callingPlayerId;
                        if (itemOwner === pId) {
                            pool.push(item);
                        }
                    });
                }
            }
            ['hand', 'deck', 'discard', 'banish'].forEach(z => {
                if (zones.includes(z.toUpperCase())) pool.push(...p[z]);
            });
        });

        return pool.filter(ent => {
            if (!types || types.length === 0) return true;
            let entType = 'UNIT';
            if (ent.type === 'avatar') entType = 'AVATAR';
            else if (ent.type === 'equipment') entType = 'EQUIPMENT';
            else if (ent.type === 'artifact') entType = 'ARTIFACT';
            else if (ent.type === 'spell') entType = 'SPELL';
            else if (ent.type === 'boon') entType = 'BOON';
            return types.includes(entType);
        });
    }

    evaluateLogicTree(node, entity, source, eventPayload, lkiAbilities = null) {
        if (!node) return true;
        if (node.type === 'group') {
            if (!node.children || node.children.length === 0) return true;
            if (node.logicalOperator === 'OR') return node.children.some(child => this.evaluateLogicTree(child, entity, source, eventPayload, lkiAbilities));
            else return node.children.every(child => this.evaluateLogicTree(child, entity, source, eventPayload, lkiAbilities));
        } else if (node.type === 'condition') {
            const context = node.context || 'EVAL_TARGET';
            let targetEnt = entity;
            let checkAttr = node.attribute;

            if (context === 'EVENT') {
                if (checkAttr === 'eventAbility') {
                    const searchVal = String(node.value).toLowerCase();
                    let abId = eventPayload?.grantedAbilityId || eventPayload?.sourceAbilityId || eventPayload?.abilityId;
                    
                    let foundMatch = false;
                    if (abId) {
                        if (abId.toLowerCase() === searchVal) foundMatch = true;
                        else {
                            const catAb = this.state.abilityCatalog?.find(ca => ca.abilityId === abId || ca.name?.toLowerCase() === abId.toLowerCase());
                            if (catAb && catAb.name?.toLowerCase() === searchVal) foundMatch = true;
                        }
                    }
                    return node.operator === '==' ? foundMatch : !foundMatch;
                }

                if (checkAttr === 'isCombat') {
                    let eventVal = (eventPayload?.isCombat || eventPayload?.eventContext?.isCombat) ? 'true' : 'false';
                    const cmp = eventVal.toLowerCase() === String(node.value).toLowerCase();
                    return node.operator === '==' ? cmp : !cmp;
                }

                if (checkAttr === 'amount') {
                    let eventAmount = eventPayload?.amount;
                    if (eventAmount === undefined) eventAmount = eventPayload?.eventContext?.amount || 0;
                    const val = Number(node.value);
                    if (node.operator === '==') return eventAmount === val;
                    if (node.operator === '!=') return eventAmount !== val;
                    if (node.operator === '>=') return eventAmount >= val;
                    if (node.operator === '<=') return eventAmount <= val;
                    if (node.operator === '>') return eventAmount > val;
                    if (node.operator === '<') return eventAmount < val;
                }

                return true;
            }

            if (context === 'HOST') {
                const loc = findEntityLocation(this, entity);
                if (loc && loc.zone === 'attachment' && loc.host) targetEnt = loc.host;
                else return node.operator === '!='; 
            } else if (context === 'EVENT_SOURCE') {
                targetEnt = eventPayload?.source;
                if (!targetEnt) return node.operator === '!=';
            } else if (context === 'EVENT_TARGET') {
                targetEnt = eventPayload?.target;
                if (!targetEnt) return node.operator === '!=';
            } else if (context === 'ABILITY_SOURCE') {
                targetEnt = source;
            }

            // Immediately fail unsupported attributes based on the Entity's type to prevent logic crashes
            const attrDef = ATTRIBUTE_MANIFEST[checkAttr];
            if (attrDef && attrDef.domain === 'ENTITY' && !attrDef.allowedTypes.includes('ALL')) {
                const tType = targetEnt.type ? targetEnt.type.toUpperCase() : 'UNIT';
                if (!attrDef.allowedTypes.includes(tType)) {
                    return node.operator === '!=';
                }
            }

            if (checkAttr === 'tribe') {
                const resolveTribeId = (val) => {
                    if (!val) return 'Generic';
                    const s = String(val).toLowerCase();
                    if (this.state.tribeCatalog) {
                        const match = this.state.tribeCatalog.find(tc => tc.id.toLowerCase() === s || tc.name.toLowerCase() === s);
                        if (match) return match.id;
                    }
                    if (s.startsWith('tribe_')) return s;
                    return `tribe_${s}`;
                };
                let tribeVal = resolveTribeId(targetEnt.tribe);
                const compareVal = resolveTribeId(node.value);
                return node.operator === '==' ? tribeVal === compareVal : tribeVal !== compareVal;
            }
            
            let entVal;
            if (checkAttr === 'entity') {
                if (node.value === 'SELF') return targetEnt.instanceId === source.instanceId;
                if (node.value === 'AVATAR') return targetEnt.type === 'avatar';
                if (node.value === 'UNIT') return targetEnt.type === 'unit';
                if (node.value === 'BOON') return targetEnt.type === 'boon';
                if (node.value === 'EQUIPMENT') return targetEnt.type === 'equipment';
                if (node.value === 'ARTIFACT') return targetEnt.type === 'artifact';
                if (node.value === 'SPELL') return targetEnt.type === 'spell';
                return false;
            }
            else if (checkAttr === 'family') entVal = targetEnt.family || '';
            else if (checkAttr === 'genus') entVal = targetEnt.genus || '';
            else if (checkAttr === 'cost') entVal = typeof targetEnt.cost === 'object' ? (targetEnt.cost.tribeAmount || targetEnt.cost.carnie || targetEnt.cost.tent || 0) : (targetEnt.cost || 0);
            else if (checkAttr === 'power') entVal = targetEnt.power || 0;
            else if (checkAttr === 'health') entVal = targetEnt.health || 0;
            else if (checkAttr === 'maxHealth') entVal = targetEnt.maxHealth || 0;
            else if (checkAttr === 'strength') entVal = targetEnt.strength || 0;
            else if (checkAttr === 'armor') entVal = targetEnt.armor || 0;
            else if (checkAttr === 'readiness') entVal = targetEnt.readiness || 0;
            else if (checkAttr === 'acts') entVal = targetEnt.acts || 0;
            else if (checkAttr === 'maxActs') entVal = targetEnt.maxActs || 0;
            else if (checkAttr === 'line') entVal = targetEnt.line || targetEnt.defaultLine || 'mid';
            else if (checkAttr === 'zone') {
                const loc = findEntityLocation(this, targetEnt);
                entVal = loc ? loc.zone.toUpperCase() : 'UNKNOWN';
                if (['FRONT', 'MID', 'BACK', 'SHELTERED', 'SIDELINE', 'TAUNT', 'BODYGUARD', 'AVATAR', 'EQUATOR', 'ATTACHMENT'].includes(entVal)) {
                    entVal = 'FIELD';
                }
            }
            else if (checkAttr === 'alignment') {
                const entOwner = getOwnerId(this.state, targetEnt);
                const sourceOwner = getOwnerId(this.state, source) || this.state.activePlayerId;
                entVal = entOwner === sourceOwner ? 'FRIENDLY' : 'ENEMY';
            }
            else if (checkAttr === 'hasAbility') {
                const searchVal = String(node.value).toLowerCase();
                const abs = lkiAbilities || targetEnt.abilities || [];
                const hasAb = abs.some(a => {
                    if (typeof a === 'string') {
                        if (a.toLowerCase() === searchVal) return true;
                        const catAb = this.state.abilityCatalog?.find(ca => ca.abilityId === a);
                        return catAb && catAb.name && catAb.name.toLowerCase() === searchVal;
                    }
                    return a.abilityId === node.value || (a.name && a.name.toLowerCase() === searchVal);
                });

                const hasEffect = targetEnt.activeEffects?.some(e => 
                    e.type === 'GRANT_ABILITY' && 
                    (e.grantedAbilityId === node.value || 
                    (e.grantedAbilityId && e.grantedAbilityId.toLowerCase() === searchVal))
                );
                
                entVal = !!(hasAb || hasEffect);
                return node.operator === '==' ? entVal : !entVal;
            }
            else if (checkAttr === 'isAttacking') {
                entVal = (eventPayload?.eventContext?.combatAttackerId === targetEnt.instanceId) ? 'true' : 'false';
            }
            
            if (typeof entVal === 'string') {
                const cmp = entVal.toLowerCase() === String(node.value).toLowerCase();
                return node.operator === '==' ? cmp : !cmp;
            } else {
                const val = Number(node.value);
                if (node.operator === '==') return entVal === val;
                if (node.operator === '!=') return entVal !== val;
                if (node.operator === '>=') return entVal >= val;
                if (node.operator === '<=') return entVal <= val;
                if (node.operator === '>') return entVal > val;
                if (node.operator === '<') return entVal < val;
            }
        }
        return true;
    }
}

export function shuffleArray(state, array) {
    return prandomShuffle(state, array);
}

export * from './utils.js';
export * from './state.js';
export * from './targeting.js';
export * from './flow.js';