import { jest } from '@jest/globals';
import * as actualUtils from '../../src/engine/utils.js';

jest.unstable_mockModule('../../src/engine/index.js', () => ({
    GameEngine: class MockEngine {
        constructor() { 
            this.emit = jest.fn(); 
            this.executeAbility = jest.fn(); // Add this line
        }
    }
}));

jest.unstable_mockModule('../../src/engine/utils.js', () => ({
    ...actualUtils,
    getAvatar: jest.fn((state, pId) => ({ id: `avatar_${pId}`, type: 'avatar' })),
    resolveResourceKey: jest.fn((state, p, tribe) => tribe === 'TribeX' ? 'TribeX' : 'Carnie'),
    hasEngineFlag: jest.fn((state, entity, flag) => {
        if (entity.id === 'unique_card' && flag === 'UNIQUE_ENTITY') return true;
        return actualUtils.hasEngineFlag(state, entity, flag);
    }),
    findEntity: jest.fn((entity) => entity),
    getAttackCost: jest.fn(() => ({ freeAction: false }))
}));

jest.unstable_mockModule('../../src/engine/actions/action_index.js', () => ({
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

    describe('Start Turn Coverage (Readiness Floors, InstanceIds, Card Types)', () => {
        it('should generate instanceIds for deck cards missing them and preserve existing ones[cite: 2]', () => {
            mockState.players.player1.setupComplete = false;
            mockState.players.player1.unplayedDeck = [
                { id: 'c1' }, 
                { id: 'c2', instanceId: 'kept_id' }
            ];
            
            flow.startTurn(mockState, null);
            
            const allCards = [...mockState.players.player1.deck, ...mockState.players.player1.hand];
            const c1 = allCards.find(c => c.id === 'c1');
            const c2 = allCards.find(c => c.id === 'c2');
            
            expect(c1.instanceId).toBeDefined();
            expect(c1.instanceId).toContain('player1_c_');
            expect(c2.instanceId).toBe('kept_id');
        });

        it('should floor NaN readiness values to 1 and handle attachment readiness[cite: 2]', () => {
            const unit = { 
                id: 'u1', 
                ownerId: 'player1', 
                readiness: 'invalid', 
                acts: 0, 
                attachments: [{ id: 'a1', readiness: NaN, ownerId: 'player1' }] 
            };
            mockState.players.player1.lines.mid.push(unit);
            
            flow.startTurn(mockState, null);
            
            expect(unit.readiness).toBe(1);
            expect(unit.attachments[0].readiness).toBe(1);
        });

        it('should handle discard acts resetting, ignoring unhandled types like buff/debuff[cite: 2]', () => {
             const unitCard = { id: 'discard1', type: 'unit' };
             const buffCard = { id: 'discard2', type: 'buff' };
             mockState.players.player1.discard.push(unitCard, buffCard);
             
             flow.startTurn(mockState, null);
             
             expect(unitCard.acts).toBe(1);
             expect(buffCard.acts).toBeUndefined();
        });
    });

    describe('Card Play Constraints (Mandatory Targets & Autocasting)', () => {
        it('should block play if no valid targets exist for mandatory target ability[cite: 2]', () => {
            const spellCard = {
                id: 'spell1',
                cost: 1,
                tribe: 'Carnie',
                abilities: [{
                    trigger: 'PLAY',
                    activation: {
                        method: 'PLAYER_CHOICE',
                        quickTargeting: { zones: ['FIELD'], alignment: ['ENEMY'] }
                    }
                }]
            };
            mockState.players.player1.hand.push(spellCard);
            
            const result = flow.canPlayCard(mockState, 'player1', spellCard);
            
            expect(result.success).toBe(false);
            expect(result.reason).toContain('No valid targets on the board for mandatory ability.');
        });

        it('should allow play if valid targets exist for mandatory target ability[cite: 2]', () => {
            const spellCard = {
                id: 'spell1',
                cost: 1,
                tribe: 'Carnie',
                abilities: [{
                    trigger: 'PLAY',
                    activation: {
                        method: 'PLAYER_CHOICE',
                        quickTargeting: { zones: ['FIELD'], alignment: ['ENEMY'] }
                    }
                }]
            };
            mockState.players.player1.hand.push(spellCard);
            mockState.players.player2.lines.mid.push({ id: 'u1' });
            
            const result = flow.canPlayCard(mockState, 'player1', spellCard);
            
            expect(result.success).toBe(true);
        });

        it('should execute playCard and successfully filter ON_BE_PLAYED abilities for autocast context[cite: 2]', () => {
            const autoCard = {
                id: 'auto_card',
                instanceId: 'inst_auto',
                cost: 0,
                tribe: 'Carnie',
                abilities: [
                    { trigger: 'ON_BE_PLAYED', isSelectable: false, activation: { method: 'AUTO' } },
                    { trigger: 'ON_BE_PLAYED', isSelectable: true, activation: { method: 'PLAYER_CHOICE' } }
                ]
            };
            mockState.players.player1.hand.push(autoCard);
            
            const result = flow.playCard(mockState, 'player1', 'inst_auto');
            
            expect(result.success).toBe(true);
        });
    });

    describe('Entity Action Execution (executeEntityAction)', () => {
        it('should fallback to generated native_attack ability if abilityId is native_attack[cite: 2]', () => {
            const entity = { id: 'u1', instanceId: 'u1_inst', ownerId: 'player1', acts: 1, abilities: [] };
            mockState.players.player1.lines.mid.push(entity);

            const result = flow.executeEntityAction(mockState, 'player1', 'u1', 'ATTACK', 'native_attack', null, null);
            
            expect(result.success).toBe(true);
            expect(entity.acts).toBe(1);
        });

        it('should block execution for unknown action types[cite: 2]', () => {
            const result = flow.executeEntityAction(mockState, 'player1', 'u1', 'INVALID_ACTION', 'ab1', null, null);
            
            expect(result.success).toBe(false);
            expect(result.reason).toBe('Unknown action');
        });
    });
});