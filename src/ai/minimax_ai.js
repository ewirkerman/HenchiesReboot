import { BaseAIEngine } from './base.js';
import { playCard, executeEntityAction, executeSacrificeDecision } from '../engine/flow.js';
import { GameEngine } from '../engine/index.js';

// ==========================================
// 1. EVALUATION PROFILES & HEURISTICS
// ==========================================

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

const HARVEST_ACTION = {
  "abilityId": "sys_harvest",
  type: 'ENTITY_ACTION',
  actionType: 'ABILITY',
  "cost": {
    "tribeAmount": 0,
    "carnie": 0,
    "power": 0,
    "readinessCost": "NONE",
    "escalates": false,
    "reuseIgnoresReadiness": false,
    "freeAction": false
  },
  "effects": [
    {
      "targetMethod": "EVENT_TARGET",
      "payloads": [
        {
          "type": "HARVEST",
          "duration": "INSTANT"
        }
      ]
    }
  ]
}

/**
 * Helper to parse a card's cost object into a mapping of distinct tribes.
 */
export function getCardCostByTribe(card) {
  const costByTribe = {};
  if (!card || card.cost === undefined) return costByTribe;

  const tribe = card.tribe || 'Generic';

  if (typeof card.cost === 'number') {
    costByTribe[tribe] = card.cost;
    return costByTribe;
  }

  for (const [key, val] of Object.entries(card.cost)) {
    if (typeof val !== 'number' || val <= 0) continue;
    if (key === 'tribeAmount') {
      costByTribe[tribe] = (costByTribe[tribe] || 0) + val;
    } else if (key.toLowerCase() === 'carnie') {
      costByTribe['Carnie'] = (costByTribe['Carnie'] || 0) + val;
    } else {
      const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
      costByTribe[formattedKey] = (costByTribe[formattedKey] || 0) + val;
    }
  }
  return costByTribe;
}

/**
 * Helper to map a player's max resources by tribe.
 */
export function getPlayerMaxResByTribe(p) {
  const res = {};
  if (p.resources) {
    for (const [tribe, data] of Object.entries(p.resources)) {
      res[tribe] = data.max || 0;
    }
  }
  return res;
}

/**
 * Scores a state relative to `playerId` using a specific personality profile.
 */
