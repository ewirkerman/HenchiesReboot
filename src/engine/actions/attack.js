import { Action, ACTION_REGISTRY } from './core.js';
import { findEntityLocation } from '../utils.js';

export class AttackAction extends Action {
    constructor(payload) {
        super(payload);
        this._combatHitTargets = new Set();
    }

    run(engine) {
        // Wrap the entire action (including WOULD_ and MODIFY_ events) in a combat state
        // to allow other actions (like DealDamage) to automatically defer deaths.
        const previousCombatState = engine.state.activeCombatState;
        engine.state.activeCombatState = true;
        
        const result = super.run(engine);
        
        engine.state.activeCombatState = previousCombatState;
        return result;
    }

    execute(engine) {
        const attacker = this.payload.source;
        const defender = this.payload.target;
        
        const isTimid = engine.utils.hasEngineFlag(engine.state, attacker, 'BLOCK_TARGET_AVATAR');

        if (isTimid && defender.type === 'avatar') {
            engine.state.history_log.push({
                text: `🙈 ${attacker.name} cannot attack the Avatar!`,
                depth: this.getLogDepth(engine)
            });
            return;
        }

        engine.state.history_log.push({
            text: `⚔️ ${attacker.name || 'Unit'} attacks ${defender.name || 'Unit'}!`,
            depth: this.getLogDepth(engine)
        });
        
        this.payload.preventReaction = true;

        const atkSpeed = this.getSpeed(engine, attacker);
        const defSpeed = this.getSpeed(engine, defender);

        let eventsEmitted = false;

        for (const phase of [1, 0, -1]) {
            // Abort combat entirely if either unit was killed/bounced/banished before this speed phase begins
            if (
                attacker._isDying || !this.checkBoard(engine, attacker) || 
                defender._isDying || !this.checkBoard(engine, defender)
            ) {
                break;
            }

            const currentAtkDmg = attacker.strength !== null && attacker.strength !== undefined 
                ? attacker.strength 
                : null;
            
            const defBlockRetaliate = engine.utils.hasEngineFlag(engine.state, defender, 'BLOCK_RETALIATE');
            const currentDefDmg = defBlockRetaliate 
                ? null 
                : (defender.strength !== null && defender.strength !== undefined ? defender.strength : null);

            const atkStrikes = atkSpeed === phase && 
                               currentAtkDmg !== null && 
                               currentAtkDmg >= 0 && 
                               !attacker._isDying && 
                               this.checkBoard(engine, attacker);

            const defStrikes = defSpeed === phase && 
                               currentDefDmg !== null && 
                               currentDefDmg >= 0 && 
                               !defender._isDying && 
                               this.checkBoard(engine, defender);

            const strikesHappened = atkStrikes || defStrikes;

            if (strikesHappened && !eventsEmitted) {
                eventsEmitted = true;
                engine.emit('ON_ATTACK', this.payload);
                engine.emit('ON_BE_ATTACKED', this.payload);
            }

            if (atkStrikes) {
                this.executeStrike(engine, attacker, defender, attacker, defender, currentAtkDmg);
            }
            if (defStrikes) {
                this.executeStrike(engine, attacker, defender, defender, attacker, currentDefDmg);
            }
            
            // SRP: Death checking is handled purely based on state, independent of who struck
            this.processKill(engine, attacker, defender, attacker, defender);
            this.processKill(engine, attacker, defender, defender, attacker);
        }
    }

    getSpeed(engine, ent) {
        let speed = 0;
        if (engine.utils.hasEngineFlag(engine.state, ent, 'STRIKE_FAST', true)) {
            speed += 1;
        }
        if (engine.utils.hasEngineFlag(engine.state, ent, 'STRIKE_SLOW', false)) {
            speed -= 1;
        }
        return Math.max(-1, Math.min(1, speed));
    }

    checkBoard(engine, ent) {
        const loc = findEntityLocation(engine, ent);
        const validZones = [
            'front', 'mid', 'back', 'sheltered', 
            'sideline', 'taunt', 'bodyguard', 'avatar'
        ];
        return loc && validZones.includes(loc.zone);
    }

    executeStrike(engine, combatAttacker, combatDefender, source, target, amount) {
        const DealDamageAction = ACTION_REGISTRY['DEAL_DAMAGE'];
        if (!DealDamageAction || amount === null || amount === undefined) return;

        const damagePayload = {
            source: source,
            target: target,
            amount: amount,
            isCombat: true,
            deferDeath: true,
            eventContext: {
                isCombat: true,
                combatAttackerId: combatAttacker.instanceId,
                combatDefenderId: combatDefender.instanceId
            }
        };

        this._combatHitTargets.add(target.instanceId || target);

        engine.emit('HIT', damagePayload);
        engine.emit('GET_HIT', damagePayload);

        new DealDamageAction(damagePayload).run(engine);
    }

    processKill(engine, combatAttacker, combatDefender, source, target) {
        const KillAction = ACTION_REGISTRY['KILL'];
        if (!KillAction) return;

        const targetKey = target.instanceId || target;
        const wasHitThisCombat = this._combatHitTargets.has(targetKey);

        if (target.health <= 0 && target.type !== 'avatar' && !target._isDying && wasHitThisCombat) {
            const sourceLKI = source.abilities ? [...source.abilities] : [];
            const targetLKI = target.abilities ? [...target.abilities] : [];

            new KillAction({
                source: source,
                target: target,
                _lkiSourceAbilities: sourceLKI,
                _lkiTargetAbilities: targetLKI,
                isCombat: true,
                eventContext: {
                    isCombat: true,
                    combatAttackerId: combatAttacker.instanceId,
                    combatDefenderId: combatDefender.instanceId
                }
            }).run(engine);
        }
    }
}