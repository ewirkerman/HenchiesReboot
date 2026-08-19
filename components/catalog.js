export class StudioCatalog extends HTMLElement {
    constructor() {
        super();
        this.items = [];
        this.filteredItems = [];
        this.renderItemCallback = null;
        this.onNewItemCallback = null;
        this.title = this.getAttribute('title') || 'Catalog';
        this.showCards = true;
        this.showAbilities = true;
    }

    connectedCallback() {
        const updateToggles = () => {
            const btnC = this.querySelector('#toggle-cards');
            const btnA = this.querySelector('#toggle-abilities');
            if(btnC) btnC.className = `flex-1 text-[10px] font-bold px-2 py-1.5 rounded transition-colors border shadow-inner ${this.showCards ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-500 border-slate-700'}`;
            if(btnA) btnA.className = `flex-1 text-[10px] font-bold px-2 py-1.5 rounded transition-colors border shadow-inner ${this.showAbilities ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-800 text-slate-500 border-slate-700'}`;
        };

        const isDual = this.getAttribute('dual-new') === 'true';
        let newBtnsHtml = isDual ? `
            <div class="flex gap-1">
                <button id="catalog-new-card-btn" class="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-2.5 py-1 rounded shadow">+ Card</button>
                <button id="catalog-new-abil-btn" class="bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black px-2.5 py-1 rounded shadow">+ Ability</button>
            </div>
        ` : `
            <button id="catalog-new-btn" class="bg-amber-500 hover:bg-amber-400 text-black text-xs font-black px-2.5 py-1 rounded shadow">
                + New
            </button>
        `;

        let togglesHtml = isDual ? `
            <div class="flex gap-2">
                <button id="toggle-cards">Cards</button>
                <button id="toggle-abilities">Abilities</button>
            </div>
        ` : '';

        this.innerHTML = `
            <div class="glass-panel rounded-2xl p-4 flex flex-col gap-3 shadow-2xl border border-slate-800 h-full max-h-[800px]">
                <div class="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h2 class="text-sm font-black text-amber-400 uppercase tracking-wider">
                        📦 ${this.title}
                    </h2>
                    ${newBtnsHtml}
                </div>
                ${togglesHtml}
                <input type="text" id="catalog-search-input" placeholder="🔍 Search by name..." class="bg-slate-900 border border-slate-700 p-2 rounded text-xs text-amber-300 w-full focus:outline-none focus:border-amber-500" />
                <div id="catalog-list-container" class="flex flex-col gap-2 overflow-y-auto flex-1 minimal-scrollbar">
                    <div class="text-xs text-slate-500 italic text-center p-3">Loading catalog...</div>
                </div>
            </div>
        `;
        
        updateToggles();

        const btnC = this.querySelector('#toggle-cards');
        const btnA = this.querySelector('#toggle-abilities');
        if (btnC) btnC.addEventListener('click', () => { this.showCards = !this.showCards; updateToggles(); this.filterAndRender(this.querySelector('#catalog-search-input').value); });
        if (btnA) btnA.addEventListener('click', () => { this.showAbilities = !this.showAbilities; updateToggles(); this.filterAndRender(this.querySelector('#catalog-search-input').value); });

        this.querySelector('#catalog-search-input').addEventListener('input', (e) => this.filterAndRender(e.target.value));
        
        if (isDual) {
            this.querySelector('#catalog-new-card-btn').addEventListener('click', () => {
                if (this.onNewItemCallback) this.onNewItemCallback('card');
                this.dispatchEvent(new CustomEvent('new-item', { detail: { type: 'card' } }));
            });
            this.querySelector('#catalog-new-abil-btn').addEventListener('click', () => {
                if (this.onNewItemCallback) this.onNewItemCallback('ability');
                this.dispatchEvent(new CustomEvent('new-item', { detail: { type: 'ability' } }));
            });
        } else {
            this.querySelector('#catalog-new-btn').addEventListener('click', () => {
                if (this.onNewItemCallback) this.onNewItemCallback();
                this.dispatchEvent(new CustomEvent('new-item'));
            });
        }
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
        const isDual = this.getAttribute('dual-new') === 'true';
        const hideBadges = this.getAttribute('hide-badges') === 'true' || !isDual;

        const typeFiltered = this.items.filter(item => {
            const isCard = item.unifiedType ? item.unifiedType === 'card' : ['card', 'unit', 'avatar', 'spell', 'equipment', 'artifact', 'boon'].includes(item.type);
            const isAbility = item.unifiedType ? item.unifiedType === 'ability' : item.abilityId !== undefined;
            if (isCard && !this.showCards) return false;
            if (isAbility && !this.showAbilities) return false;
            return true;
        });

        if (terms.length === 0) {
            this.filteredItems = typeFiltered.slice(0, 5);
        } else {
            const matched = typeFiltered.filter(item => {
                let payloadTypes = '';
                if (item.effects) {
                    payloadTypes = item.effects.map(g => (g.payloads || []).map(p => p.type).join(' ')).join(' ');
                }
                const searchableText = [
                    item.name,
                    item.id,
                    item.abilityId,
                    item.unifiedId,
                    item.genus,
                    item.tribe,
                    item.type,
                    item.family,
                    item.description,
                    item.displayDescription,
                    item.trigger,
                    item.searchTags,
                    item.passiveFlags ? item.passiveFlags.join(' ') : '',
                    payloadTypes
                ].filter(Boolean).join(' ').toLowerCase();
                
                return terms.every(term => searchableText.includes(term));
            });

            const nameMatches = [];
            const otherMatches = [];
            
            matched.forEach(item => {
                const itemName = (item.name || '').toLowerCase();
                if (terms.every(term => itemName.includes(term))) {
                    nameMatches.push(item);
                } else {
                    otherMatches.push(item);
                }
            });
            
            this.filteredItems = [...nameMatches, ...otherMatches].slice(0, 10);
        }

        if (this.filteredItems.length === 0) {
            listContainer.innerHTML = `<div class="text-xs text-slate-500 italic text-center p-3">No items found.</div>`;
            return;
        }

        listContainer.innerHTML = this.filteredItems.map(item => {
            const isCard = item.unifiedType ? item.unifiedType === 'card' : ['card', 'unit', 'avatar', 'spell', 'equipment', 'artifact', 'boon'].includes(item.type);
            const badgeColor = isCard ? 'bg-blue-900 text-blue-300 border-blue-700' : 'bg-amber-900 text-amber-300 border-amber-700';
            const badgeText = isCard ? 'CARD' : 'ABIL';
            const rawHtml = this.renderItemCallback(item);
            const itemId = item.unifiedId || item.id || item.abilityId;
            
            if (hideBadges) {
                return rawHtml;
            }
            
            return `
                <div class="relative group transition-all" data-catalog-id="${itemId}">
                    <div class="absolute top-0 right-0 -mt-1 -mr-1 z-10 scale-75 origin-top-right pointer-events-none">
                        <span class="text-[9px] font-black px-1.5 py-0.5 rounded border ${badgeColor} shadow-md">${badgeText}</span>
                    </div>
                    ${rawHtml}
                </div>
            `;
        }).join('');

        if (this.activeId) this.setActiveItem(this.activeId);
    }

    setActiveItem(id) {
        this.activeId = id;
        const items = this.querySelectorAll('[data-catalog-id]');
        items.forEach(el => {
            if (el.dataset.catalogId === id) {
                el.classList.add('ring-2', 'ring-inset', 'ring-amber-500', 'bg-slate-800/80');
                el.classList.remove('bg-slate-900/60');
            } else {
                el.classList.remove('ring-2', 'ring-inset', 'ring-amber-500', 'bg-slate-800/80');
                el.classList.add('bg-slate-900/60');
            }
        });
    }
}

customElements.define('studio-catalog', StudioCatalog);