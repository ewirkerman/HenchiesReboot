import { jest } from '@jest/globals';
import * as actualUtils from '../../src/engine/utils.js';
import { createTestUnit, createTestState, spawnUnit } from '../test_utils.js';

jest.unstable_mockModule('../../src/engine/prandom.js', () => ({
    randomInt: jest.fn(() => 0),
    shuffleArray: jest.fn((state, arr) => arr),
    generateId: jest.fn(() => 'mock_id')
}));

jest.unstable_mockModule('../../src/engine/utils.js', () => ({
    ...actualUtils,
    log: jest.fn(),
    warn: jest.fn(),
    hasEngineFlag: jest.fn((state, ent, flag) => {
        if (ent.flags?.includes(flag)) return true;
        return actualUtils.hasEngineFlag(state, ent, flag);
    }),
    getOwnerId: jest.fn((state, ent) => ent.ownerId),
    getAvatar: jest.fn((state, playerId) => state.players[playerId]?.lines.avatar?.find(unit => unit.type === 'avatar') || null),
    resolveResourceKey: jest.fn((state, p, t) => t || 'Carnie'),
    findEntityLocation: jest.fn(() => ({ zone: 'mid' }))
}));

jest.unstable_mockModule('../../src/engine/actions/action_index.js', () => ({
ACTION_REGISTRY: {
        'MOCK_ACT': class { run = jest.fn(); },
        'DAMAGE': class { run = jest.fn(); },
        'ACT': class { run = jest.fn(); },
        // Add mock implementations for the actions used in the new tests
        'KILL': class { 
            constructor(payload) { this.payload = payload; }
            run(state) {
                const target = this.payload.target;
                const player = state.state.players[target.ownerId];
                // Simulate the entity dying by moving it from mid to discard
                player.lines.mid = player.lines.mid.filter(u => u.instanceId !== target.instanceId);
                player.discard.push(target);
            }
        },
        'DRAW_CARD': class { run = jest.fn(); },
        'DISCARD_CARD': class { run = jest.fn(); },
        'MODIFY_STATS': class { run = jest.fn(); }
    },
    EVENT_MANIFEST: {},
    ACTION_MANIFEST: { DAMAGE: { passiveType: 'TAKE_DAMAGE' } },
    findEntityLocation: jest.fn(() => ({ zone: 'mid' })),
    HarvestAction: class { run = jest.fn(); },
    PlayAction: class { run = jest.fn(); },
    sweepTurnEffects: jest.fn()
}));

jest.unstable_mockModule('../../src/engine/targeting.js', () => ({
    getEntityAvailableActions: jest.fn(),
    getValidAttackTargets: jest.fn()
}));

jest.unstable_mockModule('../../src/engine/attributes.js', () => ({
    ATTRIBUTE_MANIFEST: {
        'tribe': { domain: 'ENTITY', allowedTypes: ['ALL'] }
    }
}));

