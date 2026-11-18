import { Action, ACTION_REGISTRY } from './core.js';
import { findEntityLocation, markHiddenInformationReveal, moveEntity, normalizeEntityCooldownGroups } from '../utils.js';
import { SetStatAction } from './set_stat.js';

export class PlayAction extends Action {
    execute(engine) {
        const instance = JSON.parse(JSON.stringify(this.payload.target));
        instance.maxHealth = instance.maxHealth || instance.health || 1;
        if (instance.health === undefined || instance.health <= 0) instance.health = instance.maxHealth;
        instance.readiness = ['artifact', 'boon'].includes(instance.type) ? 1 : 0;
        normalizeEntityCooldownGroups(instance);

        // Spells go to the equator temporarily so they exist in a valid zone before being Trashed
        let destZone = (instance.type === 'artifact' || instance.type === 'equipment' || instance.type === 'spell') ? 'equator' : (instance.type === 'boon' ? 'avatar' : (this.payload.targetLine || 'back'));

        if (instance.type === 'unit') {
            instance.defaultLine = instance.defaultLine || 'mid';
            if (instance.defaultLine !== 'mid') {
                destZone = instance.defaultLine;
            }
        }

        const loc = findEntityLocation(engine, this.payload.target);
        const ownerId = loc ? loc.playerId : engine.state.activePlayerId;
        markHiddenInformationReveal(engine, loc, ownerId, destZone);
        if (loc && loc.array) loc.array.splice(loc.index, 1);

        moveEntity(engine, instance, ownerId, destZone);

        this.payload.target = instance;

        if (instance.type === 'unit') {
            instance.line = instance.defaultLine || 'mid';

            if (destZone !== instance.line) {
                const tempEffect = new SetStatAction({
                    source: instance,
                    target: instance,
                    stat: 'line',
                    amount: destZone,
                    duration: 'TEMPORARY'
                });
                tempEffect.execute(engine);
            } else {
                instance.line = destZone;
            }
        }

        engine.state.history_log.push({ text: `🃏 Played ${instance.name} [instanceId=${instance.instanceId}].`, depth: this.getLogDepth(engine) });

        const ctx = this.payload.eventContext || {};
        if (ctx.chosenAbilityId) {
            const ability = instance.abilities?.find(a => a.abilityId === ctx.chosenAbilityId);
            if (ability && ability.trigger === 'PLAY_OPTIONAL') {
                let targetEntity = null;
                if (ctx.abilityTargetId) {
                    const p1 = engine.state.players.player1;
                    const p2 = engine.state.players.player2;
                    const allEntities = [
                        ...Object.values(p1.lines).flat(),
                        ...Object.values(p2.lines).flat(),
                        ...(engine.state.equator || []),
                        ...p1.hand, ...p1.deck, ...p1.discard, ...p1.banish,
                        ...p2.hand, ...p2.deck, ...p2.discard, ...p2.banish
                    ].filter(Boolean);
                    targetEntity = allEntities.find(e => e.id === ctx.abilityTargetId || e.instanceId === ctx.abilityTargetId);
                }
                engine.processingDepth++;
                engine.executeAbility(ability, instance, { target: targetEntity, eventContext: ctx }, ownerId);
                engine.processingDepth--;
            }
        }

        if (instance.type !== 'spell' && engine.utils.isFieldZone(destZone)) {
            engine.emit('FIELD', { source: this.payload.source, target: instance, eventContext: this.payload.eventContext });
            engine.emit('BE_FIELDED', { source: this.payload.source, target: instance, eventContext: this.payload.eventContext });
            engine.emit('ON_FIELD', { source: this.payload.source, target: instance, eventContext: this.payload.eventContext });
            engine.emit('ON_BE_FIELDED', { source: this.payload.source, target: instance, eventContext: this.payload.eventContext });
        } else if (instance.type === 'spell') {
            // Trigger the TRASH sequence for spells to properly move them to the discard pile
            const TrashAction = ACTION_REGISTRY['TRASH'];
            if (TrashAction) {
                new TrashAction({
                    source: this.payload.source,
                    target: instance,
                    eventContext: this.payload.eventContext,
                    actingPlayerId: ownerId
                }).run(engine);
            }
        }
    }
}