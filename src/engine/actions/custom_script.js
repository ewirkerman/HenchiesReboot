import { Action } from './core.js';
import { resolveTargetById } from '../targeting.js';

export class CustomScriptAction extends Action {
    execute(engine) {
        if (this.payload.script) {
            const actionDepth = this.getLogDepth(engine);
            const originalPush = engine.state.history_log.push;
            const originalPushDescriptor = Object.getOwnPropertyDescriptor(engine.state.history_log, 'push');

            try {
                engine.state.history_log.push = function (...args) {
                    const formattedArgs = args.map(arg => {
                        if (typeof arg === 'string') {
                            return { text: arg, depth: actionDepth };
                        }
                        return arg;
                    });
                    return originalPush.apply(this, formattedArgs);
                };

                const cleanScript = this.payload.script
                    .replace(/\\\[/g, '[')
                    .replace(/\\\]/g, ']')
                    .replace(/\\_/g, '_');

                // Extract the player's manual choice from the activation event
                const eventCtx = this.payload.eventContext || {};
                const tunneledTargetId = eventCtx.abilityTargetId || eventCtx.eventContext?.abilityTargetId;
                let manualTarget = null;

                if (tunneledTargetId) {
                    manualTarget = resolveTargetById(engine.state, tunneledTargetId);
                } else if (eventCtx.target) {
                    manualTarget = eventCtx.target;
                }

                // Inject 'source' and 'manualTarget' into the script environment
                const fn = new Function('state', 'target', 'source', 'manualTarget', 'params', 'engine', 'actionDepth', '"use strict";\n' + cleanScript);
                fn(engine.state, this.payload.target, this.payload.source, manualTarget, this.payload, engine, actionDepth);
            } catch (e) {
                let abilityName = this.payload.sourceAbilityId || 'Unknown';
                if (engine.state.abilityCatalog && this.payload.sourceAbilityId) {
                    const ab = engine.state.abilityCatalog.find(a => a.abilityId === this.payload.sourceAbilityId);
                    if (ab) abilityName = `'${ab.name}' (${ab.abilityId})`;
                }
                console.error(`[Engine] Custom script error in Ability ${abilityName}:`, e);
            } finally {
                if (originalPushDescriptor) {
                    Object.defineProperty(engine.state.history_log, 'push', originalPushDescriptor);
                } else {
                    delete engine.state.history_log.push;
                }
            }
        }
    }
}