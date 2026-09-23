import { jest } from '@jest/globals';
import { GameEngine } from '../../../src/engine/targeting.js';
import { ACTION_REGISTRY } from '../../../src/engine/actions/action_index.js';

function createPlayer() {
    return {
        resources: { Carnie: { current: 5, max: 5 } },
        lines: {
            avatar: [],
            taunt: [],
            bodyguard: [],
            front: [],
            mid: [],
            back: [],
            sheltered: [],
            sideline: []
        },
        hand: [],
        deck: [],
        discard: [],
        banish: []
    };
}

function createState() {
    return {
        activePlayerId: 'player1',
        history_log: [],
        abilityUses: {},
        players: {
            player1: createPlayer(),
            player2: createPlayer()
        },
        equator: []
    };
}

describe('HIT event', () => {
    let engine;
    let attacker;
    let defender;

    beforeEach(() => {
        attacker = {
            instanceId: 'attacker',
            ownerId: 'player1',
            name: 'Attacker',
            type: 'unit',
            strength: 2,
            health: 3,
            abilities: [],
            flags: []
        };
        defender = {
            instanceId: 'defender',
            ownerId: 'player2',
            name: 'Defender',
            type: 'unit',
            strength: null,
            health: 10,
            abilities: [],
            flags: []
        };

        const state = createState();
        state.players.player1.lines.mid.push(attacker);
        state.players.player2.lines.mid.push(defender);
        engine = new GameEngine(state);
    });

    function runAttack() {
        return new ACTION_REGISTRY.ATTACK({
            source: attacker,
            target: defender
        }).run(engine);
    }

    it('emits MODIFY_HIT and the passive GET_HIT alias once for combat damage', () => {
        const emitSpy = jest.spyOn(engine, 'emit');

        runAttack();

        const hitPayload = emitSpy.mock.calls.find(([eventType]) => eventType === 'MODIFY_HIT')?.[1];
        const getHitPayload = emitSpy.mock.calls.find(([eventType]) => eventType === 'MODIFY_GET_HIT')?.[1];

        expect(hitPayload).toMatchObject({
            source: attacker,
            target: defender,
            amount: 2,
            isCombat: true
        });
        expect(getHitPayload).toBe(hitPayload);
        expect(emitSpy.mock.calls.filter(([eventType]) => eventType === 'MODIFY_HIT')).toHaveLength(1);
    });

    it('allows MODIFY_HIT to increase incoming damage through MODIFY_EVENT amount', () => {
        attacker.abilities.push({
            abilityId: 'fire',
            trigger: 'MODIFY_HIT',
            triggerScope: 'PERSONAL',
            triggerLimit: 'UNLIMITED',
            activation: {
                method: 'NONE',
                logicTree: { type: 'group', logicalOperator: 'AND', children: [] }
            },
            effects: [{
                targetMethod: 'EVENT_TARGET',
                payloads: [{
                    type: 'MODIFY_EVENT',
                    amount: 1,
                    stat: 'amount',
                    duration: 'INSTANT'
                }]
            }]
        });

        runAttack();

        expect(defender.health).toBe(7);
    });

    it('treats zero combat damage as a HIT event', () => {
        attacker.strength = 0;
        const emitSpy = jest.spyOn(engine, 'emit');

        runAttack();

        expect(emitSpy.mock.calls.some(([eventType, payload]) => (
            eventType === 'MODIFY_HIT' && payload.amount === 0 && payload.isCombat === true
        ))).toBe(true);
    });

    it('does not emit a HIT event for a null combat strength', () => {
        attacker.strength = null;
        const emitSpy = jest.spyOn(engine, 'emit');

        runAttack();

        expect(emitSpy.mock.calls.some(([eventType]) => eventType === 'MODIFY_HIT')).toBe(false);
    });
});
