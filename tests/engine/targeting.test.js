import { jest } from '@jest/globals';

// 1. Mock Engine Dependencies using ESM syntax BEFORE importing the target file
jest.unstable_mockModule('../../src/engine/utils.js', () => ({
    hasEngineFlag: jest.fn(),
    resolveResourceKey: jest.fn((state, p, key) => key), 
    LINES: ['taunt', 'bodyguard', 'avatar', 'front', 'mid', 'back', 'sheltered', 'sideline'],
    isUndoable: jest.fn(() => true)
}));

jest.unstable_mockModule('../../src/engine/index.js', () => ({
    GameEngine: jest.fn().mockImplementation(() => ({
        // Smart mock to handle both empty LogicTrees (Fear) and basic conditionals (Reanimate)
        evaluateLogicTree: jest.fn((tree, target) => {
            if (!tree || !tree.children || tree.children.length === 0) return true;
            if (tree.children[0] && tree.children[0].attribute === 'tribe') {
                return target.tribe === tree.children[0].value;
            }
            return true;
        })
    }))
}));

// Import the target AFTER the mocks are defined
const { getValidAttackTargets, getEntityAvailableActions, getValidAbilityTargets } = await import('../../src/engine/targeting.js');
const { hasEngineFlag } = await import('../../src/engine/utils.js');

