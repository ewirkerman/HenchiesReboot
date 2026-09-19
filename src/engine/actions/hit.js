import { Action, ACTION_REGISTRY } from './core.js';

export class HitAction extends Action {
    execute(engine) {
        // Retrieve the DealDamageAction from the registry to prevent circular dependencies
        const DealDamageAction = ACTION_REGISTRY['DEAL_DAMAGE'];
        
        if (DealDamageAction) {
            // Pass the exact same payload into the DealDamageAction.
            // Because the Action class handles the WOULD_ and MODIFY_ hooks automatically
            // before this execute method runs, any modifiers to the payload (like damage amounts)
            // will carry over perfectly into the damage resolution.
            const damagePayload = { ...this.payload, type: 'DEAL_DAMAGE' };
            new DealDamageAction(damagePayload).run(engine);
        } else {
            console.warn("[Engine] DEAL_DAMAGE action not found in registry during Hit resolution.");
        }
    }
}