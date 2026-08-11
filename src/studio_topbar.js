/**
 * src/studio_topbar.js
 * Abstracted Topbar Web Component for Studio tools (Save, Clone, Test, Import, Delete)
 */

export class StudioTopbar extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <div class="flex items-center gap-2 mt-1">
                <button type="button" id="btn-save" class="bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-4 py-2 rounded-lg shadow-lg transition text-[11px] uppercase tracking-wider whitespace-nowrap">💾 Save</button>
                <button type="button" id="btn-clone" class="bg-cyan-600/80 hover:bg-cyan-500 text-white font-bold px-4 py-2 rounded-lg shadow-lg transition text-[11px] uppercase tracking-wider border border-cyan-500/30 whitespace-nowrap">👯 Clone</button>
                <button type="button" id="btn-test" class="bg-purple-600/80 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-lg shadow-lg transition text-[11px] uppercase tracking-wider border border-purple-500/30 whitespace-nowrap">🧪 Test</button>
                <button type="button" id="btn-import" class="bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg shadow-lg transition text-[11px] uppercase tracking-wider border border-emerald-500/30 whitespace-nowrap">📥 Import</button>
                <button type="button" id="btn-delete" class="bg-red-600/80 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-lg shadow-lg transition text-[11px] uppercase tracking-wider border border-red-500/30 whitespace-nowrap">🗑️ Delete</button>
            </div>
            
            <div id="import-modal" class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm hidden items-center justify-center p-4">
                <div class="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full p-5 flex flex-col gap-4">
                    <h2 class="text-lg font-black text-emerald-400 uppercase tracking-wider">📥 Import JSON</h2>
                    <textarea id="import-textarea" rows="12" class="bg-slate-950 border border-slate-800 p-3 rounded text-emerald-300 font-mono text-xs w-full focus:outline-none focus:border-emerald-500" placeholder="Paste full raw JSON data here..."></textarea>
                    <div class="flex gap-3 justify-end mt-2">
                        <button id="import-cancel" class="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2 rounded transition">Cancel</button>
                        <button id="import-confirm" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded transition">Confirm Import</button>
                    </div>
                </div>
            </div>
        `;

        this.querySelector('#btn-save').addEventListener('click', () => this.dispatchEvent(new CustomEvent('save')));
        this.querySelector('#btn-clone').addEventListener('click', () => this.dispatchEvent(new CustomEvent('clone')));
        this.querySelector('#btn-test').addEventListener('click', () => this.dispatchEvent(new CustomEvent('test')));
        
        // Handle Confirmed Delete inline so parents just listen for 'delete'
        this.querySelector('#btn-delete').addEventListener('click', (e) => {
            const btn = e.target;
            if (!btn.dataset.confirm) {
                btn.dataset.confirm = 'true';
                btn.innerHTML = '⚠️ Confirm';
                btn.classList.replace('bg-red-600/80', 'bg-red-700');
                setTimeout(() => { 
                    if (btn.dataset.confirm) { 
                        delete btn.dataset.confirm; 
                        btn.innerHTML = '🗑️ Delete'; 
                        btn.classList.replace('bg-red-700', 'bg-red-600/80'); 
                    } 
                }, 3000);
                return;
            }
            delete btn.dataset.confirm;
            btn.innerHTML = '🗑️ Delete';
            btn.classList.replace('bg-red-700', 'bg-red-600/80');
            this.dispatchEvent(new CustomEvent('delete'));
        });
        
        // Modal Handlers
        const modal = this.querySelector('#import-modal');
        const textarea = this.querySelector('#import-textarea');
        
        this.querySelector('#btn-import').addEventListener('click', () => {
            textarea.value = '';
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        });
        
        this.querySelector('#import-cancel').addEventListener('click', () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        });
        
        this.querySelector('#import-confirm').addEventListener('click', () => {
            try {
                const data = JSON.parse(textarea.value);
                
                if (typeof data !== 'object' || data === null) {
                    throw new Error("Imported data must be a JSON object.");
                }
                
                this.dispatchEvent(new CustomEvent('import', { detail: data }));
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            } catch(e) {
                let msg = e.message;
                if (e instanceof SyntaxError) {
                    msg = "JSON Syntax Error. Check for missing quotes, extra commas, or trailing commas.\n\nDetails: " + msg;
                }
                // Dispatch an error event so the parent can handle it in the UI
                this.dispatchEvent(new CustomEvent('import-error', { detail: { message: msg } }));
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        });
    }

    showButtons(isEditing) {
        const cloneBtn = this.querySelector('#btn-clone');
        const deleteBtn = this.querySelector('#btn-delete');
        
        if (isEditing) {
            cloneBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            cloneBtn.disabled = false;
            deleteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            deleteBtn.disabled = false;
        } else {
            cloneBtn.classList.add('opacity-50', 'cursor-not-allowed');
            cloneBtn.disabled = true;
            deleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
            deleteBtn.disabled = true;
        }
    }

    setLoading(action, isLoading) {
        const btn = this.querySelector(`#btn-${action}`);
        if (!btn) return;
        if (isLoading) {
            btn.dataset.origText = btn.innerHTML;
            btn.innerHTML = '⏳ ...';
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            btn.innerHTML = btn.dataset.origText || btn.innerHTML;
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}
customElements.define('studio-topbar', StudioTopbar);