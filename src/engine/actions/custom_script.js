import { Action } from './core.js';

export class CustomScriptAction extends Action { 
    execute(engine) {
        if (this.payload.script) {
            const actionDepth = this.getLogDepth(engine);
            const originalPush = engine.state.history_log.push;

            try {
                engine.state.history_log.push = function(...args) {
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

                const fn = new Function('state', 'target', 'params', 'engine', 'actionDepth', '"use strict";\n' + cleanScript);
                fn(engine.state, this.payload.target, this.payload, engine, actionDepth);
            } catch(e) {
                let abilityName = this.payload.sourceAbilityId || 'Unknown';
                if (engine.state.abilityCatalog && this.payload.sourceAbilityId) {
                    const ab = engine.state.abilityCatalog.find(a => a.abilityId === this.payload.sourceAbilityId);
                    if (ab) abilityName = `'${ab.name}' (${ab.abilityId})`;
                }
                console.error(`[Engine] Custom script error in Ability ${abilityName}:`, e);
            } finally {
                engine.state.history_log.push = originalPush;
            }
        }
    } 
}