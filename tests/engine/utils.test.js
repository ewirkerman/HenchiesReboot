import { jest } from '@jest/globals';
import * as utils from '../../src/engine/utils.js';

describe('Engine Utilities (utils.js)', () => {
    let mockState;
    let mockPlayer1;
    let mockPlayer2;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup pristine state for each test
        mockPlayer1 = {
            id: 'player1',
            name: 'Player 1',
            lines: { front: [], mid: [], back: [], avatar: [] },
            hand: [], deck: [], discard: [], banish: [],
            resources: { Carnie: { current: 5, max: 5 }, TribeA: { current: 2, max: 2 } }
        };

        mockPlayer2 = {
            id: 'player2',
            name: 'Player 2',
            lines: { front: [], mid: [], back: [], avatar: [] },
            hand: [], deck: [], discard: [], banish: [],
            resources: { Carnie: { current: 5, max: 5 } }
        };

        mockState = {
            status: 'active',
            players: { player1: mockPlayer1, player2: mockPlayer2 },
            equator: [],
            abilityCatalog: [],
            tribeCatalog: [
                { id: 'tribe_a', name: 'Tribe A' },
                { id: 'carnie', name: 'Carnie' }
            ],
            abilityUses: {}
        };
    });

    describe('isUndoable', () => {
        it('should return false if the game is finished', () => {
            mockState.status = 'finished';
            expect(utils.isUndoable(mockState, {})).toBe(false);
        });

        it('should return true if ability has no effects', () => {
            expect(utils.isUndoable(mockState, {})).toBe(true);
            expect(utils.isUndoable(mockState, { effects: [] })).toBe(true);
        });

        it('should return false if group targetMethod is AUTO_RANDOM', () => {
            const ability = { effects: [{ targetMethod: 'AUTO_RANDOM' }] };
            expect(utils.isUndoable(mockState, ability)).toBe(false);
        });

        it('should return false for inherently unsafe payload types', () => {
            const types = ['SHUFFLE', 'MILL', 'CUSTOM_SCRIPT', 'TOP_DECK'];
            types.forEach(type => {
                const ability = { effects: [{ payloads: [{ type }] }] };
                expect(utils.isUndoable(mockState, ability)).toBe(false);
            });
        });

        it('should return false for DISCARD if targeting enemy hand', () => {
            const ability = {
                effects: [{
                    quickTargeting: { alignment: ['ENEMY'], zones: ['HAND'] },
                    payloads: [{ type: 'DISCARD' }]
                }]
            };
            expect(utils.isUndoable(mockState, ability)).toBe(false);
        });

        it('should return true for DISCARD if targeting friendly hand', () => {
            const ability = {
                effects: [{
                    quickTargeting: { alignment: ['FRIENDLY'], zones: ['HAND'] },
                    payloads: [{ type: 'DISCARD' }]
                }]
            };
            expect(utils.isUndoable(mockState, ability)).toBe(true);
        });

        it('should correctly evaluate DRAW_CARD safety (Only PLAYER_CHOICE is safe)', () => {
            // Unsafe: No method provided (blind draw)
            let ab = { effects: [{ payloads: [{ type: 'DRAW_CARD' }] }] };
            expect(utils.isUndoable(mockState, ab)).toBe(false);

            // Unsafe: Random targeting
            ab = { effects: [{ payloads: [{ type: 'DRAW_CARD', targetMethod: 'AUTO_RANDOM' }] }] };
            expect(utils.isUndoable(mockState, ab)).toBe(false);

            // Safe: SpecificallyPLAYER_CHOICE
            ab = { effects: [{ payloads: [{ type: 'DRAW_CARD', targetMethod: 'PLAYER_CHOICE' }] }] };
            expect(utils.isUndoable(mockState, ab)).toBe(true);

            // Safe: Inherited PLAYER_CHOICE from activation
            ab = {
                activation: { method: 'PLAYER_CHOICE' },
                effects: [{ targetMethod: 'SAME_AS_ACTIVATION', payloads: [{ type: 'DRAW_CARD' }] }]
            };
            expect(utils.isUndoable(mockState, ab)).toBe(true);
        });
    });

    describe('Resource & Base Utilities', () => {
        it('getResKey should normalize tribe names', () => {
            expect(utils.getResKey('tribe_carnie')).toBe('Carnie');
            expect(utils.getResKey('Generic')).toBe('Generic');
            expect(utils.getResKey('tribe_a')).toBe('tribe_a');
            expect(utils.getResKey(undefined)).toBe('Generic');
        });

        it('resolveResourceKey should fallback through state catalog and player resources', () => {
            // Match via player resources (priority)
            expect(utils.resolveResourceKey(mockState, mockPlayer1, 'Tribe A')).toBe('TribeA');
            
            // Match via state catalog (fallback when player doesn't have it)
            const emptyPlayer = { resources: {} };
            expect(utils.resolveResourceKey(mockState, emptyPlayer, 'Tribe A')).toBe('tribe_a');

            // Match Carnie specifically
            expect(utils.resolveResourceKey(mockState, mockPlayer1, 'tribe_carnie')).toBe('Carnie');
        });

        it('should suppress logs and warnings when state is reconstructing', () => {
            const consoleSpyLog = jest.spyOn(console, 'log').mockImplementation(() => {});
            const consoleSpyWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            
            mockState.isReconstructing = true;
            utils.log(mockState, 'test');
            utils.warn(mockState, 'test');
            expect(consoleSpyLog).not.toHaveBeenCalled();
            expect(consoleSpyWarn).not.toHaveBeenCalled();

            mockState.isReconstructing = false;
            utils.log(mockState, 'test');
            utils.warn(mockState, 'test');
            expect(consoleSpyLog).toHaveBeenCalled();
            expect(consoleSpyWarn).toHaveBeenCalled();
            
            consoleSpyLog.mockRestore();
            consoleSpyWarn.mockRestore();
        });
    });

    describe('hasEngineFlag', () => {
        let entity;

        beforeEach(() => {
            entity = { instanceId: 'u1', activeEffects: [], abilities: [], fast: 0, slow: 0 };
        });

        it('should respect IGNORE_ override flags', () => {
            entity.activeEffects.push({ type: 'BLOCK_ACT' });
            entity.activeEffects.push({ type: 'IGNORE_BLOCK_ACT' });
            expect(utils.hasEngineFlag(mockState, entity, 'BLOCK_ACT')).toBe(false);
        });

        it('should detect direct active effect types', () => {
            entity.activeEffects.push({ type: 'BLOCK_RETALIATE' });
            expect(utils.hasEngineFlag(mockState, entity, 'BLOCK_RETALIATE')).toBe(true);
        });

        it('should read fast/slow props and consume them when requested', () => {
            entity.fast = 2;
            entity.slow = 1;

            // Without consume
            expect(utils.hasEngineFlag(mockState, entity, 'STRIKE_FAST')).toBe(true);
            expect(entity.fast).toBe(2);

            // With consume
            expect(utils.hasEngineFlag(mockState, entity, 'STRIKE_FAST', true)).toBe(true);
            expect(entity.fast).toBe(1); // Decremented
            expect(utils.hasEngineFlag(mockState, entity, 'STRIKE_SLOW', true)).toBe(true);
            expect(entity.slow).toBe(0); // Decremented
        });

        it('should parse passive flags and limit consumption', () => {
            const ability = { passiveFlags: ['BLOCK_TARGETING'], triggerLimit: 'ONCE_PER_ROUND', abilityId: 'ab1' };
            entity.abilities.push(ability);
            
            expect(utils.hasEngineFlag(mockState, entity, 'BLOCK_TARGETING')).toBe(true); // Check only
            expect(utils.hasEngineFlag(mockState, entity, 'BLOCK_TARGETING', true)).toBe(true); // Consume 1st time
            expect(mockState.abilityUses['u1_ab1']).toBe(1);
            
            // Second time should return false because limit is hit
            expect(utils.hasEngineFlag(mockState, entity, 'BLOCK_TARGETING')).toBe(false);
        });

        it('should map specific hardcoded ability names to engine flags', () => {
            entity.abilities.push({ name: 'Dazed' });
            expect(utils.hasEngineFlag(mockState, entity, 'BLOCK_ACT')).toBe(true);
            expect(utils.hasEngineFlag(mockState, entity, 'BLOCK_RETALIATE')).toBe(true);

            entity.abilities.push({ name: 'Hidden' });
            expect(utils.hasEngineFlag(mockState, entity, 'BLOCK_TARGETING')).toBe(true);

            entity.abilities.push({ name: 'Timid' });
            expect(utils.hasEngineFlag(mockState, entity, 'BLOCK_TARGET_AVATAR')).toBe(true);
        });

        it('should detect abilities granted via active effects', () => {
            mockState.abilityCatalog.push({ abilityId: 'ab_swift', name: 'Swift' });
            entity.activeEffects.push({ type: 'GRANT_ABILITY', grantedAbilityId: 'ab_swift' });
            
            expect(utils.hasEngineFlag(mockState, entity, 'STRIKE_FAST')).toBe(true);
        });
    });

    describe('Entity Tracking (getOwnerId, findEntity, isEntityOnBoard)', () => {
        it('getOwnerId should return direct properties immediately', () => {
            expect(utils.getOwnerId(mockState, { ownerId: 'player1' })).toBe('player1');
            expect(utils.getOwnerId(mockState, { originalOwnerId: 'player2' })).toBe('player2');
            expect(utils.getOwnerId(mockState, { playerId: 'player1' })).toBe('player1');
        });

        it('getOwnerId should parse Avatar specific IDs', () => {
            expect(utils.getOwnerId(mockState, { type: 'avatar', id: 'player1_avatar' })).toBe('player1');
            expect(utils.getOwnerId(mockState, { type: 'avatar', id: 'avatar_player2' })).toBe('player2');
        });

        it('getOwnerId should fallback to physical state search', () => {
            const unit = { instanceId: 'u1' };
            mockPlayer2.lines.mid.push(unit);
            
            expect(utils.getOwnerId(mockState, { instanceId: 'u1' })).toBe('player2');

            const spell = { instanceId: 'sp1' };
            mockPlayer1.discard.push(spell);
            expect(utils.getOwnerId(mockState, { instanceId: 'sp1' })).toBe('player1');
        });

        it('findEntity should locate entities across state boundaries', () => {
            const equatorCard = { instanceId: 'eq1' };
            mockState.equator.push(equatorCard);
            expect(utils.findEntity(mockState, null, 'eq1')).toBe(equatorCard);

            const boardUnit = { instanceId: 'bu1' };
            mockPlayer1.lines.front.push(boardUnit);
            expect(utils.findEntity(mockState, 'player1', 'bu1')).toBe(boardUnit);

            const handCard = { instanceId: 'hc1' };
            mockPlayer2.hand.push(handCard);
            expect(utils.findEntity(mockState, 'player2', 'hc1')).toBe(handCard);
        });

        it('isEntityOnBoard should return true only for board zones and equator', () => {
            const unit = { id: 'card1' };
            expect(utils.isEntityOnBoard(mockState, unit)).toBe(false);

            mockPlayer1.lines.mid.push(unit);
            expect(utils.isEntityOnBoard(mockState, unit)).toBe(true);

            mockPlayer1.lines.mid = [];
            mockState.equator.push(unit);
            expect(utils.isEntityOnBoard(mockState, unit)).toBe(true);

            mockState.equator = [];
            mockPlayer1.hand.push(unit);
            expect(utils.isEntityOnBoard(mockState, unit)).toBe(false); // Hand is not board
        });
    });

    describe('Cost Mechanics (canAffordCost, payCost, calculateEscalatedCostValues)', () => {
        let costObj;
        let entity;

        beforeEach(() => {
            costObj = { carnie: 2, tribeAmount: 1, escalates: false };
            entity = { tribe: 'TribeA', power: 0 };
        });

        it('getAttackCost should correctly flag exhaust requirements', () => {
            expect(utils.getAttackCost(mockState, {})).toEqual({ readinessCost: 'UNREADIES' });
            
            mockState.abilityCatalog.push({ abilityId: 'heavy', name: 'Sluggish' });
            const slowEnt = { abilities: ['heavy'] };
            expect(utils.getAttackCost(mockState, slowEnt)).toEqual({ readinessCost: 'EXHAUSTS' });
        });

        it('calculateEscalatedCostValues should escalate the primary resource', () => {
            let cost = { carnie: 2, power: 1, escalates: true };
            // Escalates power first if it exists
            expect(utils.calculateEscalatedCostValues(cost, 1)).toEqual({ cCost: 2, pCost: 2, tCost: 0 });

            cost = { carnie: 2, tribeAmount: 1, escalates: true };
            // Escalates tribe if power doesn't exist
            expect(utils.calculateEscalatedCostValues(cost, 2)).toEqual({ cCost: 2, pCost: 0, tCost: 3 });

            cost = { carnie: 2, escalates: true };
            // Escalates carnie if nothing else
            expect(utils.calculateEscalatedCostValues(cost, 2)).toEqual({ cCost: 4, pCost: 0, tCost: 0 });
        });

        it('canAffordCost should evaluate exact resources required', () => {
            // Player 1 has 5 Carnie, 2 TribeA
            expect(utils.canAffordCost(mockState, mockPlayer1, entity, costObj)).toEqual({ success: true });

            // Player 1 fails if it costs 3 TribeA (Since 2 TribeA + floor((5-2)/3)=1 == 3) Wait, math:
            // Need 3. Has 2 Tribe. Remainder Carnie = 5-2 = 3. 3/3 = 1 conversion. Total = 3. Should succeed!
            costObj.tribeAmount = 3;
            expect(utils.canAffordCost(mockState, mockPlayer1, entity, costObj)).toEqual({ success: true });

            // Fail: Cost is 4 TribeA. Max capacity is 2 + (3/3) = 3.
            costObj.tribeAmount = 4;
            expect(utils.canAffordCost(mockState, mockPlayer1, entity, costObj)).toEqual({ success: false, reason: 'Not enough resources (Need 4)' });
        });

        it('canAffordCost should enforce minimum tribe requirements for playing cards', () => {
            // Player has 5 Carnie, 0 TribeA
            mockPlayer1.resources.TribeA.current = 0;
            costObj.tribeAmount = 1;
            
            // Fails specifically because isCardPlay = true enforces at least 1 true tribe resource
            expect(utils.canAffordCost(mockState, mockPlayer1, entity, costObj, 0, true))
                .toEqual({ success: false, reason: 'Must use at least 1 Tribe Resource for the card' });

            // Succeeds if isCardPlay = false (allows pure Carnie conversion for abilities)
            expect(utils.canAffordCost(mockState, mockPlayer1, entity, costObj, 0, false)).toEqual({ success: true });
        });

        it('payCost should deduct resources correctly and handle carnie conversions', () => {
            // Player has 5 Carnie, 2 TribeA
            // Cost: 2 Carnie, 3 TribeA (Requires 2 TribeA + 1 Carnie Conversion (3 Carnie))
            costObj.carnie = 2;
            costObj.tribeAmount = 3;

            utils.payCost(mockState, mockPlayer1, entity, costObj);

            // Expect: TribeA goes from 2 -> 0.
            // Carnie goes from 5 -> 3 (paying base cost) -> 0 (paying the 3 converted for the last TribeA).
            expect(mockPlayer1.resources.TribeA.current).toBe(0);
            expect(mockPlayer1.resources.Carnie.current).toBe(0);
        });
    });

    describe('hydrateAbility & cloneGameState', () => {
        it('hydrateAbility should clone and inject paramX into all payloads deeply', () => {
            const catalog = [{
                abilityId: 'ab_1',
                name: 'Scale',
                effects: [{
                    payloads: [
                        { type: 'DAMAGE', amountIsX: true, amount: 0 },
                        { type: 'SUMMON', nestedGroup: { payloads: [{ type: 'BUFF', amountIsX: true, amount: 0 }] } }
                    ]
                }]
            }];

            const hydrated = utils.hydrateAbility({ abilityId: 'ab_1', paramX: 3 }, catalog);

            expect(hydrated.name).toBe('Scale (3)');
            expect(hydrated.paramX).toBe(3);
            expect(hydrated.effects[0].payloads[0].amount).toBe(3);
            expect(hydrated.effects[0].payloads[0].amountIsX).toBeUndefined(); // Gets deleted
            expect(hydrated.effects[0].payloads[1].nestedGroup.payloads[0].amount).toBe(3);
        });

        it('hydrateAbility should invert paramX mathematically if base amount is negative (healing/debuff)', () => {
            const catalog = [{
                abilityId: 'ab_heal',
                effects: [{ payloads: [{ type: 'HEAL', amountIsX: true, amount: -1 }] }]
            }];

            const hydrated = utils.hydrateAbility({ abilityId: 'ab_heal', paramX: 4 }, catalog);
            expect(hydrated.effects[0].payloads[0].amount).toBe(-4);
        });

        it('cloneGameState should preserve non-enumerable catalogs', () => {
            mockState.abilityCatalog = [{ id: 1 }];
            mockState.catalog = [{ id: 2 }];
            mockState.tribeCatalog = [{ id: 3 }];

            const clone = utils.cloneGameState(mockState);
            
            // Verify deep clone of physical state
            expect(clone.players.player1.id).toBe('player1');
            
            // Verify non-enumerable preservation
            expect(clone.abilityCatalog[0].id).toBe(1);
            expect(clone.catalog[0].id).toBe(2);
            expect(clone.tribeCatalog[0].id).toBe(3);
        });
    });
});