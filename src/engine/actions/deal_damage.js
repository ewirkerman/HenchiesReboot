import { Action, ACTION_REGISTRY } from './core.js';

function consumeTempHealth(target, damageAmount) {
    if (!target.activeEffects) return;

    let unabsorbedDamage = damageAmount;

    // Find all active temporary health buffs
    const tempHealthEffects = target.activeEffects.filter(e =>
        (e.type === 'MODIFY_STAT' || e.type === 'SET_STAT') && e.stat === 'health' && e.delta > 0
    );

    // Damage eats away at the buff's delta
    for (const effect of tempHealthEffects) {
        if (unabsorbedDamage <= 0) break;

        const absorbed = Math.min(effect.delta, unabsorbedDamage);
        effect.delta -= absorbed;
        unabsorbedDamage -= absorbed;
    }
}

export class DealDamageAction extends Action {
    execute(engine) {
        const { target, source, isCombat } = this.payload; //
        let amount = this.payload.amount; //[cite: 2]

        if (target && amount !== undefined) { //[cite: 2]
            const currentHealth = target.health || 0; //[cite: 2]

            // Deduct the damage from the buff deltas before actual health is resolved
            consumeTempHealth(target, amount);

            // Record any excess damage directly onto the payload before clamping[cite: 2]
            if (amount > currentHealth && target.type !== 'avatar') { //[cite: 2]
                this.payload.excessDamage = amount - currentHealth; //[cite: 2]
            } else {
                this.payload.excessDamage = 0; //[cite: 2]
            }

            target.health = Math.max(0, currentHealth - amount); //[cite: 2]
            engine.state.history_log.push({ text: `💥 ${target.name || 'Target'} took ${amount} damage.`, depth: this.getLogDepth(engine) }); //[cite: 2]

            if (target.type === 'avatar' && target.health <= 0) { //[cite: 2]
                let loserId = engine.state.activePlayerId === 'player1' ? 'player2' : 'player1'; //[cite: 2]
                engine.state.status = 'finished'; //[cite: 2]
                engine.state.winner = loserId === 'player1' ? 'player2' : 'player1'; //[cite: 2]
                engine.state.history_log.push({ text: `☠️ Avatar ${target.name} has fallen! Match finished.`, depth: this.getLogDepth(engine) }); //[cite: 2]
            }

            if (target.health <= 0 && target.type !== 'avatar' && !target._isDying) { //[cite: 2]
                const atkLKI = source && source.abilities ? [...source.abilities] : []; //[cite: 2]
                const defLKI = target.abilities ? [...target.abilities] : []; //[cite: 2]
                const KillAction = ACTION_REGISTRY['KILL']; //[cite: 2]
                if (KillAction) { //[cite: 2]
                    new KillAction({ source, target, _lkiSourceAbilities: atkLKI, _lkiTargetAbilities: defLKI, isCombat, eventContext: this.payload.eventContext || { isCombat } }).run(engine); //[cite: 2]
                }
            }
        }
    }
}