export class ArtPanner extends HTMLElement {
    connectedCallback() {
        const title = this.getAttribute('title') || 'Art Pan';
        const prefix = this.getAttribute('prefix') || 'card-art';
        const defaultScale = this.getAttribute('default-scale') || '100';

        this.innerHTML = `
            <div class="flex flex-col gap-2 bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/50 w-full h-full justify-center">
              <div class="text-[9px] font-black text-slate-400 uppercase tracking-wider flex justify-between items-center">
                <span class="truncate">${title}</span>
                <div class="flex items-center gap-2">
                    <span class="text-amber-500/50 italic text-[8px] hidden lg:block">Drag/Scroll</span>
                    <button type="button" onclick="document.getElementById('${prefix}-x').value=0; document.getElementById('${prefix}-y').value=0; document.getElementById('${prefix}-scale').value=${defaultScale}; if(window.updatePreview) window.updatePreview()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 px-1.5 py-0.5 rounded text-[8px] transition-colors shadow focus:outline-none">
                        ⟲ Reset
                    </button>
                </div>
              </div>
              <div class="flex gap-2 w-full mt-1">
                  <div class="flex-1 flex flex-col w-full">
                    <label class="text-[8px] text-slate-500 uppercase font-bold mb-1">Pan X</label>
                    <input type="range" id="${prefix}-x" min="-500" max="600" value="0" class="w-full accent-amber-500" oninput="if(window.updatePreview) window.updatePreview()" />
                  </div>
                  <div class="flex-1 flex flex-col w-full">
                    <label class="text-[8px] text-slate-500 uppercase font-bold mb-1">Pan Y</label>
                    <input type="range" id="${prefix}-y" min="-500" max="600" value="0" class="w-full accent-amber-500" oninput="if(window.updatePreview) window.updatePreview()" />
                  </div>
                  <div class="flex-1 flex flex-col w-full">
                    <label class="text-[8px] text-slate-500 uppercase font-bold mb-1">Zoom</label>
                    <input type="range" id="${prefix}-scale" min="10" max="400" value="${defaultScale}" class="w-full accent-sky-500" oninput="if(window.updatePreview) window.updatePreview()" />
                  </div>
              </div>
            </div>
        `;
    }
}
customElements.define('art-panner', ArtPanner);