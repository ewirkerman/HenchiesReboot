import { jest } from '@jest/globals';
import { GameEngine } from '../../../src/engine/index.js';
import { revertEffect } from '../../../src/engine/actions/core.js';
import { UpdateAbilityLevelAction } from '../../../src/engine/actions/update_ability_level.js';

function createEngine() {
    return new GameEngine({
        activePlayerId: 'player1',
        history_log: [],
        players: {},
        abilityCatalog: [],
        isReconstructing: false
    });
}

describe('UpdateAbilityLevelAction', () => {
    let engine;
    let target;

    beforeEach(() => {
        target = {
            abilities: [{
                abilityId: 'ab_1',
                instanceId: 'ab_inst_1',
                name: 'Power Strike (2)',
                paramX: 2,
                effects: []
            }],
            activeEffects: []
        };
        engine = createEngine();
    });

    test('sets the selected ability X value', () => {
        new UpdateAbilityLevelAction({
            type: 'UPDATE_ABILITY_LEVEL',
            target,
            abilityId: 'ab_1',
            amount: 5
        }).execute(engine);

        expect(target.abilities[0].paramX).toBe(5);
        expect(target.abilities[0].name).toBe('Power Strike (5)');
    });

    test('modifies the selected ability X value by the amount', () => {
        new UpdateAbilityLevelAction({
            type: 'UPDATE_ABILITY_LEVEL',
            target,
            abilityId: 'ab_1',
            amount: -1,
            modify: true
        }).execute(engine);

        expect(target.abilities[0].paramX).toBe(1);
    });

    test('uses the action paramX when the amount is Var X', () => {
        new UpdateAbilityLevelAction({
            type: 'UPDATE_ABILITY_LEVEL',
            target,
            abilityId: 'ab_1',
            amount: 1,
            amountIsX: true,
            paramX: 4
        }).execute(engine);

        expect(target.abilities[0].paramX).toBe(4);
    });

    test('reverts a timed change when the effect expires', () => {
        new UpdateAbilityLevelAction({
            type: 'UPDATE_ABILITY_LEVEL',
            target,
            abilityId: 'ab_1',
            amount: 7,
            duration: 'BRIEF'
        }).execute(engine);

        const [effect] = target.activeEffects;
        target.activeEffects.splice(0, 1);
        revertEffect(engine, target, effect);

        expect(target.abilities[0].paramX).toBe(2);
    });

    test('restores a timed change to a granted ability and its tracker', () => {
        target.activeEffects.push({
            id: 'grant_1',
            type: 'GRANT_ABILITY',
            grantedAbilityId: 'ab_1',
            grantedAbilityInstanceId: 'ab_inst_1',
            grantedAbilityParamX: 2,
            paramX: 2
        });

        new UpdateAbilityLevelAction({
            type: 'UPDATE_ABILITY_LEVEL',
            target,
            abilityId: 'ab_1',
            amount: 6,
            duration: 'BRIEF'
        }).execute(engine);

        expect(target.activeEffects[0].paramX).toBe(6);
        const effect = target.activeEffects.find(activeEffect => activeEffect.type === 'UPDATE_ABILITY_LEVEL');
        target.activeEffects.splice(target.activeEffects.indexOf(effect), 1);
        revertEffect(engine, target, effect);

        expect(target.abilities[0].paramX).toBe(2);
        expect(target.activeEffects[0].paramX).toBe(2);
        expect(target.activeEffects[0].grantedAbilityParamX).toBe(2);
    });

    test('preserves the latest remaining timed change when an earlier one expires', () => {
        new UpdateAbilityLevelAction({
            type: 'UPDATE_ABILITY_LEVEL',
            target,
            abilityId: 'ab_1',
            amount: 5,
            duration: 'BRIEF'
        }).execute(engine);
        new UpdateAbilityLevelAction({
            type: 'UPDATE_ABILITY_LEVEL',
            target,
            abilityId: 'ab_1',
            amount: 8,
            duration: 'TEMPORARY'
        }).execute(engine);

        const [firstEffect, secondEffect] = target.activeEffects;
        target.activeEffects.splice(0, 1);
        revertEffect(engine, target, firstEffect);
        expect(target.abilities[0].paramX).toBe(8);

        target.activeEffects.splice(0, 1);
        revertEffect(engine, target, secondEffect);
        expect(target.abilities[0].paramX).toBe(2);
    });

    test('does not modify the target when the selected ability is missing', () => {
        const originalWarn = console.warn;
        console.warn = jest.fn();
        try {
            new UpdateAbilityLevelAction({
                type: 'UPDATE_ABILITY_LEVEL',
                target,
                abilityId: 'missing',
                amount: 5
            }).execute(engine);
        } finally {
            console.warn = originalWarn;
        }

        expect(target.abilities[0].paramX).toBe(2);
    });
});
