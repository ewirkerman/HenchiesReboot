import { buildCardState } from '../../src/studio/card/form.js';
import { getCurrentAbilityState } from '../../src/studio/ability/catalog_sync.js';

describe('Creator studio developer notes', () => {
  beforeEach(() => {
    const ids = [
      'card-name', 'card-tribe', 'card-type', 'card-default-line', 'card-genus', 'card-family',
      'card-cost', 'card-power', 'card-health', 'card-strength', 'card-description', 'card-art',
      'card-art-x', 'card-art-y', 'card-art-scale', 'card-nano-art-x', 'card-nano-art-y',
      'card-nano-art-scale', 'card-developer-notes', 'card-hide-from-deckbuilder', 'card-series',
      'ab-name', 'ab-is-keyword', 'ab-description', 'ab-trigger', 'ab-base-trigger',
      'ab-trigger-phase', 'ab-trigger-role', 'ab-trigger-scope', 'ab-trigger-limit', 'ab-cost-tribe-amt',
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

    elMap['card-name'].value = 'Test Card';
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
    elMap['ab-is-keyword'].checked = false;
    elMap['ab-description'].value = 'Ability text';
    elMap['ab-trigger'].value = 'MANUAL';
    elMap['ab-base-trigger'].value = 'MANUAL';
    elMap['ab-trigger-phase'].value = 'ON';
    elMap['ab-trigger-role'].value = 'ACTIVE';
    elMap['ab-trigger-scope'].value = 'PERSONAL';
    elMap['ab-trigger-limit'].value = 'UNLIMITED';
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

  test('ability state includes developer notes in the studio export', () => {
    const state = getCurrentAbilityState();
    expect(state.developerNotes).toBe('Ability dev notes');
  });
});
