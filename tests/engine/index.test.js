import { jest } from '@jest/globals';
import * as actualUtils from '../../src/engine/utils.js';

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
    getAvatar: jest.fn(),
    resolveResourceKey: jest.fn((state, p, t) => t || 'Carnie'),
    findEntityLocation: jest.fn(() => ({ zone: 'mid' }))
}));

jest.unstable_mockModule('../../src/engine/actions/index.js', () => ({
    ACTION_REGISTRY: {
        'MOCK_ACT': class { run = jest.fn(); },
        'DAMAGE': class { run = jest.fn(); },
        'ACT': class { run = jest.fn(); }
    },
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

    beforeAll(async () => {
        const module = await import('../../src/engine/index.js');
        GameEngine = module.GameEngine;
        
        const actions = await import('../../src/engine/actions/index.js');
        ACTION_REGISTRY = actions.ACTION_REGISTRY;
        ACTION_MANIFEST = actions.ACTION_MANIFEST;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockState = {
            activePlayerId: 'player1',
            history_log: [],
            abilityUses: {},
            players: {
                player1: { resources: { Carnie: { current: 5, max: 5 } }, lines: { mid: [] }, hand: [] },
                player2: { resources: { Carnie: { current: 5, max: 5 } }, lines: { mid: [] }, hand: [] }
            }
        };
    });

    describe('Event Bus & Interceptors', () => {
        it('should cancel the root event if a WOULD_ interceptor cancels the payload', () => {
            const engine = new GameEngine(mockState);
            const targetUnit = {
                instanceId: 't1', ownerId: 'player1',
                abilities: [{
                    abilityId: 'shield',
                    // CHANGED: Match the root event emitted below
                    trigger: 'WOULD_TAKE_DAMAGE', 
                    effects: [{
                        targetMethod: 'EVENT_TARGET',
                        payloads: [{ type: 'CUSTOM_CANCEL_SCRIPT' }]
                    }]
                }]
            };
            mockState.players.player1.lines.mid.push(targetUnit);

            // CHANGED: We ensure the mock includes a passive definition for 'DAMAGE' so the target is checked!
            ACTION_MANIFEST['DAMAGE'] = { passiveType: 'TAKE_DAMAGE' };

            ACTION_REGISTRY['CUSTOM_CANCEL_SCRIPT'] = class {
                constructor(payload) { this.p = payload; }
                run() { this.p.eventContext.cancelled = true; } 
            };

            const payload = { target: targetUnit, amount: 5, cancelled: false };
            
            // Emitting 'TAKE_DAMAGE' will make the engine search for 'WOULD_TAKE_DAMAGE'
            const result = engine.emit('TAKE_DAMAGE', payload);

            expect(result.cancelled).toBe(true);
            expect(payload.cancelled).toBe(true);
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
    });

    describe('Logic Tree AST Evaluator (evaluateLogicTree)', () => {
        let engine;

        beforeEach(() => {
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
    });
});