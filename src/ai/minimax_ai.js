import { BaseAIEngine } from './base.js';
import { playCard, executeEntityAction, executeSacrificeDecision } from '../engine/flow.js';
import { resolveResourceKey, queryState, cloneGameState } from '../engine/index.js';

export const AI_PROFILES = {
  AGGRO: { hpWeight: 25, boardWeight: 3, handWeight: 1, equatorWeight: 2, resourceWeight: 3 },
  CONTROL: { hpWeight: 5, boardWeight: 15, handWeight: 8, equatorWeight: 6, resourceWeight: 10 },
  BALANCED: { hpWeight: 10, boardWeight: 6, handWeight: 4, equatorWeight: 4, resourceWeight: 6 }
};

export const AI_DIFFICULTIES = {
  HARD: 1,
  MEDIUM: 10,
  EASY: 50
};

export function getCardCostByTribe(state, player, card) {
  const costByTribe = {};
  if (!card || card.cost === undefined) return costByTribe;

  const tribeKey = resolveResourceKey(state, player, card.tribe);

  if (typeof card.cost === 'number') {
    if (tribeKey !== 'Carnie' && tribeKey !== 'Generic') {
      costByTribe[tribeKey] = card.cost;
    } else {
      costByTribe['Carnie'] = card.cost;
    }
    return costByTribe;
  }

  for (const [key, val] of Object.entries(card.cost)) {
    if (typeof val !== 'number' || val <= 0) continue;

    if (key === 'tribeAmount') {
      costByTribe[tribeKey] = (costByTribe[tribeKey] || 0) + val;
    } else if (key === 'carnie' || key === 'tent') {
      costByTribe['Carnie'] = (costByTribe['Carnie'] || 0) + val;
    } else if (!['power', 'readinessCost', 'escalates', 'freeAction', 'reuseIgnoresReadiness'].includes(key)) {
      const explicitTribeKey = resolveResourceKey(state, player, key);
      costByTribe[explicitTribeKey] = (costByTribe[explicitTribeKey] || 0) + val;
    }
  }
  return costByTribe;
}

export function getPlayerMaxResByTribe(p) {
  const res = {};
  if (p && p.resources) {
    for (const [tribe, data] of Object.entries(p.resources)) {
      res[tribe] = data.max || 0;
    }
  }
  return res;
}

