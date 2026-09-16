import { jest } from '@jest/globals';

// 1. In ESM, we must mock BEFORE importing, using the unstable_mockModule API
jest.unstable_mockModule('../../src/engine/index.js', () => ({
    canPlayCard: jest.fn(),
    getEntityAvailableActions: jest.fn(),
    playCard: jest.fn(),
    executeEntityAction: jest.fn(),
    endTurn: jest.fn(),
    executeSacrificeDecision: jest.fn(),
    getValidAbilityTargets: jest.fn(),
    getValidAttackTargets: jest.fn(),
    LINES: ['taunt', 'bodyguard', 'avatar', 'front', 'mid', 'back', 'sheltered', 'sideline'],
    isUndoable: jest.fn(),
    GameEngine: jest.fn(),
    startTurn: jest.fn()
}));

// 2. Mock UI and Network dependencies to prevent crashes
jest.unstable_mockModule('../../src/tabletop/client_state.js', () => ({ ClientState: {} }));
jest.unstable_mockModule('../../src/tabletop/renderer.js', () => ({ updateUI: jest.fn() }));
jest.unstable_mockModule('../../src/firebase.js', () => ({ pushActionToLog: jest.fn() }));
jest.unstable_mockModule('../../src/ui.js', () => ({ showToast: jest.fn() }));
jest.unstable_mockModule('../../src/tabletop/multiplayer.js', () => ({ reconstructStateFromLog: jest.fn() }));
jest.unstable_mockModule('../../src/ai/random.js', () => ({ RandomAI: class {} }));
jest.unstable_mockModule('../../src/ai/pass.js', () => ({ PassAI: class {} }));

describe('Interactions - Card Play Affordability & Cost Enforcement', () => {
    let mockState;
    let interactionsModule;
    let engineModule;

    beforeAll(async () => {
        interactionsModule = await import('../../src/tabletop/interactions.js');
        engineModule = await import('../../src/engine/index.js');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockState = { status: 'active' };
    });

    test('getCardPlayState blocks play immediately if base card cost (canPlayCard) fails', () => {
        const expensiveCard = { id: 'expensive_dragon', cost: 10, instanceId: 'inst_1' };
        
        engineModule.canPlayCard.mockReturnValue({ success: false, reason: 'Not enough Carnie' });
        
        const result = interactionsModule.getCardPlayState('inst_1', expensiveCard);
        
        expect(result.playable).toBe(false);
        expect(result.reason).toBe('Not enough Carnie');
        expect(engineModule.getEntityAvailableActions).not.toHaveBeenCalled();
    });

    test('getCardPlayState blocks play if affordable but has no valid actions (e.g. missing targets)', () => {
        const spellCard = { id: 'spell_smite', cost: 2, instanceId: 'inst_2' };
        
        engineModule.canPlayCard.mockReturnValue({ success: true });
        engineModule.getEntityAvailableActions.mockReturnValue([]);
        
        const result = interactionsModule.getCardPlayState('inst_2', spellCard);
        
        expect(result.playable).toBe(false);
        expect(result.reason).toBe('No valid targets available.');
    });

    test('getCardPlayState allows play if base cost is affordable AND actions are available', () => {
        const unitCard = { id: 'standard_unit', cost: 1, instanceId: 'inst_3' };
        
        engineModule.canPlayCard.mockReturnValue({ success: true });
        engineModule.getEntityAvailableActions.mockReturnValue([{ type: 'PLAY', abilityId: 'native_play' }]);
        
        const result = interactionsModule.getCardPlayState('inst_3', unitCard);
        
        expect(result.playable).toBe(true);
    });
});