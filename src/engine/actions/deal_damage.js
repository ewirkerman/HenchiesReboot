import { Action, ACTION_REGISTRY } from './core.js';

export class DealDamageAction extends Action {
    execute(engine) {
        const { target, source, isCombat } = this.payload;
        let amount = this.payload.amount;
        
        if (target && amount !== undefined) {
            const currentHealth = target.health || 0;
            
            // Record any excess damage directly onto the payload before clamping
            if (amount > currentHealth && target.type !== 'avatar') {
                this.payload.excessDamage = amount - currentHealth;
            } else {
                this.payload.excessDamage = 0;
            }

            target.health = Math.max(0, currentHealth - amount);
            engine.state.history_log.push({ text: `💥 ${target.name || 'Target'} took ${amount} damage.`, depth: this.getLogDepth(engine) });

            if (target.type === 'avatar' && target.health <= 0) {
                let loserId = engine.state.activePlayerId === 'player1' ? 'player2' : 'player1';
                engine.state.status = 'finished';
                engine.state.winner = loserId === 'player1' ? 'player2' : 'player1';
                engine.state.history_log.push({ text: `☠️ Avatar ${target.name} has fallen! Match finished.`, depth: this.getLogDepth(engine) });
            }
            
            if (target.health <= 0 && target.type !== 'avatar' && !target._isDying) {
                const atkLKI = source && source.abilities ? [...source.abilities] : [];
                const defLKI = target.abilities ? [...target.abilities] : [];
                const KillAction = ACTION_REGISTRY['KILL'];
                if (KillAction) {
                    new KillAction({ source, target, _lkiSourceAbilities: atkLKI, _lkiTargetAbilities: defLKI, isCombat, eventContext: this.payload.eventContext || { isCombat } }).run(engine);
                }
            }
        }
    }
}