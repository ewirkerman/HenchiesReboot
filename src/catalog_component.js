export class StudioCatalog extends HTMLElement {
    constructor() {
        super();
        this.items = [];
        this.filteredItems = [];
        this.renderItemCallback = null;
        this.onNewItemCallback = null;
        this.title = this.getAttribute('title') || 'Catalog';
    }

    connectedCallback() {
        this.innerHTML = `
            <div class="glass-panel rounded-2xl p-4 flex flex-col gap-3 shadow-2xl border border-slate-800 h-full max-h-[800px]">
                <div class="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h2 class="text-sm font-black text-amber-400 uppercase tracking-wider">
                        📦 ${this.title}
                    </h2>
                    <button id="catalog-new-btn" class="bg-amber-500 hover:bg-amber-400 text-black text-xs font-black px-2.5 py-1 rounded shadow">
                        + New
                    </button>
                </div>
                <input type="text" id="catalog-search-input" placeholder="🔍 Search by name..." class="bg-slate-900 border border-slate-700 p-2 rounded text-xs text-amber-300 w-full focus:outline-none focus:border-amber-500" />
                <div id="catalog-list-container" class="flex flex-col gap-2 overflow-y-auto flex-1 minimal-scrollbar">
                    <div class="text-xs text-slate-500 italic text-center p-3">Loading catalog...</div>
                </div>
            </div>
        `;

        this.querySelector('#catalog-search-input').addEventListener('input', (e) => this.filterAndRender(e.target.value));
        this.querySelector('#catalog-new-btn').addEventListener('click', () => {
            if (this.onNewItemCallback) this.onNewItemCallback();
            this.dispatchEvent(new CustomEvent('new-item'));
        });
    }

    setItems(items, renderCallback) {
        this.items = items;
        if (renderCallback) this.renderItemCallback = renderCallback;
        
        this.items.sort((a, b) => {
            const getVal = (item) => {
                if (item.updatedAt) return item.updatedAt;
                const idStr = item.id || item.abilityId || '';
                const parts = idStr.split('_');
                if (parts.length > 1 && !isNaN(parseInt(parts[1]))) {
                    return parseInt(parts[1]);
                }
                return 0;
            };
            return getVal(b) - getVal(a);
        }); 

        const searchInput = this.querySelector('#catalog-search-input');
        this.filterAndRender(searchInput ? searchInput.value : '');
    }

    filterAndRender(query) {
        const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const listContainer = this.querySelector('#catalog-list-container');

        if (terms.length === 0) {
            // Show top 5 most recent if no search
            this.filteredItems = this.items.slice(0, 5);
        } else {
            this.filteredItems = this.items.filter(item => {
                const searchableText = [
                    item.name,
                    item.id,
                    item.genus,
                    item.tribe,
                    item.type,
                    item.family
                ].filter(Boolean).join(' ').toLowerCase();
                
                return terms.every(term => searchableText.includes(term));
            }).slice(0, 30);
        }

        if (this.filteredItems.length === 0) {
            listContainer.innerHTML = `<div class="text-xs text-slate-500 italic text-center p-3">No items found.</div>`;
            return;
        }

        listContainer.innerHTML = this.filteredItems.map(item => this.renderItemCallback(item)).join('');
    }
}

customElements.define('studio-catalog', StudioCatalog);