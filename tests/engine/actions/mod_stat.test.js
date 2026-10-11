import { jest } from '@jest/globals';
import { GameEngine } from '../../../src/engine/index.js';
import { ACTION_REGISTRY } from '../../../src/engine/actions/action_index.js';

function createPlayer() {
  return {
    resources: { Carnie: { current: 5, max: 5 } },
    lines: { front: [], mid: [], back: [], sideline: [] },
    hand: [], deck: [], discard: [], banish: []
  };
}

function createState() {
  return {
    activePlayerId: 'player1',
    history_log: [],
    players: {
      player1: createPlayer(),
      player2: createPlayer()
    }
  };
}

describe('MODIFY_STAT Action', () => {
  let engine;
  let targetEntity;

  beforeEach(() => {
    targetEntity = {
      instanceId: 'target_1',
      ownerId: 'player1',
      name: 'Test Unit',
      type: 'unit',
      power: 2,
      health: 5,
      maxHealth: 5,
      strength: 2,
      cost: 3,
      readiness: 0,
      activeEffects: []
    };
    const state = createState();
    state.players.player1.lines.mid.push(targetEntity);
    engine = new GameEngine(state);
  });

  it('returns early if target, stat, or amount are missing/zero', () => {
    const payload = { target: targetEntity, stat: 'power', amount: 0, duration: 'INSTANT' };
    new ACTION_REGISTRY.MODIFY_STAT(payload).run(engine);
    expect(targetEntity.power).toBe(2);
  });

  it('does not modify strength if the target has no base strength', () => {
    targetEntity.strength = null;
    new ACTION_REGISTRY.MODIFY_STAT({ target: targetEntity, stat: 'strength', amount: 2, duration: 'INSTANT' }).run(engine);
    expect(targetEntity.strength).toBeNull(); //[cite: 2]
  });

  it('increases current health when maxHealth is increased', () => {
    new ACTION_REGISTRY.MODIFY_STAT({ target: targetEntity, stat: 'maxHealth', amount: 3, duration: 'INSTANT' }).run(engine);
    expect(targetEntity.maxHealth).toBe(8);
    expect(targetEntity.health).toBe(8); //[cite: 2]
  });

  it('clamps current health when maxHealth is decreased below current health', () => {
    new ACTION_REGISTRY.MODIFY_STAT({ target: targetEntity, stat: 'maxHealth', amount: -2, duration: 'INSTANT' }).run(engine);
    expect(targetEntity.maxHealth).toBe(3);
    expect(targetEntity.health).toBe(3); //[cite: 2]
  });

  it('prevents cost from dropping below zero', () => {
    new ACTION_REGISTRY.MODIFY_STAT({ target: targetEntity, stat: 'cost', amount: -5, duration: 'INSTANT' }).run(engine);
    expect(targetEntity.cost).toBe(0); //[cite: 2]
  });

  it('prevents readiness from dropping below -1', () => {
    new ACTION_REGISTRY.MODIFY_STAT({ target: targetEntity, stat: 'readiness', amount: -3, duration: 'INSTANT' }).run(engine);
    expect(targetEntity.readiness).toBe(-1); //[cite: 2]
  });

  it('consumes temp health from DealDamage and correctly restores underlying health on Cleanse', () => {
    // Grant +5 temp health
    new ACTION_REGISTRY.MODIFY_STAT({ target: targetEntity, stat: 'health', amount: 5, duration: 'TEMPORARY' }).run(engine);
    expect(targetEntity.health).toBe(10);

    // Deal 3 damage (absorbed by the +5 delta)
    new ACTION_REGISTRY.DEAL_DAMAGE({ target: targetEntity, amount: 3 }).run(engine);
    expect(targetEntity.health).toBe(7); //[cite: 3]

    // Cleanse temporary effect
    new ACTION_REGISTRY.CLEANSE({ target: targetEntity }).run(engine); //[cite: 1]

    // Original health was 5. Delta was 5. Took 3 damage -> delta is 2. 
    // Revert subtracts remaining delta (2). 7 - 2 = 5.
    expect(targetEntity.health).toBe(5);
  });
});