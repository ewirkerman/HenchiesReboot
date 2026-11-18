import { parseTriggerToComposite, populateBaseTriggers, renderAdditionalTriggers } from '../../src/studio/ability/triggers.js';
import { StudioState } from '../../src/studio/ability/state.js';

describe('Game Starting ability trigger', () => {
    let elements;

    beforeEach(() => {
        elements = {
            'ab-base-trigger': { innerHTML: '' },
            'additional-triggers-container': { innerHTML: '' }
        };
        globalThis.document.getElementById = id => elements[id] || null;
        StudioState.additionalTriggers = ['GAME_STARTING'];
    });

    it('is available as a base and additional trigger and parses as a lifecycle trigger', () => {
        populateBaseTriggers();
        renderAdditionalTriggers();

        expect(elements['ab-base-trigger'].innerHTML).toContain('<option value="GAME_STARTING">Game Starting</option>');
        expect(elements['additional-triggers-container'].innerHTML).toContain('<option value="GAME_STARTING" selected>Game Starting</option>');
        expect(parseTriggerToComposite('GAME_STARTING')).toEqual({
            base: 'GAME_STARTING',
            phase: 'ON',
            role: 'ACTIVE'
        });
    });
});
