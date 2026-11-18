import { Action, registerEffect } from './core.js';

export class HealAction extends Action {
    execute(engine) {
        const { target, amount, overheal } = this.payload;
        if (target && amount) {
            const max = target.maxHealth || 30;
            const currentHealth = target.health || 0;
            const nextHealth = currentHealth + amount;
            const nextHealthAfterHeal = overheal
                ? Math.max(currentHealth, nextHealth)
                : Math.max(currentHealth, Math.min(max, nextHealth));
            const healed = Math.max(0, Math.min(max, nextHealthAfterHeal) - Math.min(max, currentHealth));
            const temporaryHealth = overheal
                ? Math.max(0, nextHealthAfterHeal - Math.max(currentHealth, max))
                : 0;

            target.health = nextHealthAfterHeal;
            if (temporaryHealth > 0) {
                registerEffect(engine, target, { ...this.payload, type: 'MODIFY_STAT', duration: 'TEMPORARY' }, {
                    stat: 'health',
                    delta: temporaryHealth
                });
            }
            engine.state.history_log.push({ text: `💚 ${target.name || 'Target'} was healed for ${healed} HP.`, depth: this.getLogDepth(engine) });
        }
    }
}