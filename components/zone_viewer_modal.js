export class ZoneViewerModal extends HTMLElement {
    connectedCallback() {
        this.style.display = 'contents';
        this.innerHTML = `
        <div id="zone-viewer-modal" class="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md hidden flex-col p-4 sm:p-8" onclick="if(event.target === this) window.closeZoneModal()">
            <div class="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-[760px] w-full mx-auto my-auto flex flex-col max-h-[85vh]">
            <div class="flex justify-between items-center p-4 border-b border-slate-800 shrink-0">
                <div class="flex flex-col">
                    <h3 id="zone-modal-title" class="text-xl font-black text-amber-400 uppercase tracking-wider">Zone Pile</h3>
                    <p id="zone-modal-subtitle" class="text-xs text-slate-400">View cards.</p>
                </div>
                <button onclick="window.closeZoneModal()" class="text-slate-400 hover:text-white font-bold text-3xl leading-none">&times;</button>
            </div>
            <div id="zone-modal-cards" class="overflow-y-auto p-4 flex flex-wrap content-start justify-center gap-4 bg-slate-950 minimal-scrollbar rounded-b-2xl">
                <!-- Cards injected here -->
            </div>
            </div>
        </div>
        `;
    }
}
customElements.define('zone-viewer-modal', ZoneViewerModal);