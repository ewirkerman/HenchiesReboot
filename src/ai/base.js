import { canPlayCard, playCard, executeEntityAction, executeSacrificeDecision } from '../engine/flow.js';
import { getValidAbilityTargets, getValidAttackTargets, getEntityAvailableActions } from '../engine/targeting.js';
import { LINES } from '../engine/utils.js';

/**
 * Determines if a cost object represents a completely free action.
 * Used to enforce the constraint that the AI cannot infinite-loop 0-cost abilities.
 */
function isCostFree(cost) {
    if (!cost) return true;
    if (cost.freeAction) return true;
    
    const noReadiness = !cost.readinessCost || cost.readinessCost === 'NONE';
    const noCarnie = !(cost.carnie > 0) && !(cost.tent > 0);
    const noTribe = !(cost.tribeAmount > 0);
    const noPower = !(cost.power > 0);
    
    return noReadiness && noCarnie && noTribe && noPower;
}

/**
 * Base AI Interface / Contract.
 * Any AI Personality must extend this class and implement the abstract methods.
 */
export class BaseAIEngine {
    constructor(playerId) {
        this.playerId = playerId;
        this.usedFreeActions = new Set();
    }

    /**
     * Call this at the start of the AI's turn to reset its action trackers.
     */
    resetTurn() {
        this.usedFreeActions.clear();
    }

    /**
     * ABSTRACT: Subclasses must implement this to decide what to do during the sacrifice phase.
     * @returns {Object} e.g. { action: 'OPTION_A', cardId: '...', detail: 'Card Name' } OR { action: 'SKIP' }
     */
    determineSacrifice(state) {
        throw new Error("AIEngine subclass must implement determineSacrifice(state)");
    }

    /**
     * ABSTRACT: Subclasses must implement this to select one action from the legal pool.
     * @returns {Object|null} e.g. { action: actionObj, targetId: '...', targetLine: '...' }
     */
    determineMove(state, legalActions) {
        throw new Error("AIEngine subclass must implement determineMove(state, legalActions)");
    }

    /**
     * Scans the gamestate and returns a flat array of every single legal action
     * the AI can currently take, paired with all of its legal targets.
     * Shared logic available to all AI subclasses.
     */
    computeAllLegalActions(state) {
        const actions = [];
        const player = state.players[this.playerId];
        if (!player || state.turnPhase !== 'ACTION_PHASE') return actions;

        const processEntityActions = (entity) => {
            const available = getEntityAvailableActions(state, this.playerId, entity.instanceId || entity.id);
            
            available.forEach(act => {
                const isFree = isCostFree(act.cost);
                const actionKey = `${entity.instanceId || entity.id}_${act.abilityId}`;
                
                if (isFree && this.usedFreeActions.has(actionKey)) return;

                let validTargets = [];
                if (act.type === 'ATTACK') {
                    validTargets = getValidAttackTargets(state, this.playerId, entity).map(t => ({ id: t.id, line: t.line }));
                    if (validTargets.length === 0) return;
                } else {
                    const ab = entity.abilities?.find(a => a.abilityId === act.abilityId);
                    if (ab?.activation?.method === 'PLAYER_CHOICE') {
                        validTargets = getValidAbilityTargets(state, this.playerId, entity.instanceId || entity.id, act.abilityId).map(t => ({ id: t.id, line: t.line }));
                        if (validTargets.length === 0) return;
                    }
                }

                actions.push({
                    type: 'ENTITY_ACTION',
                    actionType: act.type,
                    entityId: entity.instanceId || entity.id,
                    entityName: entity.name,
                    abilityId: act.abilityId,
                    targets: validTargets,
                    isFree: isFree,
                    actionKey: actionKey
                });
            });
        };

        player.hand.forEach(card => {
            const playCheck = canPlayCard(state, this.playerId, card);
            if (playCheck.success) {
                let mandatoryAbilityId = null;
                let needsTarget = false;
                let validTargets = [];

                if (card.abilities) {
                    const playAb = card.abilities.find(ab => ['PLAY', 'PLAY_OPTIONAL', 'ON_BE_PLAYED', 'ON_PLAYED'].includes(ab.trigger) && ab.activation?.method === 'PLAYER_CHOICE');
                    if (playAb) {
                        needsTarget = true;
                        mandatoryAbilityId = playAb.abilityId;
                        validTargets = getValidAbilityTargets(state, this.playerId, card.instanceId || card.id, playAb.abilityId).map(t => ({ id: t.id, line: t.line }));
                    }
                }

                if (needsTarget) {
                    if (validTargets.length > 0) {
                        actions.push({ type: 'PLAY_CARD', cardId: card.instanceId || card.id, cardName: card.name, abilityId: mandatoryAbilityId, targets: validTargets });
                    }
                } else {
                    actions.push({ type: 'PLAY_CARD', cardId: card.instanceId || card.id, cardName: card.name, abilityId: null, targets: [] });
                }
            }
            processEntityActions(card);
        });

        LINES.forEach(line => {
            if (player.lines[line]) player.lines[line].forEach(u => processEntityActions(u));
        });

        if (state.equator) {
            state.equator.forEach(item => {
                if (item.ownerId === this.playerId || item.type === 'artifact') processEntityActions(item);
            });
        }

        return actions;
    }

    /**
     * Main execution pipeline. The external hook calls this repeatedly.
     */
    executeNextMove(state) {
        if (state.turnPhase === 'SACRIFICE_DECISION') {
            const decision = this.determineSacrifice(state);
            executeSacrificeDecision(state, decision.action, decision.cardId);
            return { executed: true, type: decision.action === 'SKIP' ? 'SACRIFICE_SKIP' : 'SACRIFICE', detail: decision.detail };
        }

        const legalActions = this.computeAllLegalActions(state);
        if (legalActions.length === 0) {
            return { executed: false, type: 'NO_MOVES', detail: null };
        }

        const move = this.determineMove(state, legalActions);
        if (!move || !move.action) {
            return { executed: false, type: 'PASS', detail: null };
        }

        const { action, targetId, targetLine } = move;

        if (action.type === 'PLAY_CARD') {
            const res = playCard(state, this.playerId, action.cardId, 'back', action.abilityId, targetId);
            return { executed: res.success, type: 'PLAY_CARD', detail: action.cardName, result: res };
        } 
        else if (action.type === 'ENTITY_ACTION') {
            const res = executeEntityAction(state, this.playerId, action.entityId, action.actionType, action.abilityId, targetId, targetLine);
            if (res.success && action.isFree) this.usedFreeActions.add(action.actionKey);
            return { executed: res.success, type: action.actionType, detail: action.entityName, result: res };
        }

        return { executed: false, type: 'ERROR', detail: 'Unknown action configuration' };
    }
}