export function evaluateStateWithProfile(state, playerId, profile) {
  const player = state.players[playerId];
  let opponentId = null;
  for (const key in state.players) {
    if (key !== playerId) opponentId = key;
  }
  const opponent = state.players[opponentId];

  if (!player) return { total: -99999, details: {} };
  if (!opponent) return { total: 99999, details: {} };

  const details = {
    hpDiff: 0,
    handAdvantage: 0,
    boardAdvantage: 0,
    threatAndDefense: 0,
    equatorControl: 0,
    resourceAdvantage: 0,
    unitScores: {},
    unitLabels: {},
    unitBreakdown: {}
  };

  // DYNAMIC AVATAR LOOKUP using queryState to survive structuredClone
  const pLoc = queryState(state, { players: [playerId], zones: ['BOARD'], target: (c) => c && c.type === 'avatar' });
  const pAvatar = pLoc ? pLoc.array[pLoc.index] : null;

  const oLoc = queryState(state, { players: [opponentId], zones: ['BOARD'], target: (c) => c && c.type === 'avatar' });
  const oAvatar = oLoc ? oLoc.array[oLoc.index] : null;

  const pHealth = pAvatar ? (pAvatar.health || 0) : 0;
  const oHealth = oAvatar ? (oAvatar.health || 0) : 0;

  if (pHealth <= 0) return { total: -99999, details: {} };
  if (oHealth <= 0) return { total: 99999, details: {} };

  details.hpDiff = (pHealth - oHealth) * (profile.hpWeight || 0);

  const pMaxResByTribe = getPlayerMaxResByTribe(player);
  const oMaxResByTribe = getPlayerMaxResByTribe(opponent);

  const getHandScore = (p, currentResByTribe) => {
    if (!p.hand || p.hand.length === 0) return 0;

    let score = 0;
    let playableCount = 0;
    let unplayableCount = 0;
    const seenIds = new Set();

    for (let i = 0; i < p.hand.length; i++) {
      const c = p.hand[i];
      const costByTribe = getCardCostByTribe(state, p, c);
      let missing = 0;

      for (const tribe in costByTribe) {
        const avail = currentResByTribe[tribe] || 0;
        if (costByTribe[tribe] > avail) missing += (costByTribe[tribe] - avail);
      }

      const isDuplicate = seenIds.has(c.id);
      seenIds.add(c.id);

      if (missing === 0) {
        if (!isDuplicate) playableCount++;
        else unplayableCount += 0.5;
      } else {
        unplayableCount++;
      }
    }

    if (playableCount > 0) score += (profile.handWeight || 1) * 1.0;
    if (playableCount > 1) score += (profile.handWeight || 1) * 0.5;
    score += Math.min(3, unplayableCount) * (profile.handWeight || 1) * 0.2;

    return score;
  };

  details.handAdvantage = getHandScore(player, pMaxResByTribe) - getHandScore(opponent, oMaxResByTribe);

  const getFlagsScore = (unit) => {
    let flagScore = 0;
    const badFlags = ['BLOCK_ACT', 'BLOCK_RETALIATE', 'STRIKE_SLOW', 'BLOCK_AVATAR_TARGET'];
    const goodFlags = ['BLOCK_TARGETING', 'STRIKE_FAST'];

    if (unit.abilities) {
      for (let i = 0; i < unit.abilities.length; i++) {
        const ab = unit.abilities[i];
        if (ab.passiveFlags) {
          for (let j = 0; j < ab.passiveFlags.length; j++) {
            const flag = ab.passiveFlags[j];
            if (badFlags.includes(flag)) flagScore -= 4;
            else if (goodFlags.includes(flag) || flag.startsWith('IGNORE_')) flagScore += 5;
          }
        }
      }
    }
    return flagScore;
  };

  const getBoardStats = (p, isOpponent) => {
    let total = 0;
    if (p.lines) {
      for (const lineName in p.lines) {
        const lineUnits = p.lines[lineName];
        if (Array.isArray(lineUnits)) {
          for (let j = 0; j < lineUnits.length; j++) {
            const u = lineUnits[j];
            if (u.type === 'avatar') continue;

            let hasBlockAttack = false;
            if (u.abilities) {
              for (let i = 0; i < u.abilities.length; i++) {
                if (u.abilities[i].passiveFlags && u.abilities[i].passiveFlags.includes('BLOCK_ATTACK')) {
                  hasBlockAttack = true;
                  break;
                }
              }
            }

            const effectiveStrength = hasBlockAttack ? 0 : (u.strength || 0);

            let numAbils = 0;
            if (u.abilities) {
              for (let i = 0; i < u.abilities.length; i++) {
                const a = u.abilities[i];
                if (a.abilityId !== 'native_attack' && a.abilityId !== 'native_play' && a.trigger !== 'ON_BE_PLAYED' && a.trigger !== 'PLAY_OPTIONAL') {
                  numAbils++;
                }
              }
            }

            const rawOffense = effectiveStrength + (u.power || 0);
            const abilityBonus = (numAbils * 2) + getFlagsScore(u);

            let readiness = (u.readiness !== undefined) ? Number(u.readiness) : 1;
            let kpMod = 0;

            let hasAttackOrTap = false;
            if (u.abilities) {
              for (let i = 0; i < u.abilities.length; i++) {
                const a = u.abilities[i];
                if (a.abilityId === 'native_attack' || (a.activation && a.activation.method !== 'NONE' && a.activation.method !== 'PASSIVE') || a.trigger === 'ACTIVATE' || a.trigger === 'MANUAL') {
                  hasAttackOrTap = true;
                  break;
                }
              }
            }

            // FLATTENED READINESS PENALTY - no longer tied to board weight or stats!
            if (hasAttackOrTap) {
              if (readiness > 0) {
                kpMod = 0.5;
              } else if (readiness === 0) {
                kpMod = -1.0; 
              } else {
                kpMod = -2.0; 
              }
            }

            let positionPenalty = 0;
            if (!isOpponent) {
              const isUtilityEngine = numAbils > 0 && effectiveStrength <= 2;
              if (isUtilityEngine && (lineName === 'bodyguard' || lineName === 'taunt')) {
                positionPenalty = -20;
              }
            }

            let stats = 0;
            let healthVal = u.health || 0;

            if (isOpponent) {
              stats = rawOffense + abilityBonus + (healthVal * 1.5) + 4;
            } else {
              stats = rawOffense + abilityBonus + (healthVal * 1.0) + positionPenalty;
            }

            const uKey = u.instanceId || u.id;
            const mult = (profile.boardWeight || 0) * (isOpponent ? -1 : 1);
            
            const finalScore = (stats * mult) + kpMod;

            details.unitScores[uKey] = finalScore;
            details.unitLabels[uKey] = `${isOpponent ? 'Enemy' : 'Ally'} ${u.name} (S:${effectiveStrength}|H:${healthVal}|R:${readiness})`;

            details.unitBreakdown[uKey] = {
              Offense: rawOffense * mult,
              Abilities: abilityBonus * mult,
              Health: (healthVal * (isOpponent ? 1.5 : 1.0)) * mult,
              Readiness: kpMod,
              Position: positionPenalty * mult,
              AliveBonus: (isOpponent ? 4 : 0) * mult
            };

            total += finalScore;
          }
        }
      }
    }
    return total;
  };

  details.boardAdvantage = getBoardStats(player, false) + getBoardStats(opponent, true);

  const getActiveThreat = (p) => {
    let threat = 0;
    if (p.lines) {
      for (const line in p.lines) {
        if (Array.isArray(p.lines[line])) {
          for (let j = 0; j < p.lines[line].length; j++) {
            const u = p.lines[line][j];
            if (u.type === 'avatar') continue;
            let hasBlockAttack = false;
            let canAttack = false;

            if (u.abilities) {
              for (let i = 0; i < u.abilities.length; i++) {
                const a = u.abilities[i];
                if (a.passiveFlags && a.passiveFlags.includes('BLOCK_ATTACK')) hasBlockAttack = true;
                if (a.abilityId === 'native_attack') canAttack = true;
                if (a.effects) {
                  for (let k = 0; k < a.effects.length; k++) {
                    if (a.effects[k].payloads) {
                      for (let m = 0; m < a.effects[k].payloads.length; m++) {
                        if (a.effects[k].payloads[m].type === 'ATTACK') canAttack = true;
                      }
                    }
                  }
                }
              }
            }

            if (!hasBlockAttack && canAttack) {
              let readiness = (u.readiness !== undefined) ? Number(u.readiness) : 1;
              if (readiness >= 0) threat += ((u.strength || 0) + (u.power || 0));
            }
          }
        }
      }
    }
    return threat;
  };

  const getBodyguardHP = (p) => {
    let hp = 0;
    if (p.lines && p.lines.bodyguard && Array.isArray(p.lines.bodyguard)) {
      for (let j = 0; j < p.lines.bodyguard.length; j++) {
        const u = p.lines.bodyguard[j];
        if (u.type !== 'avatar') hp += (u.health || 0);
      }
    }
    return hp;
  };

  const pThreat = getActiveThreat(player);
  const oThreat = getActiveThreat(opponent);
  const pBgHP = getBodyguardHP(player);
  const oBgHP = getBodyguardHP(opponent);

  const pAvatarTaunting = pLoc && pLoc.zone === 'taunt';
  const oAvatarTaunting = oLoc && oLoc.zone === 'taunt';

  let threatScore = 0;
  threatScore -= oThreat * ((profile.hpWeight || 0) * 0.5);
  threatScore += pThreat * ((profile.hpWeight || 0) * 0.2);

  const evalBg = (bgHp, avatarHp, incomingThreat) => {
    if (bgHp <= 0) return 0;
    let blockMultiplier = 0.05;
    if (incomingThreat > 0) blockMultiplier = 0.15 + Math.min(0.25, incomingThreat * 0.03);
    if (avatarHp > 0 && avatarHp <= 12) blockMultiplier = 0.8;
    if (avatarHp > 0 && avatarHp <= 6) blockMultiplier = 2.0;
    return bgHp * ((profile.hpWeight || 0) * blockMultiplier);
  };

  threatScore += evalBg(pAvatarTaunting ? 0 : pBgHP, pHealth, oThreat) - evalBg(oAvatarTaunting ? 0 : oBgHP, oHealth, pThreat);
  details.threatAndDefense = threatScore;

  if (state.equator) {
    let equatorDiff = 0;
    for (let i = 0; i < state.equator.length; i++) {
      const item = state.equator[i];
      if (item.ownerId === playerId) equatorDiff += 1;
      else if (item.ownerId === opponentId) equatorDiff -= 1;
    }
    details.equatorControl = equatorDiff * (profile.equatorWeight || 0);
  }

  const getResourceScore = (p) => {
    const maxResByTribe = getPlayerMaxResByTribe(p);
    const maxCostInHandByTribe = {};

    if (p.hand && p.hand.length > 0) {
      for (let i = 0; i < p.hand.length; i++) {
        const c = p.hand[i];
        const costByTribe = getCardCostByTribe(state, p, c);
        for (const tribe in costByTribe) {
          if (!maxCostInHandByTribe[tribe]) maxCostInHandByTribe[tribe] = 0;
          maxCostInHandByTribe[tribe] = Math.max(maxCostInHandByTribe[tribe], costByTribe[tribe]);
        }
      }
    }

    let resScore = 0;
    const allTribes = new Set([...Object.keys(maxResByTribe), ...Object.keys(maxCostInHandByTribe)]);

    allTribes.forEach(tribe => {
      const avail = maxResByTribe[tribe] || 0;
      const needed = maxCostInHandByTribe[tribe] || 0;

      if (avail <= needed) {
        resScore += avail * 1.5;
      } else {
        resScore += (needed * 1.5) + ((avail - needed) * 0.3);
      }
    });
    return resScore;
  };

  details.resourceAdvantage = (getResourceScore(player) - getResourceScore(opponent)) * (profile.resourceWeight || 0);

  let totalScore = 0;
  for (const key in details) {
    if (typeof details[key] === 'number') {
      if (isNaN(details[key])) {
        console.error(`[MinimaxAI] NaN detected in heuristic component: ${key}`);
      } else {
        totalScore += details[key];
      }
    }
  }

  return { total: totalScore, details };
}

