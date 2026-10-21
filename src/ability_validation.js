export const UNPREVENTABLE_TRIGGERS = [
    'MANUAL', 'UNTRIGGERABLE', 'TURN_STARTING', 'TURN_STARTED',
    'TURN_ENDING', 'TURN_ENDED', 'OWN_TURN_STARTING', 'OWN_TURN_STARTED',
    'OWN_TURN_ENDING', 'OWN_TURN_ENDED', 'OPP_TURN_STARTING', 'OPP_TURN_STARTED',
    'OPP_TURN_ENDING', 'OPP_TURN_ENDED', 'ON_ACT', 'ON_COMBAT_ENDED', 'COMBAT_ENDED'
];

export const MODIFIABLE_EVENTS = [
    'DAMAGE', 'HEAL', 'ATTACK', 'STAT', 'RESOURCE',
    'DRAW', 'DISCARD', 'RECOVER', 'SUMMON'
];

export const SYSTEM_TRIGGERS = [
    'UNTRIGGERABLE', 'TURN_STARTING', 'TURN_STARTED',
    'TURN_ENDING', 'TURN_ENDED', 'OWN_TURN_STARTING', 'OWN_TURN_STARTED',
    'OWN_TURN_ENDING', 'OWN_TURN_ENDED', 'OPP_TURN_STARTING', 'OPP_TURN_STARTED',
    'OPP_TURN_ENDING', 'OPP_TURN_ENDED', 'ON_ACT'
];

export const STRICTLY_POSITIVE_ACTIONS = [
    'DEAL_DAMAGE', 'HEAL', 'DRAW_CARD', 'DISCARD',
    'DISCARD_CARD', 'TRASH', 'RECOVER', 'SUMMON'
];

export function getValidScopes(trigger) {
    const clean = (trigger || '').toUpperCase();
    if ([
        'MANUAL', 'UNTRIGGERABLE',
        'OWN_TURN_STARTING', 'OWN_TURN_STARTED', 'OWN_TURN_ENDING', 'OWN_TURN_ENDED',
        'OPP_TURN_STARTING', 'OPP_TURN_STARTED', 'OPP_TURN_ENDING', 'OPP_TURN_ENDED'
    ].includes(clean)) {
        return ['PERSONAL'];
    }
    return ['PERSONAL', 'HOST', 'GLOBAL'];
}

export function getValidActivationMethods(trigger, scope) {
    const clean = (trigger || '').toUpperCase();
    const allowedTriggers = ['MANUAL', 'PLAY', 'PLAY_OPTIONAL', 'ON_BE_PLAYED'];
    if (scope === 'PERSONAL' && allowedTriggers.includes(clean)) {
        return ['NONE', 'PLAYER_CHOICE'];
    }
    return ['NONE'];
}

export function getValidTargetMethods(trigger, scope, actMethod) {
    const cleanTrigger = (trigger || '').toUpperCase();
    const isCombatEnded = cleanTrigger.includes('COMBAT_ENDED');
    const isSystem = SYSTEM_TRIGGERS.includes(cleanTrigger);
    const hasChoice = actMethod === 'PLAYER_CHOICE';
    const isManual = cleanTrigger === 'MANUAL';

    let methods = [
        'SAME_AS_ACTIVATION', 'EVENT_SOURCE', 'EVENT_TARGET', 'SELF', 'HOST',
        'AVATAR', 'ENEMY_AVATAR', 'AUTO_ALL', 'AUTO_RANDOM', 'AUTO_FIRST', 'AUTO_LAST'
    ];

    // COMBAT_ENDED is an interactive two-entity combat event.
    // Both combatants are known: source = self, target = opponent.
    // It always supports SAME_AS_ACTIVATION, EVENT_SOURCE, and EVENT_TARGET under ANY scope.
    if (isCombatEnded) {
        return methods;
    }

    if (scope !== 'GLOBAL') {
        // System triggers (like TURN_START, ON_ACT) have no interactive targets or sources
        if (isSystem) {
            methods = methods.filter(m => m !== 'EVENT_SOURCE');
            methods = methods.filter(m => m !== 'EVENT_TARGET');
            methods = methods.filter(m => m !== 'SAME_AS_ACTIVATION');
        }

        // Manual triggers without PLAYER_CHOICE have no targeted entity during activation
        if (isManual) {
            methods = methods.filter(m => m !== 'EVENT_SOURCE');
            if (!hasChoice) {
                methods = methods.filter(m => m !== 'EVENT_TARGET');
                methods = methods.filter(m => m !== 'SAME_AS_ACTIVATION');
            }
        }
    }

    return methods;
}

