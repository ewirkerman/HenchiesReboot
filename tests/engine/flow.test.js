import { jest } from '@jest/globals';
import * as actualUtils from '../../src/engine/utils.js';

jest.unstable_mockModule('../../src/engine/index.js', () => ({
    GameEngine: class MockEngine {
        constructor() { this.emit = jest.fn(); }
    }
}));

jest.unstable_mockModule('../../src/engine/utils.js', () => ({
    ...actualUtils,
    getAvatar: jest.fn((state, pId) => ({ id: `avatar_${pId}`, type: 'avatar' })),
    resolveResourceKey: jest.fn((state, p, tribe) => tribe === 'TribeX' ? 'TribeX' : 'Carnie'),
    hasEngineFlag: jest.fn((state, entity, flag) => {
        if (entity.id === 'unique_card' && flag === 'UNIQUE_ENTITY') return true;
        return actualUtils.hasEngineFlag(state, entity, flag);
    })
}));

jest.unstable_mockModule('../../src/engine/actions/index.js', () => ({
    HarvestAction: class { run = jest.fn(); },
    PlayAction: class { run = jest.fn(); },
    sweepTurnEffects: jest.fn(),
    ACTION_REGISTRY: {},
    ACTION_MANIFEST: {},
    findEntityLocation: jest.fn(() => ({ zone: 'mid' }))
}));

jest.unstable_mockModule('../../src/engine/prandom.js', () => ({
    generateId: jest.fn(() => 'mock_id'),
    shuffleArray: jest.fn((state, arr) => arr)
}));

describe('flow.js core mechanics', () => {
    let mockState;
    let flow;

    beforeAll(async () => {
        flow = await import('../../src/engine/flow.js');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockState = {
            activePlayerId: 'player1',
            turnNumber: 1,
            turnPhase: 'ACTION_PHASE',
            history_log: [],
            players: {
                player1: {
                    name: 'Player 1',
                    setupComplete: true,
                    lines: { front: [], mid: [], back: [] },
                    hand: [], deck: [{ id: 'd1' }, { id: 'd2' }], discard: [],
                    resources: { 'Carnie': { current: 3, max: 3 }, 'TribeX': { current: 1, max: 1 } }
                },
                player2: {
                    name: 'Player 2',
                    setupComplete: true,
                    lines: { front: [], mid: [], back: [] },
                    hand: [], deck: [], discard: [],
                    resources: { 'Carnie': { current: 3, max: 3 } }
                }
            },
            equator: []
        };
    });

    describe('Turn Progression (startTurn & endTurn)', () => {
        it('endTurn should increment turn number when returning to player1 and swap active player', () => {
            mockState.activePlayerId = 'player2';
            mockState.turnNumber = 1;
            
            flow.endTurn(mockState);
            
            expect(mockState.activePlayerId).toBe('player1');
            expect(mockState.turnNumber).toBe(2);
            expect(mockState.turnPhase).toBe('SACRIFICE_DECISION');
        });

        it('startTurn should replenish readiness and acts for field entities', () => {
            const tiredUnit = { id: 'u1', ownerId: 'player1', readiness: -1, acts: 0, maxActs: 2 };
            mockState.players.player1.lines.mid.push(tiredUnit);
            
            flow.startTurn(mockState, null);
            
            expect(tiredUnit.readiness).toBe(0);
            expect(tiredUnit.acts).toBe(2);
        });
    });

    describe('Card Play Constraints (canPlayCard & playCard)', () => {
        it('should block play if UNIQUE_ENTITY flag is present and card already exists on board', () => {
            const uniqueCard = { id: 'unique_card', name: 'The One', cost: 1, tribe: 'Carnie' };
            mockState.players.player1.hand.push(uniqueCard);
            mockState.players.player1.lines.mid.push({ id: 'unique_card', name: 'The One' });

            const result = flow.canPlayCard(mockState, 'player1', uniqueCard);
            expect(result.success).toBe(false);
            expect(result.reason).toContain('unique copy');
        });

        it('should allow hybrid resource payments (e.g. converting 3 Carnie to 1 Tribe)', () => {
            const expensiveTribeCard = { id: 'c1', cost: 2, tribe: 'TribeX' }; 
            mockState.players.player1.hand.push(expensiveTribeCard);

            const result = flow.canPlayCard(mockState, 'player1', expensiveTribeCard);
            expect(result.success).toBe(true);

            const playResult = flow.playCard(mockState, 'player1', 'c1');
            expect(playResult.success).toBe(true);
            expect(mockState.players.player1.resources['TribeX'].current).toBe(0);
            expect(mockState.players.player1.resources['Carnie'].current).toBe(0);
        });

        it('should block play if player lacks enough resources (Negative Case)', () => {
            const tooExpensiveCard = { id: 'c2', cost: 10, tribe: 'Carnie' };
            const result = flow.canPlayCard(mockState, 'player1', tooExpensiveCard);
            
            expect(result.success).toBe(false);
            expect(result.reason).toContain('Not enough Carnie');
        });
    });

    describe('Phase Enforcement (executeSacrificeDecision)', () => {
        it('should completely ignore harvest if phase is not SACRIFICE_DECISION (Negative Case)', () => {
            mockState.turnPhase = 'ACTION_PHASE';
            mockState.players.player1.hand.push({ instanceId: 'sac1' });

            flow.executeSacrificeDecision(mockState, 'OPTION_A', 'sac1');
            
            expect(mockState.turnPhase).toBe('ACTION_PHASE'); 
        });

        it('should transition to ACTION_PHASE even if player skips the sacrifice', () => {
            mockState.turnPhase = 'SACRIFICE_DECISION';
            
            flow.executeSacrificeDecision(mockState, 'SKIP', null);
            
            expect(mockState.turnPhase).toBe('ACTION_PHASE');
        });
    });
});