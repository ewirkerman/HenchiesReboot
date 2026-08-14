import { Action } from './core.js';

export class HealAction extends Action {
    execute(engine) {
        const { target, amount } = this.payload;
        if (target && amount) {
            const max = target.maxHealth || 30;
            const healed = Math.min(max - target.health, amount);
            target.health = Math.min(max, (target.health || 0) + amount);
            engine.state.history_log.push({ text: `💚 ${target.name || 'Target'} was healed for ${healed} HP.`, depth: this.getLogDepth(engine) });
        }
    }
}