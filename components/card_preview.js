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
            <div class="absolute inset-0 flex items-center justify-center overflow-hidden select-none pointer-events-none p-4">
                <div class="flex flex-row items-center justify-center m-auto gap-4 sm:gap-8 w-full shrink-0 origin-center xl:scale-100 lg:scale-90 scale-75">
                    <div class="pointer-events-auto hover:z-[100] transition-transform duration-200 hover:-translate-y-2 hover:scale-105">
                        <game-card card-data="${dataStr}" on-inspect="window.inspectMiniPreview()"></game-card>
                    </div>
                    <div class="pointer-events-auto hover:z-[100] transition-transform duration-200 hover:-translate-y-2 hover:scale-105">
                        <game-card card-data="${dataStr}" size="nano" on-inspect="window.inspectMiniPreview()"></game-card>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('card-preview', CardPreview);