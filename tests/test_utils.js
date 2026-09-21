import { findEntityLocation } from '../src/engine/utils.js';

/**
 * Centralized testing utilities for generating valid game states and entities.
 * Follows the "Front Door" principle: tests should use these instead of 
 * manually hacking object properties to ensure they survive engine refactors.
 */

export function createTestState() {
    return {
        activePlayerId: 'player1',
        history_log: [],
        abilityUses: {},
        players: {
            player1: createTestPlayer(),
            player2: createTestPlayer()
        },
        equator: []
    };
}

export function createTestPlayer() {
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

export function createTestUnit(overrides = {}) {
    const uniqueId = `test_unit_${Math.random().toString(36).substring(7)}`;
    return {
        id: uniqueId,               // Ensure both ID variants are populated
        instanceId: uniqueId,       // so findEntityLocation never fails.
        ownerId: 'player1',
        name: 'Test Unit',
        type: 'unit',
        strength: 2,
        health: 3,
        maxHealth: 3,
        abilities: [],
        flags: [],
        ...overrides
    };
}

export function spawnUnit(state, ownerId, line, unitOverrides = {}) {
    const unit = createTestUnit({ ownerId, ...unitOverrides });
    state.players[ownerId].lines[line].push(unit);
    return unit;
}

export function grantTestAbility(unit, passiveFlags = [], triggerLimit = 'UNLIMITED') {
    unit.abilities.push({
        abilityId: `test_ab_${Math.random().toString(36).substring(7)}`,
        name: 'Test Passive',
        isKeyword: false,
        description: 'Mocked ability for testing',
        developerNotes: '',
        trigger: 'UNTRIGGERABLE',
        additionalTriggers: [],
        triggerScope: 'PERSONAL',
        triggerLimit,
        passiveFlags,
        isValid: true,
        cost: {
            tribeAmount: 0,
            carnie: 0,
            power: 0,
            readinessCost: 'NONE',
            escalates: false,
            reuseIgnoresReadiness: false,
            freeAction: false
        },
        activation: { method: 'NONE' },
        effects: []
    });
}

/**
 * Safely asks the engine where a card currently resides.
 * Returns the zone string (e.g., 'mid', 'discard', 'hand') or null.
 */
export function getEntityZone(engine, entity) {
    const loc = findEntityLocation(engine, entity);
    return loc ? loc.zone : null;
}