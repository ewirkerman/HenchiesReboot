export class UnitActionModal extends HTMLElement {
    connectedCallback() {
        this.style.display = 'contents';
        this.innerHTML = `
        <div id="unit-action-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm hidden">
            <div class="glass-panel rounded-2xl p-5 shadow-2xl border border-slate-700 max-w-sm w-full mx-4 flex flex-col gap-4 relative">
            <button onclick="window.closeUnitActionModal()" class="absolute top-3 right-3 text-slate-400 hover:text-white font-bold text-lg leading-none">&times;</button>
            <div class="text-center border-b border-slate-800 pb-3">
                <h2 id="modal-unit-name" class="text-xl font-black text-amber-400 tracking-wider">Unit Name</h2>
                <p class="text-xs text-slate-400 mt-1">Select an action for this unit (Press 1-9 to select).</p>
            </div>
            <div id="modal-abilities-container" class="flex flex-col gap-2">
                <!-- Buttons dynamically injected here -->
            </div>
            <button onclick="window.closeUnitActionModal()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold p-3 rounded-xl border border-slate-700 mt-2 transition">Cancel [ESC]</button>
            </div>
        </div>
        `;
    }
}
customElements.define('unit-action-modal', UnitActionModal);