export function getValidEffectTypes(trigger, baseValidTypes) {
    let types = [...baseValidTypes];

    // EXPLICITLY filter out lifecycle shorthand actions so they cannot be manually selected as execution payloads
    types = types.filter(t => t !== 'FIELD' && t !== 'UNFIELD');

    const cleanTrigger = (trigger || '').toUpperCase();
    if (UNPREVENTABLE_TRIGGERS.includes(cleanTrigger) || cleanTrigger.includes('COMBAT_ENDED')) {
        types = types.filter(t => t !== 'CANCEL_EVENT');
    }

    if (!cleanTrigger.startsWith('MODIFY_')) {
        types = types.filter(t => t !== 'MODIFY_EVENT');
    }

    return types;
}

export function validateAbilityLogic(ability) {
    const errors = [];
    const trigger = ability.trigger || 'MANUAL';
    const cleanTrigger = trigger.toUpperCase();

    let hasCancel = false;
    let hasModifyEvent = false;

    const checkPayloads = (payloads, targetMethod) => {
        if (!payloads) return;
        for (const p of payloads) {
            if (p.type === 'CANCEL_EVENT') hasCancel = true;
            if (p.type === 'MODIFY_EVENT') hasModifyEvent = true;

            if (p.type === 'ATTACH' || p.type === 'ATTACH_TO') {
                if (targetMethod === 'SELF') {
                    errors.push(`A card cannot attach to itself.`);
                }
            }

            if (STRICTLY_POSITIVE_ACTIONS.includes(p.type) && p.amount !== undefined && p.amount < 0) {
                errors.push(`${p.type.replace(/_/g, ' ')} cannot have a negative amount (${p.amount}).`);
            }

            if (p.type === 'SET_STAT') {
                if (p.amount < 0 && p.stat !== 'readiness') {
                    errors.push(`SET_STAT cannot set ${p.stat || 'a stat'} to a negative number (${p.amount}).`);
                } else if (p.stat === 'readiness' && p.amount < -1) {
                    errors.push(`SET_STAT cannot set readiness below -1 (${p.amount}).`);
                }
            }

            if (p.nestedGroup) {
                if (p.nestedGroup.targetMethod?.startsWith('AUTO_') && p.nestedGroup.targetCount !== undefined && p.nestedGroup.targetCount < 1) {
                    errors.push(`Nested target count must be at least 1.`);
                }
            }
        }
    };

    const validScopes = getValidScopes(trigger);
    if (!validScopes.includes(ability.triggerScope)) {
        errors.push(`Trigger scope must be ${validScopes[0]} for ${trigger} abilities.`);
    }

    const actMethod = ability.activation?.method || 'NONE';

    if (ability.effects) {
        for (const group of ability.effects) {
            if (group.targetMethod?.startsWith('AUTO_') && group.targetCount !== undefined && group.targetCount < 1) {
                errors.push(`Target count must be at least 1 for ${group.targetMethod.replace(/_/g, ' ')}.`);
            }

            const validTargetMethods = getValidTargetMethods(trigger, ability.triggerScope, actMethod);
            if (!validTargetMethods.includes(group.targetMethod)) {
                errors.push(`${group.targetMethod} cannot be used with the ${trigger} trigger${actMethod !== 'PLAYER_CHOICE' ? ' without PLAYER_CHOICE' : ''}. Use a valid target method.`);
            }

            checkPayloads(group.payloads, group.targetMethod);
        }
    }

    if (ability.cost) {
        if (ability.cost.tribeAmount < 0) errors.push("Tribe cost cannot be negative.");
        if (ability.cost.carnie < 0) errors.push("Carnie cost cannot be negative.");
        if (ability.cost.tent < 0) errors.push("Tent cost cannot be negative.");
        if (ability.cost.power < 0) errors.push("Power cost cannot be negative.");
    }

    if (hasCancel && (UNPREVENTABLE_TRIGGERS.includes(cleanTrigger) || cleanTrigger.includes('COMBAT_ENDED'))) {
        errors.push(`CANCEL_EVENT cannot be used with the ${trigger} trigger.`);
    }
    if (hasModifyEvent && !cleanTrigger.startsWith('MODIFY_')) {
        errors.push(`MODIFY_EVENT cannot be used with the ${trigger} trigger. You can only modify events during a 'MODIFY_' phase trigger.`);
    }

    return errors;
}