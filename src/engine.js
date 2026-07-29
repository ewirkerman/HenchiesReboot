/**
 * Henchies 2 Game Engine & Data Models
 * Strict 11 Tribes (No Neutral, No Rarity).
 */

export const TRIBES = [
  'Mythic', 'Robot', 'Elemental', 'Undead', 'Pirate', 
  'Carnie', 'Viking', 'Ninja', 'Stalker', 'Alien', 'Luchador'
];

export const CARD_TYPES = ['unit', 'spell', 'equipment', 'artifact'];
export const TRAITS = ['Fast', 'Taunt', 'Ambush', 'Passive', 'Stun'];
export const LINES = ['hero', 'bodyguard', 'back', 'mid', 'front', 'taunt'];

import { fetchCustomCards } from './firebase.js';



// ---------------------------------------------------------------------------
// DATA MODELS
// ---------------------------------------------------------------------------

export class Ability {
  constructor(data = {}) {
    this.abilityId = data.abilityId || 'ability_' + Math.random().toString(36).substring(2, 9);
    this.name = data.name || 'Unnamed Ability';
    this.trigger = data.trigger || 'ON_PLAY';
    this.targetCriteria = data.targetCriteria || {
      entityType: 'unit',
      affiliation: 'enemy',
      excludeTribes: [],
      line: null
    };
    this.cost = data.cost || { tents: 0, tribeResource: 0, energy: 0, readiness: 0 };
    this.effects = data.effects || [];
    this.duration = data.duration || 'instant';
    this.description = data.description || '';
  }
}

export class Card {
  constructor(data = {}) {
    this.id = data.id || 'card_' + Math.random().toString(36).substring(2, 9);
    this.name = data.name || 'Unknown';
    this.type = data.type;
    this.tribe = data.tribe;
    this.cost = data.cost;
    this.strength = this.type === 'unit' ? (data.strength ?? 1) : null;
    this.health = this.type === 'unit' ? (data.health ?? 1) : null;
    this.maxHealth = this.type === 'unit' ? (data.maxHealth ?? data.health ?? 1) : null;
    this.abilities = (data.abilities || []).map(a => a instanceof Ability ? a : new Ability(a));
    this.traits = data.traits || [];
    this.artUrl = data.artUrl || '';
    this.description = data.description || '';
  }

  toObject() {
    return JSON.parse(JSON.stringify(this));
  }
}

export class UnitInstance {
  constructor(card, ownerId) {
    this.instanceId = 'inst_' + Math.random().toString(36).substring(2, 9);
    this.cardId = card.id;
    this.name = card.name;
    this.type = card.type;
    this.tribe = card.tribe;
    this.ownerId = ownerId;
    this.strength = card.strength ?? 0;
    this.maxHealth = card.maxHealth ?? card.health ?? 1;
    this.currentHealth = card.health ?? 1;
    this.readiness = 0; // Board state readiness: -1, 0, 1
    this.abilities = JSON.parse(JSON.stringify(card.abilities || []));
    this.traits = [...(card.traits || [])];
    this.attachments = [];
    this.line = 'mid';
    this.temporaryLineExpiry = null;
    this.entryTimestamp = Date.now();
    this.artUrl = card.artUrl || '';
    this.description = card.description || '';
  }
}

export class Avatar {
  constructor(data = {}) {
    this.id = data.id || 'avatar_' + Math.random().toString(36).substring(2, 9);
    this.name = data.name || 'Warlord';
    this.tribe = data.tribe || 'Mythic';
    this.health = data.health || 30;
    this.maxHealth = data.maxHealth || 30;
    this.power = data.power || 0;
    this.readiness = 1;
    this.bodyguardUsedThisTurn = false;
    
    this.abilities = (data.abilities && data.abilities.length > 0) 
      ? data.abilities.map(a => a instanceof Ability ? a : new Ability(a))
      : [
          new Ability({
            abilityId: 'ability_avatar_bodyguard',
            name: 'Bodyguard Command',
            trigger: 'MANUAL',
            cost: { tents: 0, tribeResource: 0, energy: 0, readiness: 0 },
            description: 'Pulls a target friendly unit into the Bodyguard line.'
          })
        ];
  }
}

