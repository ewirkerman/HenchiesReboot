import { GameEngine } from '../../../src/engine/index.js';
import { createTestState } from '../../test_utils.js';

describe('CustomScriptAction history log', () => {
  it('restores push without leaving the game state uncloneable', () => {
    const state = createTestState();
    const engine = new GameEngine(state);
    const source = { instanceId: 'script-source', ownerId: 'player1', readiness: 1 };
    const ability = {
      abilityId: 'test-script',
      name: 'Test Script',
      trigger: 'UNTRIGGERABLE',
      cost: {
        tribeAmount: 0,
        carnie: 0,
        power: 0,
        readinessCost: 'NONE',
        escalates: false,
        reuseIgnoresReadiness: false,
        freeAction: true
      },
      effects: [{
        targetMethod: 'SELF',
        payloads: [{
          type: 'CUSTOM_SCRIPT',
          script: "state.history_log.push('script message');"
        }]
      }]
    };

    engine._resolvePayloads(ability, source, {}, 'player1', [[source]], null);

    expect(state.history_log.at(-1)).toEqual({ text: 'script message', depth: 0 });
    expect(Object.prototype.hasOwnProperty.call(state.history_log, 'push')).toBe(false);
    expect(() => structuredClone(state)).not.toThrow();
  });
});