import { Action, ACTION_REGISTRY } from './core.js';

export class DealDamageAction extends Action {
    execute(engine) {
        const { target, source, isCombat } = this.payload;
        let amount = this.payload.amount;
        if (target && amount !== undefined) {
            if (isCombat && target.armor && target.armor > 0 && amount > 0) {
                const blocked = Math.min(target.armor, amount);
                target.armor -= blocked;
                amount -= blocked;
                engine.state.history_log.push({ text: `🛡️ ${target.name}'s Armor absorbed ${blocked} combat damage!`, depth: this.getLogDepth(engine) });
            }
            
            target.health = Math.max(0, (target.health || 0) - amount);
            engine.state.history_log.push({ text: `💥 ${target.name || 'Target'} took ${amount} damage.`, depth: this.getLogDepth(engine) });

            if (target.type === 'avatar' && target.health <= 0) {
                // Determine location locally without deep lookup
                let loserId = engine.state.activePlayerId === 'player1' ? 'player2' : 'player1';
                engine.state.status = 'finished';
                engine.state.winner = loserId === 'player1' ? 'player2' : 'player1';
                engine.state.history_log.push({ text: `☠️ Avatar ${target.name} has fallen! Match finished.`, depth: this.getLogDepth(engine) });
            }
            if (target.health <= 0 && target.type !== 'avatar' && !target._isDying && !this.payload.deferDeath) {
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