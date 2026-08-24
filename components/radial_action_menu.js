import { formatAbilityCostBadge } from '../src/ui.js';
import { ClientState } from '../src/tabletop/client_state.js';

export class RadialActionMenu extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <div id="radial-menu-overlay" class="fixed inset-0 z-[100] hidden">
                <div id="radial-buttons-container" class="absolute inset-0 pointer-events-none"></div>
            </div>
        `;
    }

    open(entityId, entityName, actions, cx, cy, isHand = false, cw = 144, ch = 201, sourceElement = null) {
        this.entityId = entityId;
        this.actions = [...actions];
        this.isHand = isHand;
        this.sourceElement = sourceElement;
        this.cw = cw;
        this.ch = ch;
        
        this.actions.sort((a, b) => {
            if (a.type === 'ATTACK' && b.type !== 'ATTACK') return -1;
            if (b.type === 'ATTACK' && a.type !== 'ATTACK') return 1;
            if (a.type === 'PLAY' && b.type !== 'PLAY') return -1;
            if (b.type === 'PLAY' && a.type !== 'PLAY') return 1;
            return 0;
        });

        const container = this.querySelector('#radial-buttons-container');
        
        // Determine if we need to flip the menu to the left side of the card (if near right edge)
        const flip = cx > window.innerWidth * 0.6;
        
        // Dynamically space the buttons based on the exact width of the card
        const btnX = flip ? cx - (cw / 2) - 60 : cx + (cw / 2) + 60;
        
        const N = this.actions.length;
        if (N === 0) return;

        const spacing = 55; // Vertical space per button
        const totalHeight = (N - 1) * spacing;
        const startY = cy - totalHeight / 2;

        let svgHtml = `
            <svg class="absolute inset-0 w-full h-full pointer-events-auto z-10" onclick="document.querySelector('radial-action-menu').close()">
                <defs>
                    <mask id="card-hole-mask">
                        <rect width="100%" height="100%" fill="white" />
                        <rect id="card-hole-rect" x="${cx - cw / 2 - 4}" y="${cy - ch / 2 - 4}" width="${cw + 8}" height="${ch + 8}" fill="black" rx="12" />
                    </mask>
                    <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur1"/>
                        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur2"/>
                        <feMerge>
                            <feMergeNode in="blur2"/>
                            <feMergeNode in="blur1"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>
                <rect width="100%" height="100%" fill="rgba(15, 23, 42, 0.4)" mask="url(#card-hole-mask)" />
                <g mask="url(#card-hole-mask)">
        `;

        let btnsHtml = '';

        this.actions.forEach((act, i) => {
            const btnY = startY + i * spacing;

            let desc = '';
            if (act.type === 'PLAY') desc = 'Play this card normally.';
            else if (act.type === 'ATTACK') desc = 'Attack a valid target on the board.';
            else {
                const ab = ClientState.allAbilitiesRegistry.find(a => a.abilityId === act.abilityId);
                desc = ab ? (ab.displayDescription || ab.description) : 'Activate this ability.';
            }

            let baseClass = "border-indigo-900 bg-indigo-950/95 hover:bg-indigo-900 hover:border-indigo-400 text-indigo-100";
            let lineColor = "#818cf8"; // indigo-400
            if (act.type === 'ATTACK') {
                baseClass = "border-red-900 bg-red-950/95 hover:bg-red-900 hover:border-red-400 text-red-100";
                lineColor = "#f87171"; // red-400
            }
            if (act.type === 'PLAY') {
                baseClass = "border-emerald-900 bg-emerald-950/95 hover:bg-emerald-900 hover:border-emerald-400 text-emerald-100";
                lineColor = "#34d399"; // emerald-400
            }

            let undoWarn = !act.undoable ? `<span class="text-red-400 drop-shadow-md ml-1" title="Cannot be undone">⚠️</span>` : "";
            let costHtml = formatAbilityCostBadge(act.cost, 'Generic');

            svgHtml += `<line class="neon-line" x1="${cx}" y1="${cy}" x2="${btnX}" y2="${btnY}" stroke="${lineColor}" stroke-width="2" filter="url(#neon-glow)" opacity="0.8" />`;

            const positionStyle = flip 
                ? `right: ${window.innerWidth - btnX}px; top: ${btnY}px; transform: translateY(-50%); flex-direction: row-reverse;`
                : `left: ${btnX}px; top: ${btnY}px; transform: translateY(-50%);`;
                
            const tooltipPosition = flip ? 'right-full mr-3' : 'left-full ml-3';

            btnsHtml += `
                <div class="absolute group z-20 flex items-center action-btn-container" style="${positionStyle}">
                    <button id="action-btn-${i}" onclick="document.querySelector('radial-action-menu').selectAction(${i})" 
                            class="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border-2 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.6)] font-extrabold text-sm pointer-events-auto cursor-pointer transition-all hover:scale-105 hover:border-cyan-300 hover:shadow-[0_0_25px_rgba(34,211,238,0.9)] ${baseClass} shrink-0">
                        <span class="drop-shadow-md tracking-wide">${act.name}</span>
                        ${costHtml}
                        ${undoWarn}
                    </button>
                    
                    <div class="tooltip-box absolute top-1/2 -translate-y-1/2 ${tooltipPosition} w-56 bg-slate-950/95 backdrop-blur-sm border border-slate-700 p-3 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-0 group-hover:delay-500 pointer-events-none z-30">
                        <h4 class="text-amber-400 font-bold text-[11px] uppercase tracking-wider mb-1.5">${act.name}</h4>
                        <p class="text-slate-300 text-[11px] leading-relaxed whitespace-normal break-words">${desc.replace(/"/g, '&quot;')}</p>
                    </div>
                </div>
            `;
        });

        svgHtml += `</g></svg>`;
        
        container.innerHTML = svgHtml + btnsHtml;
        this.querySelector('#radial-menu-overlay').classList.remove('hidden', 'pointer-events-none');

        // Instead of flaky scroll/resize events, we use a 60fps tracking loop 
        // to keep the spotlight perfectly glued to the card, no matter how it moves.
        this._isOpen = true;
        this._lastRect = null;
        this._trackPosition();
    }

    _trackPosition() {
        if (!this._isOpen) return;
        this.updatePosition();
        requestAnimationFrame(() => this._trackPosition());
    }

    updatePosition() {
        if (!this.sourceElement || !this._isOpen) return;
        
        const rect = this.sourceElement.getBoundingClientRect();
        
        // Auto-close if the element is removed from DOM or hidden completely
        if (rect.width === 0 && rect.height === 0) {
             this.close();
             return;
        }

        // Performance Optimization: Only trigger DOM repaints if the card actually moved.
        // We use < 1 to ignore sub-pixel jitter.
        if (this._lastRect && 
            Math.abs(this._lastRect.left - rect.left) < 1 && 
            Math.abs(this._lastRect.top - rect.top) < 1 &&
            Math.abs(this._lastRect.width - rect.width) < 1 &&
            Math.abs(this._lastRect.height - rect.height) < 1) {
            return; 
        }
        this._lastRect = rect;

        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        this.cw = rect.width;
        this.ch = rect.height;

        // Update Hole Position
        const maskRect = this.querySelector('#card-hole-rect');
        if (maskRect) {
            maskRect.setAttribute('x', cx - this.cw / 2 - 4);
            maskRect.setAttribute('y', cy - this.ch / 2 - 4);
            maskRect.setAttribute('width', this.cw + 8);
            maskRect.setAttribute('height', this.ch + 8);
        }

        // Determine if we need to flip the menu
        const flip = cx > window.innerWidth * 0.6;
        const btnX = flip ? cx - (this.cw / 2) - 60 : cx + (this.cw / 2) + 60;
        
        const N = this.actions.length;
        const spacing = 55;
        const totalHeight = (N - 1) * spacing;
        const startY = cy - totalHeight / 2;

        // Update glowing tether lines
        const lines = this.querySelectorAll('.neon-line');
        lines.forEach((line, i) => {
            const btnY = startY + i * spacing;
            line.setAttribute('x1', cx);
            line.setAttribute('y1', cy);
            line.setAttribute('x2', btnX);
            line.setAttribute('y2', btnY);
        });

        // Update button container anchor points
        const btnContainers = this.querySelectorAll('.action-btn-container');
        btnContainers.forEach((container, i) => {
            const btnY = startY + i * spacing;
            
            if (flip) {
                container.style.right = `${window.innerWidth - btnX}px`;
                container.style.left = 'auto';
                container.style.flexDirection = 'row-reverse';
                
                const tooltip = container.querySelector('.tooltip-box');
                if (tooltip) {
                    tooltip.classList.remove('left-full', 'ml-3');
                    tooltip.classList.add('right-full', 'mr-3');
                }
            } else {
                container.style.left = `${btnX}px`;
                container.style.right = 'auto';
                container.style.flexDirection = 'row';
                
                const tooltip = container.querySelector('.tooltip-box');
                if (tooltip) {
                    tooltip.classList.remove('right-full', 'mr-3');
                    tooltip.classList.add('left-full', 'ml-3');
                }
            }
            container.style.top = `${btnY}px`;
        });
    }

    selectAction(index) {
        const act = this.actions[index];
        if (act.type === 'PLAY') {
            window.executeNormalPlay(this.entityId);
        } else if (this.isHand) {
            window.activateHandCardAbility(this.entityId, act.abilityId);
        } else {
            window.activateAbility(this.entityId, act.abilityId);
        }
    }

    close() {
        this._isOpen = false;
        this.querySelector('#radial-menu-overlay').classList.add('hidden');
    }
}
customElements.define('radial-action-menu', RadialActionMenu);