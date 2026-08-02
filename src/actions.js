
 * Henchies 2 Actions Architecture
 * Standardizes the 4-Phase Action Pipeline for all engine state changes.
 */

export class Action {
    constructor(payload) {
        // Automatically derive the type from the class name (e.g., DealDamageAction -> DEAL_DAMAGE)
        this.type = this.constructor.name.replace(/Action$/, '').replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
        this.passiveType = DUAL_PREDICATE_ACTIONS[this.type] || null;
        this.payload = payload; // { source, target, amount, stat, etc. }
    }

    /**
     * Pushes the action through the 4-phase resolution pipeline.
     * @param {GameEngine} engine The active event bus
     * @returns {boolean} True if the action resolved, false if it was cancelled
     */
    run(engine) {
        // 1. Interrupt Phase (Gatekeeper)
        // Listeners can return { cancelled: true } to abort the entire action.
        if (engine.emit(`WOULD_${this.type}`, this.payload).cancelled) return false;
        if (this.passiveType && engine.emit(`WOULD_${this.passiveType}`, this.payload).cancelled) return false;

        // 2. Modification Phase (Mutation)
        // Listeners intercept the payload by reference and alter its values (e.g., reduce damage).
        engine.emit(`MODIFY_${this.type}`, this.payload);
        if (this.passiveType) engine.emit(`MODIFY_${this.passiveType}`, this.payload);

        // 3. Execution Phase (Atomic State Change)
        // The pure function altering the actual game state based on the final payload.
        this.execute(engine);

        // 4. Reaction Phase (Past-Tense Factual Occurrence)
        // Triggers listeners reacting to the action completing successfully.
        engine.emit(`ON_${this.type}`, this.payload);
        if (this.passiveType) engine.emit(`ON_${this.passiveType}`, this.payload);

        return true;
    }

    execute(engine) {
        console.warn(`Base Action execute called for ${this.type}. Missing subclass implementation.`);
    }
}

// ==========================================
// ACTION SUBCLASSES
// ==========================================

export class DealDamageAction extends Action {
    execute(engine) {
        if (this.payload.target && this.payload.amount > 0) {
            this.payload.target.health -= this.payload.amount;
        }
    }
}

export class HealAction extends Action {
    execute(engine) {
        if (this.payload.target && this.payload.amount > 0) {
            this.payload.target.health += this.payload.amount;
            if (this.payload.target.maxHealth && this.payload.target.health > this.payload.target.maxHealth) {
                this.payload.target.health = this.payload.target.maxHealth;
            }
        }
    }
}

export class KillAction extends Action {
    execute(engine) {
        // Formal board removal logic will be hooked up here
        if (this.payload.target) {
            this.payload.target.health = 0; 
        }
    }
}

export class ModifyStatAction extends Action {
    execute(engine) {
        const { target, stat, amount } = this.payload;
        if (target && stat && amount) {
            target[stat] = (target[stat] || 0) + amount;
        }
    }
}

export class SetStatAction extends Action {
    execute(engine) {
        const { target, stat, amount } = this.payload;
        if (target && stat && amount !== undefined) {
            target[stat] = amount;
        }
    }
}

export class GrantAbilityAction extends Action {
    execute(engine) {
        if (this.payload.target && this.payload.grantedAbilityId) {
            if (!this.payload.target.abilities) this.payload.target.abilities = [];
            this.payload.target.abilities.push({ abilityId: this.payload.grantedAbilityId });
        }
    }
}

export class DrawCardAction extends Action {
    execute(engine) {
        // Logic to pop from player deck and push to hand
    }
}

export class PlayAction extends Action {
    execute(engine) {
        // Logic to move card from hand to board/equator and pay costs
    }
}

export class AttackAction extends Action {
    execute(engine) {
        // Logic to resolve combat between attacker and defender
    }
}

export class HarvestAction extends Action {
    execute(engine) {
        // Logic to discard a card and increase max tents/resources
    }
}

export class SummonAction extends Action {
    execute(engine) {
        // Logic to instantiate cardId and push to designated player zone
    }
}

