// This file runs BEFORE any tests or imports are evaluated, 
// fixing the ESM hoisting crash for HTMLElement and CustomEvent.

globalThis.HTMLElement = class {};
globalThis.customElements = { define() {}, get() { return undefined; } };
globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, init = {}) {
        super(type, init);
        this.detail = init?.detail;
    }
};

globalThis.window = {
    __GAME_CARD_CACHE: new Map(),
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    openActionModal() {}, closeUnitActionModal() {}, handleRestartMatch() {},
    updateUI() {}, inspectCard() {}, activateAbility() {}, executeNormalPlay() {},
    handleHandCardClick() {},
    _isDragging: false, _forceHoverCardId: null, _dragCardId: null,
    _dragTargets: [], _blockClick: false, innerWidth: 1200,
    ClientState: { customTribesList: [] }
};

globalThis.document = {
    querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; },
    createElement() { 
        return { 
            classList: { add() {}, remove() {}, toggle() {}, replace() {} }, 
            setAttribute() {}, appendChild() {}, style: {}, innerHTML: '', value: '',
            getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; }, 
            closest() { return null; }, firstElementChild: null 
        }; 
    },
    body: { appendChild() {} }, head: { appendChild() {} }, addEventListener() {}
};