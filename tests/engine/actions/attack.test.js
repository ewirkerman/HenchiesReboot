import { jest } from '@jest/globals';
import { GameEngine } from '../../../src/engine/index.js';
import { ACTION_REGISTRY } from '../../../src/engine/actions/action_index.js';
import { createTestState, spawnUnit, grantTestAbility, getEntityZone } from '../../test_utils.js';

describe('AttackAction Combat Logic', () => {
    let AttackAction;
    let engine;
    let state;
    let attacker;
    let defender;

    beforeAll(async () => {
        const attackModule = await import('../../../src/engine/actions/attack.js');
        AttackAction = attackModule.AttackAction;
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Use the factory to guarantee standard board state geometry
        state = createTestState();
        engine = new GameEngine(state);
        
        // Front Door Spawning: They are physically on the board!
        attacker = spawnUnit(state, 'player1', 'mid', { instanceId: 'atk_1', name: 'Attacker' });
        defender = spawnUnit(state, 'player2', 'mid', { instanceId: 'def_1', name: 'Defender' });
    });

    describe('Initialization & Restrictions', () => {
        it('should abort attack immediately if attacker is Timid and target is an Avatar', () => {
            grantTestAbility(attacker, ['BLOCK_TARGET_AVATAR']);
            defender.type = 'avatar';

            const emitSpy = jest.spyOn(engine, 'emit');
            const action = new AttackAction({ source: attacker, target: defender });
            action.execute(engine);

            expect(emitSpy).not.toHaveBeenCalled();
            expect(engine.state.history_log.some(l => l.text.includes('cannot attack the Avatar'))).toBe(true);
        });

        it('should emit ON_ATTACK and ON_BE_ATTACKED events on a valid attack', () => {
            const payload = { source: attacker, target: defender };
            const emitSpy = jest.spyOn(engine, 'emit');
            
            new AttackAction(payload).execute(engine);

            expect(emitSpy).toHaveBeenCalledWith('ON_ATTACK', payload);
            expect(emitSpy).toHaveBeenCalledWith('ON_BE_ATTACKED', payload);
        });
    });

    describe('Combat Resolution & Speed Phases', () => {
        it('should result in simultaneous damage for standard speed units (Phase 0)', () => {
            new AttackAction({ source: attacker, target: defender }).run(engine);

            expect(getEntityZone(engine, attacker)).toBe('mid');
            expect(getEntityZone(engine, defender)).toBe('mid');
            expect(attacker.health).toBe(1);
            expect(defender.health).toBe(1);
        });

        it('should not kill a unit at 0 HP if it never got hit during combat', () => {
            attacker.health = 0; defender.health = 0;
            attacker.strength = null; defender.strength = null;

            new AttackAction({ source: attacker, target: defender }).run(engine);

            // Because no hit occurred, no death check occurred. They survive at 0 HP.
            expect(getEntityZone(engine, attacker)).toBe('mid');
            expect(getEntityZone(engine, defender)).toBe('mid');
            expect(attacker.health).toBe(0);
            expect(defender.health).toBe(0);
        });

        it('should kill a unit at 0 HP if it was hit for 0 damage during combat', () => {
            attacker.health = 0; defender.health = 0;
            attacker.strength = 0; defender.strength = 0;

            new AttackAction({ source: attacker, target: defender }).execute(engine);

            expect(getEntityZone(engine, attacker)).toBe('discard');
            expect(getEntityZone(engine, defender)).toBe('discard');
        });

        it('should trigger KillAction for both if lethal damage is dealt simultaneously', () => {
            attacker.health = 2; defender.health = 2;

            new AttackAction({ source: attacker, target: defender }).execute(engine);

            expect(getEntityZone(engine, attacker)).toBe('discard');
            expect(getEntityZone(engine, defender)).toBe('discard');
        });

        it('should allow a Fast attacker to kill a standard defender before retaliation (Phase 1)', () => {
            grantTestAbility(attacker, ['STRIKE_FAST']);
            attacker.strength = 3; 

            new AttackAction({ source: attacker, target: defender }).run(engine);

            expect(getEntityZone(engine, defender)).toBe('discard');
            expect(getEntityZone(engine, attacker)).toBe('mid');
            expect(attacker.health).toBe(3); // Escaped unscathed
        });

        it('should allow a standard defender to retaliate if they survive a Fast strike', () => {
            grantTestAbility(attacker, ['STRIKE_FAST']);
            attacker.strength = 2; 
            defender.health = 4;

            new AttackAction({ source: attacker, target: defender }).run(engine);

            expect(getEntityZone(engine, defender)).toBe('mid');
            expect(getEntityZone(engine, attacker)).toBe('mid');
            expect(defender.health).toBe(2);
            expect(attacker.health).toBe(1);
        });

        it('should allow a standard attacker to strike a Slow defender first (Phase 0 vs Phase -1)', () => {
            grantTestAbility(defender, ['STRIKE_SLOW']);
            attacker.strength = 3; 

            new AttackAction({ source: attacker, target: defender }).run(engine);

            expect(getEntityZone(engine, defender)).toBe('discard');
            expect(getEntityZone(engine, attacker)).toBe('mid');
            expect(attacker.health).toBe(3);
        });

        it('should allow a Fast attacker to kill a Slow defender before retaliation (Phase 1 vs Phase -1)', () => {
            grantTestAbility(attacker, ['STRIKE_FAST']);
            grantTestAbility(defender, ['STRIKE_SLOW']);
            attacker.strength = 3; 

            new AttackAction({ source: attacker, target: defender }).run(engine);

            expect(getEntityZone(engine, defender)).toBe('discard');
            expect(getEntityZone(engine, attacker)).toBe('mid');
            expect(attacker.health).toBe(3);
        });

        it('should allow a Fast defender to kill a standard attacker before the attack lands (First Strike Defense)', () => {
            grantTestAbility(defender, ['STRIKE_FAST']);
            defender.strength = 3; 

            new AttackAction({ source: attacker, target: defender }).run(engine);

            expect(getEntityZone(engine, attacker)).toBe('discard');
            expect(getEntityZone(engine, defender)).toBe('mid');
            expect(defender.health).toBe(3);
        });

        it('should allow a Slow defender to retaliate in Phase -1 if they survive a standard Phase 0 strike', () => {
            grantTestAbility(defender, ['STRIKE_SLOW']);
            attacker.strength = 2; // Non-lethal
            defender.health = 4;

            new AttackAction({ source: attacker, target: defender }).run(engine);

            expect(getEntityZone(engine, defender)).toBe('mid');
            expect(getEntityZone(engine, attacker)).toBe('mid');
            expect(defender.health).toBe(2);
            expect(attacker.health).toBe(1);
        });

        it('should consume STRIKE_FAST so it only applies to one combat per flag instance', () => {
            grantTestAbility(attacker, ['STRIKE_FAST'], 'ONCE_PER_ROUND');
            attacker.strength = 3;
            
            // Combat 1: Attacker is Fast
            new AttackAction({ source: attacker, target: defender }).run(engine);
            expect(getEntityZone(engine, defender)).toBe('discard');
            expect(attacker.health).toBe(3);

            // Resilient Setup: Front-door spawn a brand new defender for combat 2 
            const defender2 = spawnUnit(state, 'player2', 'mid', { instanceId: 'def_2' });
            
            // Combat 2: Attacker is now normal speed (consumed)
            new AttackAction({ source: attacker, target: defender2 }).run(engine);
            expect(getEntityZone(engine, defender2)).toBe('discard'); // Died to 3 damage
            expect(attacker.health).toBe(1); // Took retaliation from def2
        });

        it('should allow multiple STRIKE_FAST flags to stack for multiple consecutive combats', () => {
            // Give 2 fast flags
            grantTestAbility(attacker, ['STRIKE_FAST'], 'ONCE_PER_ROUND');
            grantTestAbility(attacker, ['STRIKE_FAST'], 'UNLIMITED');
            attacker.strength = 3;
            
            // Combat 1: Uses flag 1
            new AttackAction({ source: attacker, target: defender }).run(engine);
            expect(getEntityZone(engine, defender)).toBe('discard');
            expect(attacker.health).toBe(3);

            // Setup Combat 2 safely
            const defender2 = spawnUnit(state, 'player2', 'mid', { instanceId: 'def_2' });
            
            // Combat 2: Still fast using flag 2
            new AttackAction({ source: attacker, target: defender2 }).run(engine);
            expect(getEntityZone(engine, defender2)).toBe('discard');
            expect(attacker.health).toBe(3); // Escaped retaliation again
        });

        it('should not consume STRIKE_SLOW, applying it persistently across multiple combats', () => {
            grantTestAbility(defender, ['STRIKE_SLOW']);
            attacker.strength = 3; 

            // Combat 1
            new AttackAction({ source: attacker, target: defender }).run(engine);
            expect(getEntityZone(engine, defender)).toBe('discard');
            expect(attacker.health).toBe(3);

            // Resurrecting defender safely via Front Door replacement
            state.players.player2.lines.mid = []; // clear the corpse
            const defender2 = spawnUnit(state, 'player2', 'mid', { instanceId: 'def_2', health: 3, strength: 2 });
            grantTestAbility(defender2, ['STRIKE_SLOW']);

            // Setup new attacker safely
            const attacker2 = spawnUnit(state, 'player1', 'mid', { instanceId: 'atk_2', strength: 3 });

            // Combat 2: Defender is STILL slow
            new AttackAction({ source: attacker2, target: defender2 }).run(engine);
            expect(getEntityZone(engine, defender2)).toBe('discard');
            expect(attacker2.health).toBe(3);
        });
    });

    describe('Combat Modifiers & State Interruptions', () => {
        it('should prevent defender from dealing damage if they are Dazed (BLOCK_RETALIATE)', () => {
            grantTestAbility(defender, ['BLOCK_RETALIATE']);
            
            new AttackAction({ source: attacker, target: defender }).run(engine);

            expect(getEntityZone(engine, defender)).toBe('mid');
            expect(getEntityZone(engine, attacker)).toBe('mid');
            expect(defender.health).toBe(1);
            expect(attacker.health).toBe(3);
        });

        it('should not deal damage if a unit\'s strength is null', () => {
            attacker.strength = null;
            defender.strength = null;

            new AttackAction({ source: attacker, target: defender }).run(engine);

            expect(getEntityZone(engine, defender)).toBe('mid');
            expect(getEntityZone(engine, attacker)).toBe('mid');
            expect(attacker.health).toBe(3);
            expect(defender.health).toBe(3);
        });
    });
});