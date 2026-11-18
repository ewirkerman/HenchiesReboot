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
    findEntity: jest.fn((state, playerId, entityId) => actualUtils.findEntity(state, playerId, entityId)),
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
        it('summons a catalog Target Dummy into player 2 midline on their first turn', () => {
            const targetDummy = {
                id: 'target_dummy',
                name: 'Target Dummy',
                type: 'unit',
                defaultLine: 'mid',
                health: 1,
                maxHealth: 1,
                abilities: []
            };
            mockState.activePlayerId = 'player2';
            mockState.players.player2.setupComplete = false;
            mockState.catalog = [targetDummy];

            flow.startTurn(mockState, null);

            expect(mockState.players.player2.lines.mid).toHaveLength(1);
            expect(mockState.players.player2.lines.mid[0]).toMatchObject({
                id: 'target_dummy',
                name: 'Target Dummy',
                ownerId: 'player2',
                defaultLine: 'mid',
                line: 'mid'
            });
            expect(mockState.players.player2.lines.front).toHaveLength(0);
        });

        it('summons the Target Dummy for an AI player and only once', () => {
            mockState.activePlayerId = 'player2';
            mockState.players.player2.setupComplete = false;
            mockState.players.player2.isAI = true;
            mockState.catalog = [{
                id: 'target_dummy',
                name: 'Target Dummy',
                type: 'unit',
                defaultLine: 'mid',
                health: 1,
                maxHealth: 1,
                abilities: []
            }];

            flow.startTurn(mockState, null);
            flow.startTurn(mockState, null);

            expect(mockState.players.player2.lines.mid).toHaveLength(1);
            expect(mockState.history_log.some(entry => entry.text.includes('summoned Target Dummy'))).toBe(true);
        });

        it.each([
            [4, 'player1'],
            [5, 'player2']
        ])('draws the opening hand up to %i cards after GAME_STARTING for %s', (expectedHandSize, playerId) => {
            mockState.activePlayerId = playerId;
            const player = mockState.players[playerId];
            player.setupComplete = false;
            player.unplayedDeck = Array.from({ length: 10 }, (_, index) => ({ id: `${playerId}_card_${index}` }));
            let handSizeAtTurnStart;
            const engine = {
                emit: jest.fn(event => {
                    if (event === 'GAME_STARTING') {
                        player.hand.push(player.deck.pop());
                    }
                    if (event === 'TURN_STARTING') {
                        handSizeAtTurnStart = player.hand.length;
                    }
                })
            };

            flow.startTurn(mockState, engine);

            expect(handSizeAtTurnStart).toBe(expectedHandSize);
            expect(player.hand).toHaveLength(expectedHandSize + 2);
            expect(engine.emit.mock.calls.filter(([event]) => event === 'GAME_STARTING')).toHaveLength(1);

            flow.startTurn(mockState, engine);

            expect(engine.emit.mock.calls.filter(([event]) => event === 'GAME_STARTING')).toHaveLength(1);
        });

        it('endTurn should increment turn number when returning to player1 and swap active player', () => {
            mockState.activePlayerId = 'player2';
            mockState.turnNumber = 1;
            
            flow.endTurn(mockState);
            
            expect(mockState.activePlayerId).toBe('player1');
            expect(mockState.turnNumber).toBe(2);
            expect(mockState.turnPhase).toBe('SACRIFICE_DECISION');
        });

        it('startTurn should replenish readiness and reset cooldown groups for owned entities', () => {
            const tiredUnit = { id: 'u1', ownerId: 'player1', readiness: -1, acts: { innate: true }, maxActs: 2 };
            const tiredAttachment = { id: 'a1', ownerId: 'player1', acts: { bonus: true }, maxActs: 3 };
            tiredUnit.attachments = [tiredAttachment];
            mockState.players.player1.lines.mid.push(tiredUnit);
            const handUnit = { id: 'hand1', type: 'unit', ownerId: 'player1', acts: { innate: true } };
            mockState.players.player1.hand.push(handUnit);
            
            flow.startTurn(mockState, null);
            
            expect(tiredUnit.readiness).toBe(0);
            expect(tiredUnit.acts).toEqual({});
            expect(tiredUnit.maxActs).toBeUndefined();
            expect(tiredAttachment.acts).toEqual({});
            expect(handUnit.acts).toEqual({});
        });

        it('draws cards, resets cooldowns, and replenishes resources between TURN_STARTING and TURN_STARTED', () => {
            const activeUnit = {
                instanceId: 'p1_unit',
                ownerId: 'player1',
                readiness: -1,
                acts: { innate: true },
                abilities: [{ abilityId: 'p1_ability', instanceId: 'p1_ability_instance' }],
                attachments: [{ ownerId: 'player1', readiness: -1 }]
            };
            mockState.players.player1.lines.mid.push(activeUnit);
            mockState.players.player2.lines.mid.push({
                instanceId: 'p2_unit',
                ownerId: 'player2',
                abilities: [{ abilityId: 'p2_ability', instanceId: 'p2_ability_instance' }]
            });
            mockState.players.player1.resources.Carnie.current = 1;
            mockState.players.player1.resources.TribeX.current = 0;
            mockState.abilityUses = {
                p1_ability_instance: 1,
                p2_ability_instance: 1,
                unrelatedAbility: 1
            };
            const observedUses = {};
            const engine = {
                emit: jest.fn(event => {
                    observedUses[event] = {
                        abilityUses: { ...mockState.abilityUses },
                        acts: { ...activeUnit.acts },
                        readiness: activeUnit.readiness,
                        attachmentReadiness: activeUnit.attachments[0].readiness,
                        hand: mockState.players.player1.hand.map(card => card.id),
                        deck: mockState.players.player1.deck.map(card => card.id),
                        resources: Object.fromEntries(
                            Object.entries(mockState.players.player1.resources)
                                .map(([tribe, resource]) => [tribe, resource.current])
                        )
                    };
                })
            };

            flow.startTurn(mockState, engine);

            expect(observedUses.TURN_STARTING).toEqual({
                abilityUses: {
                    p1_ability_instance: 1,
                    p2_ability_instance: 1,
                    unrelatedAbility: 1
                },
                acts: { innate: true },
                readiness: -1,
                attachmentReadiness: -1,
                hand: [],
                deck: ['d1', 'd2'],
                resources: { Carnie: 1, TribeX: 0 }
            });
            expect(observedUses.TURN_STARTED).toEqual({
                abilityUses: {
                    p2_ability_instance: 1,
                    unrelatedAbility: 1
                },
                acts: {},
                readiness: 0,
                attachmentReadiness: 0,
                hand: ['d2', 'd1'],
                deck: [],
                resources: { Carnie: 3, TribeX: 1 }
            });
            expect(mockState.abilityUses).toEqual({
                p2_ability_instance: 1,
                unrelatedAbility: 1
            });
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

        it('should enforce UNIQUE_ENTITY ownership for cards on the equator', () => {
            const uniqueCard = { id: 'unique_card', name: 'The One', cost: 0 };
            mockState.players.player1.hand.push(uniqueCard);
            mockState.equator.push({
                id: 'unique_card',
                name: 'The One',
                ownerId: 'player2'
            });

            expect(flow.canPlayCard(mockState, 'player1', uniqueCard).success).toBe(true);

            mockState.equator[0].ownerId = 'player1';
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

        it('should remove legacy acts and maxActs state from owned discard entities', () => {
             const unitCard = { id: 'discard1', type: 'unit', acts: 1, maxActs: 2 };
             const buffCard = { id: 'discard2', type: 'buff' };
             mockState.players.player1.discard.push(unitCard, buffCard);
             
             flow.startTurn(mockState, null);
             
             expect(unitCard.acts).toEqual({});
             expect(unitCard.maxActs).toBeUndefined();
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
            const entity = { id: 'u1', instanceId: 'u1_inst', ownerId: 'player1', acts: 1, maxActs: 2, abilities: [] };
            mockState.players.player1.lines.mid.push(entity);

            const result = flow.executeEntityAction(mockState, 'player1', 'u1_inst', 'ATTACK', 'native_attack', null, null);
            
            expect(result.success).toBe(true);
            expect(entity.acts).toEqual({});
            expect(entity.maxActs).toBeUndefined();
        });

        it('tracks manual ability use independently per cooldown group and blocks repeat group use', () => {
            const entity = {
                id: 'u_groups',
                instanceId: 'u_groups',
                ownerId: 'player1',
                abilities: [
                    { abilityId: 'ab_innate', trigger: 'MANUAL' },
                    { abilityId: 'ab_bonus', trigger: 'MANUAL', origin: 'bonus' },
                    { abilityId: 'ab_free', trigger: 'MANUAL', cooldownGroup: 'miracle', cost: { freeAction: true } },
                    { abilityId: 'ab_attack', trigger: 'MANUAL', origin: 'innate', effects: [{ targetMethod: 'SELF', payloads: [{ type: 'ATTACK' }] }] }
                ]
            };
            mockState.players.player1.lines.mid.push(entity);

            expect(flow.executeEntityAction(mockState, 'player1', 'u_groups', 'ABILITY', 'ab_innate')).toEqual({ success: true });
            expect(flow.executeEntityAction(mockState, 'player1', 'u_groups', 'ABILITY', 'ab_bonus')).toEqual({ success: true });
            expect(entity.acts).toEqual({ innate: true, bonus: true });

            const repeat = flow.executeEntityAction(mockState, 'player1', 'u_groups', 'ABILITY', 'ab_innate');
            expect(repeat.success).toBe(false);
            expect(repeat.reason).toContain('innate');

            expect(flow.executeEntityAction(mockState, 'player1', 'u_groups', 'ABILITY', 'ab_free')).toEqual({ success: true });
            expect(flow.executeEntityAction(mockState, 'player1', 'u_groups', 'ABILITY', 'ab_attack')).toEqual({ success: true });
            expect(entity.acts).toEqual({ innate: true, bonus: true });
        });

        it('allows same-ability reuse to bypass its used cooldown group without freeing the group', () => {
            const reusableAbility = {
                abilityId: 'ab_reusable',
                instanceId: 'ab_reusable_instance',
                trigger: 'MANUAL',
                cost: { readinessCost: 'UNREADIES', reuseIgnoresReadiness: true }
            };
            const entity = {
                id: 'u_reusable',
                instanceId: 'u_reusable',
                ownerId: 'player1',
                acts: { innate: true },
                abilities: [
                    reusableAbility,
                    { abilityId: 'ab_other_innate', trigger: 'MANUAL' }
                ]
            };
            mockState.players.player1.lines.mid.push(entity);
            mockState.abilityUses = { ab_reusable_instance: 1 };

            expect(flow.executeEntityAction(mockState, 'player1', 'u_reusable', 'ABILITY', 'ab_reusable').success).toBe(true);
            expect(flow.executeEntityAction(mockState, 'player1', 'u_reusable', 'ABILITY', 'ab_other_innate')).toEqual({
                success: false,
                reason: "Cooldown group 'innate' has already been used this turn"
            });
            expect(entity.acts).toEqual({ innate: true });
        });

        it('allows distinct Unique abilities but shares cooldown for the same abilityId', () => {
            const entity = {
                id: 'u_unique',
                instanceId: 'u_unique',
                ownerId: 'player1',
                abilities: [
                    { abilityId: 'unique_a', instanceId: 'unique_a_1', trigger: 'MANUAL', cooldownGroup: 'Unique' },
                    { abilityId: 'unique_b', instanceId: 'unique_b_1', trigger: 'MANUAL', cooldownGroup: 'Unique' },
                    { abilityId: 'duplicate', instanceId: 'duplicate_1', trigger: 'MANUAL', cooldownGroup: 'Unique' },
                    { abilityId: 'duplicate', instanceId: 'duplicate_2', trigger: 'MANUAL', cooldownGroup: 'Unique' }
                ]
            };
            mockState.players.player1.lines.mid.push(entity);

            expect(flow.executeEntityAction(mockState, 'player1', 'u_unique', 'ABILITY', 'unique_a', null, null, 'unique_a_1').success).toBe(true);
            expect(flow.executeEntityAction(mockState, 'player1', 'u_unique', 'ABILITY', 'unique_b', null, null, 'unique_b_1').success).toBe(true);
            expect(flow.executeEntityAction(mockState, 'player1', 'u_unique', 'ABILITY', 'duplicate', null, null, 'duplicate_1').success).toBe(true);
            expect(flow.executeEntityAction(mockState, 'player1', 'u_unique', 'ABILITY', 'duplicate', null, null, 'duplicate_2').success).toBe(false);
        });

        it('allows same-ability instances to each use Unique+ in one turn', () => {
            const entity = {
                id: 'u_unique_plus',
                instanceId: 'u_unique_plus',
                ownerId: 'player1',
                abilities: [
                    { abilityId: 'unique_plus_ability', instanceId: 'unique_plus_1', trigger: 'MANUAL', cooldownGroup: 'Unique+' },
                    { abilityId: 'unique_plus_ability', instanceId: 'unique_plus_2', trigger: 'MANUAL', cooldownGroup: 'Unique+' }
                ]
            };
            mockState.players.player1.lines.mid.push(entity);

            expect(flow.executeEntityAction(mockState, 'player1', 'u_unique_plus', 'ABILITY', 'unique_plus_ability', null, null, 'unique_plus_1').success).toBe(true);
            expect(flow.executeEntityAction(mockState, 'player1', 'u_unique_plus', 'ABILITY', 'unique_plus_ability', null, null, 'unique_plus_2').success).toBe(true);
            expect(entity.acts).toEqual({
                '$unique-instance:unique_plus_1': true,
                '$unique-instance:unique_plus_2': true
            });
        });

        it('should block execution for unknown action types[cite: 2]', () => {
            const result = flow.executeEntityAction(mockState, 'player1', 'u1', 'INVALID_ACTION', 'ab1', null, null);
            
            expect(result.success).toBe(false);
            expect(result.reason).toBe('Unknown action');
        });
    });
});