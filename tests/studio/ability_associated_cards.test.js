import { jest } from '@jest/globals';
import { StudioState } from '../../src/studio/ability/state.js';

jest.unstable_mockModule('../../src/testing.js', () => ({
  launchSandboxMatch: jest.fn()
}));

const { launchSandboxMatch } = await import('../../src/testing.js');
const { renderAssociatedCards, launchTestMatch, getAbilityTestTarget } = await import('../../src/studio/ability/catalog_sync.js');

describe('renderAssociatedCards', () => {
  beforeEach(() => {
    const elements = {
      'associated-cards-list': { innerHTML: '' },
      'associated-cards-count': { innerText: '0' }
    };
    globalThis.document = {
      getElementById: jest.fn(id => elements[id] || null),
      querySelectorAll: jest.fn(() => [])
    };
    globalThis.window = {};
    launchSandboxMatch.mockClear();

    StudioState.currentEditingId = 'ability_target';
    StudioState.allAbilities = [
      { abilityId: 'ability_target', name: 'Shared' },
      { abilityId: 'ability_by_description', name: 'Uses Target', description: '@[ability_target]' },
      {
        abilityId: 'ability_by_effect',
        name: 'Grants Target',
        effects: [{ payloads: [{ type: 'GRANT_ABILITY', grantedAbilityId: 'ability_target' }] }]
      },
      {
        abilityId: 'ability_by_update_effect',
        name: 'Updates Target',
        effects: [{ payloads: [{ type: 'UPDATE_ABILITY_LEVEL', abilityId: 'ability_target' }] }]
      },
      { abilityId: 'ability_by_name', name: 'Name Only', description: '@[Shared]' }
    ];
    StudioState.allCards = [
      { id: 'card_by_description', name: 'Description Card', abilities: ['ability_by_description'] },
      { id: 'card_by_effect', name: 'Effect Card', abilities: [{ id: 'ability_by_effect' }] },
      { id: 'card_by_update_effect', name: 'Update Effect Card', abilities: ['ability_by_update_effect'] },
      { id: 'card_by_name', name: 'Name Card', abilities: [{ name: 'Shared' }] },
      { id: 'card_by_name_reference', name: 'Name Reference Card', abilities: ['ability_by_name'] }
    ];
    StudioState.customTribesList = [];
  });

  afterEach(() => {
    StudioState.currentEditingId = null;
    StudioState.allAbilities = [];
    StudioState.allCards = [];
    StudioState.customTribesList = [];
    delete globalThis.document;
    delete globalThis.window;
  });

  test('uses ability IDs for description, effect, and card associations', () => {
    renderAssociatedCards();

    const html = document.getElementById('associated-cards-list').innerHTML;
    expect(html).toContain('#card_by_description');
    expect(html).toContain('#card_by_effect');
    expect(html).toContain('#card_by_update_effect');
    expect(html).not.toContain('#card_by_name');
    expect(html).not.toContain('#card_by_name_reference');
    expect(document.getElementById('associated-cards-count').innerText).toBe(3);
  });

  test('tests the first associated unit instead of adding the ability to a dummy', async () => {
    const firstUnit = { id: 'first_unit', name: 'Gustodian', type: 'unit', abilities: ['ability_by_description'] };
    StudioState.allCards = [
      { id: 'associated_spell', type: 'spell', abilities: ['ability_target'] },
      firstUnit,
      { id: 'second_unit', type: 'unit', abilities: [{ abilityId: 'ability_by_effect' }] }
    ];

    await launchTestMatch();

    expect(launchSandboxMatch).toHaveBeenCalledWith(firstUnit, 'card');
    expect(getAbilityTestTarget({ abilityId: 'ability_target' })).toEqual({
      item: firstUnit,
      type: 'card'
    });
  });

  test('falls back to testing the ability with a dummy when no associated unit exists', async () => {
    StudioState.allCards = [
      { id: 'associated_spell', type: 'spell', abilities: ['ability_target'] }
    ];

    await launchTestMatch();

    expect(launchSandboxMatch).toHaveBeenCalledWith(
      expect.objectContaining({ abilityId: 'ability_target' }),
      'ability'
    );
  });
});
