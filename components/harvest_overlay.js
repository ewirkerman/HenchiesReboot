export class HarvestOverlay extends HTMLElement {
    connectedCallback() {
        this.style.display = 'contents';
        this.innerHTML = `
        <div id="harvest-overlay" class="fixed top-16 inset-x-0 z-50 hidden flex-col items-center justify-start pointer-events-none transition-opacity duration-300">
            <div class="pointer-events-auto bg-slate-950/95 border-b-2 border-x-2 border-amber-500 p-4 rounded-b-2xl shadow-[0_15px_50px_rgba(245,158,11,0.4)] flex flex-col items-center gap-2 w-full max-w-2xl text-center backdrop-blur-md">
                <h2 class="text-lg font-black text-amber-400 uppercase tracking-widest drop-shadow-md animate-pulse">🌾 Harvest Phase</h2>
                <p class="text-xs text-slate-300">Select a card from your hand below to sacrifice for <strong class="text-amber-300">+1 Max Carnie</strong> and <strong class="text-emerald-300">+1 Max Tribe Resource</strong>.</p>
                <div class="flex gap-3 w-full max-w-sm mt-1">
                    <button id="overlay-sacrifice-confirm-btn" class="flex-1 bg-amber-600 hover:bg-amber-500 text-black text-xs font-black px-4 py-2 rounded shadow-lg opacity-50 cursor-not-allowed transition-all" disabled title="Hotkey: C">
                        Confirm Sacrifice [C]
                    </button>
                    <button id="overlay-sacrifice-skip-btn" class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded border border-slate-600 transition-all" title="Hotkey: S">
                        Skip Harvest [S]
                    </button>
                </div>
            </div>
        </div>
        `;
    }
}
customElements.define('harvest-overlay', HarvestOverlay);