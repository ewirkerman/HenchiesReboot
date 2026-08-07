/**
 * Henchies 2 Static Glossary & Iconography
 * Contains all SVGs and static keyword definitions.
 */

export const SVG_CLASS = "inline-block h-[1.3em] w-auto ml-0.5 align-text-bottom text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)]";
export const SVG_EXHAUST = `<svg class="${SVG_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M21 21v-5h-5"/></svg>`;
export const SVG_UNREADY = `<svg class="${SVG_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`;
export const SVG_FREE = `<svg class="${SVG_CLASS}" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>`;
export const SVG_DAZED = `<svg width="800" height="800" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="iconify iconify--emojione-monotone"><path d="m1.832 50.607 9.116-7.65-.696 17.685 9.116-7.649m-.685-23.203 12.384-7.15-5.934 18.32 12.384-7.15m1.657-23.502 15.975-5.815L44.85 25.907l15.975-5.815" fill="none" stroke="#FFF" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const SVG_STUNNED = `<svg class="${SVG_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="M8.07 9.486a10 4-25 0 0 3.33 7.141m4.984-2.324a10 4-25 0 0-3.33-7.142"/><path fill="currentColor" d="m10.309 5.875.563 1.728h1.815l-1.47 1.067.563 1.727-1.47-1.067-1.47 1.067.562-1.727-1.47-1.068h1.815zm3.38 7.25.564 1.728h1.815l-1.47 1.067.563 1.727-1.47-1.066-1.47 1.067.562-1.728-1.47-1.067h1.815z" stroke="none"/></svg>`;