export class GameState {
  constructor(gameId = 'room_default') {
    this.gameId = gameId;
    this.status = 'waiting';
    this.turnNumber = 1;
    this.activePlayerId = 'player1';
    this.turnPhase = 'DRAW_DECISION';
    this.winner = null;
    
    this.players = {
      player1: {
        id: 'player1',
        name: 'Player 1',
        avatar: new Avatar({ name: 'Mythic Sovereign', tribe: 'Mythic', health: 30 }),
        tents: 1,
        maxTents: 1,
        tribeResource: 0,
        maxTribeResource: 0,
        deck: [],
        hand: [],
        discard: [],
        banish: [],
        lines: { hero: [], bodyguard: [], back: [], mid: [], front: [], taunt: [] }
      },
      player2: {
        id: 'player2',
        name: 'Player 2',
        avatar: new Avatar({ name: 'Cyber Overlord', tribe: 'Robot', health: 30 }),
        tents: 1,
        maxTents: 1,
        tribeResource: 0,
        maxTribeResource: 0,
        deck: [],
        hand: [],
        discard: [],
        banish: [],
        lines: { hero: [], bodyguard: [], back: [], mid: [], front: [], taunt: [] }
      }
    };

    this.equator = [];
    this.action_log = [];
    this.history_log = [];
    this.turn_start_state = null;
  }
}

// ---------------------------------------------------------------------------
// DEFAULT CATALOG (NO NEUTRAL, NO RARITY)
// ---------------------------------------------------------------------------

export const CARD_CATALOG = await fetchCustomCards();

