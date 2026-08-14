import { Action, ACTION_REGISTRY, findEntityLocation } from './core.js';

export class AttackAction extends Action {
    execute(engine) {
        const attacker = this.payload.source;
        const defender = this.payload.target;
        
        const isTimid = engine.utils.hasEngineFlag(engine.state, attacker, 'BLOCK_TARGET_AVATAR');

        if (isTimid && defender.type === 'avatar') {
            engine.state.history_log.push({ text: `🙈 ${attacker.name} cannot attack the Avatar!`, depth: this.getLogDepth(engine) });
            return;
        }

        engine.state.history_log.push({ text: `⚔️ ${attacker.name || 'Unit'} attacks ${defender.name || 'Unit'}!`, depth: this.getLogDepth(engine) });
        
        engine.emit('ON_ATTACK', this.payload);
        engine.emit('ON_BE_ATTACKED', this.payload);
        this.payload.preventReaction = true;
        
        const getSpeed = (ent) => {
            let speed = 0;
            if (engine.utils.hasEngineFlag(engine.state, ent, 'STRIKE_FAST', true)) speed += 1;
            if (engine.utils.hasEngineFlag(engine.state, ent, 'STRIKE_SLOW', true)) speed -= 1;
            return Math.max(-1, Math.min(1, speed));
        };

        const atkSpeed = getSpeed(attacker);
        const defSpeed = getSpeed(defender);

        const checkBoard = (ent) => {
            const loc = findEntityLocation(engine, ent);
            return loc && ['front', 'mid', 'back', 'sheltered', 'sideline', 'taunt', 'bodyguard', 'avatar'].includes(loc.zone);
        };

        const DealDamageAction = ACTION_REGISTRY['DEAL_DAMAGE'];
        const KillAction = ACTION_REGISTRY['KILL'];

        for (const phase of [1, 0, -1]) {
            // Abort combat entirely if either unit was killed/bounced/banished before this speed phase begins
            if (attacker._isDying || !checkBoard(attacker) || defender._isDying || !checkBoard(defender)) {
                break;
            }

            const currentAtkDmg = attacker.strength !== null && attacker.strength !== undefined ? attacker.strength : null;
            const defBlockRetaliate = engine.utils.hasEngineFlag(engine.state, defender, 'BLOCK_RETALIATE') || engine.utils.hasEngineFlag(engine.state, defender, 'BLOCK_ACT');
            const currentDefDmg = defBlockRetaliate ? null : (defender.strength !== null && defender.strength !== undefined ? defender.strength : null);

            let atkStrikes = atkSpeed === phase && currentAtkDmg !== null && currentAtkDmg >= 0 && !attacker._isDying && checkBoard(attacker);
            let defStrikes = defSpeed === phase && currentDefDmg !== null && currentDefDmg >= 0 && !defender._isDying && checkBoard(defender);

            const strikesHappened = atkStrikes || defStrikes;

            if (atkStrikes && DealDamageAction) new DealDamageAction({ source: attacker, target: defender, amount: currentAtkDmg, isCombat: true, deferDeath: true, eventContext: { isCombat: true, combatAttackerId: attacker.instanceId, combatDefenderId: defender.instanceId } }).run(engine);
            if (defStrikes && DealDamageAction) new DealDamageAction({ source: defender, target: attacker, amount: currentDefDmg, isCombat: true, deferDeath: true, eventContext: { isCombat: true, combatAttackerId: attacker.instanceId, combatDefenderId: defender.instanceId } }).run(engine);
            
            if (strikesHappened && KillAction) {
                const atkLKI = attacker.abilities ? [...attacker.abilities] : [];
                const defLKI = defender.abilities ? [...defender.abilities] : [];

                if (atkStrikes && defender.health <= 0 && defender.type !== 'avatar' && !defender._isDying) {
                    new KillAction({ source: attacker, target: defender, _lkiSourceAbilities: atkLKI, _lkiTargetAbilities: defLKI, isCombat: true, eventContext: { isCombat: true, combatAttackerId: attacker.instanceId, combatDefenderId: defender.instanceId } }).run(engine);
                }
                if (defStrikes && attacker.health <= 0 && attacker.type !== 'avatar' && !attacker._isDying) {
                    new KillAction({ source: defender, target: attacker, _lkiSourceAbilities: defLKI, _lkiTargetAbilities: atkLKI, isCombat: true, eventContext: { isCombat: true, combatAttackerId: attacker.instanceId, combatDefenderId: defender.instanceId } }).run(engine);
                }
            }
        }
    }
}