export const SYSTEM_GLOSSARY = [
    // Existing Action/Duration Keywords
    { regex: /\bfield(s|ed|ing)?\b/i, id: 'sys_field', name: 'Field', trigger: 'KEYWORD', displayDescription: 'To put a card into play from your hand or discard pile without paying its resource cost.' },
    { regex: /\bfor this action\b/i, id: 'sys_action', name: 'Action', trigger: 'DURATION', displayDescription: 'An effect that lasts only until the current action, attack, or event fully resolves.' },
    { regex: /\bbrief(ly)?\b/i, id: 'sys_brief', name: 'Brief', trigger: 'DURATION', displayDescription: 'An effect that lasts until the end of the current turn.' },
    { regex: /\btemporar(y|ily)\b/i, id: 'sys_temporary', name: 'Temporary', trigger: 'DURATION', displayDescription: 'An effect that lasts until the end of the opponent\'s turn.' },
    { regex: /\bwhile attached\b/i, id: 'sys_attached', name: 'While Attached', trigger: 'DURATION', displayDescription: 'An effect that lasts only as long as the equipment, artifact, or aura remains attached to its host.' },
    { regex: /\bindefinite(ly)?\b/i, id: 'sys_indefinite', name: 'Indefinite', trigger: 'DURATION', displayDescription: 'An effect that lasts as long as the entity remains on the board. Removed if it dies or leaves play.' },
    { regex: /\bpermanent(ly)?\b/i, id: 'sys_permanent', name: 'Permanent', trigger: 'DURATION', displayDescription: 'An effect that persists across all zones, even if the entity is destroyed or returned to hand.' },
    
    // Core Costs & Icons
    { regex: /\{Unready\}|\bUnready\b|\bunreadies\b/i, id: 'sys_unready', name: `${SVG_UNREADY} Unready`, trigger: 'COST', displayDescription: 'Soft-tap the card. It loses its ready state but can be readied again by some effects. Cannot be used if already unready.' },
    { regex: /\{Exhaust\}|\bExhausts\b|\bExhaust\b/i, id: 'sys_exhaust', name: `${SVG_EXHAUST} Exhaust`, trigger: 'COST', displayDescription: 'Hard-tap the card. It becomes exhausted (readiness = -1) and usually requires a full turn cycle to become ready again. Cannot be used if already exhausted.' },
    { regex: /\{Free Action\}|\bFree Action\b/i, id: 'sys_free', name: `${SVG_FREE} Free Action`, trigger: 'COST', displayDescription: 'This ability does not consume the unit\'s single action per turn. It can be used even if the unit has already acted.' },
    { regex: /\bdazed\b/i, id: 'sys_dazed', name: `${SVG_DAZED} Dazed`, trigger: 'STATUS', displayDescription: 'A Dazed unit has impaired capabilities. (Exact mechanics determined by the applying effect).' },
    { regex: /\bstun(ned)?\b/i, id: 'sys_stun', name: `${SVG_STUNNED} Stunned`, trigger: 'STATUS', displayDescription: 'A Stunned unit skips its next opportunity to act.' },

    // Core Zones & Lines
    { regex: /\btaunt\b/i, id: 'sys_taunt', name: 'Taunt (Line)', trigger: 'ZONE', displayDescription: 'Units in the Taunt line force enemies to attack them before any other target can be attacked.' },
    { regex: /\bbodyguard(s)?\b/i, id: 'sys_bodyguard', name: 'Bodyguard (Line)', trigger: 'ZONE', displayDescription: 'Units in the Bodyguard line protect the Avatar, forcing enemies to attack them before the Avatar can be targeted.' },
    { regex: /\bsheltered\b/i, id: 'sys_sheltered', name: 'Sheltered (Line)', trigger: 'ZONE', displayDescription: 'Units in the Sheltered line cannot be attacked while your Front, Mid, or Back lines are occupied.' },
    { regex: /\bsideline(s)?\b/i, id: 'sys_sideline', name: 'Sideline (Line)', trigger: 'ZONE', displayDescription: 'Units in the Sideline cannot attack or be attacked by normal combat, but their abilities still function.' },
    { regex: /\bequator\b/i, id: 'sys_equator', name: 'Equator', trigger: 'ZONE', displayDescription: 'The center neutral zone of the board where unattached artifacts and equipment reside.' },

    // Game Actions
    { regex: /\bplay(ed|s)?\b/i, id: 'sys_play', name: 'Play', trigger: 'ACTION', displayDescription: 'To move a card from your hand to the field by paying its resource costs. Triggers "When Played" effects.' },
    { regex: /\bsummon(ed|s)?\b/i, id: 'sys_summon', name: 'Summon', trigger: 'ACTION', displayDescription: 'To generate a token or card directly onto the field. Bypasses "When Played" triggers.' },
    { regex: /\bdiscard(ed|s)?\b/i, id: 'sys_discard', name: 'Discard', trigger: 'ACTION', displayDescription: 'To move a card from a player\'s hand or deck directly into their discard pile.' },
    { regex: /\bbanish(ed|es)?\b/i, id: 'sys_banish', name: 'Banish', trigger: 'ACTION', displayDescription: 'To remove a card from the game completely. It cannot be recovered.' },
    { regex: /\btrash(ed|es)?\b/i, id: 'sys_trash', name: 'Trash', trigger: 'ACTION', displayDescription: 'To move a card from the field, hand, or deck to the discard pile.' },
    { regex: /\brecover(ed|s)?\b/i, id: 'sys_recover', name: 'Recover', trigger: 'ACTION', displayDescription: 'To return a card from the discard pile to your hand.' },
    { regex: /\bharvest(ed|s)?\b/i, id: 'sys_harvest', name: 'Harvest', trigger: 'ACTION', displayDescription: 'Sacrificing a card from your hand at the start of your turn to gain +1 Max Carnie and +1 Max Tribe Resource.' },

    // Stats & Combat
    { regex: /\barmor\b|🛡️/i, id: 'sys_armor', name: '🛡️ Armor', trigger: 'STAT', displayDescription: 'Reduces incoming combat damage. Armor does not regenerate once broken.' },
    { regex: /\bstrength\b|⚔️/i, id: 'sys_strength', name: '⚔️ Strength', trigger: 'STAT', displayDescription: 'The amount of damage a unit deals during standard combat.' },
    { regex: /\bhealth\b/i, id: 'sys_health', name: 'Health', trigger: 'STAT', displayDescription: 'The amount of damage a unit or avatar can take before being destroyed.' },
    { regex: /\bfast\b|⚡/i, id: 'sys_fast', name: '⚡ Fast', trigger: 'KEYWORD', displayDescription: 'During combat, units with Fast charges strike before normal units. Consumes 1 charge per strike.' },
    { regex: /\bslow\b/i, id: 'sys_slow', name: 'Slow', trigger: 'KEYWORD', displayDescription: 'During combat, units with Slow strike after normal units. Consumes 1 charge per strike.' },
    { regex: /\bpower\b/i, id: 'sys_power', name: 'Power', trigger: 'RESOURCE', displayDescription: 'A special resource accumulated on units/avatars used to pay for powerful abilities.' },

    // Card Types
    { regex: /\bavatar(s)?\b/i, id: 'sys_avatar', name: 'Avatar', trigger: 'TYPE', displayDescription: 'Your commander card. If its health reaches 0, you lose the game.' },
    { regex: /\bunit(s)?\b/i, id: 'sys_unit', name: 'Unit', trigger: 'TYPE', displayDescription: 'A character card that can attack, defend, and use abilities on the field.' },
    { regex: /\bequipment\b/i, id: 'sys_equipment', name: 'Equipment', trigger: 'TYPE', displayDescription: 'An item that attaches to a unit to grant it stats or abilities.' },
    { regex: /\bartifact(s)?\b/i, id: 'sys_artifact', name: 'Artifact', trigger: 'TYPE', displayDescription: 'An item that stays on the Equator and provides global benefits or abilities.' },
    { regex: /\bspell(s)?\b/i, id: 'sys_spell', name: 'Spell', trigger: 'TYPE', displayDescription: 'A one-time use card that triggers its effect and immediately goes to the discard pile.' },
    { regex: /\bboon(s)?\b/i, id: 'sys_boon', name: 'Boon', trigger: 'TYPE', displayDescription: 'An enhancement that attaches directly to your Avatar.' }
];