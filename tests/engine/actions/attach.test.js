import { jest } from '@jest/globals';

// Mocking core dependencies before importing AttachAction
jest.unstable_mockModule('../../../src/engine/utils.js', () => ({
    findEntityLocation: jest.fn((engine, ent) => {
        if (ent.instanceId === 'host_enemy') return { playerId: 'player2', zone: 'mid' };
        if (ent.instanceId === 'host_friendly') return { playerId: 'player1', zone: 'mid' };
        return null;
    })
}));

jest.unstable_mockModule('../../../src/engine/actions/core.js', () => ({
    Action: class {
        constructor(payload) { this.payload = payload; }
        getLogDepth() { return 0; }
    },
    registerEffect: jest.fn()
}));

describe('AttachAction', () => {
    let AttachAction;

    beforeAll(async () => {
        const module = await import('../../../src/engine/actions/attach.js');
        AttachAction = module.AttachAction;
    });

    it('attaches equipment without changing the original ownerId, even on enemy hosts', () => {
        const engine = {
            state: { history_log: [] },
            processingDepth: 0
        };

        const targetHost = { 
            instanceId: 'host_enemy', 
            name: 'Enemy Squirrel', 
            ownerId: 'player2', 
            attachments: [] 
        };
        const sourceAttachment = { 
            instanceId: 'att1', 
            name: 'Acorn of the Ages', 
            ownerId: 'player1' // Player 1 owns this equipment 
        };

        const action = new AttachAction({
            source: targetHost, 
            target: sourceAttachment 
        });

        action.execute(engine);

        // Verify the attachment is now inside the host's array
        expect(targetHost.attachments).toContain(sourceAttachment);
        
        // CRITICAL: Verify ownership DID NOT change to player2
        expect(sourceAttachment.ownerId).toBe('player1');
    });

    it('prevents duplicate attachments of the exact same instance', () => {
        const engine = { state: { history_log: [] } };
        const targetHost = { instanceId: 'host_friendly', name: 'Ally', ownerId: 'player1', attachments: [] };
        const sourceAttachment = { instanceId: 'att2', name: 'Sword', ownerId: 'player1' };
        
        // Attach first time
        const action1 = new AttachAction({ source: targetHost, target: sourceAttachment });
        action1.execute(engine);
        expect(targetHost.attachments.length).toBe(1);

        // Attempt duplicate attach
        const action2 = new AttachAction({ source: targetHost, target: sourceAttachment });
        action2.execute(engine);
        
        // Should remain 1 to prevent endless array bloat
        expect(targetHost.attachments.length).toBe(1);
    });
});