export class MinimaxAI extends BaseAIEngine {
  constructor(playerId, profileKey = 'BALANCED', difficultyKey = 'HARD') {
    super(playerId);
    this.profile = AI_PROFILES[profileKey] || AI_PROFILES.BALANCED;
    this.topXPercent = AI_DIFFICULTIES[difficultyKey] || AI_DIFFICULTIES.HARD;
    this.debug = true;
  }

  findEntity(state, entityId) {
    if (!entityId) return null;
    const loc = queryState(state, { zones: ['ALL'], target: (c) => c && (c.instanceId === entityId || c.id === entityId) });
    return loc ? loc.array[loc.index] : null;
  }

  deduplicateOptions(state, options) {
    const unique = [];
    const signatures = new Set();

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (opt.action.type === 'PASS') {
        unique.push(opt);
        continue;
      }

      let sig = '';
      const eId = opt.action.entityId || opt.action.cardId;
      const entity = this.findEntity(state, eId);

      if (entity) {
        sig += `Src[${entity.id}|${entity.strength}|${entity.health || 0}|${entity.acts}]_`;
      }
      sig += `Act[${opt.action.type}|${opt.action.actionType}|${opt.action.abilityId}]_Tgt[${opt.targetId}|${opt.targetLine}]`;

      if (!signatures.has(sig)) {
        signatures.add(sig);
        unique.push(opt);
      }
    }
    return unique;
  }

  getExpandedOptions(legalActions) {
    const options = [{ action: { type: 'PASS' }, targetId: null, targetLine: null }];

    for (let i = 0; i < legalActions.length; i++) {
      const action = legalActions[i];
      if (action.targets && action.targets.length > 0) {
        for (let j = 0; j < action.targets.length; j++) {
          options.push({ action, targetId: action.targets[j].id, targetLine: action.targets[j].line });
        }
      } else {
        options.push({ action, targetId: null, targetLine: null });
      }
    }
    return options;
  }

  applyMoveToState(simState, playerId, move) {
    if (!move || !move.action) return { success: false };
    const { action, targetId, targetLine } = move;

    if (action.type === 'PASS') return { success: true };

    if (action.type === 'PLAY_CARD') {
      return playCard(simState, playerId, action.cardId, 'back', action.abilityId, targetId);
    } else if (action.type === 'ENTITY_ACTION') {
      const entityId = action.entityId || action.cardId;
      const entity = this.findEntity(simState, entityId);

      if (entity) {
        const player = simState.players[playerId];
        let inHand = false;
        if (player && player.hand) {
          for (let i = 0; i < player.hand.length; i++) {
            if (player.hand[i].instanceId === entityId) inHand = true;
          }
        }

        if (inHand) {
          if (action.abilityId === 'native_play' || action.actionType === 'PLAY') {
            return playCard(simState, playerId, entityId, 'back', null, targetId);
          }

          if (entity.abilities) {
            for (let i = 0; i < entity.abilities.length; i++) {
              const ab = entity.abilities[i];
              if (ab.abilityId === action.abilityId && (ab.trigger === 'PLAY' || ab.trigger === 'PLAY_OPTIONAL' || ab.trigger === 'ON_BE_PLAYED' || ab.trigger === 'WOULD_PLAY')) {
                return playCard(simState, playerId, entityId, 'back', action.abilityId, targetId);
              }
            }
          }
        }
      }

      return executeEntityAction(simState, playerId, entityId, action.actionType, action.abilityId, targetId, targetLine);
    }
    return { success: false };
  }

  selectOptionByDifficulty(scoredList) {
    if (scoredList.length === 0) return null;
    scoredList.sort((a, b) => b.score - a.score);
    const poolSize = Math.max(1, Math.ceil(scoredList.length * (this.topXPercent / 100)));
    const pool = scoredList.slice(0, poolSize);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  determineSacrifice(state) {
    if (this.debug) console.log(`\n[MinimaxAI ${this.playerId}] --- EVALUATING SACRIFICE ---`);
    const player = state.players[this.playerId];
    const candidates = [{ action: 'SKIP', cardId: null, detail: 'Skipped', card: null }];

    if (player && player.hand) {
      for (let i = 0; i < player.hand.length; i++) {
        const card = player.hand[i];
        candidates.push({ action: 'OPTION_A', cardId: card.instanceId || card.id, detail: card.name, card: card });
      }
    }

    const pool = [];
    if (player && player.deck) pool.push(...player.deck);
    if (player && player.hand) pool.push(...player.hand);
    
    const costsPerTribe = {};

    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      const costByTribe = getCardCostByTribe(state, player, c);
      for (const tribe in costByTribe) {
        if (!costsPerTribe[tribe]) costsPerTribe[tribe] = [];
        costsPerTribe[tribe].push(costByTribe[tribe]);
      }
    }

    const targetResourcesByTribe = {};
    for (const tribe in costsPerTribe) {
      const costs = costsPerTribe[tribe];
      costs.sort((a, b) => a - b);
      const highest = costs[costs.length - 1];
      const midIdx = Math.floor(costs.length / 2);
      const median = costs.length % 2 !== 0
        ? costs[midIdx]
        : (costs[midIdx - 1] + costs[midIdx]) / 2;
      targetResourcesByTribe[tribe] = Math.max(highest, Math.ceil(2 * median));
    }

    const currentMaxResByTribe = getPlayerMaxResByTribe(player);
    let totalMissingResources = 0;

    for (const tribe in targetResourcesByTribe) {
      const target = targetResourcesByTribe[tribe];
      const avail = currentMaxResByTribe[tribe] || 0;
      if (avail < target) {
        totalMissingResources += (target - avail);
      }
    }

    const needsResources = totalMissingResources > 0;
    if (this.debug) {
      console.log(`[MinimaxAI] Resource Check: Has ${JSON.stringify(currentMaxResByTribe)}, Target ${JSON.stringify(targetResourcesByTribe)}. Missing Total: ${totalMissingResources}`);
    }

    const scoredCandidates = [];
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const simState = cloneGameState(state);
      simState.simulation = true;

      if (cand.cardId) {
        executeSacrificeDecision(simState, cand.action, cand.cardId);
      }

      let evalResult = evaluateStateWithProfile(simState, this.playerId, this.profile);
      let score = evalResult.total;

      if (isNaN(score)) continue;

      if (cand.action === 'SKIP') {
        if (needsResources) {
          score -= (25 * totalMissingResources);
        } else {
          score += 20;
        }
      }

      scoredCandidates.push({ option: cand, score });
    }

    const bestCandidate = this.selectOptionByDifficulty(scoredCandidates);
    return bestCandidate ? bestCandidate.option : candidates[0];
  }

  determineMove(state, legalActions) {
    if (this.debug) {
        console.log(`\n[MinimaxAI ${this.playerId}] --- SEARCHING FOR NEXT BEST ACTION ---`);
        console.log(`[MinimaxAI] Engine provided ${legalActions.length} legal actions.`);
    }

    const simState = cloneGameState(state);
    simState.simulation = true;

    const baselineEval = evaluateStateWithProfile(simState, this.playerId, this.profile);
    const currentScore = baselineEval.total;

    const options = this.getExpandedOptions(legalActions);
    const dedupedOptions = this.deduplicateOptions(simState, options);

    if (this.debug) console.log(`[MinimaxAI] Expanded to ${dedupedOptions.length} unique tactical options.`);

    let bestOption = null;
    let bestScore = currentScore;
    let bestDetails = null;

    let highestOption = null;
    let highestScore = -999999;
    let highestDetails = null;

    const entityBestMoves = {};
    for (let i = 0; i < dedupedOptions.length; i++) {
      const opt = dedupedOptions[i];
      if (opt.action.type === 'PASS') continue;
      const eId = opt.action.entityId || opt.action.cardId;
      if (eId && !entityBestMoves[eId]) {
        entityBestMoves[eId] = { attempted: 0, best: null };
      }
    }

    for (let i = 0; i < dedupedOptions.length; i++) {
      const opt = dedupedOptions[i];
      if (opt.action.type === 'PASS') continue;

      const nextState = cloneGameState(simState);
      let res;
      try {
        res = this.applyMoveToState(nextState, this.playerId, opt);
      } catch (err) {
        console.log(`[MinimaxAI] [ERROR] Engine crashed during simulation:`, err.message);
        continue;
      }

      const entityId = opt.action.entityId || opt.action.cardId;

      if (res && res.success) {
        if (entityId && entityBestMoves[entityId]) entityBestMoves[entityId].attempted++;

        let oppId = null;
        for (const key in nextState.players) {
          if (key !== this.playerId) oppId = key;
        }
        
        let oppAvatar = null;
        if (oppId) {
            const oppAvatarLoc = queryState(nextState, { players: [oppId], zones: ['BOARD'], target: (c) => c && c.type === 'avatar' });
            if (oppAvatarLoc) oppAvatar = oppAvatarLoc.array[oppAvatarLoc.index];
        }

        if (oppAvatar && oppAvatar.health <= 0) {
          if (this.debug) console.log(`[MinimaxAI] LETHAL DISCOVERED. Executing.`);

          if (opt.action.type === 'ENTITY_ACTION') {
            const entity = this.findEntity(simState, entityId);
            if (entity) {
                let p = simState.players[this.playerId];
                let inHand = false;
                if (p && p.hand) {
                    for(let x=0; x < p.hand.length; x++) { if (p.hand[x].instanceId === entityId) inHand = true; }
                }
                if (inHand && entity.abilities) {
                    for(let x=0; x < entity.abilities.length; x++) {
                        const ab = entity.abilities[x];
                        if (ab.abilityId === opt.action.abilityId && (ab.trigger === 'PLAY' || ab.trigger === 'PLAY_OPTIONAL' || ab.trigger === 'ON_BE_PLAYED' || ab.trigger === 'WOULD_PLAY')) {
                            opt.action.type = 'PLAY_CARD';
                            opt.action.cardId = entityId;
                        }
                    }
                }
            }
          }
          return opt;
        }

        const nextEval = evaluateStateWithProfile(nextState, this.playerId, this.profile);
        const nextScore = nextEval.total;

        if (isNaN(nextScore)) continue;

        const actionCost = 0.1;
        const jitter = Math.random() * 0.01;
        const finalScore = (nextScore - actionCost) + jitter;

        if (entityId && entityBestMoves[entityId]) {
          if (!entityBestMoves[entityId].best || finalScore > entityBestMoves[entityId].best.score) {
            entityBestMoves[entityId].best = { option: opt, score: finalScore, details: nextEval.details };
          }
        }

        if (finalScore > highestScore) {
          highestScore = finalScore;
          highestOption = opt;
          highestDetails = nextEval.details;
        }

        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestOption = opt;
          bestDetails = nextEval.details;
        }
      }
    }

    const detailNames = {
      hpDiff: 'Avatar Health',
      handAdvantage: 'Hand Advantage',
      boardAdvantage: 'Board Presence',
      threatAndDefense: 'Threat/Bodyguard',
      equatorControl: 'Equator Control',
      resourceAdvantage: 'Resources'
    };

    if (bestOption) {
      if (this.debug) {
        try {
            let actionName = bestOption.action.name || bestOption.action.abilityId || bestOption.action.type;
            const entityId = bestOption.action.entityId || bestOption.action.cardId;
            const entity = this.findEntity(simState, entityId);

            if (entity) {
                if (bestOption.action.type === 'PLAY_CARD' || bestOption.action.actionType === 'PLAY') {
                    actionName = `Play ${entity.name}`;
                    if (entity.abilities) {
                        for(let i=0; i<entity.abilities.length; i++) {
                            const ab = entity.abilities[i];
                            if (ab.abilityId === bestOption.action.abilityId && ab.name && bestOption.action.abilityId !== 'native_play') {
                                actionName += ` (${ab.name})`;
                            }
                        }
                    }
                } else if (bestOption.action.actionType === 'ATTACK' || bestOption.action.abilityId === 'native_attack') {
                    actionName = `Attack with ${entity.name}`;
                } else if (bestOption.action.abilityId) {
                    let abName = bestOption.action.abilityId;
                    if (entity.abilities) {
                        for(let i=0; i<entity.abilities.length; i++) {
                            if (entity.abilities[i].abilityId === bestOption.action.abilityId) {
                                abName = entity.abilities[i].name || abName;
                            }
                        }
                    }
                    actionName = `${entity.name} uses ${abName}`;
                }
            }

            if (bestOption.targetId) {
                const targetEntity = this.findEntity(simState, bestOption.targetId);
                if (targetEntity) actionName += ` on -> [${targetEntity.name}]`;
                else actionName += ` on -> [Target ID: ${bestOption.targetId}]`;
            } else if (bestOption.targetLine) {
                actionName += ` (Placed in ${bestOption.targetLine} line)`;
            }

            console.log(`\n[MinimaxAI] Chosen Move Score: ${Number(bestScore).toFixed(2)} (Baseline: ${Number(currentScore).toFixed(2)})`);
            console.log(`[MinimaxAI] Executing: ${actionName}`);
            console.log(`[MinimaxAI] Itemized Score Deltas (Next - Baseline):`);

            let hasDeltas = false;
            for (const key in bestDetails) {
                if (key === 'unitScores' || key === 'unitLabels' || key === 'unitBreakdown') continue;
                const nVal = Number(bestDetails[key]) || 0;
                const bVal = Number(baselineEval.details[key]) || 0;
                const diff = nVal - bVal;

                if (Math.abs(diff) > 0.01) {
                    hasDeltas = true;
                    const sign = diff > 0 ? '+' : '';
                    const name = detailNames[key] || key;
                    console.log(`[MinimaxAI]      * ${name}: ${sign}${diff.toFixed(2)}`);
                }
            }

            const nextUnits = bestDetails.unitScores || {};
            const baseUnits = baselineEval.details.unitScores || {};
            const allUnitKeys = [];
            for (const k in nextUnits) { if (!allUnitKeys.includes(k)) allUnitKeys.push(k); }
            for (const k in baseUnits) { if (!allUnitKeys.includes(k)) allUnitKeys.push(k); }
            
            let hasUnitDiff = false;
            for (let j = 0; j < allUnitKeys.length; j++) {
              const uKey = allUnitKeys[j];
              const nVal = Number(nextUnits[uKey]) || 0;
              const bVal = Number(baseUnits[uKey]) || 0;
              const unitDiff = nVal - bVal;

              if (Math.abs(unitDiff) > 0.01) {
                if (!hasUnitDiff) {
                  console.log(`[MinimaxAI]      * BOARD UNIT BREAKDOWN (Weighted Deltas):`);
                  hasUnitDiff = true;
                }
                const sign = unitDiff > 0 ? '+' : '';
                let nLabel = String(bestDetails.unitLabels[uKey] || '');
                let bLabel = String(baselineEval.details.unitLabels[uKey] || '');
                let displayLabel = nLabel;

                if (nLabel && bLabel && nLabel !== bLabel) {
                    let newStats = '';
                    const match = nLabel.match(/\((.*)\)/);
                    if (match && match[1]) newStats = match[1];
                    displayLabel = `${bLabel} => (${newStats})`;
                } else if (!nLabel) {
                  displayLabel = `${bLabel} [DIED/REMOVED]`;
                } else if (!bLabel) {
                  displayLabel = `${nLabel} [PLAYED/CREATED]`;
                }

                let breakdownExplanation = [];
                const nBreak = bestDetails.unitBreakdown[uKey];
                const bBreak = baselineEval.details.unitBreakdown[uKey];
                
                if (nBreak || bBreak) {
                    const safeN = nBreak || {};
                    const safeB = bBreak || {};
                    const statKeys = ['Offense', 'Abilities', 'Health', 'Readiness', 'Position', 'AliveBonus'];

                    for (let s = 0; s < statKeys.length; s++) {
                      const stat = statKeys[s];
                      const nStat = Number(safeN[stat]) || 0;
                      const bStat = Number(safeB[stat]) || 0;
                      const statDiff = nStat - bStat;
                      if (Math.abs(statDiff) > 0.01) {
                        breakdownExplanation.push(`${stat}: ${statDiff > 0 ? '+' : ''}${statDiff.toFixed(2)}`);
                      }
                    }
                }

                const explanationStr = breakdownExplanation.length > 0 ? ` (${breakdownExplanation.join(', ')})` : '';
                console.log(`[MinimaxAI]        - ${displayLabel}: ${sign}${unitDiff.toFixed(2)}${explanationStr}`);
              }
            }

            if (!hasDeltas && !hasUnitDiff) console.log(`[MinimaxAI]    -> (No top-level score differences found)`);
            
        } catch(e) {
            console.log(`[MinimaxAI] [ERROR] Formatting Chosen Move Log: ${e.message}`);
        }
      }

      const chosenAction = bestOption.action;
      if (chosenAction.type === 'ENTITY_ACTION') {
        const entityId = chosenAction.entityId || chosenAction.cardId;
        const entity = this.findEntity(simState, entityId);

        if (entity) {
          const player = simState.players[this.playerId];
          let inHand = false;
          if (player && player.hand) {
              for(let i=0; i<player.hand.length; i++) {
                  if (player.hand[i].instanceId === entityId) inHand = true;
              }
          }

          if (inHand && entity.abilities) {
            for(let i=0; i<entity.abilities.length; i++) {
                const ab = entity.abilities[i];
                if (ab.abilityId === chosenAction.abilityId && (ab.trigger === 'PLAY' || ab.trigger === 'PLAY_OPTIONAL' || ab.trigger === 'ON_BE_PLAYED' || ab.trigger === 'WOULD_PLAY')) {
                    if (this.debug) console.log(`[MinimaxAI] Intercepted live execution: Converting ${entity.name}'s play ability from ENTITY_ACTION to PLAY_CARD.`);
                    chosenAction.type = 'PLAY_CARD';
                    chosenAction.cardId = entityId;
                }
            }
          }
        }
      }

      return bestOption;
    }

    if (this.debug) {
      console.log(`\n[MinimaxAI] === DECIDED TO PASS ===`);
      if (highestOption) {
          let actName = highestOption.action.name || highestOption.action.abilityId || highestOption.action.type;
          const entityId = highestOption.action.entityId || highestOption.action.cardId;
          const entity = this.findEntity(simState, entityId);
          if (entity) actName = `${entity.name} uses ${actName}`;
          console.log(`[MinimaxAI] Best rejected move: ${actName}`);
          console.log(`[MinimaxAI] Rejected Score: ${Number(highestScore).toFixed(2)} (Baseline: ${Number(currentScore).toFixed(2)})`);
          
          let hasDeltas = false;
          console.log(`[MinimaxAI] Itemized Score Deltas (Next - Baseline):`);
          for (const key in highestDetails) {
              if (key === 'unitScores' || key === 'unitLabels' || key === 'unitBreakdown') continue;
              const nVal = Number(highestDetails[key]) || 0;
              const bVal = Number(baselineEval.details[key]) || 0;
              const diff = nVal - bVal;
              if (Math.abs(diff) > 0.01) {
                  hasDeltas = true;
                  const name = detailNames[key] || key;
                  console.log(`[MinimaxAI]    -> ${name}: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}`);
              }
          }
          if (!hasDeltas) console.log(`[MinimaxAI]    -> (No top-level score differences found)`);
      } else {
          console.log(`[MinimaxAI] No actions attempted.`);
      }

      console.log(`\n[MinimaxAI] --- DETAILED ENTITY BREAKDOWN (Why the AI Passed) ---`);
      try {
        const allMyEntities = [];
        const p = state.players[this.playerId];
        if (p) {
          if (p.hand) {
            for (let i = 0; i < p.hand.length; i++) {
              if (p.hand[i]) allMyEntities.push(p.hand[i]);
            }
          }
          if (p.lines) {
            for (const line in p.lines) {
              if (Array.isArray(p.lines[line])) {
                  for (let i = 0; i < p.lines[line].length; i++) {
                    if (p.lines[line][i]) allMyEntities.push(p.lines[line][i]);
                  }
              }
            }
          }
        }
        if (state.equator) {
          for (let i = 0; i < state.equator.length; i++) {
            const u = state.equator[i];
            if (u && u.ownerId === this.playerId) allMyEntities.push(u);
          }
        }

        console.log(`[MinimaxAI] Auditing ${allMyEntities.length} entities...`);

        for (let i = 0; i < allMyEntities.length; i++) {
          const entity = allMyEntities[i];
          if (!entity || entity.type === 'avatar') continue;

          const eId = entity.instanceId || entity.id;
          const data = entityBestMoves[eId];

          console.log(`\n[MinimaxAI] -> Entity: [${entity.name || 'Unknown'}]`);

          if (!data) {
            console.log(`[MinimaxAI]      * IGNORING: The engine provided ZERO legal actions for this entity.`);
            console.log(`[MinimaxAI]      * (Check readiness, acts, or BLOCK_ targeting flags in targeting.js)`);
            continue;
          }

          if (data.attempted === 0) {
            console.log(`[MinimaxAI]      * FAILED: All simulated actions were rejected by the engine (success: false). Mechanically illegal.`);
            continue;
          }

          if (data.best) {
            let actName = data.best.option.action.name || data.best.option.action.abilityId || data.best.option.action.type;

            if (data.best.option.action.type === 'PLAY_CARD' || data.best.option.action.actionType === 'PLAY') {
              actName = `Play ${entity.name}`;
              if (entity.abilities) {
                  for(let k=0; k<entity.abilities.length; k++) {
                      const ab = entity.abilities[k];
                      if (ab.abilityId === data.best.option.action.abilityId && ab.name && data.best.option.action.abilityId !== 'native_play') {
                          actName += ` (${ab.name})`;
                      }
                  }
              }
            } else if (data.best.option.action.actionType === 'ATTACK' || data.best.option.action.abilityId === 'native_attack') {
              actName = `Attack with ${entity.name}`;
            } else if (data.best.option.action.abilityId) {
                let abName = data.best.option.action.abilityId;
                if (entity.abilities) {
                    for(let k=0; k<entity.abilities.length; k++) {
                        if (entity.abilities[k].abilityId === data.best.option.action.abilityId) {
                            abName = entity.abilities[k].name || abName;
                        }
                    }
                }
                actName = `${entity.name} uses ${abName}`;
            }

            if (data.best.option.targetId) {
              const tEnt = this.findEntity(simState, data.best.option.targetId);
              if (tEnt) actName += ` on -> [${tEnt.name}]`;
              else actName += ` on -> [Target ID: ${data.best.option.targetId}]`;
            } else if (data.best.option.targetLine) {
              actName += ` (Placed in ${data.best.option.targetLine} line)`;
            }

            const diff = Number(data.best.score) - Number(currentScore);
            console.log(`[MinimaxAI]      Best Simulated Move: ${actName}`);
            console.log(`[MinimaxAI]      Resulting Score: ${Number(data.best.score).toFixed(2)} (Delta vs Baseline: ${diff > 0 ? '+' : ''}${diff.toFixed(2)})`);

            let hasDeltas = false;
            for (const key in data.best.details) {
              if (key === 'unitScores' || key === 'unitLabels' || key === 'unitBreakdown') continue;
              const bVal = Number(baselineEval.details[key]) || 0;
              const nVal = Number(data.best.details[key]) || 0;
              const delta = nVal - bVal;
              if (Math.abs(delta) > 0.01) {
                hasDeltas = true;
                const name = detailNames[key] || key;
                console.log(`[MinimaxAI]        * ${name}: ${delta > 0 ? '+' : ''}${delta.toFixed(2)}`);
              }
            }

            const nextUnits = data.best.details.unitScores || {};
            const baseUnits = baselineEval.details.unitScores || {};
            const allUnitKeys = [];
            for (const k in nextUnits) { if (!allUnitKeys.includes(k)) allUnitKeys.push(k); }
            for (const k in baseUnits) { if (!allUnitKeys.includes(k)) allUnitKeys.push(k); }
            
            let hasUnitDiff = false;

            for (let j = 0; j < allUnitKeys.length; j++) {
              const uKey = allUnitKeys[j];
              const nVal = Number(nextUnits[uKey]) || 0;
              const bVal = Number(baseUnits[uKey]) || 0;
              const unitDiff = nVal - bVal;

              if (Math.abs(unitDiff) > 0.01) {
                if (!hasUnitDiff) {
                  console.log(`[MinimaxAI]        * BOARD UNIT BREAKDOWN:`);
                  hasUnitDiff = true;
                }
                const sign = unitDiff > 0 ? '+' : '';
                let nLabel = String(data.best.details.unitLabels[uKey] || '');
                let bLabel = String(baselineEval.details.unitLabels[uKey] || '');
                let displayLabel = nLabel;

                if (nLabel && bLabel && nLabel !== bLabel) {
                    let newStats = '';
                    const match = nLabel.match(/\((.*)\)/);
                    if (match && match[1]) newStats = match[1];
                    displayLabel = `${bLabel} => (${newStats})`;
                } else if (!nLabel) {
                  displayLabel = `${bLabel} [DIED/REMOVED]`;
                } else if (!bLabel) {
                  displayLabel = `${nLabel} [PLAYED/CREATED]`;
                }

                let breakdownExplanation = [];
                const nBreak = data.best.details.unitBreakdown[uKey];
                const bBreak = baselineEval.details.unitBreakdown[uKey];
                
                if (nBreak || bBreak) {
                    const safeN = nBreak || {};
                    const safeB = bBreak || {};
                    const statKeys = ['Offense', 'Abilities', 'Health', 'Readiness', 'Position', 'AliveBonus'];

                    for (let s = 0; s < statKeys.length; s++) {
                      const stat = statKeys[s];
                      const nStat = Number(safeN[stat]) || 0;
                      const bStat = Number(safeB[stat]) || 0;
                      const statDiff = nStat - bStat;
                      if (Math.abs(statDiff) > 0.01) {
                        breakdownExplanation.push(`${stat}: ${statDiff > 0 ? '+' : ''}${statDiff.toFixed(2)}`);
                      }
                    }
                }

                const explanationStr = breakdownExplanation.length > 0 ? ` (${breakdownExplanation.join(', ')})` : '';
                console.log(`[MinimaxAI]          - ${displayLabel}: ${sign}${unitDiff.toFixed(2)}${explanationStr}`);
              }
            }
          }
        }
      } catch (err) {
        console.log(`[MinimaxAI] [ERROR] Crash in entity breakdown: ${err.message}`);
      }
      console.log(`[MinimaxAI] ===========================================================\n`);
    }

    return { action: { type: 'PASS' } };
  }
}