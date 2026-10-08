import { Action, ACTION_REGISTRY } from './core.js';

export class HitAction extends Action {
    execute(engine) {
        const DealDamageAction = ACTION_REGISTRY['DEAL_DAMAGE'];

        if (!DealDamageAction) {
            console.warn("[Engine] DEAL_DAMAGE action not found in registry during Hit resolution.");
            return;
        }

        let effectiveAmount = this.payload.eventContext?.amount ?? this.payload.amount;
        const target = this.payload.target;

        if (target && target.armor && target.armor > 0 && effectiveAmount > 0) {
            target.armor -= 1;
            effectiveAmount = Math.max(0, effectiveAmount - 1);
            engine.state.history_log.push({ text: `🛡️ ${target.name}'s Armor absorbed 1 combat damage! (${target.armor} remaining)`, depth: this.getLogDepth(engine) });
        }

        if (effectiveAmount !== undefined) {
            this.payload.amount = effectiveAmount;
            if (this.payload.eventContext) this.payload.eventContext.amount = effectiveAmount;
        }

        if (this.payload.cancelled) return;

        const damagePayload = { ...this.payload, amount: this.payload.amount, type: 'DEAL_DAMAGE', isCombat: true };
        new DealDamageAction(damagePayload).run(engine);
        
        // Bubble the recorded excess damage back up to the HIT payload
        this.payload.excessDamage = damagePayload.excessDamage || 0;
    }
}