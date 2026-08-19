export class MainNav extends HTMLElement {
    connectedCallback() {
        const activePage = this.getAttribute('active-page') || 'game';
        const subtitle = this.getAttribute('subtitle') || 'Match Setup Lobby';
    
        // Dynamically resolve relative paths based on directory depth
        const isStudio = window.location.pathname.includes('/studios/');
        const prefix = isStudio ? '../' : './';

        const links = [
            { id: 'game', href: prefix + 'game.html', text: 'Game Table' },
            { id: 'deckbuilder', href: prefix + 'deckbuilder.html', text: 'Deckbuilder' },
            { id: 'creator_studio', href: isStudio ? 'creator.html' : 'studios/creator.html', text: 'Creator Studio' },
            { id: 'tribe_studio', href: isStudio ? 'tribes.html' : 'studios/tribes.html', text: 'Tribe Studio' }
        ];

        const navLinksHtml = links.map(link => {
            const isActive = link.id === activePage;
            const classes = isActive 
                ? 'text-amber-400 border-b-2 border-amber-400 pb-0.5' 
                : 'text-slate-400 hover:text-slate-200 transition-colors';
            return `<a href="${link.href}" class="${classes}">${link.text}</a>`;
        }).join('');

        this.innerHTML = `
            <header class="sticky top-0 z-[100] glass-panel border-b border-slate-800 px-4 py-3 flex flex-wrap justify-between items-center gap-2 shadow-2xl">
                <div class="flex items-center gap-3">
                    <span class="text-xl font-black bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent">
                        HENCHIES 2
                    </span>
                    <span class="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-300 font-semibold" id="header-room-badge">
                        ${subtitle}
                    </span>
                </div>
                <nav class="flex items-center gap-4 text-xs font-bold uppercase tracking-wider">
                    ${navLinksHtml}
                </nav>
            </header>
        `;
    }
}
customElements.define('main-nav', MainNav);