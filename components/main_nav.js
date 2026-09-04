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
                : 'text-slate-400 hover:text-slate-200 transition-colors block py-2 md:py-0';
            return `<a href="${link.href}" class="${classes}">${link.text}</a>`;
        }).join('');

        this.innerHTML = `
            <header id="main-nav-header" class="relative z-[100] glass-panel border-b border-slate-800 px-4 py-2 sm:py-3 flex flex-wrap justify-between items-center shadow-md">
                <div class="flex items-center justify-between w-full md:w-auto">
                    <div class="flex items-center gap-3">
                        <span class="text-lg sm:text-xl font-black bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent">
                            HENCHIES 2
                        </span>
                        <span class="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-300 font-semibold truncate max-w-[120px] sm:max-w-none" id="header-room-badge">
                            ${subtitle}
                        </span>
                    </div>
                    
                    <!-- Mobile Hamburger Menu Button -->
                    <button id="mobile-menu-toggle" class="md:hidden text-amber-400 hover:text-amber-300 focus:outline-none p-1">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </button>
                </div>
                
                <!-- Nav Links -->
                <nav id="mobile-nav-menu" class="hidden md:flex flex-col md:flex-row w-full md:w-auto items-start md:items-center gap-2 md:gap-4 text-xs font-bold uppercase tracking-wider mt-3 md:mt-0 border-t border-slate-800 md:border-none pt-2 md:pt-0">
                    ${navLinksHtml}
                </nav>
            </header>
        `;

        const toggleBtn = this.querySelector('#mobile-menu-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const menu = this.querySelector('#mobile-nav-menu');
                menu.classList.toggle('hidden');
                menu.classList.toggle('flex');
            });
        }
    }
}
customElements.define('main-nav', MainNav);