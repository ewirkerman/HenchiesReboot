/**
 * Standalone Dataset Generator for Henchies 2 Language Engine
 * 
 * Run this script via node:
 *   node generate_dataset.mjs
 * 
 * It will output `language_review_dataset.json` in the same directory.
 */

import fs from 'fs';
import { ACTION_MANIFEST } from '../src/actions.js';
import { generateAbilityDescription } from '../src/language_description.js';
import { validateAbilityLogic } from '../src/abilities.js';

// --- MOCK CATALOG DATA ---
const MOCK_ABILITIES = [
    { abilityId: 'ab_1', name: 'Piercing Strike' },
    { abilityId: 'ab_2', name: 'Shadow Cloak' },
    { abilityId: 'ab_3', name: 'Frenzied Blood' }
];

const MOCK_CARDS = [
    { id: 'card_1', name: 'Goblin Bruiser' },
    { id: 'card_2', name: 'Skeleton' },
    { id: 'card_3', name: 'Mystic Wisp' }
];

// --- RANDOM GENERATION UTILS ---
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randBool = (chance = 0.5) => Math.random() < chance;
const randSubset = (arr, min = 1, max = arr.length) => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, randInt(min, max));
};

// --- DOMAINS ---
const TRIGGERS = [
    'MANUAL', 'UNTRIGGERABLE', 'TURN_STARTING', 'TURN_ENDED', 
    'ON_BE_PLAYED', 'PLAY_OPTIONAL', 'SUMMON', 'ON_ATTACK', 
    'ON_BE_DAMAGED', 'WOULD_BE_KILLED', 'MODIFY_DEAL_DAMAGE'
];
const TARGET_METHODS = ['SAME_AS_ACTIVATION', 'EVENT_SOURCE', 'EVENT_TARGET', 'SELF', 'AVATAR', 'ENEMY_AVATAR', 'AUTO_ALL', 'AUTO_RANDOM', 'AUTO_FIRST', 'AUTO_LAST'];
const ZONES = ['FIELD', 'HAND', 'DECK', 'DISCARD', 'BANISH'];
const ALIGNMENTS = ['FRIENDLY', 'ENEMY'];
const ENTITY_TYPES = ['UNIT', 'AVATAR', 'EQUIPMENT', 'SPELL', 'BOON'];
const STATS = ['health', 'strength', 'armor', 'readiness', 'acts', 'maxHealth', 'power'];
const RESOURCES = ['Carnie', 'maxCarnie', 'Mythic', 'Undead', 'Robot'];

// --- GENERATOR FUNCTIONS ---

function genQuickTargeting() {
    // Lower temperature: heavily favor simple, single-target setups
    const simple = randBool(0.8);
    return {
        zones: simple ? ['FIELD'] : randSubset(ZONES, 1, 2),
        alignment: simple ? [randItem(ALIGNMENTS)] : randSubset(ALIGNMENTS, 1, 2),
        entityType: simple ? ['UNIT'] : randSubset(ENTITY_TYPES, 1, 2),
        ignoreBattlelines: randBool(0.1)
    };
}

function genPayload() {
    // Exclude deprecated or overly vague ones from linguistic testing to focus on meaty actions
    const validTypes = Object.keys(ACTION_MANIFEST).filter(k => !ACTION_MANIFEST[k].deprecated);
    const type = randItem(validTypes);
    const manifest = ACTION_MANIFEST[type] || {};

    let payload = { type };
    
    if (manifest.validDurations) payload.duration = randItem(manifest.validDurations);
    else payload.duration = 'INSTANT';

    // Populate required parameters based on manifest
    if (manifest.requiresAmount) payload.amount = randInt(-3, 5); // Allow negatives to test decrease wording
    if (manifest.requiresStat) payload.stat = randItem(STATS);
    if (manifest.requiresResource) payload.resource = randItem(RESOURCES);
    if (manifest.requiresGrantedAbility) payload.grantedAbilityId = randItem(MOCK_ABILITIES).abilityId;
    if (manifest.requiresCardId) payload.cardId = randItem(MOCK_CARDS).id;
    if (manifest.requiresZone) payload.zone = randItem(ZONES);
    if (manifest.requiresZoneOwner) payload.zoneOwner = randItem(['CASTER', 'TARGET']);
    if (manifest.canLimitStacks && randBool(0.1)) payload.maxStacks = randInt(1, 3);
    if (manifest.canBlockDuplicates && randBool(0.1)) payload.blockDuplicates = true;
    
    // Inversions and costs (much lower probability for sanity)
    if (manifest.canInvert && randBool(0.05)) payload.invertRoles = true;
    if (manifest.canBeCost && randBool(0.05)) payload.isCost = true;

    // Custom Scripts
    if (manifest.requiresScript) {
        payload.script = "target.health += 1;";
        payload.description = randItem(["do something mysterious", "burn the target", "bless the target"]);
    }

    // Nested Summons
    if (manifest.hasNestedGroup && randBool(0.15)) {
        payload.nestedGroup = {
            targetMethod: randItem(['AUTO_ALL', 'AUTO_RANDOM']),
            targetCount: randInt(1, 2),
            quickTargeting: genQuickTargeting(),
            payloads: [
                { type: 'MODIFY_STAT', stat: 'strength', amount: randInt(1, 2), duration: randItem(['INSTANT', 'TEMPORARY']) }
            ]
        };
    }

    return payload;
}

