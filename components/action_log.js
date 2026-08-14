export class ActionLog extends HTMLElement {
    connectedCallback() {
        this.style.display = 'contents';
        this.innerHTML = `
        <div id="action-log-drawer-container" class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col items-center pointer-events-none transition-transform duration-300 translate-y-[calc(100%-2rem)]">
            <div class="pointer-events-auto bg-slate-900 border-t border-x border-slate-700 rounded-t-xl px-4 h-8 flex items-center justify-between gap-4 shadow-[0_-5px_25px_rgba(0,0,0,0.6)] cursor-pointer hover:bg-slate-800 transition-colors w-full max-w-3xl" onclick="window.toggleActionLog()">
            <div class="flex items-center gap-2 overflow-hidden w-full">
                <span class="text-[10px] font-black uppercase text-amber-400 tracking-wider shrink-0">📜 Log:</span>
                <div id="action-log-ticker-text" class="text-[11px] text-slate-300 truncate font-mono leading-none mt-0.5">Waiting for match to start...</div>
            </div>
            <div id="action-log-chevron" class="text-slate-400 font-bold transform transition-transform shrink-0 leading-none">&#x25B2;</div>
            </div>
            
            <div class="pointer-events-auto bg-slate-950/95 backdrop-blur-xl border-x border-slate-800 w-full max-w-3xl h-64 flex flex-col shadow-2xl">
            <div class="p-2 border-b border-slate-800/60 flex justify-between items-center bg-slate-900/50 shadow-inner">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Action History</span>
                <button onclick="window.toggleActionLog()" class="text-slate-500 hover:text-white font-bold leading-none px-2">&times;</button>
            </div>
            <div id="history-log-text" class="flex-1 overflow-y-auto p-3 flex flex-col gap-0.5 text-xs font-mono text-slate-300 minimal-scrollbar pb-6 select-text">
                <div class="text-slate-500 italic">Match tabletop initialized.</div>
            </div>
            </div>
        </div>
        `;
    }
}
customElements.define('action-log', ActionLog);