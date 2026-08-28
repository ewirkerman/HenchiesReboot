class CardHoverManager {
    constructor() {
        this.showTimer = null;
        this.hideTimer = null;
        this.isVisible = false;
        this.currentCardId = null;
        this.tooltipEl = null;
        
        // Phase 2: Track when the tooltip was last hidden for "warm start" logic
        this.lastHiddenTime = 0; 
        
        // Timing Configuration (Hover Intent)
        this.SHOW_DELAY = 400;       // Initial hover requirement
        this.FAST_FOLLOW_DELAY = 50; // Delay when moving between cards quickly
        this.HIDE_DELAY = 100;       // Grace period for mouse slipping
    }

    init() {
        if (this.tooltipEl || typeof document === 'undefined') return;
        
        this.tooltipEl = document.createElement('div');
        this.tooltipEl.id = 'global-card-tooltip';
        
        // Phase 3: Changed 'transition-all' to 'transition' (which animates opacity/transform but snaps left/top instantly)
        this.tooltipEl.className = 'fixed z-[10000] pointer-events-none opacity-0 transition duration-150 ease-out transform scale-95 flex';
        document.body.appendChild(this.tooltipEl);

        // Instantly kill tooltips on ANY click down to prevent them covering the UI during dragging/interactions
        window.addEventListener('mousedown', () => this.forceHide(), { capture: true });
    }

    shouldSuppress() {
        // Based on interactions.js, suppress if dragging or targeting
        if (window._isDragging === true) return true;
        if (window.ClientState && window.ClientState.pendingAbility != null) return true;
        return false;
    }

    onMouseEnter(targetEl, cacheId) {
        console.log(`%c[HOVER MGR] onMouseEnter: ${cacheId}`, 'color: #3b82f6', { current: this.currentCardId, visible: this.isVisible, lastHide: this.lastHiddenTime });
        if (this.shouldSuppress()) {
            console.log(`%c[HOVER MGR] Suppressed during enter!`, 'color: #ef4444');
            return;
        }

        clearTimeout(this.hideTimer);

        // If hovering the exact same card, do nothing
        if (this.currentCardId === cacheId && this.isVisible) {
            console.log(`%c[HOVER MGR] Already visible and hovering same card. Ignored.`, 'color: #6b7280');
            return;
        }

        this.currentCardId = cacheId;
        
        // Phase 2: Check if we are currently visible, OR if we were visible very recently (within 300ms)
        const isWarm = this.isVisible || (Date.now() - this.lastHiddenTime < 300);
        const delay = isWarm ? this.FAST_FOLLOW_DELAY : this.SHOW_DELAY;
        console.log(`%c[HOVER MGR] isWarm: ${isWarm}, Using delay: ${delay}ms`, 'color: #8b5cf6');

        clearTimeout(this.showTimer);
        this.showTimer = setTimeout(() => {
            console.log(`%c[HOVER MGR] showTimer completed for ${cacheId}`, 'color: #10b981');
            this._showTooltip(targetEl, cacheId);
        }, delay);
    }

    // Phase 1: Accept the cacheId of the departing card
    onMouseLeave(cacheId) {
        console.log(`%c[HOVER MGR] onMouseLeave: ${cacheId}`, 'color: #f59e0b', { current: this.currentCardId });
        
        // Phase 1: If Card A says it's leaving, but we are already focused on Card B, ignore Card A!
        if (cacheId && this.currentCardId !== cacheId) {
            console.log(`%c[HOVER MGR] Ignoring leave for ${cacheId} because focus is already on ${this.currentCardId}`, 'color: #6b7280');
            return;
        }

        clearTimeout(this.showTimer);
        this.hideTimer = setTimeout(() => {
            console.log(`%c[HOVER MGR] hideTimer completed. Forcing hide.`, 'color: #f59e0b');
            this.forceHide();
        }, this.HIDE_DELAY);
    }

    forceHide() {
        console.log(`%c[HOVER MGR] forceHide executed.`, 'color: #ef4444');
        clearTimeout(this.showTimer);
        clearTimeout(this.hideTimer);
        
        // Phase 2: Stamp the time right as the tooltip vanishes
        if (this.isVisible) {
            this.lastHiddenTime = Date.now();
        }
        
        this.isVisible = false;
        this.currentCardId = null;
        
        if (this.tooltipEl) {
            this.tooltipEl.classList.remove('opacity-100', 'scale-100', 'translate-x-0');
            this.tooltipEl.classList.add('opacity-0', 'scale-95');
            
            // Give it 150ms to fade out before destroying the HTML
            setTimeout(() => {
                if (!this.isVisible) this.tooltipEl.innerHTML = '';
            }, 150);
        }
    }

    _showTooltip(targetEl, cacheId) {
        console.log(`%c[HOVER MGR] _showTooltip Initialized for ${cacheId}`, 'color: #10b981');
        if (this.shouldSuppress()) {
            console.log(`%c[HOVER MGR] Suppressed inside _showTooltip!`, 'color: #ef4444');
            this.forceHide();
            return;
        }

        if (!this.tooltipEl) this.init();

        // Dynamically inject the Jumbo card via the Singleton cache ID
        this.tooltipEl.innerHTML = `<game-card cache-id="${cacheId}" size="jumbo"></game-card>`;
        this.isVisible = true;

        // Double rAF ensures the browser mounts the inner HTML, calculates its layout geometry, 
        // allows us to measure it while invisible, and THEN applies the fade-in.
        requestAnimationFrame(() => {
            console.log(`%c[HOVER MGR] _showTooltip rAF 1 executed`, 'color: #10b981');
            if (!this.isVisible || this.currentCardId !== cacheId) {
                console.log(`%c[HOVER MGR] Aborted in rAF 1 (No longer visible or ID mismatch)`, 'color: #ef4444');
                return;
            }
            
            // Because <game-card> is display:contents, we must measure its first real wrapper child
            const jumboWrapper = this.tooltipEl.firstElementChild?.firstElementChild;
            if (!jumboWrapper) {
                console.log(`%c[HOVER MGR] ERROR: jumboWrapper not found in DOM!`, 'color: #ef4444', this.tooltipEl.innerHTML);
                return;
            }

            const tooltipRect = jumboWrapper.getBoundingClientRect();
            const rect = targetEl.getBoundingClientRect();
            
            // Default: Align top, push right
            let left = rect.right + 16;
            let top = rect.top;

            // X-Axis Collision (Hits right screen edge)
            if (left + tooltipRect.width > window.innerWidth) {
                left = rect.left - tooltipRect.width - 16; // Flip to left side
            }
            if (left < 0) left = 16; // Clamp left

            // Y-Axis Collision (Hits bottom screen edge)
            if (top + tooltipRect.height > window.innerHeight) {
                top = window.innerHeight - tooltipRect.height - 16; // Push up
            }
            if (top < 0) top = 16; // Clamp top

            this.tooltipEl.style.left = `${left}px`;
            this.tooltipEl.style.top = `${top}px`;

            // Prepare slide animation direction based on side
            const isRightSide = left > rect.left;
            const slideClass = isRightSide ? '-translate-x-3' : 'translate-x-3';
            
            this.tooltipEl.classList.remove('-translate-x-3', 'translate-x-3', 'origin-top-left', 'origin-top-right');
            this.tooltipEl.classList.add(isRightSide ? 'origin-top-left' : 'origin-top-right', slideClass);

            // Final frame: Trigger CSS transitions
            requestAnimationFrame(() => {
                console.log(`%c[HOVER MGR] _showTooltip rAF 2 executed (FADING IN)`, 'color: #10b981');
                if (!this.isVisible || this.currentCardId !== cacheId) return;
                this.tooltipEl.classList.remove('opacity-0', 'scale-95', '-translate-x-3', 'translate-x-3');
                this.tooltipEl.classList.add('opacity-100', 'scale-100', 'translate-x-0');
            });
        });
    }
}

export const HoverManager = new CardHoverManager();

if (typeof window !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        HoverManager.init();
    } else {
        window.addEventListener('DOMContentLoaded', () => HoverManager.init());
    }
}