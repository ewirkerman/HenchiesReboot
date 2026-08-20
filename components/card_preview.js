export class CardPreview extends HTMLElement {
    connectedCallback() {
        this.style.display = 'contents';
        this.render();
    }

    static get observedAttributes() { return ['card-data']; }
    
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue && this.isConnected) {
            this.render();
        }
    }
    
    render() {
        const dataStr = this.getAttribute('card-data');
        if (!dataStr) {
            this.innerHTML = `<div class="text-xs text-slate-500 italic">No data to preview.</div>`;
            return;
        }
        
        this.innerHTML = `
            <div class="absolute inset-0 w-full h-full flex flex-col items-center overflow-y-auto overflow-x-hidden minimal-scrollbar p-4 select-none">
                <div class="flex flex-col items-center justify-center m-auto gap-8 w-full min-h-full py-4 shrink-0 transition-all duration-300 pointer-events-none">
                    <div class="pointer-events-auto transition-transform duration-200" style="transform: scale(1.25); transform-origin: center center;">
                        <game-card card-data="${dataStr}" on-inspect="window.inspectMiniPreview()"></game-card>
                    </div>
                    <div class="flex gap-4 items-end pointer-events-auto">
                        <game-card card-data="${dataStr}" size="micro" on-inspect="window.inspectMiniPreview()"></game-card>
                        <game-card card-data="${dataStr}" size="nano" on-inspect="window.inspectMiniPreview()"></game-card>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('card-preview', CardPreview);