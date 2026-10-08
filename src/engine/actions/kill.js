import { Action, ACTION_REGISTRY } from './core.js';

export class KillAction extends Action {
    
    // 1. Override the base run() to intercept the lifecycle BEFORE events emit
    run(engine) {
        const target = this.payload.target;
        if (!target || target._isDying) return { cancelled: true };

        // 2. Check for deferral conditions
        const shouldDefer = this.payload.deferDeath || engine.state.activeCombatState;
        
        // 3. If deferring, tag and abort the entire action lifecycle
        if (shouldDefer && !this.payload.forceKill) {
            target._deathDeferred = true;
            return { cancelled: true }; // Stop! No WOULD_, no ON_ events fire.
        }

        // 4. If we are authorized to kill (either outside combat, or forced by the sweeper)
        target._deathDeferred = false; // Consume the tag
        
        // Let the base class take over to emit WOULD_ events, execute(), and ON_ events
        return super.run(engine); 
    }
    
    execute(engine) {
        if (this.payload.target) {
            // Guarantee health reflects the dead state (useful for non-damage instant kills)
            this.payload.target.health = 0; 
            
            if (!this.payload.target._isDying) {
                this.payload.target._isDying = true;
                
                const TrashAction = ACTION_REGISTRY['TRASH'];
                
                if (TrashAction) {
                    new TrashAction({ 
                        target: this.payload.target, 
                        eventContext: this.payload.eventContext 
                    }).run(engine);
                }
            }
        }
    }
}