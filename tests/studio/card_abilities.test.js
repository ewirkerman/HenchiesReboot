import { jest } from '@jest/globals';
import { CardState } from '../../src/studio/card/state.js';
import { renderReferencedAbilities } from '../../src/studio/card/abilities.js';

describe('renderReferencedAbilities', () => {
  beforeEach(() => {
    const container = {
      classList: {
        add: jest.fn(),
        remove: jest.fn()
      }
    };
    const list = { innerHTML: '' };
    globalThis.document = {
      getElementById(id) {
        return id === 'referenced-abilities-container' ? container : list;
      }
    };
    globalThis.window = {};

    CardState.allAbilitiesRegistry = [
      { abilityId: 'root', name: 'Root', description: '@[duplicate-id]' },
      { abilityId: 'duplicate-id', name: 'Duplicate', description: '' },
      { abilityId: 'other-id', name: 'Duplicate', description: '' }
    ];
    CardState.currentAbilities = [{ id: 'root' }];
  });

  afterEach(() => {
    CardState.allAbilitiesRegistry = [];
    CardState.currentAbilities = [];
    delete globalThis.document;
    delete globalThis.window;
  });

  test('matches referenced abilities by ID even when names are duplicated', () => {
    renderReferencedAbilities();

    const list = document.getElementById('referenced-abilities-list');
    expect(list.innerHTML).toContain("copyAbilityJSON('duplicate-id')");
    expect(list.innerHTML).not.toContain("copyAbilityJSON('other-id')");
  });

  test('does not resolve a name-only mention to a duplicate ability', () => {
    CardState.allAbilitiesRegistry[0].description = '@[Duplicate]';

    renderReferencedAbilities();

    const container = document.getElementById('referenced-abilities-container');
    expect(container.classList.add).toHaveBeenCalledWith('hidden');
  });

  test('tracks abilities referenced by UPDATE_ABILITY_LEVEL actions', () => {
    CardState.allAbilitiesRegistry[0].description = '';
    CardState.allAbilitiesRegistry[0].effects = [{
      payloads: [{ type: 'UPDATE_ABILITY_LEVEL', abilityId: 'duplicate-id' }]
    }];

    renderReferencedAbilities();

    const list = document.getElementById('referenced-abilities-list');
    expect(list.innerHTML).toContain("copyAbilityJSON('duplicate-id')");
    expect(list.innerHTML).not.toContain("copyAbilityJSON('other-id')");
  });
});
