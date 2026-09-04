export class HarvestModal extends HTMLElement {
    constructor() {
        super();
        this.expanded = false;
        this.handleToggle = this.handleToggle.bind(this);
    }

    connectedCallback() {
        this.render();
    }

    static get observedAttributes() {
        return ['is-active', 'selected-card', 'tribe-name'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.render();
        }
    }

    handleToggle() {
        this.expanded = !this.expanded;
        this.render();
    }

    render() {
        const isActive = this.getAttribute('is-active') === 'true';
        if (!isActive) {
            this.innerHTML = '';
            this.className = 'hidden';
            return;
        }

        const hasSelectedCard = this.getAttribute('selected-card') === 'true';
        const tribeName = this.getAttribute('tribe-name') || 'Tribe Resource';

        // Position fixed just below the top bars. Pointer-events-none on wrapper so you can click through to board
        this.className = 'fixed top-[40px] md:top-[100px] left-0 right-0 z-[85] flex justify-center pointer-events-none px-2 transition-all duration-300';

        const chevronIcon = this.expanded 
            ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>`
            : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;

        this.innerHTML = `
            <div class="bg-slate-900/95 backdrop-blur-md border-2 border-amber-500/80 rounded-xl shadow-2xl flex flex-col max-w-md w-full relative overflow-hidden pointer-events-auto transition-all duration-300 ${this.expanded ? 'p-3' : 'px-3 py-2'}">
                <div class="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none"></div>
                
                <!-- Header / Toggle -->
                <div class="flex justify-between items-center z-10 cursor-pointer group" onclick="this.getRootNode().host.handleToggle()">
                    <h2 class="text-sm font-black text-amber-400 uppercase tracking-widest drop-shadow-md flex items-center gap-2">
                        🌿 Harvest Phase
                    </h2>
                    <div class="text-amber-500/70 group-hover:text-amber-400 transition-colors">
                        ${chevronIcon}
                    </div>
                </div>
                
                <!-- Expandable Instructions -->
                <div class="${this.expanded ? 'block mt-2 mb-3' : 'hidden'} text-slate-300 text-[10px] leading-relaxed z-10 font-medium border-t border-amber-500/30 pt-2">
                    Sacrifice a card from your hand below to permanently gain:<br>
                    <strong class="text-purple-400 block mt-1">+1 Max Carnie</strong>
                    <strong class="text-emerald-400 block">+1 Max ${tribeName}</strong>
                </div>

                <!-- Action Buttons (Always Visible) -->
                <div class="flex items-center gap-2 mt-2 z-10 w-full">
                    <button id="overlay-sacrifice-confirm-btn" onclick="window.handleSacrificeConfirm()" class="flex-1 bg-amber-700 hover:bg-amber-600 text-white text-[10px] sm:text-xs font-bold py-1.5 rounded shadow border border-amber-500 transition ${hasSelectedCard ? '' : 'opacity-50 cursor-not-allowed'}" ${hasSelectedCard ? '' : 'disabled'}>
                        Confirm [C]
                    </button>
                    <button id="overlay-sacrifice-skip-btn" onclick="window.handleSacrificeDecision('SKIP')" class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] sm:text-xs font-bold py-1.5 rounded shadow border border-slate-600 transition">
                        Skip [S]
                    </button>
                </div>
            </div>
        `;

        // We have to bind the toggle handler to the host node since we are injecting raw HTML strings
        const headerEl = this.querySelector('div.cursor-pointer');
        if (headerEl) {
             headerEl.onclick = this.handleToggle;
        }
    }
}
customElements.define('harvest-modal', HarvestModal);