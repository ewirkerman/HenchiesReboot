import { jest } from '@jest/globals';
import { GameEngine } from '../../../src/engine/index.js';
import { ACTION_REGISTRY } from '../../../src/engine/actions/action_index.js';

function createPlayer() {
  return {
    resources: { Carnie: { current: 5, max: 5 } },
    lines: { avatar: [], taunt: [], bodyguard: [], front: [], mid: [], back: [], sheltered: [], sideline: [] },
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

describe('SET_STAT Action', () => {
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
      cost: 3,
      line: 'mid',
      readiness: 0,
      activeEffects: []
    };
    const state = createState();
    state.players.player1.lines.mid.push(targetEntity);
    engine = new GameEngine(state);
  });

  it('clears existing MODIFY_STAT effects for the same stat', () => {
    targetEntity.activeEffects.push({ type: 'MODIFY_STAT', stat: 'power', delta: 2 });
    targetEntity.statSources = { power: ['buff_1'] };

    new ACTION_REGISTRY.SET_STAT({ target: targetEntity, stat: 'power', amount: 10, duration: 'INSTANT' }).run(engine);

    expect(targetEntity.power).toBe(10);
    expect(targetEntity.activeEffects.some(e => e.type === 'MODIFY_STAT')).toBe(false);
    expect(targetEntity.statSources.power).toBeUndefined();
  });

  it('preserves trueOriginal when stacking multiple SET_STAT effects', () => {
    new ACTION_REGISTRY.SET_STAT({ target: targetEntity, stat: 'power', amount: 8, duration: 'TEMPORARY' }).run(engine);
    new ACTION_REGISTRY.SET_STAT({ target: targetEntity, stat: 'power', amount: 12, duration: 'TEMPORARY' }).run(engine);

    const effects = targetEntity.activeEffects.filter(e => e.type === 'SET_STAT');
    expect(effects[0].originalValue).toBe(2);
    expect(effects[1].originalValue).toBe(2); // Should reference the true baseline, not 8
    expect(targetEntity.power).toBe(12);
  });

  it('increases current health if maxHealth is set higher', () => {
    new ACTION_REGISTRY.SET_STAT({ target: targetEntity, stat: 'maxHealth', amount: 10, duration: 'INSTANT' }).run(engine);
    expect(targetEntity.maxHealth).toBe(10);
    expect(targetEntity.health).toBe(10);
  });

  it('clamps current health if maxHealth is set lower', () => {
    new ACTION_REGISTRY.SET_STAT({ target: targetEntity, stat: 'maxHealth', amount: 2, duration: 'INSTANT' }).run(engine);
    expect(targetEntity.maxHealth).toBe(2);
    expect(targetEntity.health).toBe(2);
  });

  it('prevents cost from being set below zero', () => {
    new ACTION_REGISTRY.SET_STAT({ target: targetEntity, stat: 'cost', amount: -2, duration: 'INSTANT' }).run(engine);
    expect(targetEntity.cost).toBe(0);
  });

  it('moves entity to a new zone when line is set', () => {
    new ACTION_REGISTRY.SET_STAT({ target: targetEntity, stat: 'line', amount: 'front', duration: 'INSTANT' }).run(engine);
    expect(targetEntity.line).toBe('front');
    expect(engine.state.players.player1.lines.front).toContain(targetEntity);
    expect(engine.state.players.player1.lines.mid).not.toContain(targetEntity);
  });

  it('blocks line movement if the entity is in the sideline', () => {
    targetEntity.line = 'sideline';
    engine.state.players.player1.lines.mid = [];
    engine.state.players.player1.lines.sideline.push(targetEntity);

    new ACTION_REGISTRY.SET_STAT({ target: targetEntity, stat: 'line', amount: 'front', duration: 'INSTANT' }).run(engine);

    expect(targetEntity.line).toBe('sideline');
    expect(engine.state.players.player1.lines.front).not.toContain(targetEntity);
  });

  it('allows innate SELF effects to move from any battleline to any line', () => {
    const sourceLines = ['avatar', 'taunt', 'bodyguard', 'front', 'mid', 'back', 'sheltered', 'sideline'];
    for (const fromLine of sourceLines) {
      for (const destination of ['taunt', 'bodyguard', 'avatar', 'front', 'mid', 'back', 'sheltered', 'sideline']) {
        for (const line of Object.keys(engine.state.players.player1.lines)) {
          engine.state.players.player1.lines[line] = [];
        }
        targetEntity.line = fromLine;
        engine.state.players.player1.lines[fromLine].push(targetEntity);

        new ACTION_REGISTRY.SET_STAT({
          target: targetEntity,
          stat: 'line',
          amount: destination,
          targetMethod: 'SELF',
          sourceAbilityOrigin: 'innate',
          duration: 'INSTANT'
        }).run(engine);

        expect(targetEntity.line).toBe(destination);
        expect(engine.state.players.player1.lines[destination]).toContain(targetEntity);
      }
    }
  });

  it('restricts non-innate effects from bodyguard to taunt or sideline', () => {
    targetEntity.line = 'bodyguard';
    engine.state.players.player1.lines.mid = [];
    engine.state.players.player1.lines.bodyguard.push(targetEntity);

    new ACTION_REGISTRY.SET_STAT({
      target: targetEntity,
      stat: 'line',
      amount: 'front',
      duration: 'INSTANT'
    }).run(engine);

    expect(targetEntity.line).toBe('bodyguard');
    expect(engine.state.players.player1.lines.bodyguard).toContain(targetEntity);

    new ACTION_REGISTRY.SET_STAT({
      target: targetEntity,
      stat: 'line',
      amount: 'sideline',
      duration: 'INSTANT'
    }).run(engine);

    expect(targetEntity.line).toBe('sideline');
    expect(engine.state.players.player1.lines.sideline).toContain(targetEntity);
    engine.state.players.player1.lines.sideline = [];
    targetEntity.line = 'bodyguard';
    engine.state.players.player1.lines.bodyguard.push(targetEntity);

    new ACTION_REGISTRY.SET_STAT({
      target: targetEntity,
      stat: 'line',
      amount: 'taunt',
      duration: 'INSTANT'
    }).run(engine);

    expect(targetEntity.line).toBe('taunt');
    expect(engine.state.players.player1.lines.taunt).toContain(targetEntity);
  });

  it('does not allow non-innate effects to move out of sideline', () => {
    targetEntity.line = 'sideline';
    engine.state.players.player1.lines.mid = [];
    engine.state.players.player1.lines.sideline.push(targetEntity);

    new ACTION_REGISTRY.SET_STAT({
      target: targetEntity,
      stat: 'line',
      amount: 'front',
      duration: 'INSTANT'
    }).run(engine);

    expect(targetEntity.line).toBe('sideline');
    expect(engine.state.players.player1.lines.front).not.toContain(targetEntity);
  });

  it('allows Patrol to move an innate SELF unit from sideline to taunt', () => {
    targetEntity.line = 'sideline';
    engine.state.players.player1.lines.mid = [];
    engine.state.players.player1.lines.sideline.push(targetEntity);

    new ACTION_REGISTRY.SET_STAT({
      target: targetEntity,
      stat: 'line',
      amount: 'taunt',
      targetMethod: 'SELF',
      sourceAbilityOrigin: 'innate',
      duration: 'TEMPORARY'
    }).run(engine);

    expect(targetEntity.line).toBe('taunt');
    expect(engine.state.players.player1.lines.taunt).toContain(targetEntity);
    expect(engine.state.players.player1.lines.sideline).not.toContain(targetEntity);
  });

  it('treats positive health sets as dynamic deltas for damage and cleanse', () => {
    // Set health to 15 (Target has 5. Delta is +10)
    new ACTION_REGISTRY.SET_STAT({ target: targetEntity, stat: 'health', amount: 15, duration: 'TEMPORARY' }).run(engine);
    expect(targetEntity.health).toBe(15);
    expect(targetEntity.activeEffects[0].delta).toBe(10);

    // Deal 4 damage (absorbed by the +10 delta)
    new ACTION_REGISTRY.DEAL_DAMAGE({ target: targetEntity, amount: 4 }).run(engine); //[cite: 3]
    expect(targetEntity.health).toBe(11);
    expect(targetEntity.activeEffects[0].delta).toBe(6);

    // Cleanse temporary effect
    new ACTION_REGISTRY.CLEANSE({ target: targetEntity }).run(engine); //[cite: 1]

    // Revert subtracts remaining delta (6). 11 - 6 = 5.
    expect(targetEntity.health).toBe(5);
  });
});