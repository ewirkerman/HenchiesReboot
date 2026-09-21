import { jest } from '@jest/globals';
import { GrantAbilityAction } from '../../../src/engine/actions/grant_ability.js';
import { GameEngine } from '../../../src/engine/index.js';

function createPlayer() {
    return {
        resources: { Carnie: { current: 5, max: 5 } },
        lines: { avatar: [], taunt: [], bodyguard: [], front: [], mid: [], back: [], sheltered: [], sideline: [] },
        hand: [], deck: [], discard: [], banish: []
    };
}

describe('GrantAbilityAction', () => {
    let engine;
    let target;
    const originalConsoleLog = console.log;

    beforeEach(() => {
        jest.clearAllMocks();
        
        console.log = jest.fn(); // Suppress intentional logs during tests

        target = {
            instanceId: 'unit_1',
            name: 'Test Unit',
            type: 'unit',
            abilities: [],
            activeEffects: []
        };

        const state = {
            activePlayerId: 'player1',
            history_log: [],
            abilityUses: {},
            abilityCatalog: [
                { abilityId: 'ab_1', name: 'Test Ability' }
            ],
            players: {
                player1: createPlayer(),
                player2: createPlayer()
            },
            equator: [],
            isReconstructing: false
        };
        engine = new GameEngine(state);
    });

    afterEach(() => {
        console.log = originalConsoleLog;
    });

    describe('Validation', () => {
        it('should do nothing if target is missing', () => {
            const action = new GrantAbilityAction({ grantedAbilityId: 'ab_1' });
            
            // Should exit gracefully without throwing or mutating
            expect(() => action.execute(engine)).not.toThrow();
        });

        it('should do nothing if grantedAbilityId is missing', () => {
            const action = new GrantAbilityAction({ target: target });
            
            expect(() => action.execute(engine)).not.toThrow();
            expect(target.abilities.length).toBe(0);
        });
    });

    describe('Ability Instantiation', () => {
        it('should initialize target.abilities array if it does not exist', () => {
            delete target.abilities;
            
            const action = new GrantAbilityAction({ 
                target: target, 
                grantedAbilityId: 'ab_1',
                duration: 'TEMPORARY' // Verifies registerEffect side-effects
            });
            action.execute(engine);
            
            expect(target.abilities).toBeDefined();
            expect(target.abilities.length).toBe(1);
            expect(target.abilities[0].abilityId).toBe('ab_1');
            
            // Verifies registerEffect successfully pushed the active effect
            expect(target.activeEffects.length).toBe(1);
            expect(target.activeEffects[0].type).toBe('GRANT_ABILITY');
        });

        it('should correctly format abRef with paramX if provided', () => {
            const action = new GrantAbilityAction({ 
                target: target, 
                grantedAbilityId: 'ab_1',
                grantedAbilityParamX: 3
            });
            action.execute(engine);
            
            expect(target.abilities.length).toBe(1);
            expect(target.abilities[0].abilityId).toBe('ab_1');
            expect(target.abilities[0].paramX).toBe(3);
            expect(target.abilities[0].name).toContain('(3)');
        });

        it('should fallback to an unresolved ability if catalog lookup fails', () => {
            const action = new GrantAbilityAction({ 
                target: target, 
                grantedAbilityId: 'missing_ab'
            });
            action.execute(engine);
            
            expect(target.abilities[0].abilityId).toBe('missing_ab');
            expect(target.abilities[0].name).toBe('Unresolved: missing_ab');
        });
    });

    describe('Duplicate Blocking', () => {
        it('should bypass block checking if blockDuplicates is false', () => {
            target.abilities.push({ abilityId: 'ab_1' }); // Duplicate exists
            
            const action = new GrantAbilityAction({ 
                target: target, 
                grantedAbilityId: 'ab_1',
                blockDuplicates: false 
            });
            action.execute(engine);
            
            expect(target.abilities.length).toBe(2); // Successfully pushed duplicate
        });

        it('should block and abort if target already has ability with same abilityId', () => {
            target.abilities.push({ abilityId: 'ab_1', name: 'Test Ability' }); 
            
            const action = new GrantAbilityAction({ 
                target: target, 
                grantedAbilityId: 'ab_1',
                blockDuplicates: true 
            });
            action.execute(engine);
            
            expect(target.abilities.length).toBe(1); 
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('duplicate prevented'));
        });

        it('should block and abort if target already has string ability in array', () => {
            target.abilities.push('ab_1'); 
            
            const action = new GrantAbilityAction({ 
                target: target, 
                grantedAbilityId: 'ab_1',
                blockDuplicates: true 
            });
            action.execute(engine);
            
            expect(target.abilities.length).toBe(1); 
        });

        it('should block and abort if target has activeEffect granting the ability by ID', () => {
            target.activeEffects.push({ type: 'GRANT_ABILITY', grantedAbilityId: 'ab_1' });
            
            const action = new GrantAbilityAction({ 
                target: target, 
                grantedAbilityId: 'ab_1',
                blockDuplicates: true 
            });
            action.execute(engine);
            
            expect(target.abilities.length).toBe(0); 
        });

        it('should not console.log the duplicate prevention if engine is reconstructing', () => {
            engine.state.isReconstructing = true;
            target.abilities.push({ abilityId: 'ab_1', name: 'Test Ability' }); 
            
            const action = new GrantAbilityAction({ 
                target: target, 
                grantedAbilityId: 'ab_1',
                blockDuplicates: true 
            });
            action.execute(engine);
            
            expect(console.log).not.toHaveBeenCalled();
        });
    });
});