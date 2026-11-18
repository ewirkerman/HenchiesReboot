import { CARD_TYPES } from '../../src/engine/card_types.js';
import { toggleStatFields } from '../../src/studio/card/form.js';
import { CardState } from '../../src/studio/card/state.js';

describe('Card editor genus field', () => {
  const fieldContainerIds = [
    'stat-health-container',
    'stat-strength-container',
    'stat-power-container',
    'stat-line-container',
    'stat-family-container',
    'stat-cost-container',
    'stat-genus-container'
  ];

  beforeEach(() => {
    const elements = new Map();
    const makeField = (id) => ({
      id,
      value: '',
      disabled: false,
      classList: { add() {}, remove() {} },
      querySelector() { return null; }
    });

    elements.set('card-type', makeField('card-type'));
    elements.set('card-health', makeField('card-health'));
    fieldContainerIds.forEach((id) => {
      const input = makeField(`${id}-input`);
      elements.set(id, {
        classList: { add() {}, remove() {} },
        querySelector() { return input; }
      });
    });

    document.getElementById = (id) => elements.get(id) || null;
    CardState.allAbilities = [];
    CardState.currentAbilities = [];
  });

  test.each(Object.entries(CARD_TYPES))('%s genus is enabled unless the type is avatar', (_key, type) => {
    document.getElementById('card-type').value = type;

    toggleStatFields();

    expect(document.getElementById('stat-genus-container').querySelector().disabled)
      .toBe(type === CARD_TYPES.AVATAR);
  });
});