function genEffectGroup() {
    // Favor more common targeting methods
    const commonMethods = ['SAME_AS_ACTIVATION', 'SELF', 'AUTO_ALL', 'EVENT_TARGET'];
    const method = randBool(0.7) ? randItem(commonMethods) : randItem(TARGET_METHODS);
    const group = {
        targetMethod: method,
        targetCount: randInt(1, 2),
        quickTargeting: genQuickTargeting(),
        logicTree: { type: 'group', logicalOperator: 'AND', children: [] }, // Empty for simplicity, though can expand
        payloads: []
    };

    const payloadCount = randBool(0.8) ? 1 : 2;
    for (let i = 0; i < payloadCount; i++) {
        group.payloads.push(genPayload());
    }

    // Ensure at least one cost and one effect if testing cost combos
    if (randBool(0.1) && group.payloads.length > 1) {
        group.payloads[0].isCost = true;
        group.payloads[1].isCost = false;
    }

    return group;
}

function genAbility() {
    // Favor manual and standard triggers
    const commonTriggers = ['MANUAL', 'ON_BE_PLAYED', 'TURN_STARTING', 'ON_ATTACK'];
    const trigger = randBool(0.6) ? randItem(commonTriggers) : randItem(TRIGGERS);
    
    const actMethod = (trigger === 'MANUAL' || trigger === 'PLAY') && randBool(0.8) 
        ? 'PLAYER_CHOICE' 
        : 'NONE';

    // Keep costs simple if it's untriggerable
    const isPassive = trigger === 'UNTRIGGERABLE';

    const ability = {
        abilityId: 'ab_random_' + randInt(1000, 9999),
        name: 'Randomized Skill',
        trigger: trigger,
        triggerScope: randItem(['PERSONAL', 'GLOBAL']),
        triggerLimit: randBool(0.8) ? 'UNLIMITED' : randItem(['ONCE_PER_ROUND', 'TWICE_PER_ROUND']),
        cost: {
            tribeAmount: (!isPassive && randBool(0.15)) ? randInt(1, 2) : 0,
            carnie: (!isPassive && randBool(0.2)) ? 1 : 0,
            power: (!isPassive && randBool(0.1)) ? randInt(1, 2) : 0,
            readinessCost: isPassive ? 'NONE' : randItem(['NONE', 'NONE', 'UNREADIES', 'EXHAUSTS']),
            reuseIgnoresReadiness: randBool(0.05),
            freeAction: randBool(0.05)
        },
        passiveFlags: randBool(0.1) ? [randItem(['STRIKE_FAST', 'BLOCK_ACT', 'IGNORE_BLOCK_TARGETING'])] : [],
        activation: {
            method: actMethod,
            quickTargeting: genQuickTargeting(),
            logicTree: { type: 'group', logicalOperator: 'AND', children: [] }
        },
        effects: []
    };

    const groupCount = randBool(0.8) ? 1 : 2;
    for (let i = 0; i < groupCount; i++) {
        ability.effects.push(genEffectGroup());
    }

    return ability;
}

// --- EXECUTION ---

const NUM_SAMPLES = 100;
const dataset = [];

console.log(`Generating ${NUM_SAMPLES} random abilities...`);

for (let i = 0; i < NUM_SAMPLES; i++) {
    let ability;
    let valid = false;
    while (!valid) {
        ability = genAbility();
        if (validateAbilityLogic(ability).length === 0) valid = true;
    }
    
    let generatedLanguage = "";
    try {
        generatedLanguage = generateAbilityDescription(ability, MOCK_ABILITIES, MOCK_CARDS);
    } catch (e) {
        generatedLanguage = `[ERROR DURING GENERATION]: ${e.message}`;
    }

    dataset.push({
        input: ability,
        output: generatedLanguage
    });
}

const outputPath = './language_review_dataset.json';
fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2));

console.log(`✅ Success! Dataset exported to ${outputPath}`);
console.log(`Feed this JSON to your LLM to review the grammar, sentence structure, and terminology edge cases.`);