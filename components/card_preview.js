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
            <div class="absolute inset-0 w-full h-full flex flex-col items-center overflow-y-auto minimal-scrollbar p-4 cursor-grab active:cursor-grabbing">
                <div class="flex flex-col items-center gap-5 w-full m-auto shrink-0">
                    <game-card card-data="${dataStr}" on-inspect="window.inspectMiniPreview()"></game-card>
                    <div class="flex gap-4 items-end">
                        <game-card card-data="${dataStr}" size="micro" on-inspect="window.inspectMiniPreview()"></game-card>
                        <game-card card-data="${dataStr}" size="nano" on-inspect="window.inspectMiniPreview()"></game-card>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('card-preview', CardPreview);