export class DiscardAction extends Action { execute(engine) { /* Move from hand to discard */ } }
export class ShuffleAction extends Action { execute(engine) { /* Move target to deck and shuffle */ } }
export class ReturnAction extends Action { execute(engine) { /* Move from board to hand */ } }
export class RecoverAction extends Action { execute(engine) { /* Move from discard to hand/deck */ } }
export class TrashAction extends Action { execute(engine) { /* Move from hand/deck to banish */ } }
export class BanishAction extends Action { execute(engine) { /* Move from board/discard to banish */ } }
export class FieldAction extends Action { execute(engine) { /* Move from hand to board for free */ } }
export class AttachAction extends Action { execute(engine) {} }
export class AttachToAction extends Action { execute(engine) {} }
export class UnattachAction extends Action { execute(engine) {} }
export class BlockActAction extends Action { execute(engine) {} }
export class BlockAttackAction extends Action { execute(engine) {} }
export class BlockRetaliateAction extends Action { execute(engine) {} }
export class CustomScriptAction extends Action { 
    execute(engine) {
        // Execution of arbitrary user-defined script blocks
    } 
}

// ==========================================
// REGISTRY & EXPORTS
// ==========================================

export const ACTION_REGISTRY = {
    'DEAL_DAMAGE': DealDamageAction,
    'HEAL': HealAction,
    'GRANT_ABILITY': GrantAbilityAction,
    'MODIFY_STAT': ModifyStatAction,
    'SET_STAT': SetStatAction,
    'DRAW_CARD': DrawCardAction,
    'SUMMON': SummonAction,
    'PLAY': PlayAction,
    'ATTACK': AttackAction,
    'HARVEST': HarvestAction,
    'BLOCK_ACT': BlockActAction,
    'BLOCK_ATTACK': BlockAttackAction,
    'BLOCK_RETALIATE': BlockRetaliateAction,
    'CUSTOM_SCRIPT': CustomScriptAction,
    'DISCARD': DiscardAction,
    'SHUFFLE': ShuffleAction,
    'RETURN': ReturnAction,
    'RECOVER': RecoverAction,
    'ATTACH': AttachAction,
    'ATTACH_TO': AttachToAction,
    'UNATTACH': UnattachAction,
    'TRASH': TrashAction,
    'KILL': KillAction,
    'FIELD': FieldAction,
    'BANISH': BanishAction
};

export const EFFECT_TYPES = Object.keys(ACTION_REGISTRY);

export const DUAL_PREDICATE_ACTIONS = {
    'DEAL_DAMAGE': 'BE_DAMAGED',
    'HEAL': 'BE_HEALED',
    'KILL': 'BE_KILLED',
    'GRANT_ABILITY': 'BE_GRANTED_ABILITY',
    'MODIFY_STAT': 'BE_STAT_MODIFIED',
    'SET_STAT': 'BE_STAT_SET',
    'DRAW_CARD': 'BE_DRAWN',
    'SUMMON': 'BE_SUMMONED',
    'PLAY': 'BE_PLAYED',
    'ATTACK': 'BE_ATTACKED',
    'HARVEST': 'BE_HARVESTED',
    'DISCARD': 'BE_DISCARDED',
    'SHUFFLE': 'BE_SHUFFLED',
    'RETURN': 'BE_RETURNED',
    'RECOVER': 'BE_RECOVERED',
    'TRASH': 'BE_TRASHED',
    'BANISH': 'BE_BANISHED',
    'FIELD': 'BE_FIELDED',
    'ATTACH': 'BE_ATTACHED',
    'ATTACH_TO': 'HAVE_ATTACHED',
    'UNATTACH': 'BE_UNATTACHED'
};

/**
 * Generates the dynamic lifecycle triggers for every action (WOULD_, MODIFY_, ON_)
 * @returns {Array<string>} Flattened array of all possible action lifecycle events
 */
export function getActionTriggers() {
    const triggers = [];
    EFFECT_TYPES.forEach(action => {
        triggers.push(`WOULD_${action}`);
        triggers.push(`MODIFY_${action}`);
        triggers.push(`ON_${action}`);
        
        if (DUAL_PREDICATE_ACTIONS[action]) {
            const pType = DUAL_PREDICATE_ACTIONS[action];
            triggers.push(`WOULD_${pType}`);
            triggers.push(`MODIFY_${pType}`);
            triggers.push(`ON_${pType}`);
        }
    });
    return triggers;
}