import { Action, revertEffect } from './core.js';

export class CleanseAction extends Action {
    execute(engine) {
        const { target, endingPlayerId } = this.payload;
        if (!target || !target.activeEffects) return;

        let cleansedCount = 0;
        for (let i = target.activeEffects.length - 1; i >= 0; i--) {
            const eff = target.activeEffects[i];
            let shouldRemove = false;

            if (endingPlayerId) {
                if (eff.expiresAt === endingPlayerId) shouldRemove = true;
            } else {
                if (['TEMPORARY', 'BRIEF'].includes(eff.duration)) shouldRemove = true;
            }

            if (shouldRemove) {
                target.activeEffects.splice(i, 1);
                revertEffect(engine, target, eff);
                cleansedCount++;
            }
        }
        
        if (cleansedCount > 0 && !endingPlayerId) {
            engine.state.history_log.push({ text: `✨ '${target.name || 'Target'}' was cleansed of temporary effects.`, depth: this.getLogDepth(engine) });
        }
    }
}