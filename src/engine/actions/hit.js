import { Action, ACTION_REGISTRY } from './core.js';

export class HitAction extends Action {
    execute(engine) {
        const DealDamageAction = ACTION_REGISTRY['DEAL_DAMAGE'];

        if (!DealDamageAction) {
            console.warn("[Engine] DEAL_DAMAGE action not found in registry during Hit resolution.");
            return;
        }

        const effectiveAmount = this.payload.eventContext?.amount ?? this.payload.amount;
        if (effectiveAmount !== undefined) {
            this.payload.amount = effectiveAmount;
            if (this.payload.eventContext) this.payload.eventContext.amount = effectiveAmount;
        }

        if (this.payload.cancelled) return;

        const damagePayload = { ...this.payload, amount: this.payload.amount, type: 'DEAL_DAMAGE' };
        new DealDamageAction(damagePayload).run(engine);
    }
}