describe('targeting.js core logic', () => {
    let mockState;

    beforeEach(() => {
        jest.clearAllMocks();
        // Base state setup
        mockState = {
            players: {
                player1: { 
                    lines: { front: [], taunt: [], mid: [], back: [], sheltered: [], bodyguard: [], avatar: [], sideline: [] }, 
                    hand: [], discard: [], deck: [], banish: [],
                    resources: { 'Carnie': { current: 2, max: 2 }, 'Pirate': { current: 0, max: 0 } } 
                },
                player2: { 
                    lines: { front: [], taunt: [], mid: [], back: [], sheltered: [], bodyguard: [], avatar: [], sideline: [] }, 
                    hand: [], discard: [], deck: [], banish: [],
                    resources: { 'Carnie': { current: 2, max: 2 } } 
                }
            },
            equator: [],
            abilityUses: {}
        };
        
        hasEngineFlag.mockReturnValue(false); // Default false for all flags
    });

    describe('Stealth and Perception', () => {
        it('should block targeting if the target is hidden (BLOCK_TARGETING)', () => {
            const attacker = { id: 'a1', ownerId: 'player1', type: 'unit' };
            const target = { id: 't1', instanceId: 't1', line: 'front' };
            mockState.players.player2.lines.front.push(target);

            hasEngineFlag.mockImplementation((state, ent, flag) => {
                if (ent.id === 't1' && flag === 'BLOCK_TARGETING') return true;
                return false;
            });

            const targets = getValidAttackTargets(mockState, 'player1', attacker);
            expect(targets).toHaveLength(0);
        });

        it('should allow targeting a hidden unit if attacker has perception (IGNORE_BLOCK_TARGETING)', () => {
            const attacker = { id: 'a1', ownerId: 'player1', type: 'unit' };
            const target = { id: 't1', instanceId: 't1', line: 'front' };
            mockState.players.player2.lines.front.push(target);

            hasEngineFlag.mockImplementation((state, ent, flag) => {
                if (ent.id === 't1' && flag === 'BLOCK_TARGETING') return true;
                if (ent.id === 'a1' && flag === 'IGNORE_BLOCK_TARGETING') return true;
                return false;
            });

            const targets = getValidAttackTargets(mockState, 'player1', attacker);
            expect(targets).toHaveLength(1);
            expect(targets[0].id).toBe('t1');
        });
    });

    describe('Battleline Enforcement', () => {
        it('should target Bodyguard or Avatar if Front/Mid/Back/Sheltered are empty', () => {
            const attacker = { id: 'a1', ownerId: 'player1', type: 'unit' };
            mockState.players.player2.lines.bodyguard.push({ id: 'bg1', instanceId: 'bg1', line: 'bodyguard' });
            mockState.players.player2.lines.avatar.push({ id: 'av1', instanceId: 'av1', line: 'avatar' });
            
            const targets = getValidAttackTargets(mockState, 'player1', attacker);
            // Bodyguard takes priority over Avatar, but Avatar is in the same fallback tier check
            expect(targets.some(t => t.id === 'bg1')).toBe(true);
            expect(targets.some(t => t.id === 'av1')).toBe(false); 
        });

        it('should allow targeting Sideline concurrently with main lines, unprotected unless Taunt is present', () => {
            const attacker = { id: 'a1', ownerId: 'player1', type: 'unit' };
            mockState.players.player2.lines.front.push({ id: 'front1', instanceId: 'front1', line: 'front' });
            mockState.players.player2.lines.sideline.push({ id: 'side1', instanceId: 'side1', line: 'sideline' });
            
            const targets = getValidAttackTargets(mockState, 'player1', attacker);
            
            // Front does NOT protect Sideline, both should be targetable
            expect(targets).toHaveLength(2);
            expect(targets.some(t => t.id === 'front1')).toBe(true);
            expect(targets.some(t => t.id === 'side1')).toBe(true);
        });

        it('should protect Sideline if Taunt is present', () => {
            const attacker = { id: 'a1', ownerId: 'player1', type: 'unit' };
            mockState.players.player2.lines.taunt.push({ id: 'taunt1', instanceId: 'taunt1', line: 'taunt' });
            mockState.players.player2.lines.sideline.push({ id: 'side1', instanceId: 'side1', line: 'sideline' });
            
            const targets = getValidAttackTargets(mockState, 'player1', attacker);
            
            // Taunt blocks everything, including Sideline
            expect(targets).toHaveLength(1);
            expect(targets[0].id).toBe('taunt1');
        });

        it('should block attacks against avatars if the attacker is timid (BLOCK_TARGET_AVATAR)', () => {
            const attacker = { id: 'a1', ownerId: 'player1', type: 'unit' };
            mockState.players.player2.lines.avatar.push({ id: 'av1', instanceId: 'av1', type: 'avatar', line: 'avatar' });
            
            hasEngineFlag.mockImplementation((state, ent, flag) => flag === 'BLOCK_TARGET_AVATAR');
            
            const targets = getValidAttackTargets(mockState, 'player1', attacker);
            expect(targets).toHaveLength(0); // Timid prevents targeting the avatar
        });
        
        it('should strictly enforce battlelines for spells if ignoreBattlelines is false', () => {
            const spell = {
                id: 'spell_1', instanceId: 'spell_1', type: 'spell', ownerId: 'player1',
                abilities: [{
                    abilityId: 'ab_1', activation: { method: 'PLAYER_CHOICE', quickTargeting: { zones: ['FIELD'], alignment: ['ENEMY'], entityType: ['UNIT'], ignoreBattlelines: false } }
                }]
            };
            mockState.players.player1.lines.mid.push(spell);
            
            // Player 2 has a Taunt and a Mid unit
            mockState.players.player2.lines.taunt.push({ id: 'taunt1', instanceId: 'taunt1', line: 'taunt' });
            mockState.players.player2.lines.mid.push({ id: 'mid1', instanceId: 'mid1', line: 'mid' });

            const targets = getValidAbilityTargets(mockState, 'player1', 'spell_1', 'ab_1');
            
            expect(targets).toHaveLength(1);
            expect(targets[0].id).toBe('taunt1'); // Because ignoreBattlelines is false, taunt blocked mid
        });
    });

    describe('Equator and Attachments Targeting', () => {
        it('should find targets on the Equator but NEVER target attached cards', () => {
            const spell = {
                id: 'spell_1', instanceId: 'spell_1', ownerId: 'player1',
                abilities: [{
                    abilityId: 'ab_1', activation: { method: 'PLAYER_CHOICE', quickTargeting: { zones: ['FIELD'], entityType: ['EQUIPMENT'], ignoreBattlelines: true } }
                }]
            };
            mockState.players.player1.lines.mid.push(spell);
            
            mockState.equator.push({ id: 'eq_item', instanceId: 'eq_item', type: 'equipment', ownerId: 'player1' });
            mockState.players.player2.lines.mid.push({
                id: 'unit_1', instanceId: 'unit_1', type: 'unit', line: 'mid',
                attachments: [{ id: 'att_item', instanceId: 'att_item', type: 'equipment', ownerId: 'player2' }]
            });

            const targets = getValidAbilityTargets(mockState, 'player1', 'spell_1', 'ab_1');
            
            expect(targets).toHaveLength(1);
            expect(targets.some(t => t.id === 'eq_item')).toBe(true); // Equator item is targetable
            expect(targets.some(t => t.id === 'att_item')).toBe(false); // Attached item is protected/invisible
        });
    });

    describe('Advanced Resource Affordability', () => {
        it('should allow substitution of 3 Carnie for 1 Tribe Resource', () => {
            const unit = {
                id: 'u1', instanceId: 'u1', type: 'unit', readiness: 1, acts: 1, tribe: 'Pirate', ownerId: 'player1',
                abilities: [{ abilityId: 'ab_1', trigger: 'MANUAL', cost: { tribeAmount: 1 } }]
            };
            mockState.players.player1.lines.mid.push(unit);
            
            // Player has 0 Pirate, but has 3 Carnie. 3 Carnie = 1 Tribe Resource.
            mockState.players.player1.resources['Pirate'].current = 0;
            mockState.players.player1.resources['Carnie'].current = 3;

            const actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions).toHaveLength(1); // The substitution makes it affordable
        });

        it('should calculate escalating costs correctly', () => {
            const unit = {
                id: 'u1', instanceId: 'u1', type: 'unit', readiness: 1, acts: 1, ownerId: 'player1',
                lifetimeAbilityUses: { 'ab_1': 2 }, // Ability used twice already
                abilities: [{ abilityId: 'ab_1', trigger: 'MANUAL', cost: { carnie: 1, escalates: 1 } }]
            };
            mockState.players.player1.lines.mid.push(unit);
            
            // Base cost (1) + (Escalates(1) * Uses(2)) = 3 total cost.
            mockState.players.player1.resources['Carnie'].current = 2; // Can't afford 3

            let actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions).toHaveLength(0); 

            mockState.players.player1.resources['Carnie'].current = 3; // Can afford 3
            actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions).toHaveLength(1);
        });

        it('should block abilities that would reduce readiness below -1', () => {
            const unit = {
                id: 'u1', instanceId: 'u1', type: 'unit', readiness: 0, acts: 1, ownerId: 'player1',
                abilities: [{ 
                    abilityId: 'ab_1', trigger: 'MANUAL', activation: { method: 'PLAYER_CHOICE', quickTargeting: { zones: ['FIELD'], ignoreBattlelines: true } },
                    effects: [{ targetMethod: 'SAME_AS_ACTIVATION', payloads: [{ type: 'MODIFY_STAT', stat: 'readiness', amount: -2, isCost: true }] }]
                }]
            };
            mockState.players.player1.lines.mid.push(unit);
            // Give them a valid target
            mockState.players.player2.lines.mid.push({ id: 'target', instanceId: 'target' });
            
            // Trying to use it drops readiness from 0 to -2 (which is below the -1 floor).
            // checkStatCostValidity should filter out the target.
            const targets = getValidAbilityTargets(mockState, 'player1', 'u1', 'ab_1');
            expect(targets).toHaveLength(0);
        });

        it('should allow abilities to ignore readiness if reuseIgnoresReadiness is true and ability was used this turn', () => {
            const unit = {
                id: 'u1', instanceId: 'u1', type: 'unit', readiness: 0, acts: 1, ownerId: 'player1',
                abilities: [{ abilityId: 'ab_1', trigger: 'MANUAL', cost: { readinessCost: 'EXHAUSTS', reuseIgnoresReadiness: true } }]
            };
            mockState.players.player1.lines.mid.push(unit);
            
            mockState.abilityUses['u1_ab_1'] = 1; // Used this turn
            
            const actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions).toHaveLength(1); // Passes readiness check because of reuse flag
        });
    });

    describe('Attack Blocks & Edge Cases', () => {
        it('should filter out native_attack if strength is missing or undefined', () => {
            const unit = { id: 'u1', instanceId: 'u1', type: 'unit', readiness: 1, ownerId: 'player1' }; // No strength
            mockState.players.player1.lines.mid.push(unit);
            mockState.players.player2.lines.mid.push({ id: 'target', instanceId: 'target', line: 'mid' }); // Valid target
            
            const actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions.find(a => a.type === 'ATTACK')).toBeUndefined();
        });

        it('should ALLOW native_attack if strength is exactly 0', () => {
            const unit = { id: 'u2', instanceId: 'u2', type: 'unit', strength: 0, readiness: 1, ownerId: 'player1' }; // 0 strength
            mockState.players.player1.lines.mid.push(unit);
            mockState.players.player2.lines.mid.push({ id: 'target', instanceId: 'target', line: 'mid' }); // Valid target
            
            const actions = getEntityAvailableActions(mockState, 'player1', 'u2');
            expect(actions.find(a => a.type === 'ATTACK')).toBeDefined();
        });

        it('should filter out native_attack if unit has BLOCK_ATTACK flag', () => {
            const unit = { id: 'u1', instanceId: 'u1', type: 'unit', strength: 2, readiness: 1, ownerId: 'player1' };
            mockState.players.player1.lines.mid.push(unit);
            mockState.players.player2.lines.mid.push({ id: 'target', instanceId: 'target', line: 'mid' });
            
            hasEngineFlag.mockImplementation((state, ent, flag) => flag === 'BLOCK_ATTACK');

            const actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions.find(a => a.type === 'ATTACK')).toBeUndefined();
        });
    });

    describe('Hand Activation Filtering', () => {
        it('should hide MANUAL abilities in hand UNLESS they have ACTIVATE_FROM_HAND flag', () => {
            const unit = {
                id: 'u1', instanceId: 'u1', type: 'unit', cost: 0, ownerId: 'player1',
                abilities: [
                    { abilityId: 'ab_no', name: 'No Flag', trigger: 'MANUAL', cost: { carnie: 0 } },
                    { abilityId: 'ab_yes', name: 'Has Flag', trigger: 'MANUAL', passiveFlags: ['ACTIVATE_FROM_HAND'], cost: { carnie: 0 } }
                ]
            };
            mockState.players.player1.hand.push(unit);
            
            const actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            
            // Should have native_play AND ab_yes, but NOT ab_no
            expect(actions).toHaveLength(2);
            expect(actions.find(a => a.abilityId === 'ab_yes')).toBeDefined();
            expect(actions.find(a => a.abilityId === 'ab_no')).toBeUndefined();
        });

        it('should completely omit the ability action if targets are required but 0 are valid', () => {
            const spell = {
                id: 'spell_1', instanceId: 'spell_1', ownerId: 'player1', cost: 0,
                abilities: [{
                    abilityId: 'ab_1', trigger: 'ON_BE_PLAYED', cost: { carnie: 0 },
                    activation: { method: 'PLAYER_CHOICE', quickTargeting: { zones: ['FIELD'], alignment: ['ENEMY'] } } // Requires Enemy
                }]
            };
            mockState.players.player1.hand.push(spell);
            
            // Notice: Player 2's board is completely empty, so there are 0 valid targets.
            
            const actions = getEntityAvailableActions(mockState, 'player1', 'spell_1');
            expect(actions).toHaveLength(0); // Filters out the ability entirely
        });
    });

    describe('Mandatory Plays', () => {
        it('should remove native_play if a mandatory PLAY trigger ability exists', () => {
            const card = {
                id: 'c1', instanceId: 'c1', type: 'unit', ownerId: 'player1', cost: 0,
                abilities: [{
                    abilityId: 'custom_play', name: 'Enter the Fray', trigger: 'PLAY', cost: { carnie: 0 }
                }]
            };
            mockState.players.player1.hand.push(card);

            const actions = getEntityAvailableActions(mockState, 'player1', 'c1');
            
            expect(actions).toEqual(expect.arrayContaining([
                expect.objectContaining({ abilityId: 'custom_play' })
            ]));
            expect(actions).not.toEqual(expect.arrayContaining([
                expect.objectContaining({ abilityId: 'native_play' })
            ]));
        });
    });
        describe('100% Coverage Edge Cases', () => {
        it('should safely return empty arrays when querying non-existent players or null zones', () => {
            const actions = getEntityAvailableActions(mockState, 'player3', 'ghost_id');
            expect(actions).toHaveLength(0);
        });

        it('should target the Avatar if Bodyguard and all front lines are empty', () => {
            // Triggers line 126 (getBattlelineTargets avatar fallback)
            const attacker = { id: 'a1', ownerId: 'player1', type: 'unit', strength: 1, readiness: 1 };
            
            // Ensure all blocking lines are empty
            mockState.players.player2.lines.front = [];
            mockState.players.player2.lines.mid = [];
            mockState.players.player2.lines.bodyguard = [];
            
            // Add the avatar
            const oppAvatar = { id: 'opp_avatar', instanceId: 'opp_avatar', line: 'avatar', type: 'avatar' };
            mockState.players.player2.lines.avatar = [oppAvatar];
            
            const targets = getValidAttackTargets(mockState, 'player1', attacker);
            expect(targets).toHaveLength(1);
            expect(targets[0].id).toBe('opp_avatar');
        });

        it('should process abilities that target the DECK and BANISH zones', () => {
            const deckSpell = {
                id: 'spell_deck', instanceId: 'spell_deck', type: 'spell', ownerId: 'player1',
                abilities: [{
                    abilityId: 'ab_deck', trigger: 'ON_BE_PLAYED', activation: { method: 'PLAYER_CHOICE', quickTargeting: { zones: ['DECK', 'BANISH'] } }
                }]
            };
            mockState.players.player1.hand.push(deckSpell);
            mockState.players.player2.deck = [{ id: 'deck_card', instanceId: 'deck_card' }];
            mockState.players.player2.banish = [{ id: 'banished_card', instanceId: 'banished_card' }];

            const targets = getValidAbilityTargets(mockState, 'player1', 'spell_deck', 'ab_deck');
            expect(targets).toHaveLength(2);
        });

        it('should properly validate tribeAmount costs for Carnie-tribe entities', () => {
            // Triggers line 308 (checkTribeResourceAffordability Carnie-specific branch)
            const carnieUnit = {
                id: 'u_carnie', instanceId: 'u_carnie', type: 'unit', readiness: 1, acts: 1, tribe: 'Carnie', ownerId: 'player1',
                abilities: [{ abilityId: 'ab_carnie', trigger: 'MANUAL', cost: { carnie: 1, tribeAmount: 2 } }]
            };
            mockState.players.player1.lines.mid.push(carnieUnit);
            
            // Needs 1 basic Carnie + 2 Carnie for the Tribe cost = 3 total.
            mockState.players.player1.resources['Carnie'] = { current: 3, max: 3 };
            let actions = getEntityAvailableActions(mockState, 'player1', 'u_carnie');
            expect(actions).toHaveLength(1);

            // Should fail if only 2 Carnie are available
            mockState.players.player1.resources['Carnie'].current = 2;
            actions = getEntityAvailableActions(mockState, 'player1', 'u_carnie');
            expect(actions).toHaveLength(0);
        });

        it('should exclude targets if a stat cost reduces their readiness below -1 (e.g. heavy items)', () => {
            // Triggers stat cost validity checks (preventing readiness from dropping below -1)
            const heavyEquip = {
                id: 'heavy_eq', instanceId: 'heavy_eq', type: 'equipment', ownerId: 'player1',
                abilities: [{
                    abilityId: 'ab_equip', trigger: 'ON_BE_PLAYED', 
                    activation: { method: 'PLAYER_CHOICE', quickTargeting: { zones: ['FIELD'], entityType: ['UNIT'] } },
                    effects: [{ targetMethod: 'SAME_AS_ACTIVATION', payloads: [{ isCost: true, type: 'MODIFY_STAT', stat: 'readiness', amount: -1 }] }]
                }]
            };
            mockState.players.player1.hand.push(heavyEquip);

            const validTarget = { id: 't_valid', instanceId: 't_valid', type: 'unit', line: 'mid', ownerId: 'player1', readiness: 0 };
            const invalidTarget = { id: 't_invalid', instanceId: 't_invalid', type: 'unit', line: 'mid', ownerId: 'player1', readiness: -1 };
            
            mockState.players.player1.lines.mid.push(validTarget, invalidTarget);

            const targets = getValidAbilityTargets(mockState, 'player1', 'heavy_eq', 'ab_equip');
            
            expect(targets).toHaveLength(1);
            expect(targets[0].id).toBe('t_valid');
        });

        it('should parse raw numerical costs on base cards safely', () => {
            const simpleCard = { id: 'simple1', instanceId: 'simple1', type: 'unit', cost: 2, ownerId: 'player1' }; 
            mockState.players.player1.hand.push(simpleCard);
            mockState.players.player1.resources['Carnie'].current = 2; 

            const actions = getEntityAvailableActions(mockState, 'player1', 'simple1');
            expect(actions.some(a => a.abilityId === 'native_play')).toBe(true);
        });
    });
});