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
            const consoleSpyLog = jest.spyOn(console, 'log').mockImplementation(() => { });
            const consoleSpyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });

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

        it('should read fast/slow props and consume them when requested', () => {
            const ability_fast_1 = { passiveFlags: ['STRIKE_FAST'], triggerLimit: 'ONCE_PER_ROUND', abilityId: 'ab1' };
            const ability_fast_2 = { passiveFlags: ['STRIKE_FAST'], triggerLimit: 'ONCE_PER_ROUND', abilityId: 'ab1' };
            entity.abilities.push(ability_fast_1);
            entity.abilities.push(ability_fast_2);

            const ability_slow = { passiveFlags: ['STRIKE_SLOW'], triggerLimit: 'UNLIMITED', abilityId: 'ab2' };
            entity.abilities.push(ability_slow);

            // Without consume
            expect(utils.hasEngineFlag(mockState, entity, 'STRIKE_SLOW')).toBe(true);
            expect(utils.hasEngineFlag(mockState, entity, 'STRIKE_SLOW')).toBe(true);

            // Unlimited consume
            expect(utils.hasEngineFlag(mockState, entity, 'STRIKE_SLOW', true)).toBe(true);
            expect(utils.hasEngineFlag(mockState, entity, 'STRIKE_SLOW', true)).toBe(true);

            // With consume;
            expect(utils.hasEngineFlag(mockState, entity, 'STRIKE_FAST', true)).toBe(true);
            expect(utils.hasEngineFlag(mockState, entity, 'STRIKE_FAST', true)).toBe(true);
            expect(utils.hasEngineFlag(mockState, entity, 'STRIKE_FAST', true)).toBe(false);
        });

        it('should parse passive flags and limit consumption', () => {
            const ability = { passiveFlags: ['BLOCK_TARGETING'], triggerLimit: 'ONCE_PER_ROUND', abilityId: 'ab1' };
            entity.abilities.push(ability);

            expect(utils.hasEngineFlag(mockState, entity, 'BLOCK_TARGETING')).toBe(true); // Check only
            expect(utils.hasEngineFlag(mockState, entity, 'BLOCK_TARGETING', true)).toBe(true); // Consume 1st time
            expect(mockState.abilityUses['u1_ab1_0']).toBe(1);

            // Second time should return false because limit is hit
            expect(utils.hasEngineFlag(mockState, entity, 'BLOCK_TARGETING')).toBe(false);
        });
    });

    describe('General Purpose State Locator (queryState)', () => {
        let p1Unit, p2Unit, p1EquipOnP1, p1EquipOnP2, p1Spell, p2Spell, eqNeutral, eqP1;

        beforeEach(() => {
            // Set up a complex board state
            p1Unit = { instanceId: 'uA', id: 'unit_a' };
            p1EquipOnP1 = { instanceId: 'e1', id: 'equip_1' }; // Implicitly owned by P1 due to zone
            p1Unit.attachments = [p1EquipOnP1];
            mockPlayer1.lines.front.push(p1Unit);

            p2Unit = { instanceId: 'uB', id: 'unit_b' };
            p1EquipOnP2 = { instanceId: 'e2', id: 'equip_2', ownerId: 'player1' }; // Explicit P1 owner, physically on P2's board!
            p2Unit.attachments = [p1EquipOnP2];
            mockPlayer2.lines.front.push(p2Unit);

            p1Spell = { instanceId: 's1', id: 'fireball' };
            mockPlayer1.hand.push(p1Spell);

            p2Spell = { instanceId: 's2', id: 'fireball' };
            mockPlayer2.hand.push(p2Spell);

            eqNeutral = { instanceId: 'eq1', id: 'token' };
            eqP1 = { instanceId: 'eq2', id: 'token', ownerId: 'player1' };
            mockState.equator.push(eqNeutral, eqP1);
        });

        it('should expand zone aliases and find entities in specific zones', () => {
            // BOARD alias includes front line
            let loc = utils.queryState(mockState, { zones: ['BOARD'], target: { instanceId: 'uA' } });
            expect(loc).not.toBeNull();
            expect(loc.zone).toBe('front');

            // PILES alias includes hand, but not front line
            loc = utils.queryState(mockState, { zones: ['PILES'], target: { instanceId: 'uA' } });
            expect(loc).toBeNull();

            // PILES finds the spell in hand
            loc = utils.queryState(mockState, { zones: ['PILES'], target: { instanceId: 's1' } });
            expect(loc).not.toBeNull();
            expect(loc.zone).toBe('hand');
        });

        it('should traverse attachments to find entities and return their host', () => {
            const loc = utils.queryState(mockState, { zones: ['BOARD'], target: { instanceId: 'e1' } });
            expect(loc).not.toBeNull();
            expect(loc.zone).toBe('attachment');
            expect(loc.host).toBe(p1Unit);
        });

        it('should skip attachments if ignoreAttachments is true', () => {
            const loc = utils.queryState(mockState, { zones: ['BOARD'], target: { instanceId: 'e1' }, ignoreAttachments: true });
            expect(loc).toBeNull();
        });

        it('should support findAll to return an array of all matches', () => {
            // Find all fireballs anywhere (no zones specified defaults to ALL)
            const locs = utils.queryState(mockState, { target: { id: 'fireball' }, findAll: true });
            expect(locs.length).toBe(2);
            expect(locs[0].array[locs[0].index]).toBe(p1Spell);
            expect(locs[1].array[locs[1].index]).toBe(p2Spell);
        });

        it('should distinguish between spatial (players) and logical (ownedBy) queries', () => {
            // Spatial: Search ONLY Player 2's board lines.
            // Logical: Filter ONLY for items owned by Player 1.
            const locs = utils.queryState(mockState, {
                players: ['player2'],
                zones: ['LINES'],
                ownedBy: 'player1',
                target: c => true, // Predicate function matches anything that passes the ownership check
                findAll: true
            });

            expect(locs.length).toBe(1);
            expect(locs[0].array[locs[0].index]).toBe(p1EquipOnP2); // Found the cross-board attachment!
            expect(locs[0].host).toBe(p2Unit);
            expect(locs[0].playerId).toBe('player2'); // It correctly reports its spatial physical location
        });

        it('should evaluate implicit and explicit ownership correctly on the Equator', () => {
            // Equator tokens. P1 explicitly owns eq2, nobody owns eq1.
            let locs = utils.queryState(mockState, { zones: ['equator'], ownedBy: 'player1', target: c => true, findAll: true });
            expect(locs.length).toBe(1);
            expect(locs[0].array[locs[0].index]).toBe(eqP1);

            // Searching for targets with no owner restrictions
            locs = utils.queryState(mockState, { zones: ['equator'], target: { id: 'token' }, findAll: true });
            expect(locs.length).toBe(2);
        });

        it('should accept custom predicate functions for complex target matching', () => {
            const loc = utils.queryState(mockState, { target: c => c.id === 'unit_b' });
            expect(loc).not.toBeNull();
            expect(loc.array[loc.index]).toBe(p2Unit);
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
            const unit = { id: 'card1', instanceId: 'u1' };
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

        it('isNameOrIdOnBoard should check generic id and name for uniqueness, ignoring attachments and opponent cards', () => {
            const cardInHand = { id: 'unique_hero', instanceId: 'hand_inst_1', name: 'Original Name' };
            const myBoardCard = { id: 'unique_hero', instanceId: 'board_inst_2', name: 'Original Name' };
            const oppBoardCard = { id: 'unique_hero', instanceId: 'board_inst_3', name: 'Original Name' };
            const altArtCard = { id: 'alt_hero_id', instanceId: 'board_inst_4', name: 'Original Name' };

            // 1. Not on board
            expect(utils.isNameOrIdOnBoard(mockState, 'player1', cardInHand)).toBe(false);

            // 2. Opponent has it (should still be false for player 1)
            mockPlayer2.lines.front.push(oppBoardCard);
            expect(utils.isNameOrIdOnBoard(mockState, 'player1', cardInHand)).toBe(false);

            // 3. Player 1 has it on board (different instance, same generic ID)
            mockPlayer1.lines.front.push(myBoardCard);
            expect(utils.isNameOrIdOnBoard(mockState, 'player1', cardInHand)).toBe(true);

            // 4. On board (different ID entirely, but exact same name)
            mockPlayer1.lines.front = [];
            mockPlayer1.lines.front.push(altArtCard);
            expect(utils.isNameOrIdOnBoard(mockState, 'player1', cardInHand)).toBe(true);

            // 5. Ignore attachments
            mockPlayer1.lines.front = []; // clear board
            const hostUnit = { id: 'some_guy', instanceId: 'host_1', attachments: [myBoardCard] };
            mockPlayer1.lines.front.push(hostUnit);

            // Should be false because uniqueness checks do not search inside attachments
            expect(utils.isNameOrIdOnBoard(mockState, 'player1', cardInHand)).toBe(false);
        });

        // The specific regression test for the Debbie Downer bug
        it('should strictly match instanceId to prevent cross-player collisions (Debbie Downer bug)', () => {
            // Player 1 has a card on board
            const p1Card = { id: 'debbie_downer', instanceId: 'p1_dd_123' };
            mockPlayer1.lines.front.push(p1Card);

            // Player 2 has the exact same generic card in hand
            const p2Card = { id: 'debbie_downer', instanceId: 'p2_dd_456' };
            mockPlayer2.hand.push(p2Card);

            // If we search for Player 2's specific instance, it MUST NOT return Player 1's card
            // even though Player 1's card is evaluated first in the loops and has the same generic 'id'.
            const loc = utils.findEntityLocation(mockState, p2Card);

            expect(loc).not.toBeNull();
            expect(loc.playerId).toBe('player2');
            expect(loc.zone).toBe('hand');
            expect(loc.array[loc.index]).toBe(p2Card);
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

            mockState.abilityCatalog.push({ abilityId: 'heavy', passiveFlags: ['ATTACK_EXHAUSTS'], name: 'Sluggish' });
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

            // Player 1 fails if it costs 3 TribeA (Since 2 TribeA + floor((5-2)/3)=1 == 3)
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

        it('evaluatePayment should calculate exact deduction values and fallbacks without modifying state', () => {
            const cost = { carnie: 2, tribeAmount: 3, escalates: false };
            const testEntity = { tribe: 'TribeA', power: 0 };

            // Give player 5 Carnie, 2 TribeA. 
            // Expected Cost: 2 Base Carnie + 2 TribeA + 1 Missing TribeA converted to 3 Carnie.
            // Expected Deductions: 5 Carnie, 2 TribeA
            const result = utils.evaluatePayment(mockState, mockPlayer1, testEntity, cost);

            expect(result.success).toBe(true);
            expect(result.entityTribe).toBe('TribeA');
            expect(result.carnieDeduct).toBe(5); // 2 base + 3 converted
            expect(result.tribeDeduct).toBe(2);  // Used all 2 available

            // Verify it was a PURE function (no state actually modified yet)
            expect(mockPlayer1.resources.TribeA.current).toBe(2);
            expect(mockPlayer1.resources.Carnie.current).toBe(5);
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

    describe('isAutoCast', () => {
        it('should return true for default mandatory auto-cast abilities', () => {
            const ability = { trigger: 'ON_BE_PLAYED', isSelectable: false, activation: { method: 'AUTO' } };
            expect(utils.isAutoCast(ability)).toBe(true);
        });

        it('should return false if trigger is not ON_BE_PLAYED', () => {
            const ability = { trigger: 'ON_DEATH', isSelectable: false, activation: { method: 'AUTO' } };
            expect(utils.isAutoCast(ability)).toBe(false);
        });

        it('should return false if ability isSelectable', () => {
            const ability = { trigger: 'ON_BE_PLAYED', isSelectable: true, activation: { method: 'AUTO' } };
            expect(utils.isAutoCast(ability)).toBe(false);
        });

        it('should return false if activation method is PLAYER_CHOICE', () => {
            const ability = { trigger: 'ON_BE_PLAYED', isSelectable: false, activation: { method: 'PLAYER_CHOICE' } };
            expect(utils.isAutoCast(ability)).toBe(false);
        });
    });

    describe('Entity Movement & Location (moveEntity, findEntityLocation)', () => {
        let mockEngine;
        let target;

        beforeEach(() => {
            mockEngine = { state: mockState };
            target = { instanceId: 't1', health: -5, maxHealth: 10, readiness: 10, _isDying: true };
            mockPlayer1.lines.front.push(target);
        });

        it('should reset health and _isDying when moving to a board zone', () => {
            utils.moveEntity(mockEngine, target, 'player1', 'back');
            expect(target._isDying).toBe(false);
            expect(target.health).toBe(10);
            expect(mockPlayer1.lines.front.length).toBe(0);
            expect(mockPlayer1.lines.back[0]).toBe(target);
        });

        it('should reset readiness floor when moving to deck or banish', () => {
            utils.moveEntity(mockEngine, target, 'player1', 'banish');
            expect(target.readiness).toBe(0); // Readiness floor test
            expect(mockPlayer1.banish[0]).toBe(target);

            // Test moving to deck also resets readiness
            target.readiness = 5;
            utils.moveEntity(mockEngine, target, 'player1', 'deck');
            expect(target.readiness).toBe(0);
        });

        it('should place entity in equator correctly', () => {
            utils.moveEntity(mockEngine, target, null, 'equator');
            expect(mockState.equator[0]).toBe(target);
        });

        it('should find entity in nested attachments (host scoped events)', () => {
            const deepAttachment = { instanceId: 'att2' };
            const attached = { instanceId: 'att1', attachments: [deepAttachment] };
            target.attachments = [attached]; // target is on front line

            // Find first level attachment
            let loc = utils.findEntityLocation(mockEngine, attached);
            expect(loc).not.toBeNull();
            expect(loc.zone).toBe('attachment');
            expect(loc.host).toBe(target);

            // Find deeply nested attachment
            loc = utils.findEntityLocation(mockEngine, deepAttachment);
            expect(loc).not.toBeNull();
            expect(loc.zone).toBe('attachment');
            expect(loc.host).toBe(attached);
        });

        it('should return null if findEntityLocation cannot find target', () => {
            const loc = utils.findEntityLocation(mockEngine, { instanceId: 'ghost' });
            expect(loc).toBeNull();
        });

        it('findEntityLocation should normalize arguments, accepting either an Engine or a State object', () => {
            const unit = { instanceId: 'norm1' };
            mockPlayer1.lines.front.push(unit);

            // 1. Test passing the engine (legacy support)
            const engineResult = utils.findEntityLocation(mockEngine, unit);
            expect(engineResult).not.toBeNull();
            expect(engineResult.zone).toBe('front');

            // 2. Test passing the raw state (new support for utils)
            const stateResult = utils.findEntityLocation(mockState, unit);
            expect(stateResult).not.toBeNull();
            expect(stateResult.zone).toBe('front');

            // Ensure both methods yield the exact same internal reference
            expect(engineResult.array[engineResult.index]).toBe(stateResult.array[stateResult.index]);
        });
    });

    describe('Factory Functions (instantiateAbility, instantiateEntity)', () => {
        let catalogAbs;

        beforeEach(() => {
            catalogAbs = [
                { abilityId: 'ab_1', name: 'Fireball', trigger: 'ON_PLAY' }
            ];
        });

        describe('instantiateAbility', () => {
            it('should deeply clone and assign a UUID to a resolved ability', () => {
                const inst = utils.instantiateAbility('ab_1', catalogAbs);
                expect(inst.name).toBe('Fireball');
                expect(inst.instanceId).toMatch(/^ab_inst_/);
            });

            it('should bypass regeneration and return clone if ability already has instanceId', () => {
                const existing = { abilityId: 'ab_1', instanceId: 'ab_inst_already_set', name: 'Original' };
                const inst = utils.instantiateAbility(existing, catalogAbs);
                expect(inst.instanceId).toBe('ab_inst_already_set');
                expect(inst).not.toBe(existing); // Should be a deep clone
            });
        });

        describe('instantiateEntity', () => {
            it('should deeply clone and assign correct prefixes based on entity type', () => {
                const token = utils.instantiateEntity({ id: 't1', isToken: true }, catalogAbs);
                expect(token.instanceId).toMatch(/^sum_/);

                const unit = utils.instantiateEntity({ id: 'u1', type: 'unit' }, catalogAbs);
                expect(unit.instanceId).toMatch(/^ent_/);
            });

            it('should assign item_ prefix to equipment, buff, and debuff card types', () => {
                const equip = utils.instantiateEntity({ id: 'e1', type: 'equipment' }, catalogAbs);
                expect(equip.instanceId).toMatch(/^item_/);

                const buff = utils.instantiateEntity({ id: 'b1', type: 'buff' }, catalogAbs);
                expect(buff.instanceId).toMatch(/^item_/);

                const debuff = utils.instantiateEntity({ id: 'd1', type: 'debuff' }, catalogAbs);
                expect(debuff.instanceId).toMatch(/^item_/);
            });

            it('should bypass regeneration and return clone if entity already has instanceId', () => {
                const existing = { id: 'u1', instanceId: 'ent_already_set' };
                const inst = utils.instantiateEntity(existing, catalogAbs);
                expect(inst.instanceId).toBe('ent_already_set');
                expect(inst).not.toBe(existing); // Should be a deep clone
            });

            it('should assign ownerId and originalOwnerId if provided', () => {
                const inst = utils.instantiateEntity({ id: 'u1' }, catalogAbs, null, 'player1');
                expect(inst.ownerId).toBe('player1');
                expect(inst.originalOwnerId).toBe('player1');
            });

            it('should reset health to maxHealth if provided health is <= 0', () => {
                const inst = utils.instantiateEntity({ id: 'u1', maxHealth: 4, health: -2 }, catalogAbs);
                expect(inst.health).toBe(4);
            });
        });
    });
});