export function cloneGameState(state) {
  return JSON.parse(JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// PROTECTION HIERARCHY ENGINE
// ---------------------------------------------------------------------------
export function canAttackTarget(state, attackerOwnerId, defenderOwnerId, targetLine, targetId) {
  const defenderPlayer = state.players[defenderOwnerId];
  if (!defenderPlayer) return false;

  const lines = defenderPlayer.lines;
  const tauntUnits = lines.taunt.filter(u => u.currentHealth > 0);
  if (tauntUnits.length > 0) {
    if (targetLine !== 'taunt') return false;
  }

  if (targetLine === 'hero') {
    const bodyguardUnits = lines.bodyguard.filter(u => u.currentHealth > 0);
    if (bodyguardUnits.length > 0) return false;
    if (tauntUnits.length > 0) return false;
    return true;
  }

  if (targetLine === 'back') {
    const midUnits = lines.mid.filter(u => u.currentHealth > 0);
    const frontUnits = lines.front.filter(u => u.currentHealth > 0);
    if (midUnits.length > 0 || frontUnits.length > 0) return false;
  }

  if (targetLine === 'mid') {
    const frontUnits = lines.front.filter(u => u.currentHealth > 0);
    if (frontUnits.length > 0) return false;
  }

  return true;
}

export function getValidAttackTargets(state, attackerOwnerId) {
  const defenderOwnerId = attackerOwnerId === 'player1' ? 'player2' : 'player1';
  const defenderPlayer = state.players[defenderOwnerId];
  if (!defenderPlayer) return [];

  const targets = [];
  if (canAttackTarget(state, attackerOwnerId, defenderOwnerId, 'hero', defenderPlayer.avatar.id)) {
    targets.push({ line: 'hero', id: defenderPlayer.avatar.id, type: 'hero', name: defenderPlayer.avatar.name });
  }

  for (const line of ['taunt', 'front', 'mid', 'back', 'bodyguard']) {
    for (const unit of defenderPlayer.lines[line]) {
      if (unit.currentHealth > 0 && canAttackTarget(state, attackerOwnerId, defenderOwnerId, line, unit.instanceId)) {
        targets.push({ line, id: unit.instanceId, type: 'unit', name: unit.name, unit });
      }
    }
  }

  return targets;
}

// ---------------------------------------------------------------------------
// COMBAT & DAMAGE ENGINE
// ---------------------------------------------------------------------------
export function resolveCombat(state, attackerOwnerId, attackerId, targetLine, targetId) {
  const attackerPlayer = state.players[attackerOwnerId];
  const defenderOwnerId = attackerOwnerId === 'player1' ? 'player2' : 'player1';
  const defenderPlayer = state.players[defenderOwnerId];

  let attackerUnit = null;
  for (const line of LINES) {
    const found = attackerPlayer.lines[line].find(u => u.instanceId === attackerId);
    if (found) { attackerUnit = found; break; }
  }

  if (!attackerUnit || attackerUnit.readiness < 1) {
    return { success: false, reason: 'Attacker is not ready or does not exist.' };
  }

  if (!canAttackTarget(state, attackerOwnerId, defenderOwnerId, targetLine, targetId)) {
    return { success: false, reason: 'Target is protected by battleline rules!' };
  }

  attackerUnit.readiness = Math.max(-1, attackerUnit.readiness - 1);

  let defenderEntity = null;
  if (targetLine === 'hero') {
    defenderEntity = defenderPlayer.avatar;
  } else {
    for (const line of LINES) {
      const found = defenderPlayer.lines[line].find(u => u.instanceId === targetId);
      if (found) { defenderEntity = found; break; }
    }
  }

  if (!defenderEntity) return { success: false, reason: 'Target entity not found.' };

  const logEntries = [];
  const attackDamage = attackerUnit.strength || 0;

  if (targetLine === 'hero') {
    defenderEntity.health = Math.max(0, defenderEntity.health - attackDamage);
    logEntries.push(`${attackerUnit.name} attacked ${defenderEntity.name} dealing ${attackDamage} damage!`);
    
    if (defenderEntity.health <= 0) {
      state.status = 'finished';
      state.winner = attackerOwnerId;
      logEntries.push(`🏆 ${attackerPlayer.name} has defeated ${defenderPlayer.name}!`);
    }
  } else {
    defenderEntity.currentHealth = Math.max(0, defenderEntity.currentHealth - attackDamage);
    logEntries.push(`${attackerUnit.name} struck ${defenderEntity.name} dealing ${attackDamage} damage.`);

    executeTrigger(state, 'ON_DAMAGED', defenderEntity, attackerUnit);

    const isAmbush = attackerUnit.traits.includes('Ambush');
    const isDefenderPassive = defenderEntity.traits && defenderEntity.traits.includes('Passive');
    const isDefenderStunned = defenderEntity.traits && defenderEntity.traits.includes('Stun');
    
    if (defenderEntity.currentHealth > 0 && !isAmbush && !isDefenderPassive && !isDefenderStunned) {
      const counterDamage = defenderEntity.strength || 0;
      attackerUnit.currentHealth = Math.max(0, attackerUnit.currentHealth - counterDamage);
      logEntries.push(`${defenderEntity.name} counter-attacked ${attackerUnit.name} dealing ${counterDamage} damage!`);
      executeTrigger(state, 'ON_DAMAGED', attackerUnit, defenderEntity);
    }
  }

  checkAndCleanDeaths(state);
  state.history_log.push(...logEntries);
  return { success: true, log: logEntries };
}

export function checkAndCleanDeaths(state) {
  for (const playerId of ['player1', 'player2']) {
    const p = state.players[playerId];
    for (const line of LINES) {
      const remaining = [];
      for (const unit of p.lines[line]) {
        if (unit.currentHealth <= 0) {
          state.history_log.push(`💀 ${unit.name} was destroyed.`);
          executeTrigger(state, 'ON_DEATH', unit);

          if (unit.attachments && unit.attachments.length > 0) {
            for (const item of unit.attachments) {
              if (item.type === 'equipment' || item.type === 'artifact') {
                state.equator.push(item);
                state.history_log.push(`📦 ${item.name} dropped to the Equator.`);
              } else {
                p.lines.mid.push(item);
              }
            }
          }
          p.discard.push(unit);
        } else {
          remaining.push(unit);
        }
      }
      p.lines[line] = remaining;
    }
  }
}

// ---------------------------------------------------------------------------
// ABILITY ENGINE
// ---------------------------------------------------------------------------
export function executeTrigger(state, triggerName, sourceEntity, targetEntity = null) {
  if (!sourceEntity || !sourceEntity.abilities) return;
  for (const ab of sourceEntity.abilities) {
    if (ab.trigger === triggerName) {
      executeAbility(state, ab, sourceEntity, targetEntity);
    }
  }
}

export function executeAbility(state, ability, sourceEntity, targetEntity = null) {
  state.history_log.push(`✨ Ability '${ability.name}' executed!`);

  for (const effect of (ability.effects || [])) {
    const amt = effect.amount !== undefined ? effect.amount : 1;
    switch (effect.type) {
      case 'DEAL_DAMAGE': {
        if (effect.target === 'ENEMY_HERO') {
          const enemyId = sourceEntity.ownerId === 'player1' ? 'player2' : 'player1';
          const hero = state.players[enemyId].avatar;
          hero.health = Math.max(0, hero.health - amt);
          state.history_log.push(`💥 ${hero.name} took ${amt} damage.`);
        } else if (targetEntity && targetEntity.currentHealth !== undefined) {
          targetEntity.currentHealth = Math.max(0, targetEntity.currentHealth - amt);
          state.history_log.push(`💥 ${targetEntity.name} took ${amt} damage.`);
        }
        break;
      }
      case 'HEAL': {
        if (effect.target === 'FRIENDLY_HERO') {
          const hero = state.players[sourceEntity.ownerId].avatar;
          hero.health = Math.min(hero.maxHealth, hero.health + amt);
          state.history_log.push(`💚 ${hero.name} healed for ${amt} HP.`);
        } else if (sourceEntity.currentHealth !== undefined) {
          sourceEntity.currentHealth = Math.min(sourceEntity.maxHealth, sourceEntity.currentHealth + amt);
          state.history_log.push(`💚 ${sourceEntity.name} healed for ${amt} HP.`);
        }
        break;
      }
      case 'APPLY_STATUS': {
        const statusType = effect.status || 'Stun';
        if (targetEntity && targetEntity.traits) {
          if (!targetEntity.traits.includes(statusType)) {
            targetEntity.traits.push(statusType);
          }
          if (statusType === 'Stun') targetEntity.readiness = -1;
          state.history_log.push(`✨ Applied status '${statusType}' to ${targetEntity.name}.`);
        }
        break;
      }
      case 'DRAW_CARD': {
        drawCards(state, sourceEntity.ownerId, amt);
        break;
      }
      case 'CUSTOM_SCRIPT': {
        if (effect.script) {
          try {
            const fn = new Function('state', 'sourceEntity', 'targetEntity', 'effect', effect.script);
            const resultMsg = fn(state, sourceEntity, targetEntity, effect);
            if (typeof resultMsg === 'string') {
              state.history_log.push(`📜 ${resultMsg}`);
            }
          } catch (err) {
            console.error('Custom Script Error:', err);
          }
        }
        break;
      }
    }
  }

  checkAndCleanDeaths(state);
}

// ---------------------------------------------------------------------------
// TURN STATE MACHINE
// ---------------------------------------------------------------------------
export function drawCards(state, playerId, count) {
  const p = state.players[playerId];
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (p.deck.length > 0) {
      p.hand.push(p.deck.pop());
      drawn++;
    }
  }
  state.history_log.push(`🎴 ${p.name} drew ${drawn} card(s).`);
  return drawn;
}

export function startTurn(state) {
  const activeP = state.players[state.activePlayerId];
  state.history_log.push(`--- TURN ${state.turnNumber} (${activeP.name}) ---`);

  state.turnPhase = 'PRE_TURN';
  activeP.tents = activeP.maxTents;
  activeP.tribeResource = activeP.maxTribeResource;

  for (const line of LINES) {
    for (const unit of activeP.lines[line]) {
      unit.readiness = Math.min(1, unit.readiness + 1);
      if (unit.temporaryLineExpiry && state.turnNumber >= unit.temporaryLineExpiry) {
        if (unit.line === 'back') {
          unit.line = 'mid';
          activeP.lines.back = activeP.lines.back.filter(u => u.instanceId !== unit.instanceId);
          activeP.lines.mid.push(unit);
          unit.temporaryLineExpiry = null;
        }
      }
    }
  }

  activeP.avatar.power += 1;
  activeP.avatar.bodyguardUsedThisTurn = false;
  state.turnPhase = 'DRAW_DECISION';

  if (activeP.deck.length === 0) {
    state.turnPhase = 'SACRIFICE_DECISION';
  }
}

export function executeDrawDecision(state, option) {
  if (state.turnPhase !== 'DRAW_DECISION') return false;
  if (option === 'OPTION_A') {
    drawCards(state, state.activePlayerId, 2);
    state.turnPhase = 'SACRIFICE_DECISION';
  } else if (option === 'OPTION_B') {
    drawCards(state, state.activePlayerId, 4);
    endTurn(state);
  }
  return true;
}

export function executeSacrificeDecision(state, option, cardIdToBanish = null) {
  if (state.turnPhase !== 'SACRIFICE_DECISION') return false;
  const activeP = state.players[state.activePlayerId];

  if (option === 'OPTION_A' && cardIdToBanish) {
    const cardIdx = activeP.hand.findIndex(c => c.id === cardIdToBanish);
    if (cardIdx !== -1) {
      const banished = activeP.hand.splice(cardIdx, 1)[0];
      activeP.banish.push(banished);
      activeP.maxTents += 1;
      activeP.maxTribeResource += 1;
      activeP.tents += 1;
      activeP.tribeResource += 1;
      state.history_log.push(`🔥 Sacrificed card '${banished.name}'. Max capacity increased!`);
    }
  }
  state.turnPhase = 'ACTION_PHASE';
  return true;
}

export function endTurn(state) {
  state.turnPhase = 'TURN_ENDING';
  const prevP = state.activePlayerId;
  state.activePlayerId = prevP === 'player1' ? 'player2' : 'player1';
  state.turnNumber += 1;
  startTurn(state);
}

export function initGame(gameId, player1Name = 'Player 1', customDeck = null) {
  const state = new GameState(gameId);
  state.players.player1.name = player1Name;
  state.players.player1.deck = customDeck && customDeck.length > 0 ? cloneDeck(customDeck) : generate40CardDeck('Mythic');
  shuffleArray(state.players.player1.deck);
  drawCards(state, 'player1', 4);
  state.turn_start_state = JSON.stringify(state);
  return state;
}

export function joinGame(state, player2Name = 'Player 2', customDeck = null) {
  state.players.player2.name = player2Name;
  state.players.player2.deck = customDeck && customDeck.length > 0 ? cloneDeck(customDeck) : generate40CardDeck('Robot');
  shuffleArray(state.players.player2.deck);
  drawCards(state, 'player2', 5);

  const dummyCard = CARD_CATALOG.find(c => c.name === 'Target Dummy');
  const dummyUnit = new UnitInstance(dummyCard, 'player2');
  dummyUnit.line = 'mid';
  state.players.player2.lines.mid.push(dummyUnit);

  state.status = 'active';
  state.turn_start_state = JSON.stringify(state);
  return state;
}

export function generate40CardDeck(tribe) {
  const tribeCards = CARD_CATALOG.filter(c => c.tribe === tribe);
  const deck = [];
  while (deck.length < 40) {
    const randomCard = tribeCards.length > 0 
      ? tribeCards[Math.floor(Math.random() * tribeCards.length)]
      : CARD_CATALOG[Math.floor(Math.random() * CARD_CATALOG.length)];
    deck.push(new Card(randomCard));
  }
  return deck;
}

function cloneDeck(deck) {
  return deck.map(c => new Card(c));
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function playCard(state, playerId, cardId, targetLine = 'back', targetUnitId = null) {
  if (state.turnPhase !== 'ACTION_PHASE' || state.activePlayerId !== playerId) return { success: false, reason: 'Not your turn!' };

  const p = state.players[playerId];
  const cardIdx = p.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return { success: false, reason: 'Card not in hand.' };

  const card = p.hand[cardIdx];
  if (p.tents < card.cost.tents || p.tribeResource < card.cost.tribeResource) {
    return { success: false, reason: 'Insufficient resources.' };
  }

  p.tents -= card.cost.tents;
  p.tribeResource -= card.cost.tribeResource;
  p.hand.splice(cardIdx, 1);

  state.history_log.push(`🃏 ${p.name} played '${card.name}'.`);

  if (card.type === 'unit') {
    const unit = new UnitInstance(card, playerId);
    if (targetLine === 'back') {
      unit.line = 'back';
      unit.temporaryLineExpiry = state.turnNumber + 1;
      p.lines.back.push(unit);
    } else {
      unit.line = targetLine;
      p.lines[targetLine].push(unit);
    }
    executeTrigger(state, 'ON_PLAY', unit);
  } else if (card.type === 'equipment' || card.type === 'artifact') {
    if (!targetUnitId) {
      state.equator.push(card);
    } else {
      let hostUnit = null;
      for (const line of LINES) {
        const found = p.lines[line].find(u => u.instanceId === targetUnitId);
        if (found) { hostUnit = found; break; }
      }
      if (hostUnit) hostUnit.attachments.push(card);
    }
  } else if (card.type === 'spell') {
    executeTrigger(state, 'ON_PLAY', card);
    p.discard.push(card);
  }

  checkAndCleanDeaths(state);
  return { success: true };
}

// Equator equipping uniformly costs 2 Tents
export function equipFromEquator(state, playerId, itemIndex, targetUnitId) {
  if (state.turnPhase !== 'ACTION_PHASE' || state.activePlayerId !== playerId) return false;
  const item = state.equator[itemIndex];
  if (!item) return false;

  const p = state.players[playerId];
  if (p.tents < 2) return false;

  let targetUnit = null;
  for (const line of LINES) {
    const found = p.lines[line].find(u => u.instanceId === targetUnitId);
    if (found) { targetUnit = found; break; }
  }

  if (!targetUnit || targetUnit.readiness < 1) return false;

  p.tents -= 2;
  state.equator.splice(itemIndex, 1);
  targetUnit.attachments.push(item);
  targetUnit.readiness = 0;

  state.history_log.push(`🛡️ Equipped '${item.name}' from Equator to ${targetUnit.name}.`);
  return true;
}

export function useBodyguardAbility(state, playerId, targetUnitId) {
  if (state.turnPhase !== 'ACTION_PHASE' || state.activePlayerId !== playerId) return false;

  const p = state.players[playerId];
  let targetUnit = null;
  let currentLine = null;

  for (const line of LINES) {
    const found = p.lines[line].find(u => u.instanceId === targetUnitId);
    if (found) { targetUnit = found; currentLine = line; break; }
  }

  if (!targetUnit) return false;

  p.lines[currentLine] = p.lines[currentLine].filter(u => u.instanceId !== targetUnitId);
  targetUnit.line = 'bodyguard';
  p.lines.bodyguard.push(targetUnit);

  state.history_log.push(`🛡️ Avatar activated Bodyguard on ${targetUnit.name}! Unit moved to Bodyguard Line.`);
  return true;
}

// ---------------------------------------------------------------------------
// ENTITY ACTIONS & ABILITIES MENU SUPPORT
// ---------------------------------------------------------------------------

/**
 * Call this when a user clicks a Unit or Avatar on the board.
 * It returns a list of valid actions they can take (like 'Attack' or Manual Abilities).
 */
export function getEntityAvailableActions(state, playerId, entityId) {
  if (state.turnPhase !== 'ACTION_PHASE' || state.activePlayerId !== playerId) return [];
  
  const p = state.players[playerId];
  let entity = null;
  let isAvatar = false;

  // 1. Find the entity
  if (p.avatar.id === entityId) {
    entity = p.avatar;
    isAvatar = true;
  } else {
    for (const line of LINES) {
      const found = p.lines[line].find(u => u.instanceId === entityId);
      if (found) { 
        entity = found; 
        break; 
      }
    }
  }

  if (!entity) return [];

  const actions = [];

  // 2. Add 'Attack' option if it's a ready unit capable of damage
  if (!isAvatar && entity.readiness >= 1 && (entity.strength > 0)) {
    actions.push({
      actionType: 'ATTACK',
      name: 'Attack',
      requiresTarget: true,
      targetCriteria: { affiliation: 'enemy' }
    });
  }

  // 3. Add Manual Abilities
  if (entity.abilities && entity.abilities.length > 0) {
    for (const ab of entity.abilities) {
      if (ab.trigger === 'MANUAL') {
        let canAfford = true;
        
        // Check costs
        if (ab.cost) {
          if (ab.cost.readiness && entity.readiness < ab.cost.readiness) canAfford = false;
          // If the ability has a specific resource cost, ensure the player has enough of that entity's native resource
          if (ab.cost.resource && p.resources[entity.tribe] < ab.cost.resource) canAfford = false;
        }

        // Custom Avatar restriction (Bodyguard can only be used once per turn)
        if (isAvatar && ab.abilityId === 'ability_avatar_bodyguard' && p.avatar.bodyguardUsedThisTurn) {
          canAfford = false;
        }

        if (canAfford) {
          actions.push({
            actionType: 'ABILITY',
            abilityId: ab.abilityId,
            name: ab.name,
            requiresTarget: ab.targetCriteria ? true : false,
            targetCriteria: ab.targetCriteria,
            ability: ab
          });
        }
      }
    }
  }

  return actions;
}

/**
 * Executes an action chosen from the getEntityAvailableActions menu.
 */
export function executeEntityAction(state, playerId, entityId, actionType, targetLine = null, targetId = null, abilityId = null) {
  if (state.turnPhase !== 'ACTION_PHASE' || state.activePlayerId !== playerId) {
    return { success: false, reason: 'Not your turn or phase.' };
  }

  // Handle Attack
  if (actionType === 'ATTACK') {
    return resolveCombat(state, playerId, entityId, targetLine, targetId);
  }

  // Handle Manual Ability
  if (actionType === 'ABILITY') {
    const p = state.players[playerId];
    let entity = null;
    let isAvatar = false;

    // Find Entity
    if (p.avatar.id === entityId) {
      entity = p.avatar;
      isAvatar = true;
    } else {
      for (const line of LINES) {
        const found = p.lines[line].find(u => u.instanceId === entityId);
        if (found) { entity = found; break; }
      }
    }

    if (!entity) return { success: false, reason: 'Entity not found.' };

    const ability = entity.abilities.find(a => a.abilityId === abilityId);
    if (!ability || ability.trigger !== 'MANUAL') {
      return { success: false, reason: 'Invalid or non-manual ability.' };
    }

    // Deduct costs
    if (ability.cost) {
      if (ability.cost.readiness) entity.readiness -= ability.cost.readiness;
      if (ability.cost.resource) p.resources[entity.tribe] -= ability.cost.resource;
    }

    // Special override: Map the generic Bodyguard ability to the existing hardcoded engine function
    if (isAvatar && abilityId === 'ability_avatar_bodyguard') {
      p.avatar.bodyguardUsedThisTurn = true;
      const success = useBodyguardAbility(state, playerId, targetId);
      return { success, log: success ? [`Activated Bodyguard`] : [] };
    }

    // Standard target resolution for other custom abilities
    let targetEntity = null;
    if (targetId) {
       const enemyId = playerId === 'player1' ? 'player2' : 'player1';
       const searchPlayers = [p, state.players[enemyId]];
       for (const sp of searchPlayers) {
         if (sp.avatar.id === targetId) { targetEntity = sp.avatar; break; }
         for (const line of LINES) {
           const found = sp.lines[line].find(u => u.instanceId === targetId);
           if (found) { targetEntity = found; break; }
         }
         if (targetEntity) break;
       }
    }

    executeAbility(state, ability, entity, targetEntity);
    return { success: true, log: [`Activated ability: ${ability.name}`] };
  }

  return { success: false, reason: 'Unknown action type.' };
}