export function evaluateStateWithProfile(state, playerId, profile) {
  const player = state.players[playerId];
  const opponentId = Object.keys(state.players).find(id => id !== playerId);
  const opponent = state.players[opponentId];

  if (!player) return -99999;
  if (!opponent) return 99999;

  const getAvatar = (p) => {
    if (!p || !p.lines) return null;
    for (const line of Object.values(p.lines)) {
      if (Array.isArray(line)) {
        const avatar = line.find(u => u.type === 'avatar');
        if (avatar) return avatar;
      }
    }
    return null;
  };

  const pAvatar = getAvatar(player);
  const oAvatar = getAvatar(opponent);

  const pHealth = pAvatar ? (pAvatar.health || 0) : 0;
  const oHealth = oAvatar ? (oAvatar.health || 0) : 0;

  if (pHealth <= 0) return -99999;
  if (oHealth <= 0) return 99999;

  let score = 0;

  // 1. HP Differential
  score += (pHealth - oHealth) * (profile.hpWeight || 0);

  const pMaxResByTribe = getPlayerMaxResByTribe(player);
  const oMaxResByTribe = getPlayerMaxResByTribe(opponent);

  // 2. Hand Size & Quality Advantage
  const getHandScore = (p, currentResByTribe) => {
    if (!p.hand || p.hand.length === 0) return 0;
    let q = p.hand.length * (profile.handWeight || 0);

    const seenIds = new Set();

    p.hand.forEach(c => {
      const costByTribe = getCardCostByTribe(c);
      let missing = 0;

      for (const [tribe, amt] of Object.entries(costByTribe)) {
        const avail = currentResByTribe[tribe] || 0;
        if (amt > avail) missing += (amt - avail);
      }

      if (missing === 0) {
        q += (profile.handWeight || 1) * 0.8;
      } else {
        q -= missing * 0.5;
      }

      if (seenIds.has(c.id)) {
        q -= (profile.handWeight || 1) * 0.5;
      }
      seenIds.add(c.id);

      const stats = (c.strength || 0) + (c.health || 0) + (c.power || 0);
      q += stats * 0.05;
    });
    return q;
  };

  score += getHandScore(player, pMaxResByTribe) - getHandScore(opponent, oMaxResByTribe);

  // 3. Total On-Board Unit Stats
  const getBoardStats = (p, isOpponent) => {
    let total = 0;
    if (p.lines) {
      Object.values(p.lines).forEach(lineUnits => {
        if (Array.isArray(lineUnits)) {
          lineUnits.forEach(u => {
            if (u.type === 'avatar') return;

            const numAbils = (u.abilities || []).filter(a => !['ON_BE_PLAYED', 'PLAY_OPTIONAL'].includes(a.trigger)).length;
            const rawOffense = (u.strength || 0) + (u.power || 0);
            const abilityBonus = (numAbils * 2);

            // KINETIC POTENTIAL & READINESS PENALTIES
            // We scale ONLY the physical offensive capability, decoupling it from ability inflation.
            // We enforce a minimum effective offense of 1 so 0-attack units still have a tiny exhaust penalty.
            const effectiveOffense = Math.max(1, rawOffense);

            let kpMod = 0;
            let readiness = (u.readiness !== undefined) ? Number(u.readiness) : 1;

            if (readiness > 0) {
              kpMod = effectiveOffense * 0.10; // Small bonus to incentivize buffing BEFORE attacking
            } else if (readiness === 0) {
              kpMod = effectiveOffense * -0.05;  // Normal drop from attacking
            } else {
              kpMod = effectiveOffense * -0.20;  // Moderated penalty for Stun/Exhaust mechanics
            }

            let stats = 0;
            if (isOpponent) {
              // Enemy units hold a static "Alive Bonus" to force the AI to value KILLING them
              stats = rawOffense + abilityBonus + (u.health * 1.5) + 4 + kpMod;
            } else {
              // AI values its own units objectively
              stats = rawOffense + abilityBonus + (u.health * 1.0) + kpMod;
            }

            total += stats;
          });
        }
      });
    }
    return total;
  };

  score += (getBoardStats(player, false) - getBoardStats(opponent, true)) * (profile.boardWeight || 0);

  // 4. Refined Bodyguard / Threat Heuristic
  const getActiveThreat = (p) => {
    let threat = 0;
    if (p.lines) {
      Object.values(p.lines).forEach(lineUnits => {
        if (Array.isArray(lineUnits)) {
          lineUnits.forEach(u => {
            if (u.type === 'avatar') return;
            // Any unit with >= 0 readiness can attack NEXT turn, making it a threat
            let readiness = (u.readiness !== undefined) ? Number(u.readiness) : 1;
            if (readiness >= 0) threat += ((u.strength || 0) + (u.power || 0));
          });
        }
      });
    }
    return threat;
  };

  const getBodyguardHP = (p) => {
    let hp = 0;
    if (p.lines?.bodyguard && Array.isArray(p.lines.bodyguard)) {
      p.lines.bodyguard.forEach(u => {
        if (u.type === 'avatar') return;
        hp += (u.health || 0);
      });
    }
    return hp;
  };

  const pThreat = getActiveThreat(player);
  const oThreat = getActiveThreat(opponent);
  const pBgHP = getBodyguardHP(player);
  const oBgHP = getBodyguardHP(opponent);

  // DIRECT THREAT PENALTY: The AI should be terrified of high-attack enemy units.
  // We directly penalize the AI's score for every point of damage the enemy has on board.
  score -= oThreat * (profile.hpWeight * 0.5);

  // The AI also values its own ability to threaten the enemy.
  score += pThreat * (profile.hpWeight * 0.2);

  const evalBg = (bgHp, avatarHp) => {
    if (bgHp <= 0) return 0;

    let blockMultiplier = 0.3; // Default inherent value for having a meat shield

    if (avatarHp > 0 && avatarHp <= 10) {
      blockMultiplier = 0.8; // SERIOUS: Protect the avatar as health gets low
    }
    if (avatarHp > 0 && avatarHp <= 5) {
      blockMultiplier = 1.5; // LETHAL RANGE: Bodyguard is infinitely valuable
    }

    return bgHp * (profile.hpWeight * blockMultiplier);
  };

  score += evalBg(pBgHP, pHealth) - evalBg(oBgHP, oHealth);

  // 5. Equator Control
  if (state.equator) {
    let equatorDiff = 0;
    state.equator.forEach(item => {
      if (item.ownerId === playerId) equatorDiff += 1;
      else if (item.ownerId === opponentId) equatorDiff -= 1;
    });
    score += equatorDiff * (profile.equatorWeight || 0);
  }

  // 6. Dynamic Resources Advantage (By Tribe)
  const getResourceScore = (p) => {
    const maxResByTribe = getPlayerMaxResByTribe(p);
    const maxCostInHandByTribe = {};

    if (p.hand && p.hand.length > 0) {
      p.hand.forEach(c => {
        const costByTribe = getCardCostByTribe(c);
        for (const [tribe, amt] of Object.entries(costByTribe)) {
          maxCostInHandByTribe[tribe] = Math.max(maxCostInHandByTribe[tribe] || 0, amt);
        }
      });
    }

    let resScore = 0;
    const allTribes = new Set([...Object.keys(maxResByTribe), ...Object.keys(maxCostInHandByTribe)]);

    for (const tribe of allTribes) {
      const avail = maxResByTribe[tribe] || 0;
      const needed = maxCostInHandByTribe[tribe] || 0;

      if (avail <= needed) {
        resScore += avail * 1.5;
      } else {
        resScore += (needed * 1.5) + ((avail - needed) * 0.3);
      }
    }
    return resScore;
  };

  const resDiff = getResourceScore(player) - getResourceScore(opponent);
  score += resDiff * (profile.resourceWeight || 0);

  return score;
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
    for (const pId of ['player1', 'player2']) {
      const p = state.players[pId];
      const inHand = p.hand?.find(c => c.instanceId === entityId || c.id === entityId);
      if (inHand) return inHand;
      for (const line of Object.values(p.lines || {})) {
        if (Array.isArray(line)) {
          const u = line.find(e => e.instanceId === entityId || e.id === entityId);
          if (u) return u;
        }
      }
    }
    if (state.equator) return state.equator.find(e => e.instanceId === entityId || e.id === entityId);
    return null;
  }

  deduplicateOptions(state, options) {
    const unique = [];
    const signatures = new Set();

    for (const opt of options) {
      if (opt.action.type === 'PASS') {
        unique.push(opt);
        continue;
      }

      let sig = '';
      const eId = opt.action.entityId || opt.action.cardId;
      const entity = this.findEntity(state, eId);

      if (entity) {
        sig += `Src[${entity.id}|${entity.strength}|${entity.health}|${entity.acts}]_`;
      }
      sig += `Act[${opt.action.type}|${opt.action.actionType}|${opt.action.abilityId}]_Tgt[${opt.targetId}|${opt.targetLine}]`;

      if (!signatures.has(sig)) {
        signatures.add(sig);
        unique.push(opt);
      }
    }
    return unique;
  }

  getExpandedOptions(state, targetPlayerId) {
    const originalId = this.playerId;
    const originalFreeActions = this.usedFreeActions;

    this.playerId = targetPlayerId;
    this.usedFreeActions = new Set();

    const legalActions = this.computeAllLegalActions(state);

    this.playerId = originalId;
    this.usedFreeActions = originalFreeActions;

    const options = [{ action: { type: 'PASS' }, targetId: null, targetLine: null }];

    for (let action of legalActions) {
      if (action.type === 'ENTITY_ACTION') {
        const player = state.players[targetPlayerId];
        const inHand = player.hand?.some(c => c.instanceId === action.entityId || c.id === action.entityId);

        if (inHand) {
          const entity = this.findEntity(state, action.entityId);
          const ab = entity?.abilities?.find(a => a.abilityId === action.abilityId);
          const isPlayTrigger = ab && ['PLAY', 'PLAY_OPTIONAL', 'ON_BE_PLAYED'].includes(ab.trigger);

          if (isPlayTrigger) {
            // Convert hand-based play abilities into true PLAY_CARD actions
            action = {
              ...action,
              type: 'PLAY_CARD',
              cardId: action.entityId,
              cardName: entity?.name || action.entityName
            };
          } else if (action.actionType === 'PLAY' || action.abilityId === 'native_play') {
            continue;
          }
        } else if (action.actionType === 'PLAY' || action.abilityId === 'native_play') {
          continue;
        }
      }

      if (action.targets && action.targets.length > 0) {
        for (const target of action.targets) {
          options.push({ action, targetId: target.id, targetLine: target.line });
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
      return executeEntityAction(simState, playerId, action.entityId, action.actionType, action.abilityId, targetId, targetLine);
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
      player.hand.forEach(card => {
        candidates.push({ action: 'OPTION_A', cardId: card.instanceId || card.id, detail: card.name, card: card });
      });
    }

    const pool = [...(player.deck || []), ...(player.hand || [])];
    const costsPerTribe = {};

    pool.forEach(c => {
      const costByTribe = getCardCostByTribe(c);
      for (const [tribe, amt] of Object.entries(costByTribe)) {
        if (!costsPerTribe[tribe]) costsPerTribe[tribe] = [];
        costsPerTribe[tribe].push(amt);
      }
    });

    const targetResourcesByTribe = {};
    for (const [tribe, costs] of Object.entries(costsPerTribe)) {
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

    for (const [tribe, target] of Object.entries(targetResourcesByTribe)) {
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
    for (const cand of candidates) {
      const simState = structuredClone(state);
      simState.simulation = true;

      const engine = new GameEngine(simState);
      if (cand.cardId) {
        engine.executeAbility(HARVEST_ACTION, {}, { target: cand.card }, this.playerId);
      }

      let score = evaluateStateWithProfile(simState, this.playerId, this.profile);

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

  /**
   * ITERATIVE GREEDY MAXIMIZER (Hill Climbing / GOAP)
   */
  determineMove(state, legalActions) {
    if (this.debug) console.log(`\n[MinimaxAI ${this.playerId}] --- SEARCHING FOR NEXT BEST ACTION ---`);

    const simState = structuredClone(state);
    simState.simulation = true;

    // 1. Establish the baseline score for doing absolutely nothing
    const currentScore = evaluateStateWithProfile(simState, this.playerId, this.profile);

    // 2. Expand and deduplicate options
    const options = this.getExpandedOptions(simState, this.playerId);
    const dedupedOptions = this.deduplicateOptions(simState, options);

    let bestOption = null;
    let bestScore = currentScore;

    // 3. Test every option 1-ply deep
    for (const opt of dedupedOptions) {
      if (opt.action.type === 'PASS') continue;

      const nextState = structuredClone(simState);
      const res = this.applyMoveToState(nextState, this.playerId, opt);

      if (res && res.success) {
        // Lethal Check: If this specific move kills the enemy Avatar, take it immediately!
        const oppId = Object.keys(nextState.players).find(id => id !== this.playerId);
        const oppAvatar = nextState.players[oppId]?.lines.avatar?.[0];
        if (!oppAvatar || oppAvatar.health <= 0) {
          if (this.debug) console.log(`[MinimaxAI] LETHAL DISCOVERED. Executing.`);
          return opt;
        }

        const nextScore = evaluateStateWithProfile(nextState, this.playerId, this.profile);

        // THE ACTION COST PENALTY: 
        // We subtract 0.1 from the score of EVERY simulated move. 
        // This stops the AI from taking pointless actions (like Taunting empty boards) 
        // just because the baseline score didn't physically drop.
        const actionCost = 0.1;
        const jitter = Math.random() * 0.01;
        const finalScore = (nextScore - actionCost) + jitter;

        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestOption = opt;
        }
      }
    }

    // 4. Execute the best state-improving move, or PASS if we hit the summit
    if (bestOption) {
      if (this.debug) {
        let actionName = bestOption.action.name || bestOption.action.abilityId || bestOption.action.type;
        const entityId = bestOption.action.entityId || bestOption.action.cardId;
        const entity = this.findEntity(simState, entityId);

        if (entity) {
          if (bestOption.action.type === 'PLAY_CARD' || bestOption.action.actionType === 'PLAY') {
            actionName = `Play ${entity.name}`;
            const ab = entity.abilities?.find(a => a.abilityId === bestOption.action.abilityId);
            if (ab && ab.name && bestOption.action.abilityId !== 'native_play') {
              actionName += ` (${ab.name})`;
            }
          } else if (bestOption.action.actionType === 'ATTACK' || bestOption.action.abilityId === 'native_attack') {
            actionName = `Attack with ${entity.name}`;
          } else if (bestOption.action.abilityId) {
            const ab = entity.abilities?.find(a => a.abilityId === bestOption.action.abilityId);
            actionName = `${entity.name} uses ${ab?.name || bestOption.action.abilityId}`;
          }
        }

        if (bestOption.targetId) {
          const targetEntity = this.findEntity(simState, bestOption.targetId);
          if (targetEntity) {
            actionName += ` on -> [${targetEntity.name}]`;
          } else {
            actionName += ` on -> [Target ID: ${bestOption.targetId}]`;
          }
        } else if (bestOption.targetLine) {
          actionName += ` (Placed in ${bestOption.targetLine} line)`;
        }

        console.log(`[MinimaxAI] Chosen Move Score: ${bestScore.toFixed(2)} (Baseline: ${currentScore.toFixed(2)})`);
        console.log(`[MinimaxAI] Executing:`, actionName);
      }
      return bestOption;
    }

    if (this.debug) console.log(`\n[MinimaxAI ${this.playerId}] === NO MORE VALUABLE ACTIONS. ENDING TURN. ===\n`);
    return { action: { type: 'PASS' } };
  }
}