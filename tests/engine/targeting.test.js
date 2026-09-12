import { jest } from '@jest/globals';
import * as actualUtils from '../../src/engine/utils.js';

jest.unstable_mockModule('../../src/engine/utils.js', () => ({
    ...actualUtils,
    hasEngineFlag: jest.fn(),
    resolveResourceKey: jest.fn((state, p, key) => key), 
    isUndoable: jest.fn(() => true)
}));

jest.unstable_mockModule('../../src/engine/index.js', () => ({
    GameEngine: jest.fn().mockImplementation(() => ({
        evaluateLogicTree: jest.fn(() => true)
    }))
}));

describe('targeting.js core logic', () => {
    let mockState;
    let getValidAttackTargets;
    let getEntityAvailableActions;
    let getValidAbilityTargets;
    let hasEngineFlagMock;

    beforeAll(async () => {
        const targetingModule = await import('../../src/engine/targeting.js');
        getValidAttackTargets = targetingModule.getValidAttackTargets;
        getEntityAvailableActions = targetingModule.getEntityAvailableActions;
        getValidAbilityTargets = targetingModule.getValidAbilityTargets;

        const utilsModule = await import('../../src/engine/utils.js');
        hasEngineFlagMock = utilsModule.hasEngineFlag;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockState = {
            players: {
                player1: { 
                    lines: { front: [], taunt: [], mid: [], bodyguard: [], avatar: [], sheltered: [], sideline: [], back: [] }, 
                    hand: [], discard: [], deck: [], banish: [],
                    resources: { 'Carnie': { current: 2, max: 2 } } 
                },
                player2: { 
                    lines: { front: [], taunt: [], mid: [], bodyguard: [], avatar: [], sheltered: [], sideline: [], back: [] }, 
                    hand: [], discard: [], deck: [], banish: [],
                    resources: { 'Carnie': { current: 2, max: 2 } } 
                }
            },
            equator: []
        };
    });

    describe('Stealth and Perception', () => {
        it('should block targeting if the target is hidden (BLOCK_TARGETING)', () => {
            const attacker = { id: 'a1', ownerId: 'player1', type: 'unit' };
            const target = { id: 't1', instanceId: 't1', line: 'front' };
            mockState.players.player2.lines.front.push(target);

            hasEngineFlagMock.mockImplementation((state, ent, flag) => {
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

            hasEngineFlagMock.mockImplementation((state, ent, flag) => {
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
            const attacker = { id: 'a1', ownerId: 'player1', type: 'unit', strength: 1, readiness: 1 };
            
            const oppAvatar = { id: 'opp_avatar', instanceId: 'opp_avatar', type: 'avatar' };
            mockState.players.player2.lines.avatar = [oppAvatar];
            
            let targets = getValidAttackTargets(mockState, 'player1', attacker);
            expect(targets).toHaveLength(1);
            expect(targets[0].id).toBe('opp_avatar');

            const oppBodyguard = { id: 'opp_bodyguard', instanceId: 'opp_bodyguard', type: 'unit' };
            mockState.players.player2.lines.bodyguard = [oppBodyguard];

            targets = getValidAttackTargets(mockState, 'player1', attacker);
            expect(targets).toHaveLength(1);
            expect(targets[0].id).toBe('opp_bodyguard');
        });

        it('should allow targeting Sideline concurrently with main lines, unprotected unless Taunt is present', () => {
            const attacker = { id: 'a1', ownerId: 'player1', type: 'unit', strength: 2 };
            
            const midUnit = { id: 'mid1', instanceId: 'mid1', line: 'mid' };
            const sideUnit = { id: 'side1', instanceId: 'side1', line: 'sideline' };
            
            mockState.players.player2.lines.mid.push(midUnit);
            mockState.players.player2.lines.sideline.push(sideUnit);

            const targets = getValidAttackTargets(mockState, 'player1', attacker);
            
            expect(targets).toHaveLength(2);
            expect(targets.some(t => t.id === 'mid1')).toBe(true);
            expect(targets.some(t => t.id === 'side1')).toBe(true);
        });

        it('should protect Sideline if Taunt is present', () => {
            const attacker = { id: 'a1', ownerId: 'player1', type: 'unit', strength: 2 };
            
            const tauntUnit = { id: 'taunt1', instanceId: 'taunt1', line: 'taunt' };
            const sideUnit = { id: 'side1', instanceId: 'side1', line: 'sideline' };
            
            mockState.players.player2.lines.taunt.push(tauntUnit);
            mockState.players.player2.lines.sideline.push(sideUnit);

            const targets = getValidAttackTargets(mockState, 'player1', attacker);
            
            expect(targets).toHaveLength(2);
            expect(targets.some(t => t.id === 'taunt1')).toBe(true);
            expect(targets.some(t => t.id === 'side1')).toBe(true);
        });

        it('should block attacks against avatars if the attacker is timid (BLOCK_TARGET_AVATAR)', () => {
            const timidAttacker = { id: 'a1', ownerId: 'player1', type: 'unit', strength: 1, readiness: 1 };
            const oppAvatar = { id: 'opp_avatar', instanceId: 'opp_avatar', type: 'avatar' };
            
            mockState.players.player2.lines.avatar = [oppAvatar];

            hasEngineFlagMock.mockImplementation((state, ent, flag) => {
                if (flag === 'BLOCK_TARGET_AVATAR') return true;
                return false;
            });

            const targets = getValidAttackTargets(mockState, 'player1', timidAttacker);
            expect(targets).toHaveLength(0);
        });

        it('should strictly enforce battlelines for spells if ignoreBattlelines is false', () => {
            const playSpell = {
                id: 'spell_1', instanceId: 'spell_1', type: 'spell', ownerId: 'player1',
                abilities: [{
                    abilityId: 'ab_1', trigger: 'MANUAL',
                    activation: { method: 'PLAYER_CHOICE', quickTargeting: { zones: ['FIELD'], ignoreBattlelines: false, alignment: ['ENEMY'], entityType: ['UNIT'] } }
                }]
            };
            mockState.players.player1.lines.mid.push(playSpell);
            
            mockState.players.player2.lines.mid.push({ id: 'mid1', instanceId: 'mid1', type: 'unit', ownerId: 'player2' });
            mockState.players.player2.lines.taunt.push({ id: 'taunt1', instanceId: 'taunt1', type: 'unit', ownerId: 'player2' });

            const targets = getValidAbilityTargets(mockState, 'player1', 'spell_1', 'ab_1');

            expect(targets).toHaveLength(1);
            expect(targets[0].id).toBe('taunt1'); 
        });
    });

    describe('Equator and Attachments Targeting', () => {
        it('should find targets on the Equator but NEVER target attached cards', () => {
            const playSpell = {
                id: 'spell_1', instanceId: 'spell_1', type: 'spell', ownerId: 'player1',
                abilities: [{
                    abilityId: 'ab_1', trigger: 'MANUAL',
                    activation: { method: 'PLAYER_CHOICE', quickTargeting: { zones: ['FIELD'], ignoreBattlelines: true, entityType: ['EQUIPMENT'] } }
                }]
            };
            mockState.players.player1.lines.mid.push(playSpell);
            
            const equatorItem = { id: 'eq_item', instanceId: 'eq_item', type: 'equipment', ownerId: 'player2' };
            mockState.equator.push(equatorItem);

            const attachedItem = { id: 'att_item', instanceId: 'att_item', type: 'equipment', ownerId: 'player2' };
            const unit = { id: 'u1', instanceId: 'u1', type: 'unit', ownerId: 'player2', attachments: [attachedItem] };
            mockState.players.player2.lines.mid.push(unit);

            const targets = getValidAbilityTargets(mockState, 'player1', 'spell_1', 'ab_1');

            expect(targets).toHaveLength(1);
            expect(targets.some(t => t.id === 'eq_item')).toBe(true); 
            expect(targets.some(t => t.id === 'att_item')).toBe(false); 
        });
    });

    describe('Boon Targeting', () => {
        it('should allow targeting a boon ONLY if the ability explicitly includes BOON in entityType', () => {
            const boonTarget = { id: 'b1', instanceId: 'b1', type: 'boon', line: 'mid', ownerId: 'player2' };
            const unitTarget = { id: 'u1', instanceId: 'u1', type: 'unit', line: 'mid', ownerId: 'player2' };
            
            mockState.players.player2.lines.mid.push(boonTarget, unitTarget);

            const spellExplicit = {
                id: 'spell_boon', instanceId: 'spell_boon', type: 'spell', ownerId: 'player1',
                abilities: [{
                    abilityId: 'ab_boon', trigger: 'MANUAL',
                    activation: { method: 'PLAYER_CHOICE', quickTargeting: { zones: ['FIELD'], entityType: ['BOON'] } }
                }]
            };

            const spellGeneric = {
                id: 'spell_gen', instanceId: 'spell_gen', type: 'spell', ownerId: 'player1',
                abilities: [{
                    abilityId: 'ab_gen', trigger: 'MANUAL',
                    activation: { method: 'PLAYER_CHOICE', quickTargeting: { zones: ['FIELD'] } } // No entityType specified
                }]
            };

            mockState.players.player1.lines.mid.push(spellExplicit, spellGeneric);

            const explicitTargets = getValidAbilityTargets(mockState, 'player1', 'spell_boon', 'ab_boon');
            expect(explicitTargets).toHaveLength(1);
            expect(explicitTargets[0].id).toBe('b1');

            const genericTargets = getValidAbilityTargets(mockState, 'player1', 'spell_gen', 'ab_gen');
            // genericTargets should include 'u1', but skip 'b1' because BOON wasn't explicitly requested
            expect(genericTargets.some(t => t.id === 'b1')).toBe(false);
            expect(genericTargets.some(t => t.id === 'u1')).toBe(true);
        });
    });

    describe('Advanced Resource Affordability', () => {
        it('should return ability action if player can afford Carnie cost', () => {
            const unit = {
                id: 'u1', instanceId: 'u1', type: 'unit', readiness: 1, acts: 1, ownerId: 'player1',
                abilities: [{ abilityId: 'ab_1', name: 'Costly Strike', trigger: 'MANUAL', cost: { carnie: 2 } }]
            };
            mockState.players.player1.lines.mid.push(unit);
            mockState.players.player1.resources['Carnie'].current = 2;

            const actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions).toEqual(expect.arrayContaining([expect.objectContaining({ abilityId: 'ab_1' })]));
        });

        it('should filter out ability action if player lacks required Carnie resources', () => {
            const unit = {
                id: 'u1', instanceId: 'u1', type: 'unit', readiness: 1, acts: 1, ownerId: 'player1',
                abilities: [{ abilityId: 'ab_1', name: 'Costly Strike', trigger: 'MANUAL', cost: { carnie: 3 } }]
            };
            mockState.players.player1.lines.mid.push(unit);

            const actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions).not.toEqual(expect.arrayContaining([expect.objectContaining({ abilityId: 'ab_1' })]));
        });

        it('should allow substitution of 3 Carnie for 1 Tribe Resource', () => {
            const unit = {
                id: 'u1', instanceId: 'u1', type: 'unit', readiness: 1, acts: 1, ownerId: 'player1', tribe: 'Pirate',
                abilities: [{ abilityId: 'ab_tribe', trigger: 'MANUAL', cost: { tribeAmount: 1 } }]
            };
            mockState.players.player1.lines.mid.push(unit);
            mockState.players.player1.resources['Pirate'] = { current: 0, max: 0 }; 
            mockState.players.player1.resources['Carnie'].current = 3; 

            const actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions.some(a => a.abilityId === 'ab_tribe')).toBe(true);
        });

        it('should calculate escalating costs correctly', () => {
            const unit = {
                id: 'u1', instanceId: 'u1', type: 'unit', readiness: 1, acts: 1, ownerId: 'player1',
                lifetimeAbilityUses: { 'ab_esc': 1 }, 
                abilities: [{ abilityId: 'ab_esc', trigger: 'MANUAL', cost: { carnie: 1, escalates: 1 } }]
            };
            mockState.players.player1.lines.mid.push(unit);
            
            mockState.players.player1.resources['Carnie'].current = 1;
            let actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions.some(a => a.abilityId === 'ab_esc')).toBe(false); 

            mockState.players.player1.resources['Carnie'].current = 2;
            actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions.some(a => a.abilityId === 'ab_esc')).toBe(true); 
        });

        it('should block abilities that would reduce readiness below -1', () => {
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

        it('should allow abilities to ignore readiness if reuseIgnoresReadiness is true and ability was used this turn', () => {
            const unit = {
                id: 'u1', instanceId: 'u1', type: 'unit', readiness: 0, acts: 1, ownerId: 'player1',
                abilities: [{ abilityId: 'ab_reuse', trigger: 'MANUAL', cost: { readinessCost: 'UNREADIES', reuseIgnoresReadiness: true } }]
            };
            mockState.players.player1.lines.mid.push(unit);
            
            let actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions.some(a => a.abilityId === 'ab_reuse')).toBe(false); 

            mockState.abilityUses = { 'u1_ab_reuse': 1 };
            actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions.some(a => a.abilityId === 'ab_reuse')).toBe(true); 
        });
    });

    describe('Attack Blocks & Edge Cases', () => {
        it('should filter out native_attack if strength is missing or undefined', () => {
            const item = { id: 'item1', instanceId: 'item1', type: 'equipment', readiness: 1, ownerId: 'player1' }; 
            mockState.players.player1.lines.mid.push(item);
            
            const actions = getEntityAvailableActions(mockState, 'player1', 'item1');
            expect(actions.some(a => a.type === 'ATTACK')).toBe(false);
        });

        it('should ALLOW native_attack if strength is exactly 0', () => {
            const pacifist = { id: 'paci', instanceId: 'paci', type: 'unit', readiness: 1, acts: 1, strength: 0, ownerId: 'player1' }; 
            mockState.players.player1.lines.mid.push(pacifist);
            
            mockState.players.player2.lines.mid.push({ id: 'target', instanceId: 'target', line: 'mid' });

            const actions = getEntityAvailableActions(mockState, 'player1', 'paci');
            expect(actions.some(a => a.type === 'ATTACK')).toBe(true);
        });

        it('should filter out native_attack if unit has BLOCK_ATTACK flag', () => {
            const unit = { id: 'u1', instanceId: 'u1', type: 'unit', readiness: 1, strength: 2, ownerId: 'player1' };
            mockState.players.player1.lines.front.push(unit);
            mockState.players.player2.lines.front.push({ id: 'target', instanceId: 'target', line: 'front' });

            hasEngineFlagMock.mockImplementation((state, ent, flag) => {
                if (flag === 'BLOCK_ATTACK') return true;
                return false;
            });

            const actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions.some(a => a.type === 'ATTACK')).toBe(false);
        });
    });

    describe('Hand Activation Filtering', () => {
        it('should hide MANUAL abilities in hand UNLESS they have ACTIVATE_FROM_HAND flag', () => {
            const unit = {
                id: 'u1', instanceId: 'u1', type: 'unit', ownerId: 'player1', cost: 0,
                abilities: [
                    { abilityId: 'ab_normal', trigger: 'MANUAL' },
                    { abilityId: 'ab_hand', trigger: 'MANUAL', passiveFlags: ['ACTIVATE_FROM_HAND'] }
                ]
            };
            mockState.players.player1.hand.push(unit);

            const actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            
            expect(actions.some(a => a.abilityId === 'ab_normal')).toBe(false);
            expect(actions.some(a => a.abilityId === 'ab_hand')).toBe(true);
        });

        it('should completely omit the ability action if targets are required but 0 are valid', () => {
            const unit = {
                id: 'u1', instanceId: 'u1', type: 'unit', readiness: 1, acts: 1, ownerId: 'player1',
                abilities: [{
                    abilityId: 'ab_target', trigger: 'MANUAL',
                    activation: { method: 'PLAYER_CHOICE', quickTargeting: { zones: ['FIELD'], alignment: ['ENEMY'] } }
                }]
            };
            mockState.players.player1.lines.mid.push(unit);
            
            const actions = getEntityAvailableActions(mockState, 'player1', 'u1');
            expect(actions.some(a => a.abilityId === 'ab_target')).toBe(false);
        });
    });

    describe('Play Triggers Zone Availability', () => {
        it('should make ON_PLAY abilities available when the entity is in the hand', () => {
            const card = {
                id: 'hand_card', instanceId: 'hand_card', type: 'unit', ownerId: 'player1', cost: 0,
                abilities: [{ abilityId: 'ab_on_play', trigger: 'ON_PLAY', cost: { carnie: 0 } }]
            };
            mockState.players.player1.hand.push(card);

            const actions = getEntityAvailableActions(mockState, 'player1', 'hand_card');
            expect(actions.some(a => a.abilityId === 'ab_on_play')).toBe(true);
        });

        it('should completely hide ON_PLAY abilities when the entity is on the board', () => {
            const unit = {
                id: 'board_unit', instanceId: 'board_unit', type: 'unit', ownerId: 'player1', readiness: 1, acts: 1,
                abilities: [{ abilityId: 'ab_on_play', trigger: 'ON_PLAY', cost: { carnie: 0 } }]
            };
            mockState.players.player1.lines.mid.push(unit);

            const actions = getEntityAvailableActions(mockState, 'player1', 'board_unit');
            
            // This should be false, as Play triggers are only relevant when cast from the hand
            expect(actions.some(a => a.abilityId === 'ab_on_play')).toBe(false);
        });
    });

    describe('Mandatory Plays', () => {
        it('should remove native_play if a mandatory PLAY trigger ability exists', () => {
            const card = {
                id: 'c1', instanceId: 'c1', type: 'unit', ownerId: 'player1', cost: 0,
                abilities: [{ abilityId: 'custom_play', name: 'Enter the Fray', trigger: 'PLAY', cost: { carnie: 0 } }]
            };
            mockState.players.player1.hand.push(card);

            const actions = getEntityAvailableActions(mockState, 'player1', 'c1');
            
            expect(actions.some(a => a.abilityId === 'custom_play')).toBe(true);
            expect(actions.some(a => a.abilityId === 'native_play')).toBe(false); 
        });
    });

    describe('100% Coverage Edge Cases', () => {
        it('should natively allow PLAY and PLAY_OPTIONAL abilities to target hidden (BLOCK_TARGETING) units', () => {
            const hiddenEnemy = { id: 'stealth_unit', instanceId: 'stealth_unit', type: 'unit', line: 'mid', ownerId: 'player2' };
            mockState.players.player2.lines.mid.push(hiddenEnemy);

            const playSpell = {
                id: 'spell_strike', instanceId: 'spell_strike', type: 'spell', ownerId: 'player1',
                abilities: [{
                    abilityId: 'ab_play_strike', trigger: 'ON_BE_PLAYED',
                    activation: { method: 'PLAYER_CHOICE', quickTargeting: { zones: ['FIELD'], alignment: ['ENEMY'], entityType: ['UNIT'], ignoreBattlelines: true } }
                }]
            };
            mockState.players.player1.hand.push(playSpell);

            hasEngineFlagMock.mockImplementation((state, ent, flag) => {
                if (ent?.id === 'stealth_unit' && flag === 'BLOCK_TARGETING') return true;
                return false;
            });

            const targets = getValidAbilityTargets(mockState, 'player1', 'spell_strike', 'ab_play_strike');
            expect(targets).toHaveLength(1);
            expect(targets[0].id).toBe('stealth_unit');
        });
    });

    describe('Branch Coverage Corner Cases', () => {
        it('should strictly enforce FRIENDLY and ENEMY alignments', () => {
            const spell = {
                id: 's_align', instanceId: 's_align', type: 'spell', ownerId: 'player1',
                abilities: [
                    { abilityId: 'ab_f', trigger: 'ON_BE_PLAYED', activation: { method: 'PLAYER_CHOICE', quickTargeting: { zones: ['FIELD'], alignment: ['FRIENDLY'] } } },
                    { abilityId: 'ab_e', trigger: 'ON_BE_PLAYED', activation: { method: 'PLAYER_CHOICE', quickTargeting: { zones: ['FIELD'], alignment: ['ENEMY'] } } }
                ]
            };
            mockState.players.player1.hand.push(spell);
            mockState.players.player1.lines.mid.push({ id: 'friend', instanceId: 'friend', type: 'unit', ownerId: 'player1' });
            mockState.players.player2.lines.mid.push({ id: 'enemy', instanceId: 'enemy', type: 'unit', ownerId: 'player2' });

            let targetsF = getValidAbilityTargets(mockState, 'player1', 's_align', 'ab_f');
            expect(targetsF.some(t => t.id === 'enemy')).toBe(false);

            let targetsE = getValidAbilityTargets(mockState, 'player1', 's_align', 'ab_e');
            expect(targetsE.some(t => t.id === 'friend')).toBe(false);
        });

        it('should extract quickTargeting from effects if missing in activation, or return [] if none exists', () => {
            const weirdSpell = {
                id: 'weird_spell', instanceId: 'weird_spell', type: 'spell', ownerId: 'player1',
                abilities: [
                    { abilityId: 'ab_effect_qt', trigger: 'ON_BE_PLAYED', activation: { method: 'PLAYER_CHOICE' }, effects: [{ quickTargeting: { zones: ['FIELD'] } }] },
                    { abilityId: 'ab_no_qt', trigger: 'ON_BE_PLAYED', activation: { method: 'PLAYER_CHOICE' } } 
                ]
            };
            mockState.players.player1.hand.push(weirdSpell);
            mockState.players.player2.lines.mid.push({ id: 't1', instanceId: 't1', type: 'unit', ownerId: 'player2' });

            const targetsWithEffectQt = getValidAbilityTargets(mockState, 'player1', 'weird_spell', 'ab_effect_qt');
            expect(targetsWithEffectQt).toHaveLength(1);

            const targetsWithNoQt = getValidAbilityTargets(mockState, 'player1', 'weird_spell', 'ab_no_qt');
            expect(targetsWithNoQt).toHaveLength(0);
        });

        it('should properly escalate power and tribeAmount costs', () => {
            const escalatingUnit = {
                id: 'esc_unit', instanceId: 'esc_unit', type: 'unit', ownerId: 'player1', power: 1, readiness: 1, acts: 1,
                lifetimeAbilityUses: { 'ab_power': 1, 'ab_tribe': 1 },
                abilities: [
                    { abilityId: 'ab_power', trigger: 'MANUAL', cost: { power: 1, escalates: 1 } },
                    { abilityId: 'ab_tribe', trigger: 'MANUAL', cost: { tribeAmount: 1, escalates: 1 } }
                ]
            };
            mockState.players.player1.lines.mid.push(escalatingUnit);

            const actions = getEntityAvailableActions(mockState, 'player1', 'esc_unit');
            expect(actions.some(a => a.abilityId === 'ab_power')).toBe(false);
            expect(actions.some(a => a.abilityId === 'ab_tribe')).toBe(false);
        });
    });
});