import { formatAbilityCostBadge, formatCardText } from '../components/game_card.js';

// The beforeAll block has been removed, as tests/setup.js handles global DOM mocking now.

describe('Resource Rendering', () => {
    test('ability cost badges use shared resource token rendering', () => {
        globalThis.window.ClientState.customTribesList = [{ id: 'pirate', name: 'Pirate', iconSvg: '<svg id="pirate-icon"></svg>' }];
        const badge = formatAbilityCostBadge({ carnie: 2, tribeAmount: 1, tribeType: 'Pirate' }, 'Carnie');

        expect(badge).toMatch(/text-\[14px\]/);
        expect(badge).toMatch(/w-\[1\.35em\]/);
        expect(badge).toMatch(/<svg/);
        expect(badge).toMatch(/pirate-icon/);
        expect(badge).not.toMatch(/\[RESOURCE:tribe_pirate\]/);
        expect(badge).not.toMatch(/>P<\/span>/);
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
});