import { jest } from '@jest/globals';

describe('ConditionalAction', () => {
    let ConditionalAction;
    let ACTION_REGISTRY;

    beforeAll(async () => {
        ({ ConditionalAction, ACTION_REGISTRY } = await import('../../../src/engine/actions/action_index.js'));
    });

    beforeEach(() => {
        Object.keys(ACTION_REGISTRY).forEach(key => delete ACTION_REGISTRY[key]);
    });

    it('runs all nested actions against the considered unit, ignoring nested targeting metadata', () => {
        const run = jest.fn();
        ACTION_REGISTRY.TEST = class { constructor(payload) { this.payload = payload; } run(engine) { run(this.payload, engine); } };
        const source = { instanceId: 'source' };
        const target = { instanceId: 'target' };
        const eventContext = { abilityId: 'ability' };
        const engine = { evaluateLogicTree: jest.fn(() => true) };

        new ConditionalAction({
            type: 'CONDITIONAL', source, target, eventContext,
            logicTree: { type: 'group', children: [] },
            nestedGroup: { targetMethod: 'AUTO_RANDOM', targetCount: 99, payloads: [{ type: 'TEST' }, { type: 'TEST', invertRoles: true }] }
        }).execute(engine);

        expect(engine.evaluateLogicTree).toHaveBeenCalledWith(expect.any(Object), target, source, eventContext);
        expect(run).toHaveBeenNthCalledWith(1, expect.objectContaining({ source, target, eventContext }), engine);
        expect(run).toHaveBeenNthCalledWith(2, expect.objectContaining({ source: target, target: source, eventContext }), engine);
    });

    it('does not run nested actions when the condition fails', () => {
        const run = jest.fn();
        ACTION_REGISTRY.TEST = class { run() { run(); } };
        const engine = { evaluateLogicTree: jest.fn(() => false) };

        new ConditionalAction({
            type: 'CONDITIONAL', target: {}, source: {},
            logicTree: { type: 'group', children: [{ type: 'condition' }] },
            nestedGroup: { payloads: [{ type: 'TEST' }] }
        }).execute(engine);

        expect(run).not.toHaveBeenCalled();
    });

    it('runs elsePayloads when the condition fails', () => {
        const run = jest.fn();
        ACTION_REGISTRY.TEST = class { constructor(payload) { this.payload = payload; } run() { run(this.payload); } };
        const source = { instanceId: 'source' };
        const target = { instanceId: 'target' };
        const engine = { evaluateLogicTree: jest.fn(() => false) };

        new ConditionalAction({
            type: 'CONDITIONAL', source, target,
            nestedGroup: { payloads: [{ type: 'TEST', amount: 1 }] },
            elsePayloads: [{ type: 'TEST', amount: 2 }]
        }).execute(engine);

        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith(expect.objectContaining({ amount: 2, source, target }));
    });

    it('runs the true branch and ignores elsePayloads when the condition passes', () => {
        const run = jest.fn();
        ACTION_REGISTRY.TEST = class { constructor(payload) { this.payload = payload; } run() { run(this.payload); } };
        const source = { instanceId: 'source' };
        const target = { instanceId: 'target' };
        const engine = { evaluateLogicTree: jest.fn(() => true) };

        new ConditionalAction({
            type: 'CONDITIONAL', source, target,
            nestedGroup: { payloads: [{ type: 'TEST', amount: 1 }] },
            elsePayloads: [{ type: 'TEST', amount: 2 }]
        }).execute(engine);

        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith(expect.objectContaining({ amount: 1, source, target }));
    });
});