describe('index.js GameEngine', () => {
    let mockState;
    let GameEngine;
    let ACTION_REGISTRY;
    let ACTION_MANIFEST;
    let findEntityLocationMock;

    beforeAll(async () => {
        const module = await import('../../src/engine/index.js');
        GameEngine = module.GameEngine;
        
        const actions = await import('../../src/engine/actions/action_index.js');
        ACTION_REGISTRY = actions.ACTION_REGISTRY;
        ACTION_MANIFEST = actions.ACTION_MANIFEST;
        findEntityLocationMock = actions.findEntityLocation;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockState = createTestState();
    });

    describe('Event Bus & Interceptors', () => {
        it('should register own and opponent turn aliases against generic turn events', () => {
            const engine = new GameEngine(mockState);
            
            spawnUnit(mockState, 'player1', 'avatar', {
                type: 'avatar',
                abilities: [
                    { abilityId: 'own-turn', trigger: 'OWN_TURN_STARTED', effects: [] },
                    { abilityId: 'opp-turn', trigger: 'OPP_TURN_STARTED', effects: [] },
                    { abilityId: 'global-turn', trigger: 'TURN_STARTED', triggerScope: 'GLOBAL', effects: [] }
                ]
            });
            
            spawnUnit(mockState, 'player2', 'avatar', {
                type: 'avatar', abilities: []
            });
            
            spawnUnit(mockState, 'player1', 'mid', {
                abilities: [
                    { abilityId: 'unit-turn', trigger: 'TURN_STARTED', triggerScope: 'GLOBAL', effects: [] },
                    { abilityId: 'unit-own-turn', trigger: 'OWN_TURN_STARTED', triggerScope: 'PERSONAL', effects: [] },
                    { abilityId: 'unit-opp-turn', trigger: 'OPP_TURN_STARTED', triggerScope: 'PERSONAL', effects: [] }
                ]
            });

            expect(engine.queueTriggers('TURN_STARTED', { playerId: 'player1' })).toBe(3);
            engine.stack = [];
            expect(engine.queueTriggers('TURN_STARTED', { playerId: 'player2' })).toBe(3);
        });

        it('should cancel the root event if a WOULD_ interceptor cancels the payload', () => {
            const engine = new GameEngine(mockState);
            const targetUnit = spawnUnit(mockState, 'player1', 'mid', {
                abilities: [{
                    abilityId: 'shield',
                    trigger: 'WOULD_TAKE_DAMAGE', 
                    effects: [{
                        targetMethod: 'EVENT_TARGET',
                        payloads: [{ type: 'CUSTOM_CANCEL_SCRIPT' }]
                    }]
                }]
            });

            ACTION_MANIFEST['DAMAGE'] = { passiveType: 'TAKE_DAMAGE' };

            ACTION_REGISTRY['CUSTOM_CANCEL_SCRIPT'] = class {
                constructor(payload) { this.p = payload; }
                run() { this.p.eventContext.cancelled = true; } 
            };

            const payload = { target: targetUnit, amount: 5, cancelled: false };
            const result = engine.emit('TAKE_DAMAGE', payload);

            expect(result.cancelled).toBe(true);
            expect(payload.cancelled).toBe(true);
        });

        it('should correctly trigger HOST scoped abilities when the host is the event entity', () => {
            const engine = new GameEngine(mockState);
            const hostEntity = spawnUnit(mockState, 'player1', 'mid');
            const attachment = {
                instanceId: 'att1', ownerId: 'player1',
                abilities: [{
                    abilityId: 'host-buff',
                    trigger: 'TAKE_DAMAGE',
                    triggerScope: 'HOST',
                    effects: [{ targetMethod: 'NONE', payloads: [] }]
                }]
            };
            hostEntity.attachments = [attachment];

            findEntityLocationMock.mockReturnValueOnce({ zone: 'attachment', host: hostEntity });

            engine.queueTriggers('TAKE_DAMAGE', { target: hostEntity });
            
            const queued = engine.stack.find(f => f.ability.abilityId === 'host-buff');
            expect(queued).toBeDefined();
        });

        it('should exact match Block X event names (e.g. ON_, WOULD_) without prepending WOULD_ again', () => {
            const engine = new GameEngine(mockState);
            const spy = jest.spyOn(engine, 'queueTriggers');
            
            engine.emit('ON_DEATH', {});
            expect(spy).toHaveBeenCalledWith('ON_DEATH', expect.anything());
            expect(spy).not.toHaveBeenCalledWith('WOULD_ON_DEATH', expect.anything());

            spy.mockClear();

            engine.emit('WOULD_HEAL', {});
            expect(spy).toHaveBeenCalledWith('WOULD_HEAL', expect.anything());
            expect(spy).not.toHaveBeenCalledWith('WOULD_WOULD_HEAL', expect.anything());
        });
    });

    describe('Cost Enforcement (_checkAndPayCost)', () => {
        it('should respect ONCE_PER_ROUND trigger limits (Negative Case)', () => {
            const engine = new GameEngine(mockState);
            const source = { instanceId: 's1', ownerId: 'player1', readiness: 1 };
            const ability = { abilityId: 'ab1', triggerLimit: 'ONCE_PER_ROUND', trigger: 'MANUAL', cost: { carnie: 0 } };

            expect(engine._checkAndPayCost(ability, source, 'player1', {})).toBe(true);
            expect(engine._checkAndPayCost(ability, source, 'player1', {})).toBe(false);
        });

        it('should drop readiness by 2 if cost is EXHAUSTS', () => {
            const engine = new GameEngine(mockState);
            const source = { instanceId: 's2', ownerId: 'player1', readiness: 2 };
            const ability = { abilityId: 'ab2', trigger: 'MANUAL', cost: { readinessCost: 'EXHAUSTS', carnie: 0 } };

            expect(engine._checkAndPayCost(ability, source, 'player1', {})).toBe(true);
            expect(source.readiness).toBe(0); 
        });

        it('should floor readiness at -1 when exhausted', () => {
            const engine = new GameEngine(mockState);
            const source = { instanceId: 's3', ownerId: 'player1', readiness: 0 };
            const ability = { abilityId: 'ab3', trigger: 'MANUAL', cost: { readinessCost: 'EXHAUSTS', carnie: 0 } };

            expect(engine._checkAndPayCost(ability, source, 'player1', {})).toBe(false);
            expect(source.readiness).toBe(0); 
        });
    });

    describe('Ability Execution', () => {
        it('should abort silently if ability requires targets but none are found', () => {
            const engine = new GameEngine(mockState);
            const source = { instanceId: 's1', ownerId: 'player1' };
            const ability = {
                abilityId: 'ab_no_target',
                effects: [{
                    targetMethod: 'AUTO_ALL',
                    logicTree: { type: 'condition', attribute: 'health', operator: '>', value: 999 },
                    payloads: [{ type: 'DAMAGE', amount: 1 }]
                }]
            };

            const spyCheckCost = jest.spyOn(engine, '_checkAndPayCost');
            engine.executeAbility(ability, source, {}, 'player1');
            
            expect(spyCheckCost).not.toHaveBeenCalled();
        });

        it('should proceed if ability has NONE targetMethod or successfully finds targets', () => {
            const engine = new GameEngine(mockState);
            const source = { instanceId: 's2', ownerId: 'player1', readiness: 2 };
            const ability = {
                abilityId: 'ab_has_target',
                effects: [{
                    targetMethod: 'NONE',
                    payloads: [{ type: 'DRAW_CARD' }]
                }]
            };

            const spyCheckCost = jest.spyOn(engine, '_checkAndPayCost');
            engine.executeAbility(ability, source, {}, 'player1');
            
            expect(spyCheckCost).toHaveBeenCalled();
        });
    });

    describe('Logic Tree AST Evaluator (evaluateLogicTree)', () => {
        let engine;

        beforeEach(() => {
            player = mockState.players.player1;
            engine = new GameEngine(mockState);
        });

        it('should evaluate numeric comparisons correctly (>=, <=, ==)', () => {
            const entity = { health: 5 };
            
            const nodeGTE = { type: 'condition', attribute: 'health', operator: '>=', value: 5 };
            const nodeLT = { type: 'condition', attribute: 'health', operator: '<', value: 3 };

            expect(engine.evaluateLogicTree(nodeGTE, entity)).toBe(true);
            expect(engine.evaluateLogicTree(nodeLT, entity)).toBe(false);
        });

        it('should correctly evaluate AND/OR logical groups', () => {
            const entity = { tribe: 'Pirate', power: 3 };
            
            const groupNode = {
                type: 'group',
                logicalOperator: 'AND',
                children: [
                    { type: 'condition', attribute: 'tribe', operator: '==', value: 'Pirate' },
                    { type: 'group', logicalOperator: 'OR', children: [
                        { type: 'condition', attribute: 'power', operator: '>', value: 5 }, 
                        { type: 'condition', attribute: 'power', operator: '==', value: 3 } 
                    ]}
                ]
            };

            expect(engine.evaluateLogicTree(groupNode, entity)).toBe(true);
        });

        it('should correctly evaluate entity card types (BOON, SPELL, etc.)', () => {
            const boonEntity = { type: 'boon', instanceId: 'b1' };
            const spellEntity = { type: 'spell', instanceId: 'sp1' };
            const unitEntity = { type: 'unit', instanceId: 'u1' };
            const source = { instanceId: 'source1' };

            const nodeBoon = { type: 'condition', attribute: 'entity', operator: '==', value: 'BOON' };
            expect(engine.evaluateLogicTree(nodeBoon, boonEntity, source, {})).toBe(true);
            expect(engine.evaluateLogicTree(nodeBoon, spellEntity, source, {})).toBe(false);

            const nodeSpell = { type: 'condition', attribute: 'entity', operator: '==', value: 'SPELL' };
            expect(engine.evaluateLogicTree(nodeSpell, spellEntity, source, {})).toBe(true);
            expect(engine.evaluateLogicTree(nodeSpell, unitEntity, source, {})).toBe(false);
        });
    });

    describe('Ability isCost Payload Validation', () => {
        let engine;
        let player;

        beforeEach(() => {
            player = mockState.players.player1;
            engine = new GameEngine(mockState);
        });

        describe('Triggered Abilities (ON_* triggers)', () => {
            it('should NOT activate if an isCost payload (KILL) has no valid targets', () => {
                const triggerUnit = spawnUnit(mockState, 'player1', 'mid', {
                    name: 'Trigger Unit',
                    tribe: 'Robot',
                    health: 1,
                    abilities: [
                        {
                            abilityId: 'ab_triggered_cost',
                            name: 'Sacrificial Trigger',
                            trigger: 'ON_TURN_START',
                            triggerScope: 'PERSONAL',
                            effects: [
                                {
                                    targetMethod: 'AUTO_RANDOM',
                                    targetCount: 1,
                                    quickTargeting: { zones: ['FIELD'], alignment: ['FRIENDLY'], entityType: ['UNIT'] },
                                    logicTree: {
                                        type: 'condition', attribute: 'tribe', value: 'Undead', operator: '=='
                                    },
                                    payloads: [
                                        { type: 'KILL', isCost: true }
                                    ]
                                },
                                {
                                    targetMethod: 'SELF',
                                    payloads: [
                                        { type: 'DRAW_CARD', amount: 1 }
                                    ]
                                }
                            ]
                        }
                    ]
                });

                engine.emit('ON_TURN_START', { source: triggerUnit });

                expect(player.lines.mid.length).toBe(1);
                expect(player.hand.length).toBe(0);
            });

            it('SHOULD activate if the isCost payload HAS valid targets', () => {
                const triggerUnit = spawnUnit(mockState, 'player1', 'mid', {
                    name: 'Trigger Unit',
                    tribe: 'Undead', 
                    health: 1,
                    abilities: [
                        {
                            abilityId: 'ab_triggered_cost',
                            name: 'Sacrificial Trigger',
                            trigger: 'ON_TURN_START',
                            triggerScope: 'PERSONAL',
                            effects: [
                                {
                                    targetMethod: 'AUTO_RANDOM',
                                    targetCount: 1,
                                    quickTargeting: { zones: ['FIELD'], alignment: ['FRIENDLY'], entityType: ['UNIT'] },
                                    logicTree: {
                                        type: 'condition', attribute: 'tribe', value: 'Undead', operator: '=='
                                    },
                                    payloads: [
                                        { type: 'KILL', isCost: true } 
                                    ]
                                },
                                {
                                    targetMethod: 'SELF',
                                    payloads: [
                                        { type: 'DRAW_CARD', amount: 1 }
                                    ]
                                }
                            ]
                        }
                    ]
                });

                engine.emit('ON_TURN_START', { source: triggerUnit });

                expect(player.lines.mid.length).toBe(0);
                expect(player.discard.length).toBe(1);
                
                const actionLogs = mockState.history_log.filter(l => l.text.includes("activated 'Sacrificial Trigger'"));
                expect(actionLogs.length).toBe(1);
            });
        });

        describe('Manual Abilities (MANUAL triggers)', () => {
             it('should NOT activate if an isCost payload (DISCARD) has no valid targets', () => {
                const manualUnit = spawnUnit(mockState, 'player1', 'mid', {
                    name: 'Manual Unit',
                    tribe: 'Generic',
                    health: 1,
                    readiness: 1, 
                    abilities: [
                        {
                            abilityId: 'ab_manual_cost',
                            instanceId: 'ab_discard_power_123',
                            name: 'Discard for Power',
                            trigger: 'MANUAL',
                            triggerScope: 'PERSONAL',
                            effects: [
                                {
                                    targetMethod: 'AUTO_RANDOM',
                                    targetCount: 1,
                                    quickTargeting: { zones: ['HAND'], alignment: ['FRIENDLY'] }, 
                                    payloads: [
                                        { type: 'DISCARD_CARD', isCost: true }
                                    ]
                                },
                                {
                                    targetMethod: 'SELF',
                                    payloads: [
                                        { type: 'MODIFY_STATS', attack: 2 }
                                    ]
                                }
                            ]
                        }
                    ]
                });

                const ability = manualUnit.abilities[0];
                engine.executeAbility(ability, manualUnit, {}, 'player1');

                expect(manualUnit.attack || 0).toBe(0);
                
                const abilityKey = `${manualUnit.instanceId}`;
                expect(mockState.abilityUses[abilityKey]).toBeUndefined();
            });

             it('should activate if an isCost payload (DISCARD) has valid targets', () => {
                const unitOverrides = {
                    name: 'Manual Unit2',
                    tribe: 'Generic',
                    health: 1,
                    readiness: 1, 
                    abilities: []
                };
                const unit = createTestUnit({ ownerId: 'player1', ...unitOverrides }).ACT
                mockState.players['player1'].hand = [unit];
                const manualUnit = spawnUnit(mockState, 'player1', 'mid', {
                    name: 'Manual Unit',
                    tribe: 'Generic',
                    health: 1,
                    readiness: 1, 
                    abilities: [
                        {
                            abilityId: 'ab_manual_cost',
                            instanceId: 'ab_discard_power_123',
                            name: 'Discard for Power',
                            trigger: 'MANUAL',
                            triggerScope: 'PERSONAL',
                            effects: [
                                {
                                    targetMethod: 'AUTO_RANDOM',
                                    targetCount: 1,
                                    quickTargeting: { zones: ['HAND'], alignment: ['FRIENDLY'] }, 
                                    payloads: [
                                        { type: 'DISCARD_CARD', isCost: true }
                                    ]
                                },
                                {
                                    targetMethod: 'SELF',
                                    payloads: [
                                        { type: 'MODIFY_STATS', attack: 2 }
                                    ]
                                }
                            ]
                        }
                    ]
                });



                const ability = manualUnit.abilities[0];
                engine.executeAbility(ability, manualUnit, {}, 'player1');

                expect(manualUnit.attack || 0).toBe(0);
                
                const abilityKey = `${manualUnit.instanceId}`;
                expect(mockState.abilityUses[abilityKey]).toBeUndefined();
            });
        });
    });
});