export const CONTEXT_TYPES = {
    'EVAL_TARGET': 'Target Being Evaluated',
    'ABILITY_SOURCE': 'This Card (Ability Source)',
    'HOST': 'Its Host Unit (If Attached)',
    'EVENT_SOURCE': 'Event Doer (Attacker/Caster)',
    'EVENT_TARGET': 'Event Receiver (Defender/Victim)',
    'EVENT': 'Event Payload (The Event Itself)'
};

export const ATTRIBUTE_MANIFEST = {
    // --- IDENTITY & RELATIONS (Evaluable Only) ---
    'entity': { label: 'Entity Type', domain: 'ENTITY', type: 'select', options: ['SELF', 'AVATAR', 'UNIT', 'EQUIPMENT', 'ARTIFACT', 'SPELL', 'BOON'], evaluable: true, settable: false, modifiable: false, allowedTypes: ['ALL'] },
    'alignment': { label: 'Alignment', domain: 'ENTITY', type: 'select', options: ['FRIENDLY', 'ENEMY'], evaluable: true, settable: false, modifiable: false, allowedTypes: ['ALL'] },
    'zone': { label: 'Zone', domain: 'ENTITY', type: 'select', options: ['HAND', 'DECK', 'FIELD', 'DISCARD', 'BANISH', 'ORIGINAL_DECK'], evaluable: true, settable: false, modifiable: false, allowedTypes: ['ALL'] },
    'tribe': { label: 'Tribe', domain: 'ENTITY', type: 'select', options: ['Robot', 'Mythic', 'Elemental', 'Pirate', 'Undead', 'Carnie', 'Viking', 'Ninja', 'Stalker', 'Alien', 'Luchador'], evaluable: true, settable: false, modifiable: false, allowedTypes: ['ALL'] },
    'family': { label: 'Family', domain: 'ENTITY', type: 'select', options: ['Humanoid', 'Creature', 'Automaton'], evaluable: true, settable: false, modifiable: false, allowedTypes: ['UNIT'] },
    'genus': { label: 'Genus', domain: 'ENTITY', type: 'text', options: [], evaluable: true, settable: false, modifiable: false, allowedTypes: ['UNIT'] },
    'hasAbility': { label: 'Has Ability ID/Name', domain: 'ENTITY', type: 'text', evaluable: true, settable: false, modifiable: false, allowedTypes: ['ALL'] },
    'isAttacking': { label: 'Is the Active Attacker', domain: 'ENTITY', type: 'select', options: ['true', 'false'], evaluable: true, settable: false, modifiable: false, allowedTypes: ['UNIT', 'AVATAR'] },
    'customScript': { label: 'Custom Script (Return Bool)', domain: 'ENTITY', type: 'text', evaluable: true, settable: false, modifiable: false, allowedTypes: ['ALL'] },

    // --- NUMERIC STATS (Evaluable, Settable, Modifiable) ---
    'health': { label: 'Current Health', domain: 'ENTITY', type: 'number', evaluable: true, settable: true, modifiable: true, allowedTypes: ['UNIT', 'AVATAR', 'EQUIPMENT', 'ARTIFACT'] },
    'maxHealth': { label: 'Max Health', domain: 'ENTITY', type: 'number', evaluable: true, settable: true, modifiable: true, allowedTypes: ['UNIT', 'AVATAR', 'EQUIPMENT', 'ARTIFACT'] },
    'strength': { label: 'Strength', domain: 'ENTITY', type: 'number', evaluable: true, settable: true, modifiable: true, allowedTypes: ['UNIT', 'AVATAR', 'EQUIPMENT'] },
    'armor': { label: 'Armor', domain: 'ENTITY', type: 'number', evaluable: true, settable: true, modifiable: true, allowedTypes: ['UNIT', 'AVATAR', 'EQUIPMENT'] },
    'power': { label: 'Power', domain: 'ENTITY', type: 'number', evaluable: true, settable: true, modifiable: true, allowedTypes: ['UNIT', 'AVATAR'] },
    'cost': { label: 'Cost', domain: 'ENTITY', type: 'number', evaluable: true, settable: true, modifiable: true, allowedTypes: ['UNIT', 'EQUIPMENT', 'ARTIFACT', 'SPELL', 'BOON'] },
    'readiness': { label: 'Readiness', domain: 'ENTITY', type: 'number', evaluable: true, settable: true, modifiable: true, allowedTypes: ['UNIT', 'AVATAR', 'EQUIPMENT', 'ARTIFACT'] },
    'acts': { label: 'Available Acts', domain: 'ENTITY', type: 'number', evaluable: true, settable: true, modifiable: true, allowedTypes: ['UNIT', 'AVATAR', 'EQUIPMENT', 'ARTIFACT'] },
    'maxActs': { label: 'Max Acts', domain: 'ENTITY', type: 'number', evaluable: true, settable: true, modifiable: true, allowedTypes: ['UNIT', 'AVATAR', 'EQUIPMENT', 'ARTIFACT'] },

    // --- POSITIONAL (Evaluable, Settable) ---
    'line': { label: 'Battleline', domain: 'ENTITY', type: 'select', options: ['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard'], evaluable: true, settable: true, modifiable: false, allowedTypes: ['UNIT', 'AVATAR'] },

    // --- EVENT ATTRIBUTES ---
    'amount': { label: 'Event Amount', domain: 'EVENT', type: 'number', evaluable: true, settable: true, modifiable: true },
    'isCombat': { label: 'Is Combat Damage', domain: 'EVENT', type: 'select', options: ['true', 'false'], evaluable: true, settable: false, modifiable: false },
    'eventAbility': { label: 'Event Ability ID/Name', domain: 'EVENT', type: 'text', evaluable: true, settable: false, modifiable: false }
};