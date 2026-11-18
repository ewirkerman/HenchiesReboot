import { computeAbilitiesData, formatAbilityCostBadge, formatCardText, GameCard } from '../components/game_card.js';
import { resolveAssetUrl } from '../src/asset_paths.js';
import { getIconSvg } from '../src/glossary.js';

// The beforeAll block has been removed, as tests/setup.js handles global DOM mocking now.

describe('Resource Rendering', () => {
    test('asset URLs resolve against the application root', () => {
        expect(resolveAssetUrl('./assets/undead/consume.png', '/')).toBe('/assets/undead/consume.png');
        expect(resolveAssetUrl('./assets/undead/consume.png', '/HenchiesReboot/')).toBe('/HenchiesReboot/assets/undead/consume.png');
        expect(resolveAssetUrl('/HenchiesReboot/assets/undead/consume.png', '/HenchiesReboot/')).toBe('/HenchiesReboot/assets/undead/consume.png');
        expect(resolveAssetUrl('https://example.com/consume.png', '/HenchiesReboot/')).toBe('https://example.com/consume.png');
    });

    test('ability cost badges use shared resource token rendering', () => {
        globalThis.window.ClientState.customTribesList = [{ id: 'pirate', name: 'Pirate', iconSvg: '<svg id="pirate-icon"></svg>' }];
        const badge = formatAbilityCostBadge({ carnie: 2, tribeAmount: 1, tribeType: 'Pirate' }, 'Carnie');

        expect(badge).toMatch(/<svg/);
        expect(badge).toMatch(/pirate-icon/);
        expect(badge).not.toMatch(/\[RESOURCE:tribe_pirate\]/);
        expect(badge).not.toMatch(/>P<\/span>/);
        expect(badge.indexOf(getIconSvg('power'))).toBeLessThan(badge.indexOf('pirate-icon'));
        expect(badge.indexOf('pirate-icon')).toBeLessThan(badge.indexOf(getIconSvg('tent')));
    });

    test('ability power costs use the shared stat token rendering', () => {
        const badge = formatAbilityCostBadge({ power: 3 });
        const description = formatCardText('Pay 3[STAT:power].');

        expect(badge).not.toMatch(/\[STAT:power\]/);
        expect(badge).toContain(getIconSvg('power'));
        expect(description).toContain(getIconSvg('power'));
    });

    test('cost modifiers use the gray cost badge fill regardless of duration', () => {
        const gameCard = new GameCard();
        const styleContext = { style: { border: 'border-black' }, hexBorder: '' };
        const cardState = { isToken: false, hasReadiness: false };
        const getCostClass = duration => gameCard._computeVisualClasses({
            activeEffects: [{ type: 'MODIFY_STAT', stat: 'cost', duration }]
        }, {}, styleContext, cardState).costClass;

        expect(getCostClass('PERMANENT')).toContain('stat-cost-modified');
        expect(getCostClass('INDEFINITE')).toContain('stat-cost-modified');
        expect(getCostClass('WHILE_ATTACHED')).toContain('stat-cost-modified');
        expect(getCostClass('TEMPORARY')).toContain('stat-cost-modified');
    });

    test('card text resource tokens render through the same replacement pipeline', () => {
        const html = formatCardText('gain [RESOURCE:tent] and [RESOURCE:maxCarnie].');
        expect(html).not.toMatch(/\[RESOURCE:tent\]/);
        expect(html).toMatch(/<svg/);
    });

    test('card text resource tokens degrade gracefully when fed unknown keys (Negative Case)', () => {
        const html = formatCardText('gain [RESOURCE:made_up_garbage].');

        // It shouldn't crash, and it should just leave the raw token or strip it cleanly 
        // depending on your implementation, but it definitely shouldn't output a broken SVG
        expect(html).not.toMatch(/<svg id="undefined"/);
    });

    test('HOST-scoped trigger names include the host scope', () => {
        const abilities = computeAbilitiesData({
            type: 'equipment',
            abilities: [{
                trigger: 'ON_BE_TRASHED',
                triggerScope: 'HOST',
                description: 'Summon a unit.'
            }]
        }, {});

        expect(abilities.bespoke[0].event).toBe('HOST Trashed');
        expect(abilities.bespoke[0].formattedDesc).toContain('HOST Trashed:');
    });

    test.each([
        ['TURN_STARTING', 'GLOBAL', 'ANY Starting'],
        ['TURN_ENDED', 'GLOBAL', 'ANY Ended'],
        ['TURN_STARTING', 'PERSONAL', 'OWN Starting'],
        ['OWN_TURN_STARTED', 'PERSONAL', 'OWN Started'],
        ['OPP_TURN_STARTING', 'PERSONAL', 'OPP Starting']
    ])('distinguishes %s turn triggers with %s scope', (trigger, triggerScope, expectedEvent) => {
        const abilities = computeAbilitiesData({
            type: 'unit',
            abilities: [{ trigger, triggerScope, description: 'Draw a card.' }]
        }, {});

        expect(abilities.bespoke[0].event).toBe(expectedEvent);
        expect(abilities.bespoke[0].formattedDesc).toContain(`${expectedEvent}:`);
    });
});