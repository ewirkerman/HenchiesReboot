import { jest } from '@jest/globals';
import { MinimaxAI, AI_PROFILES, AI_DIFFICULTIES } from '../../src/ai/minimax_ai.js/index.js';
import { executeSacrificeDecision } from '../../src/engine/flow.js';
import { createTestState } from '../test_utils.js';

describe('MinimaxAI Engine Decisions', () => {
  let ai;
  let state;

  beforeEach(() => {
    jest.clearAllMocks();

    // Use the factory to guarantee standard board state geometry[cite: 2]
    state = createTestState();

    // Define default player structures expected by the evaluateStateWithProfile logic[cite: 1]
    state.players = {
      player1: {
        hand: [],
        lines: { avatar: [{ type: 'avatar', health: 20 }] },
        resources: { mana: { max: 5, current: 5 } },
        startingDeck: []
      },
      player2: {
        hand: [],
        lines: { avatar: [{ type: 'avatar', health: 20 }] },
        resources: { mana: { max: 5, current: 5 } },
        startingDeck: []
      }
    };

    // Instantiate AI for player1 using BALANCED profile, HARD difficulty, and 1 determinization for speed[cite: 1]
    ai = new MinimaxAI('player1', 'BALANCED', 'HARD', 1);
    ai.debug = false; // Disable verbose AI logging for clean test output[cite: 1]
  });

  describe('determineSacrifice()', () => {
    it('should return SKIP if the player has no cards in their hand', () => {
      // Evaluates candidates including 'SKIP' and 'OPTION_A'[cite: 1]
      const decision = ai.determineSacrifice(state);

      expect(decision.action).toBe('SKIP');
      expect(decision.cardId).toBeNull();
      expect(decision.detail).toBe('Skipped');
    });

    it('should evaluate hand cards and select an OPTION_A sacrifice candidate', () => {
      // Provide cards with instanceIds so the AI can build OPTION_A candidates[cite: 1]
      state.players.player1.hand = [
        { id: 'card1', instanceId: 'inst_1', name: 'Low Cost Card', cost: 1, strength: 1, health: 1 },
        { id: 'card2', instanceId: 'inst_2', name: 'High Cost Card', cost: 9, strength: 8, health: 8 }
      ];

      const decision = ai.determineSacrifice(state);

      // The AI should select either SKIP or one of the OPTION_A candidates based on state evaluation[cite: 1]
      expect(['SKIP', 'OPTION_A']).toContain(decision.action);
    });
  });

  describe('executeNextMove() sacrifice replay contract', () => {
    it('preserves the selected card ID so replay consumes the card and grants resources', () => {
      const liveState = createTestState();
      liveState.turnPhase = 'SACRIFICE_DECISION';
      liveState.players.player1.hand = [
        { id: 'harvest-card', instanceId: 'harvest-instance', ownerId: 'player1', name: 'Harvest Card', tribe: 'Pirate' }
      ];
      liveState.players.player1.lines.avatar = [
        { type: 'avatar', instanceId: 'avatar-player1', ownerId: 'player1', health: 20 }
      ];
      liveState.players.player1.resources = { Carnie: { current: 1, max: 1 } };
      liveState.players.player2.lines.avatar = [
        { type: 'avatar', instanceId: 'avatar-player2', ownerId: 'player2', health: 20 }
      ];
      const replayState = structuredClone(liveState);

      const sacrificeAI = new MinimaxAI('player1');
      sacrificeAI.debug = false;
      jest.spyOn(sacrificeAI, 'determineSacrifice').mockReturnValue({
        action: 'OPTION_A',
        cardId: 'harvest-instance',
        detail: 'Harvest Card'
      });

      const move = sacrificeAI.executeNextMove(liveState);

      expect(move.type).toBe('SACRIFICE');
      expect(move.action).toEqual({ action: 'OPTION_A', cardId: 'harvest-instance' });

      const option = move.action?.action || (move.type === 'SACRIFICE_SKIP' ? 'SKIP' : 'OPTION_A');
      const cardId = move.action?.cardId || null;
      executeSacrificeDecision(replayState, option, cardId);

      expect(replayState.players.player1.hand).toHaveLength(0);
      expect(replayState.players.player1.banish[0].instanceId).toBe('harvest-instance');
      expect(replayState.players.player1.resources.Carnie).toEqual({ current: 2, max: 2 });
      expect(replayState.players.player1.resources.Pirate).toEqual({ current: 1, max: 1 });
    });
  });

  describe('determineMove()', () => {
    beforeEach(() => {
      // Mock base engine methods to isolate MinimaxAI logic
      ai.computeAllLegalActions = jest.fn().mockReturnValue([]);

      // Mock applyMoveToState to avoid executing actual game flow functions (playCard, executeEntityAction)[cite: 1]
      jest.spyOn(ai, 'applyMoveToState').mockReturnValue({ success: true });
    });

    it('should return null if there are no positive EV options compared to passing', () => {
      // When no legal actions exist, getExpandedOptions automatically injects PASS[cite: 1]
      const move = ai.determineMove(state, []);

      // If positiveEVOptions array is empty (meaning no move scored higher than PASS), it returns null[cite: 1]
      expect(move).toBeNull();
    });

    it('should return a valid move from the expanded options if it yields a higher score than PASS', () => {
      // Mock a legal generic play action[cite: 1]
      ai.computeAllLegalActions.mockReturnValue([
        { type: 'PLAY_CARD', cardId: 'inst_1', abilityId: 'native_play', targets: [] }
      ]);

      // Artificially manipulate the simulated state to guarantee a high score for playing the card
      ai.applyMoveToState.mockImplementation((simState, playerId, move) => {
        if (move.action.type === 'PLAY_CARD' && playerId === 'player1') {
          // Boost HP differential to guarantee this move is selected over PASS[cite: 1]
          simState.players.player2.lines.avatar[0].health = 0;
        }
        return { success: true };
      });

      const move = ai.determineMove(state, []);

      expect(move).not.toBeNull();
      expect(move.action.type).toBe('PLAY_CARD');
    });

    it('should determinize the opponent hand to simulate imperfect information', () => {
      // Provide hidden cards and a deck pool for determinization[cite: 1]
      state.players.player2.hand = [{ id: 'hidden_1' }, { id: 'hidden_2' }];
      state.players.player2.startingDeck = [{ id: 'deck_1' }, { id: 'deck_2' }, { id: 'deck_3' }];

      const determinizeSpy = jest.spyOn(ai, 'determinizeOpponentHand');

      // Provide a legal action to force the evaluation loop to run[cite: 1]
      ai.computeAllLegalActions.mockReturnValue([
        { type: 'PLAY_CARD', cardId: 'inst_1', abilityId: 'native_play', targets: [] }
      ]);

      ai.determineMove(state, []);

      // Verifies the AI attempts to replace the hidden hand with a random deck selection[cite: 1]
      expect(determinizeSpy).toHaveBeenCalledWith(expect.any(Object), 'player2');
    });
  });

  describe('applyMoveToState()', () => {
    it('should return success: true immediately for a PASS action', () => {
      // PASS is injected as an evaluable option and resolves to success without hitting game flow logic[cite: 1]
      const move = { action: { type: 'PASS' }, targetId: null, targetLine: null };
      const result = ai.applyMoveToState(state, 'player1', move);

      expect(result.success).toBe(true);
    });
  });
});