export const ClientState = {
    gameState: null,
    localPlayerRole: 'player1',
    roomCode: 'ROOM_HENCHIES_1',
    activeBattleDeck: null,
    selectedCardId: null,
    pendingAbility: null,
    selectedEquatorItemIndex: null,
    validTargets: [],
    replayStepIndex: 0,
    localReplayStates: [],
    lastSafeUndoIndex: 0,
    allAbilitiesRegistry: [],
    allCardsRegistry: [],
    loadedUserDecks: {},
    customTribesList: [],
    
    isMyTurn() {
        if (!this.gameState || this.gameState.status === 'finished') return false;
        return this.gameState.activePlayerId === this.localPlayerRole;
    }
};