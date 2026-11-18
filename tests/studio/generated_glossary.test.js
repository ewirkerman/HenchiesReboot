import { extractGlossary } from '../../src/ui.js';
import { formatCardText } from '../../components/game_card.js';
import { formatAbilityDescription } from '../../src/ability_descriptions.js';

describe('generated glossary ability references', () => {
  const registry = [
    { abilityId: 'root', name: 'Root', description: 'gain @[ability_second]' },
    { abilityId: 'ability_first', name: 'Shared Name' },
    { abilityId: 'ability_second', name: 'Shared Name' }
  ];

  test('resolves description mentions by ability ID when names are duplicated', () => {
    const glossary = extractGlossary([registry[0]], registry);

    expect(glossary.map(ability => ability.abilityId)).toContain('ability_second');
    expect(glossary.map(ability => ability.abilityId)).not.toContain('ability_first');
  });

  test('does not resolve a name-only mention', () => {
    const glossary = extractGlossary(
      [{ abilityId: 'root', name: 'Root', description: '@[Shared Name]' }],
      registry
    );

    expect(glossary.map(ability => ability.abilityId)).not.toContain('ability_first');
    expect(glossary.map(ability => ability.abilityId)).not.toContain('ability_second');
  });

  test('renders ID-based mentions with the referenced ability name', () => {
    const text = formatCardText('Gain @[ability_second].', registry);

    expect(text).toContain('Gain <span');
    expect(text).toContain('>Shared Name</span>.');
  });

  test('uses the same capitalization and mention rendering in the glossary', () => {
    const text = formatAbilityDescription(
      { description: 'gain @[ability_second].' },
      registry
    );

    expect(text).toContain('Gain <span');
    expect(text).toContain('>Shared Name</span>.');
  });
});
