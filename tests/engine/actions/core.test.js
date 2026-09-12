import { jest } from '@jest/globals';

// Mock dependencies before importing the core module
jest.unstable_mockModule('../../../src/engine/utils.js', () => ({
    isUndoable: jest.fn(() => true)
}));

describe('core.js Action Core & Utilities', () => {
    let core;
    let mockEngine;
    let utilsMock;

    beforeAll(async () => {
        // Dynamically import the module under test after mocks are defined
        core = await import('../../../src/engine/actions/core.js');
        utilsMock = await import('../../../src/engine/utils.js');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup a fresh mock GameEngine for every test
        mockEngine = {
            state: {
                activePlayerId: 'player1',
                _actionDepth: 0,
                _irreversibleActionOccurred: false,
                players: {
                    player1: { 
                        lines: { mid: [], front: [], back: [], sideline: [] }, 
                        hand: [], deck: [], discard: [], banish: [],
                        resources: {} 
                    },
                    player2: { 
                        lines: { mid: [], front: [], back: [], sideline: [] }, 
                        hand: [], deck: [], discard: [], banish: [],
                        resources: {} 
                    }
                },
                equator: [],
                history_log: [],
                abilityCatalog: []
            },
            emit: jest.fn(() => ({ cancelled: false }))
        };

        // Reset the Action Registry
        Object.keys(core.ACTION_REGISTRY).forEach(key => delete core.ACTION_REGISTRY[key]);
    });

    describe('Action Class & Pipeline Execution', () => {
        it('should correctly resolve action type from ACTION_REGISTRY', () => {
            class MOCK_ACTION extends core.Action { execute() {} }
            core.ACTION_REGISTRY['MOCK_ACTION'] = MOCK_ACTION;
            
            const action = new MOCK_ACTION({});
            expect(action.type).toBe('MOCK_ACTION');
        });

        it('should halt execution if WOULD_ event is cancelled', () => {
            class CANCEL_ACTION extends core.Action { execute = jest.fn(); }
            core.ACTION_REGISTRY['CANCEL_ACTION'] = CANCEL_ACTION;
            
            mockEngine.emit.mockImplementation((event) => {
                if (event.startsWith('WOULD_')) return { cancelled: true };
                return { cancelled: false };
            });

            const action = new CANCEL_ACTION({ type: 'CANCEL_ACTION' });
            const result = action.run(mockEngine);

            expect(result).toBe(false);
            expect(action.execute).not.toHaveBeenCalled();
            expect(mockEngine.emit).toHaveBeenCalledWith('WOULD_CANCEL_ACTION', expect.any(Object));
        });

        it('should process leaves play cleanup automatically', () => {
            class LEAVES_PLAY extends core.Action { execute() {} }
            core.ACTION_REGISTRY['LEAVES_PLAY'] = LEAVES_PLAY;
            core.ACTION_MANIFEST['LEAVES_PLAY'] = { isLeavesPlay: true };

            const target = { instanceId: 't1', health: 5, maxHealth: 10, activeEffects: [{ type: 'BUFF', duration: 'TEMPORARY' }] };
            const action = new LEAVES_PLAY({ type: 'LEAVES_PLAY', target });
            
            const spy = jest.spyOn(action, 'processLeavesPlay');
            action.run(mockEngine);

            expect(spy).toHaveBeenCalled();
            expect(target.health).toBe(10); // Reset base stats
            expect(target.activeEffects.length).toBe(0); // Temporary effects wiped
        });
        
        it('should defer leaves play if targeting a fielded unit (non-UNFIELD)', () => {
            class LEAVES_PLAY extends core.Action { execute() {} }
            core.ACTION_REGISTRY['LEAVES_PLAY'] = LEAVES_PLAY;
            core.ACTION_MANIFEST['LEAVES_PLAY'] = { isLeavesPlay: true };

            const target = { instanceId: 't1', health: 5, maxHealth: 10 };
            mockEngine.state.players.player1.lines.front.push(target); // Put on board

            const action = new LEAVES_PLAY({ type: 'LEAVES_PLAY', target });
            action.run(mockEngine);

            // Because it defers to UNFIELD, it should NOT reset base stats yet
            expect(target.health).toBe(5); 
        });

        it('should route executeZoneMovement correctly', () => {
            class MOCK_MOVE extends core.Action { execute() { this.executeZoneMovement(mockEngine, 'discard'); } }
            core.ACTION_REGISTRY['MOCK_MOVE'] = MOCK_MOVE;

            const runMock = jest.fn();
            core.ACTION_REGISTRY['UNFIELD'] = class { constructor() {} run = runMock; };

            const targetOnBoard = { instanceId: 't1' };
            mockEngine.state.players.player1.lines.front.push(targetOnBoard);
            
            new MOCK_MOVE({ target: targetOnBoard }).run(mockEngine);
            expect(runMock).toHaveBeenCalled(); // Fielded unit routed to UNFIELD

            const targetOffBoard = { instanceId: 't2' };
            mockEngine.state.players.player1.hand.push(targetOffBoard);
            
            new MOCK_MOVE({ target: targetOffBoard }).run(mockEngine);
            expect(mockEngine.state.players.player1.discard[0].instanceId).toBe('t2'); // Off board routed directly
        });
    });

    describe('Undo Safety Verification', () => {
        it('should flag irreversible for blind native draws', () => {
            const action = new core.Action({ type: 'DRAW_CARD' });
            action.evaluateUndoSafety(mockEngine);
            expect(mockEngine.state._irreversibleActionOccurred).toBe(true);
        });

        it('should NOT flag irreversible for targeted draws (ctxTarget exists)', () => {
            const action = new core.Action({ 
                type: 'DRAW_CARD', 
                eventContext: { abilityTargetId: 'specific_card_id' } 
            });
            action.evaluateUndoSafety(mockEngine);
            expect(mockEngine.state._irreversibleActionOccurred).toBe(false);
        });

        it('should run isUndoable dynamically against the source ability', () => {
            utilsMock.isUndoable.mockReturnValueOnce(false); 
            mockEngine.state.abilityCatalog.push({ abilityId: 'ab_unsafe' });
            
            const action = new core.Action({ type: 'DAMAGE', sourceAbilityId: 'ab_unsafe' });
            action.evaluateUndoSafety(mockEngine);
            
            expect(utilsMock.isUndoable).toHaveBeenCalled();
            expect(mockEngine.state._irreversibleActionOccurred).toBe(true);
        });
    });

    describe('findEntityLocation & moveEntity', () => {
        it('should locate and move entities across player zones', () => {
            const unit = { instanceId: 'u1' };
            mockEngine.state.players.player1.lines.mid.push(unit);
            
            let loc = core.findEntityLocation(mockEngine, unit);
            expect(loc.playerId).toBe('player1');
            expect(loc.zone).toBe('mid');

            core.moveEntity(mockEngine, unit, 'player2', 'hand');
            
            loc = core.findEntityLocation(mockEngine, unit);
            expect(loc.playerId).toBe('player2');
            expect(loc.zone).toBe('hand');
        });

        it('should locate and move entities to/from the equator', () => {
            const artifact = { instanceId: 'art1' };
            mockEngine.state.players.player1.hand.push(artifact);

            core.moveEntity(mockEngine, artifact, null, 'equator');
            
            const loc = core.findEntityLocation(mockEngine, artifact);
            expect(loc.zone).toBe('equator');
            expect(mockEngine.state.equator[0].instanceId).toBe('art1');
        });

        it('should accurately locate deeply nested attachments', () => {
            const subAttachment = { instanceId: 'att2' };
            const attachment = { instanceId: 'att1', attachments: [subAttachment] };
            const host = { instanceId: 'h1', attachments: [attachment] };
            mockEngine.state.players.player2.lines.front.push(host);
            
            const loc = core.findEntityLocation(mockEngine, subAttachment);
            expect(loc.playerId).toBe('player2');
            expect(loc.zone).toBe('attachment');
            expect(loc.host.instanceId).toBe('att1');
        });

        it('should reset state when moving to the board', () => {
            const card = { instanceId: 'c1', health: -5, maxHealth: 10, _isDying: true };
            mockEngine.state.players.player1.hand.push(card);
            
            core.moveEntity(mockEngine, card, 'player1', 'mid');
            expect(card.health).toBe(10);
            expect(card._isDying).toBe(false);
        });

        it('should reset readiness when moving to deck or banish', () => {
            const card = { instanceId: 'c1', readiness: 1 };
            mockEngine.state.players.player1.hand.push(card);
            
            core.moveEntity(mockEngine, card, 'player1', 'deck');
            expect(card.readiness).toBe(0);
        });
    });

    describe('Effect Registration & Helper Utilities', () => {
        it('should calculate expirations correctly', () => {
            const target = {};
            core.registerEffect(mockEngine, target, { type: 'BUFF', duration: 'TEMPORARY' });
            expect(target.activeEffects[0].expiresAt).toBe('player2'); // Opposite of active (player1)

            core.registerEffect(mockEngine, target, { type: 'BUFF', duration: 'BRIEF' });
            expect(target.activeEffects[1].expiresAt).toBe('player1'); // Same as active
        });

        it('should sweep turn effects and trigger recursive CLEANSE', () => {
            const cleanseRunMock = jest.fn();
            core.ACTION_REGISTRY['CLEANSE'] = class { run = cleanseRunMock; };

            const att = { instanceId: 'att1' };
            const unit = { instanceId: 'u1', attachments: [att] };
            mockEngine.state.players.player1.lines.front.push(unit);

            core.sweepTurnEffects(mockEngine, 'player1');
            
            // Should be called twice: once for unit, once for nested attachment
            expect(cleanseRunMock).toHaveBeenCalledTimes(2);
        });
    });

    describe('Effect Reversion Edge Cases', () => {
        it('should revert MODIFY_STAT and clamp health to new maxHealth', () => {
            const target = { maxHealth: 5, health: 5 }; // Was debuffed
            core.revertEffect(mockEngine, target, { type: 'MODIFY_STAT', stat: 'maxHealth', delta: -5 });
            
            expect(target.maxHealth).toBe(10);
            expect(target.health).toBe(10); // Restored bounds mathematically
        });

        it('should revert MODIFY_RESOURCE by modifying player totals', () => {
            mockEngine.state.players.player1.resources = { Carnie: { current: 5 } };
            const target = { instanceId: 't1' };
            mockEngine.state.players.player1.lines.front.push(target);
            
            core.revertEffect(mockEngine, target, { type: 'MODIFY_RESOURCE', resourceKey: 'Carnie', delta: 2 });
            expect(mockEngine.state.players.player1.resources.Carnie.current).toBe(3); // 5 - 2
        });

        it('should revert line changes (SET_STAT line) by triggering moveEntity', () => {
            const target = { instanceId: 't1', line: 'back', defaultLine: 'front' };
            mockEngine.state.players.player1.lines.back.push(target);
            
            core.revertEffect(mockEngine, target, { type: 'SET_STAT', stat: 'line', originalValue: 'front', id: 'eff1' });
            
            expect(target.line).toBe('front');
            const loc = core.findEntityLocation(mockEngine, target);
            expect(loc.zone).toBe('front'); // Moved successfully
        });

        it('should fall back to remaining effects when reverting generic SET_STAT', () => {
            const target = { 
                power: 10,
                activeEffects: [
                    { type: 'SET_STAT', stat: 'power', amount: 5, id: 'eff1' },
                    { type: 'SET_STAT', stat: 'power', amount: 10, id: 'eff2' } // The one being reverted
                ]
            };
            
            core.revertEffect(mockEngine, target, target.activeEffects[1]);
            // Because eff1 is still active, it falls back to 5 instead of originalValue
            expect(target.power).toBe(5);
        });

        it('should revert GRANT_ABILITY and REMOVE_ABILITY', () => {
            const target = { abilities: [{ abilityId: 'ab_granted' }] };
            
            core.revertEffect(mockEngine, target, { type: 'GRANT_ABILITY', grantedAbilityId: 'ab_granted' });
            expect(target.abilities.length).toBe(0);

            core.revertEffect(mockEngine, target, { 
                type: 'REMOVE_ABILITY', 
                restoredAbilities: [{ abilityId: 'ab_restored' }],
                restoredEffects: [{ type: 'BUFF' }]
            });
            expect(target.abilities[0].abilityId).toBe('ab_restored');
            expect(target.activeEffects[0].type).toBe('BUFF');
        });

        it('should spawn UNATTACH, TRANSFORM, and UNFIELD actions on revert', () => {
            const mockUnfield = jest.fn();
            const mockUnattach = jest.fn();
            const mockTransform = jest.fn();
            
            core.ACTION_REGISTRY['UNFIELD'] = class { run = mockUnfield; };
            core.ACTION_REGISTRY['UNATTACH'] = class { run = mockUnattach; };
            core.ACTION_REGISTRY['TRANSFORM'] = class { run = mockTransform; };

            const target = { 
                instanceId: 't1', 
                attachments: [{ instanceId: 'att1' }] 
            };

            core.revertEffect(mockEngine, target, { type: 'SUMMON' });
            expect(mockUnfield).toHaveBeenCalled();

            core.revertEffect(mockEngine, target, { type: 'ATTACH', sourceId: 'att1' });
            expect(mockUnattach).toHaveBeenCalled();

            core.revertEffect(mockEngine, target, { type: 'TRANSFORM', originalCardId: 'orig1' });
            expect(mockTransform).toHaveBeenCalled();
        });

        it('should return entities to original owners on REBEL/DONATE revert', () => {
            const target = { instanceId: 't1', ownerId: 'player2' };
            mockEngine.state.players.player2.lines.front.push(target); // Currently controlled by p2
            
            core.revertEffect(mockEngine, target, { type: 'REBEL', originalOwnerId: 'player1' });
            
            expect(target.ownerId).toBe('player1');
            const loc = core.findEntityLocation(mockEngine, target);
            expect(loc.playerId).toBe('player1');
        });
    });
});