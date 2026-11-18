import { jest } from '@jest/globals';
import { SummonAction } from '../../../src/engine/actions/summon.js';
import { GameEngine } from '../../../src/engine/index.js';
import { ACTION_REGISTRY, Action } from '../../../src/engine/actions/core.js';

function createPlayer() {
    return {
        resources: { Carnie: { current: 5, max: 5 } },
        lines: { avatar: [], taunt: [], bodyguard: [], front: [], mid: [], back: [], sheltered: [], sideline: [] },
        hand: [], deck: [], discard: [], banish: []
    };
}

describe('SummonAction', () => {
    let engine;
    let baseCard;

    beforeEach(() => {
        jest.clearAllMocks();
        
        baseCard = { id: 'card_1', name: 'Goblin', type: 'unit' };

        const state = {
            activePlayerId: 'player1',
            history_log: [],
            abilityUses: {},
            catalog: [baseCard],
            abilityCatalog: [],
            players: {
                player1: createPlayer(),
                player2: createPlayer()
            },
            equator: []
        };
        
        engine = new GameEngine(state);
    });

    describe('Card Lookup', () => {
        it('should abort if card is not found in catalog', () => {
            const action = new SummonAction({ cardId: 'missing_card' });
            action.execute(engine);
            
            expect(engine.state.players.player1.lines.back.length).toBe(0);
        });

        it('should lookup card by exact id', () => {
            const action = new SummonAction({ cardId: 'card_1' });
            action.execute(engine);
            
            expect(engine.state.players.player1.lines.back.length).toBe(1);
            expect(engine.state.players.player1.lines.back[0].id).toBe('card_1');
        });

        it('should fallback to lookup card by name (lowercase)', () => {
            const action = new SummonAction({ cardId: 'goblin' });
            action.execute(engine);
            
            expect(engine.state.players.player1.lines.back.length).toBe(1);
        });
    });

    describe('Owner Resolution', () => {
        it('should default to actingPlayerId if provided', () => {
            const action = new SummonAction({ cardId: 'card_1', actingPlayerId: 'player2' });
            action.execute(engine);
            
            expect(engine.state.players.player2.lines.back.length).toBe(1);
            expect(engine.state.players.player1.lines.back.length).toBe(0);
        });

        it('should resolve owner to target location playerId if zoneOwner is TARGET', () => {
            // Place a target unit in player2's mid line
            const targetUnit = { instanceId: 't1', ownerId: 'player2' };
            engine.state.players.player2.lines.mid.push(targetUnit);
            
            const action = new SummonAction({ 
                cardId: 'card_1', 
                zoneOwner: 'TARGET', 
                target: targetUnit 
            });
            action.execute(engine);
            
            expect(engine.state.players.player2.lines.back.length).toBe(1);
        });

        it('should resolve owner to target.ownerId if location is missing but zoneOwner is TARGET', () => {
            const action = new SummonAction({ 
                cardId: 'card_1', 
                zoneOwner: 'TARGET', 
                target: { instanceId: 't1', ownerId: 'player2' } 
            });
            action.execute(engine);
            
            expect(engine.state.players.player2.lines.back.length).toBe(1);
        });
    });

    describe('Destination and Looping', () => {
        it('should summon multiple instances based on amount', () => {
            const action = new SummonAction({ cardId: 'card_1', amount: 3 });
            action.execute(engine);
            
            expect(engine.state.players.player1.lines.back.length).toBe(3);
            expect(engine.state.history_log.length).toBe(3);
        });

        it('should emit fielded events for each summoned instance', () => {
            const emit = jest.spyOn(engine, 'emit');
            const eventContext = { abilityId: 'ability_1' };
            const source = { instanceId: 'source_1' };

            const action = new SummonAction({ cardId: 'card_1', amount: 2, source, eventContext });
            action.execute(engine);

            const summoned = engine.state.players.player1.lines.back;
            expect(emit).toHaveBeenCalledWith('ON_FIELD', { source, target: summoned[0], eventContext });
            expect(emit).toHaveBeenCalledWith('ON_BE_FIELDED', { source, target: summoned[0], eventContext });
            expect(emit).toHaveBeenCalledWith('ON_FIELD', { source, target: summoned[1], eventContext });
            expect(emit).toHaveBeenCalledWith('ON_BE_FIELDED', { source, target: summoned[1], eventContext });
        });

        it('should use the syntactic object as summoner and each spawned unit as the summoned event target', () => {
            baseCard.abilities = [{
                abilityId: 'summoned-trigger',
                instanceId: 'summoned-trigger-instance',
                name: 'Summoned Trigger',
                trigger: 'ON_BE_SUMMONED',
                effects: []
            }];
            const abilityHolder = { instanceId: 'ability_holder', name: 'Ability Holder' };
            const summoner = {
                instanceId: 'syntactic_object',
                name: 'Summoner',
                ownerId: 'player1',
                abilities: [{
                    abilityId: 'own-summon-trigger',
                    instanceId: 'own-summon-trigger-instance',
                    name: 'Own Summon Trigger',
                    trigger: 'ON_BE_SUMMONED',
                    triggerScope: 'PERSONAL',
                    effects: []
                }]
            };
            const emit = jest.spyOn(engine, 'emit');

            new SummonAction({
                cardId: 'card_1',
                amount: 2,
                source: abilityHolder,
                target: summoner
            }).run(engine);

            const summoned = engine.state.players.player1.lines.back;
            expect(summoned).toHaveLength(2);
            for (const instance of summoned) {
                expect(emit).toHaveBeenCalledWith('ON_SUMMON', expect.objectContaining({
                    source: summoner,
                    target: instance
                }));
                expect(emit).toHaveBeenCalledWith('ON_BE_SUMMONED', expect.objectContaining({
                    source: summoner,
                    target: instance
                }));
                expect(engine.state.history_log.some(entry =>
                    entry.text.includes(`entityId=${instance.instanceId} abilityId=summoned-trigger event=ON_BE_SUMMONED`)
                )).toBe(true);
            }
            expect(engine.state.history_log.some(entry =>
                entry.text.includes('entityId=syntactic_object abilityId=own-summon-trigger')
            )).toBe(false);
        });

        it('should route "field" or "board" to defaultLine', () => {
            const action = new SummonAction({ cardId: 'card_1', zone: 'FIELD' });
            action.execute(engine);
            
            expect(engine.state.players.player1.lines.mid.length).toBe(1); // Default is mid
        });

        it('should safely fallback actualDest for units sent to back line', () => {
            baseCard.defaultLine = 'front';
            const action = new SummonAction({ cardId: 'card_1', zone: 'back' });
            action.execute(engine);
            
            // Because unit defaultLine is 'front', it prevents going to 'back'
            expect(engine.state.players.player1.lines.front.length).toBe(1);
            expect(engine.state.players.player1.lines.back.length).toBe(0);
        });
    });

    describe('Side Effects', () => {
        it('should register effect if valid duration provided', () => {
            const action = new SummonAction({ cardId: 'card_1', duration: 'TEMPORARY' });
            action.execute(engine);
            
            const summoned = engine.state.players.player1.lines.back[0];
            expect(summoned.activeEffects.length).toBe(1);
            expect(summoned.activeEffects[0].type).toBe('SUMMON');
        });

        it('should not register effect for INSTANT, PERMANENT, or INDEFINITE', () => {
            const action = new SummonAction({ cardId: 'card_1', duration: 'PERMANENT' });
            action.execute(engine);
            
            const summoned = engine.state.players.player1.lines.back[0];
            expect(summoned.activeEffects).toBeUndefined();
        });

        describe('Nested Groups', () => {
            class MockAction extends Action {
                execute() {
                    if (!this.payload.target.markedCount) this.payload.target.markedCount = 0;
                    this.payload.target.markedCount++;
                }
            }

            beforeEach(() => {
                ACTION_REGISTRY['MOCK_ACT'] = MockAction;
            });

            afterEach(() => {
                delete ACTION_REGISTRY['MOCK_ACT'];
            });

            it('should execute nested payloads for AUTO_ALL', () => {
                const action = new SummonAction({ 
                    cardId: 'card_1', amount: 2,
                    nestedGroup: { 
                        targetMethod: 'AUTO_ALL', 
                        payloads: [{ type: 'MOCK_ACT' }] 
                    } 
                });
                action.execute(engine);
                
                const summoned = engine.state.players.player1.lines.back;
                expect(summoned.length).toBe(2);
                expect(summoned[0].markedCount).toBe(1);
                expect(summoned[1].markedCount).toBe(1);
            });

            it('should execute nested payloads for AUTO_FIRST', () => {
                const action = new SummonAction({ 
                    cardId: 'card_1', amount: 3,
                    nestedGroup: { 
                        targetMethod: 'AUTO_FIRST', targetCount: 2,
                        payloads: [{ type: 'MOCK_ACT' }] 
                    } 
                });
                action.execute(engine);
                
                const summoned = engine.state.players.player1.lines.back;
                expect(summoned.length).toBe(3);
                expect(summoned[0].markedCount).toBe(1);
                expect(summoned[1].markedCount).toBe(1);
                expect(summoned[2].markedCount).toBeUndefined(); // Didn't hit the 3rd one
            });

            it('should handle inverted roles for nested payloads', () => {
                const sourceEnt = { id: 'original_source' };
                let capturedActionPayload = null;

                class CaptureAction extends Action {
                    execute() { capturedActionPayload = this.payload; }
                }
                ACTION_REGISTRY['CAPTURE_ACT'] = CaptureAction;

                const action = new SummonAction({ 
                    cardId: 'card_1', source: sourceEnt,
                    nestedGroup: { 
                        targetMethod: 'AUTO_ALL', 
                        payloads: [{ type: 'CAPTURE_ACT', invertRoles: true }] 
                    } 
                });
                action.execute(engine);
                
                expect(capturedActionPayload.target).toBe(sourceEnt);
                expect(capturedActionPayload.source.isToken).toBe(true); // Source is the token now
                
                delete ACTION_REGISTRY['CAPTURE_ACT'];
            });

            it('should silently skip missing Action Registry classes', () => {
                const action = new SummonAction({ 
                    cardId: 'card_1',
                    nestedGroup: { 
                        targetMethod: 'AUTO_ALL', 
                        payloads: [{ type: 'MISSING_ACTION' }] 
                    } 
                });
                // Should not throw an error, just resolves without executing anything inside
                expect(() => action.execute(engine)).not.toThrow();
            });
        });
    });
});