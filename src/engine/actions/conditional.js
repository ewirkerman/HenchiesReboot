import { Action, ACTION_REGISTRY } from './core.js';

export class ConditionalAction extends Action {
    execute(engine) {
        const target = this.payload.target;
        const source = this.payload.source;
        const eventContext = this.payload.eventContext;
        const logicTree = this.payload.logicTree || this.payload.nestedGroup?.logicTree;

        const conditionPassed = typeof engine.evaluateLogicTree === 'function'
            ? engine.evaluateLogicTree(logicTree, target, source, eventContext)
            : false;

        const nestedPayloads = conditionPassed
            ? (this.payload.nestedGroup?.payloads || this.payload.payloads || [])
            : (this.payload.elsePayloads || []);
        for (const nestedPayload of nestedPayloads) {
            const ActionClass = ACTION_REGISTRY[nestedPayload.type];
            if (!ActionClass) continue;

            const actionPayload = {
                ...nestedPayload,
                source: nestedPayload.invertRoles ? target : source,
                target: nestedPayload.invertRoles ? source : target,
                eventContext: eventContext,
                sourceAbilityId: this.payload.sourceAbilityId,
                paramX: this.payload.paramX
            };
            new ActionClass(actionPayload).run(engine);
        }
    }
}