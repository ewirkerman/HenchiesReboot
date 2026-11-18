import { buildCardState } from '../../src/studio/card/form.js';
import { CardState } from '../../src/studio/card/state.js';
import { loadCard } from '../../src/studio/card/catalog_sync.js';
import { getCurrentAbilityState } from '../../src/studio/ability/catalog_sync.js';
import { getEditorDisplayName } from '../../src/studio/editor_names.js';

describe('Creator studio developer notes', () => {
  beforeEach(() => {
    const ids = [
      'card-name', 'card-name-suffix', 'card-tribe', 'card-type', 'card-default-line', 'card-genus', 'card-family',
      'card-cost', 'card-power', 'card-health', 'card-strength', 'card-description', 'card-art',
      'card-art-x', 'card-art-y', 'card-art-scale', 'card-nano-art-x', 'card-nano-art-y',
      'card-nano-art-scale', 'card-developer-notes', 'card-hide-from-deckbuilder', 'card-series',
      'assigned-abilities', 'referenced-abilities-container', 'referenced-abilities-list',
      'ab-name', 'ab-name-suffix', 'ab-is-keyword', 'ab-description', 'ab-trigger', 'ab-base-trigger',
      'ab-trigger-phase', 'ab-trigger-role', 'ab-trigger-scope', 'ab-trigger-limit', 'ab-cooldown-group', 'ab-cost-tribe-amt',
      'ab-cost-tent', 'ab-cost-power', 'ab-cost-readiness', 'ab-cost-escalates', 'ab-cost-reuse-exempt',
      'ab-cost-free-action', 'ab-act-method', 'ab-developer-notes'
    ];

    const elMap = {};
    ids.forEach((id) => {
      const el = {
        id,
        value: '',
        checked: false,
        classList: { add() {}, remove() {}, toggle() {} },
        querySelector() { return null; },
        disabled: false,
        innerHTML: '',
        style: {},
        dataset: {}
      };
      elMap[id] = el;
    });

    const getById = (id) => elMap[id] || null;
    globalThis.document = {
      getElementById: getById,
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: () => ({
        classList: { add() {}, remove() {}, toggle() {} },
        setAttribute() {},
        appendChild() {},
        style: {},
        innerHTML: '',
        value: '',
        dataset: {},
        getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; }
      }),
      body: { appendChild() {}, style: {} },
      head: { appendChild() {} },
      addEventListener() {}
    };
    globalThis.window.location = { hash: '' };
    CardState.allCards = [];
    CardState.allAbilities = [];
    CardState.allAbilitiesRegistry = [];
    CardState.customTribes = [];
    CardState.currentAbilities = [];

    elMap['card-name'].value = 'Test Card';
    elMap['card-name-suffix'].value = '(Alt)';
    elMap['card-tribe'].value = 'tribe_1';
    elMap['card-type'].value = 'unit';
    elMap['card-default-line'].value = 'mid';
    elMap['card-cost'].value = '2';
    elMap['card-power'].value = '3';
    elMap['card-health'].value = '4';
    elMap['card-strength'].value = '5';
    elMap['card-description'].value = 'Flavor';
    elMap['card-art'].value = 'https://example.com/card.png';
    elMap['card-art-x'].value = '10';
    elMap['card-art-y'].value = '20';
    elMap['card-art-scale'].value = '90';
    elMap['card-nano-art-x'].value = '5';
    elMap['card-nano-art-y'].value = '6';
    elMap['card-nano-art-scale'].value = '100';
    elMap['card-series'].value = 'Base Set';
    elMap['card-developer-notes'].value = 'Internal play notes';

    elMap['ab-name'].value = 'Test Ability';
    elMap['ab-name-suffix'].value = '(Alt)';
    elMap['ab-is-keyword'].checked = false;
    elMap['ab-description'].value = 'Ability text';
    elMap['ab-trigger'].value = 'MANUAL';
    elMap['ab-base-trigger'].value = 'MANUAL';
    elMap['ab-trigger-phase'].value = 'ON';
    elMap['ab-trigger-role'].value = 'ACTIVE';
    elMap['ab-trigger-scope'].value = 'PERSONAL';
    elMap['ab-trigger-limit'].value = 'UNLIMITED';
    elMap['ab-cooldown-group'].value = '';
    elMap['ab-cost-tribe-amt'].value = '1';
    elMap['ab-cost-tent'].value = '2';
    elMap['ab-cost-power'].value = '3';
    elMap['ab-cost-readiness'].value = 'NONE';
    elMap['ab-cost-escalates'].checked = false;
    elMap['ab-cost-reuse-exempt'].checked = false;
    elMap['ab-cost-free-action'].checked = false;
    elMap['ab-act-method'].value = 'NONE';
    elMap['ab-developer-notes'].value = 'Ability dev notes';
  });

  test('card state includes developer notes in the studio export', () => {
    const state = buildCardState();
    expect(state.developerNotes).toBe('Internal play notes');
  });

  test('custom tribes are saved on cards by tribe name', () => {
    CardState.customTribes = [{ id: 'tribe_123', name: 'Moon Clan', isDefault: false }];
    document.getElementById('card-tribe').value = 'tribe_123';

    expect(buildCardState().tribe).toBe('Moon Clan');
  });

  test('legacy tribe IDs load unchanged and migrate to names when the card is saved', () => {
    const legacyCard = {
      id: 'legacy-card',
      name: 'Legacy Card',
      tribe: 'tribe_123',
      type: 'spell'
    };
    CardState.allCards = [legacyCard];
    CardState.customTribes = [{ id: 'tribe_123', name: 'Moon Clan', isDefault: false }];

    loadCard(legacyCard.id);

    expect(document.getElementById('card-tribe').value).toBe('tribe_123');
    expect(legacyCard.tribe).toBe('tribe_123');
    expect(buildCardState().tribe).toBe('Moon Clan');
  });

  test('default tribes keep their existing card tribe value', () => {
    CardState.customTribes = [{ id: 'tribe_robot', name: 'Robot', isDefault: true }];
    document.getElementById('card-tribe').value = 'tribe_robot';

    expect(buildCardState().tribe).toBe('tribe_robot');
  });

  test('spell cards preserve an assigned genus', () => {
    document.getElementById('card-type').value = 'spell';
    document.getElementById('card-genus').value = 'Elemental';

    expect(buildCardState().genus).toBe('Elemental');
  });

  test('card suffix is editor-only and does not change the card name', () => {
    const state = buildCardState();
    expect(state.name).toBe('Test Card');
    expect(state.editorNameSuffix).toBe('(Alt)');
  });

  test('ability state includes developer notes in the studio export', () => {
    const state = getCurrentAbilityState();
    expect(state.developerNotes).toBe('Ability dev notes');
    expect(state.cooldownGroup).toBeNull();
  });

  test('ability suffix is editor-only and does not change the ability name', () => {
    const state = getCurrentAbilityState();
    expect(state.name).toBe('Test Ability');
    expect(state.editorNameSuffix).toBe('(Alt)');
  });

  test('editor display names append the optional suffix', () => {
    expect(getEditorDisplayName({ name: 'Test Card', editorNameSuffix: '(Alt)' })).toBe('Test Card (Alt)');
    expect(getEditorDisplayName({ name: 'Test Card' })).toBe('Test Card');
  });

  test.each(['Unique', 'Unique+'])('ability state exports the %s cooldown group override', (cooldownGroup) => {
    document.getElementById('ab-cooldown-group').value = cooldownGroup;
    expect(getCurrentAbilityState().cooldownGroup).toBe(cooldownGroup);
  });
});
