import { jest } from '@jest/globals';

// Mock dependencies using strict ESM relative paths
jest.unstable_mockModule('../../../src/engine/actions/core.js', () => {
    class MockAction {
        constructor(payload) {
            this.payload = payload;
            this.type = payload.type || 'MOCK_ACTION';
        }
        getLogDepth() { return 1; }
    }
    
    return {
        Action: MockAction,
        ACTION_REGISTRY: {},
        findEntityLocation: jest.fn()
    };
});

describe('AttackAction Combat Logic', () => {
    let AttackAction;
    let core;
    let engine;
    let attacker;
    let defender;

    beforeAll(async () => {
        // Dynamically import the modules AFTER mocks are established
        const attackModule = await import('../../../src/engine/actions/attack.js');
        AttackAction = attackModule.AttackAction;
        core = await import('../../../src/engine/actions/core.js');
    });

    beforeEach(() => {
        jest.clearAllMocks();

        attacker = { 
            instanceId: 'atk_1', name: 'Attacker Unit', type: 'unit', 
            strength: 2, health: 3, abilities: [], flags: [] 
        };
        defender = { 
            instanceId: 'def_1', name: 'Defender Unit', type: 'unit', 
            strength: 2, health: 3, abilities: [], flags: [] 
        };

        engine = {
            state: { history_log: [] },
            emit: jest.fn(),
            utils: {
                hasEngineFlag: jest.fn((state, ent, flag, consume = false) => {
                    if (!ent.flags) return false;
                    const idx = ent.flags.indexOf(flag);
                    if (idx > -1) {
                        if (consume) ent.flags.splice(idx, 1); // Simulate consumption
                        return true;
                    }
                    return false;
                })
            }
        };

        Object.keys(core.ACTION_REGISTRY).forEach(key => delete core.ACTION_REGISTRY[key]);

        core.ACTION_REGISTRY['DEAL_DAMAGE'] = class {
            constructor(payload) { this.payload = payload; }
            run() { 
                if (this.payload.amount !== null && this.payload.amount !== undefined) {
                    this.payload.target.health -= this.payload.amount; 
                }
            }
        };

        core.ACTION_REGISTRY['KILL'] = class {
            constructor(payload) { this.payload = payload; }
            run() { this.payload.target._isDying = true; }
        };

        core.findEntityLocation.mockReturnValue({ zone: 'mid' });
    });

    describe('Initialization & Restrictions', () => {
        it('should abort attack immediately if attacker is Timid and target is an Avatar', () => {
            attacker.flags = ['BLOCK_TARGET_AVATAR'];
            defender.type = 'avatar';

            const action = new AttackAction({ source: attacker, target: defender });
            action.run = action.execute; 
            action.execute(engine);

            expect(engine.emit).not.toHaveBeenCalled();
            expect(engine.state.history_log.some(l => l.text.includes('cannot attack the Avatar'))).toBe(true);
        });

        it('should emit ON_ATTACK and ON_BE_ATTACKED events on a valid attack', () => {
            const payload = { source: attacker, target: defender };
            const action = new AttackAction(payload);
            action.execute(engine);

            expect(engine.emit).toHaveBeenCalledWith('ON_ATTACK', payload);
            expect(engine.emit).toHaveBeenCalledWith('ON_BE_ATTACKED', payload);
            expect(payload.preventReaction).toBe(true);
        });
    });

    describe('Combat Resolution & Speed Phases', () => {
        it('should result in simultaneous damage for standard speed units (Phase 0)', () => {
            const action = new AttackAction({ source: attacker, target: defender });
            action.execute(engine);

            expect(attacker.health).toBe(1);
            expect(defender.health).toBe(1);
            expect(attacker._isDying).toBeFalsy();
            expect(defender._isDying).toBeFalsy();
        });

        it('should trigger KillAction for both if lethal damage is dealt simultaneously', () => {
            attacker.health = 2;
            defender.health = 2;

            const action = new AttackAction({ source: attacker, target: defender });
            action.execute(engine);

            expect(attacker.health).toBe(0);
            expect(defender.health).toBe(0);
            expect(attacker._isDying).toBe(true);
            expect(defender._isDying).toBe(true);
        });

        it('should allow a Fast attacker to kill a standard defender before retaliation (Phase 1)', () => {
            attacker.flags = ['STRIKE_FAST']; 
            attacker.strength = 3; 
            defender.health = 3;

            const action = new AttackAction({ source: attacker, target: defender });
            action.execute(engine);

            expect(defender.health).toBe(0);
            expect(defender._isDying).toBe(true);
            expect(attacker.health).toBe(3); // Untouched
        });

        it('should allow a standard defender to retaliate if they survive a Fast strike', () => {
            attacker.flags = ['STRIKE_FAST'];
            attacker.strength = 2; 
            defender.health = 4;

            const action = new AttackAction({ source: attacker, target: defender });
            action.execute(engine);

            expect(defender.health).toBe(2);
            expect(attacker.health).toBe(1); // Takes 2 damage in return
        });

        it('should allow a standard attacker to strike a Slow defender first (Phase 0 vs Phase -1)', () => {
            defender.flags = ['STRIKE_SLOW']; 
            attacker.strength = 3; 
            defender.health = 3;

            const action = new AttackAction({ source: attacker, target: defender });
            action.execute(engine);

            expect(defender.health).toBe(0);
            expect(defender._isDying).toBe(true);
            expect(attacker.health).toBe(3);
        });

        it('should allow a Fast attacker to kill a Slow defender before retaliation (Phase 1 vs Phase -1)', () => {
            attacker.flags = ['STRIKE_FAST'];
            defender.flags = ['STRIKE_SLOW']; 
            attacker.strength = 3; 
            defender.health = 3;

            const action = new AttackAction({ source: attacker, target: defender });
            action.execute(engine);

            expect(defender.health).toBe(0);
            expect(defender._isDying).toBe(true);
            expect(attacker.health).toBe(3); // Completely untouched
        });

        it('should allow a Fast defender to kill a standard attacker before the attack lands (First Strike Defense)', () => {
            defender.flags = ['STRIKE_FAST']; 
            defender.strength = 3; 
            attacker.health = 3;

            const action = new AttackAction({ source: attacker, target: defender });
            action.execute(engine);

            expect(attacker.health).toBe(0);
            expect(attacker._isDying).toBe(true);
            expect(defender.health).toBe(3); // Defender strikes in Phase 1, avoiding Phase 0 damage
        });

        it('should allow a Slow defender to retaliate in Phase -1 if they survive a standard Phase 0 strike', () => {
            defender.flags = ['STRIKE_SLOW'];
            attacker.strength = 2; // Non-lethal
            defender.health = 4;

            const action = new AttackAction({ source: attacker, target: defender });
            action.execute(engine);

            expect(defender.health).toBe(2);
            expect(attacker.health).toBe(1); // Attacker takes 2 damage in Phase -1
        });

        it('should resolve combat simultaneously if both units are Fast (Phase 1 clash)', () => {
            attacker.flags = ['STRIKE_FAST'];
            defender.flags = ['STRIKE_FAST'];

            const action = new AttackAction({ source: attacker, target: defender });
            action.execute(engine);

            expect(attacker.health).toBe(1);
            expect(defender.health).toBe(1);
        });

        it('should resolve combat simultaneously if both units are Slow (Phase -1 clash)', () => {
            attacker.flags = ['STRIKE_SLOW'];
            defender.flags = ['STRIKE_SLOW'];

            const action = new AttackAction({ source: attacker, target: defender });
            action.execute(engine);

            expect(attacker.health).toBe(1);
            expect(defender.health).toBe(1);
        });

        it('should consume STRIKE_FAST so it only applies to one combat per flag instance', () => {
            attacker.flags = ['STRIKE_FAST']; 
            attacker.strength = 3;
            
            // Combat 1: Attacker is Fast
            const def1 = { ...defender, instanceId: 'def_1', health: 3, strength: 2 };
            new AttackAction({ source: attacker, target: def1 }).execute(engine);
            
            expect(def1.health).toBe(0);
            expect(attacker.health).toBe(3); // Fast kill, takes no damage

            // Combat 2: STRIKE_FAST was consumed, Attacker is now Normal speed
            const def2 = { ...defender, instanceId: 'def_2', health: 3, strength: 2 };
            new AttackAction({ source: attacker, target: def2 }).execute(engine);
            
            expect(def2.health).toBe(0);
            expect(attacker.health).toBe(1); // Simultaneous clash, takes 2 damage
        });

        it('should allow multiple STRIKE_FAST flags to stack for multiple consecutive combats', () => {
            attacker.flags = ['STRIKE_FAST', 'STRIKE_FAST']; 
            attacker.strength = 3;
            
            // Combat 1: Attacker is Fast (1 flag consumed)
            const def1 = { ...defender, instanceId: 'def_1', health: 3 };
            new AttackAction({ source: attacker, target: def1 }).execute(engine);
            expect(def1.health).toBe(0);
            expect(attacker.health).toBe(3); 

            // Combat 2: Attacker is STILL Fast (2nd flag consumed)
            const def2 = { ...defender, instanceId: 'def_2', health: 3 };
            new AttackAction({ source: attacker, target: def2 }).execute(engine);
            expect(def2.health).toBe(0);
            expect(attacker.health).toBe(3); 
        });

        it('should not consume STRIKE_SLOW, applying it persistently across multiple combats', () => {
            defender.flags = ['STRIKE_SLOW']; 
            defender.health = 3;
            attacker.strength = 3; // Lethal normal damage

            // Combat 1: Defender is Slow
            const atk1 = { ...attacker, instanceId: 'atk_1', health: 3 };
            new AttackAction({ source: atk1, target: defender }).execute(engine);
            
            expect(defender.health).toBe(0);
            expect(atk1.health).toBe(3); // Killed before phase -1 retaliation

            // Resurrect defender for Combat 2
            defender.health = 3;
            defender._isDying = false;

            // Combat 2: Defender should STILL be Slow (flag not consumed)
            const atk2 = { ...attacker, instanceId: 'atk_2', health: 3 };
            new AttackAction({ source: atk2, target: defender }).execute(engine);
            
            expect(defender.health).toBe(0);
            expect(atk2.health).toBe(3); // Killed before phase -1 retaliation again!
        });
    });

    describe('Combat Modifiers & State Interruptions', () => {
        it('should prevent defender from dealing damage if they are Dazed (BLOCK_RETALIATE)', () => {
            defender.flags = ['BLOCK_RETALIATE'];
            
            const action = new AttackAction({ source: attacker, target: defender });
            action.execute(engine);

            expect(defender.health).toBe(1); 
            expect(attacker.health).toBe(3); // Retaliation blocked
        });

        it('should not deal damage if a unit\'s strength is null', () => {
            attacker.strength = null;
            defender.strength = null;

            const action = new AttackAction({ source: attacker, target: defender });
            action.execute(engine);

            expect(attacker.health).toBe(3);
            expect(defender.health).toBe(3);
        });

        it('should abort combat loop if a unit is moved off-board mid-combat', () => {
            attacker.flags = ['STRIKE_FAST'];
            
            // Simulate defender bouncing to hand upon taking damage in Phase 1
            core.ACTION_REGISTRY['DEAL_DAMAGE'] = class {
                constructor(payload) { this.payload = payload; }
                run() { 
                    this.payload.target.health -= this.payload.amount;
                    core.findEntityLocation.mockImplementation((eng, ent) => {
                        if (ent.instanceId === defender.instanceId) return { zone: 'hand' };
                        return { zone: 'mid' };
                    });
                }
            };

            const action = new AttackAction({ source: attacker, target: defender });
            action.execute(engine);

            // Phase 1 hits
            expect(defender.health).toBe(1);
            
            // Phase 0 retaliation aborted because defender is in 'hand' now
            expect(attacker.health).toBe(3); 
        });
    });
});