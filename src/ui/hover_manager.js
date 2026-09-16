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

        this.scrubActive = false;
        this.scrubStartX = 0;
        this.scrubStartY = 0;
        this.scrubHasMoved = false;
        this.handHoverId = null;
        this.handHoverFrame = null;
        
        // Mobile touch tracking to suppress Jumbo cards
        this.lastTouchTime = 0;
        if (typeof window !== 'undefined') {
            window.addEventListener('touchstart', () => { this.lastTouchTime = Date.now(); }, { passive: true, capture: true });
        }
    }

    startScrub(x, y) {
        this.scrubActive = true;
        this.scrubStartX = x;
        this.scrubStartY = y;
        this.scrubHasMoved = false;
    }

    stopScrub() {
        this.scrubActive = false;
    }

    isScrubActive() {
        return this.scrubActive;
    }

    markScrubMoved() {
        this.scrubHasMoved = true;
    }

    getScrubHasMoved() {
        return this.scrubHasMoved;
    }

    evaluateScrubThreshold(x, y, threshold) {
        const dx = Math.abs(x - this.scrubStartX);
        const dy = Math.abs(y - this.scrubStartY);
        return dx > threshold || dy > threshold;
    }

    evaluateRevert(currentY, originalTop) {
        // We use the exact starting top coordinate of the card's bounds.
        // If the mouse/finger returns below this line, they are back in the hand area.
        if (originalTop === undefined || originalTop === null) return false;
        return currentY >= originalTop;
    }

    evaluateDragStart(clientY) {
        const threshold = this.calculateDragStartThreshold();
        return clientY < threshold;
    }

    calculateDragStartThreshold() {
        const handWrapper = document.getElementById('player-hand-container');
        if (!handWrapper) return 0;
        const containerRect = handWrapper.getBoundingClientRect();
        return containerRect.top - 60;
    }

    findHoveredHandCardId(clientX) {
        const handWrapper = document.getElementById('player-hand-container');
        if (!handWrapper) return null;
        const containerRect = handWrapper.getBoundingClientRect();
        const cards = handWrapper.querySelectorAll('game-card[is-hand="true"]');
        
        for (let i = cards.length - 1; i >= 0; i--) {
            const gc = cards[i];
            if (gc.parentElement) {
                const left = containerRect.left + gc.parentElement.offsetLeft;
                const right = left + gc.parentElement.offsetWidth;
                if (clientX >= left && clientX <= right) {
                    return gc.getAttribute('data-instance-id');
                }
            }
        }
        return null;
    }

    focusHandCard(cardId) {
        this.handHoverId = cardId;
        this.scheduleHandHoverUpdate();
    }

    unfocusHandCard() {
        this.handHoverId = null;
        this.scheduleHandHoverUpdate();
    }

    scheduleHandHoverUpdate() {
        if (this.handHoverFrame) return;
        this.handHoverFrame = requestAnimationFrame(() => {
            this.handHoverFrame = null;
            this.refreshAllHandCards();
        });
    }

    refreshAllHandCards() {
        const handWrapper = document.getElementById('player-hand-container');
        if (!handWrapper) return;
        
        const cards = handWrapper.querySelectorAll('game-card[is-hand="true"]');
        cards.forEach((gc, idx) => {
            this.styleSingleCard(gc, idx);
        });
    }

    styleSingleCard(gc, idx) {
        const cardId = gc.getAttribute('data-instance-id');
        const wrapper = gc.parentElement;
        if (!wrapper) return;
        
        const isFocused = (cardId === this.handHoverId);
        const isRaised = window._isDragging && window._dragCardId === cardId;
        
        this.setBaseStyles(wrapper);
        this.setTransformStyles(wrapper, isFocused, isRaised, gc);
        this.setZIndex(wrapper, isFocused, idx);
    }

    setBaseStyles(wrapper) {
        wrapper.style.opacity = '1';
        wrapper.style.pointerEvents = 'auto';
    }

    setTransformStyles(wrapper, isFocused, isRaised, gc) {
        if (isFocused || isRaised) {
            const lift = this.measureLift(gc, isRaised);
            wrapper.style.transform = `translateY(-${lift}px) scale(1.15)`;
        } else {
            wrapper.style.transform = `translateY(85px) scale(0.95)`;
        }
    }

    setZIndex(wrapper, isFocused, idx) {
        wrapper.style.zIndex = isFocused ? 110 : (10 + idx);
    }

    measureLift(gc, isRaised) {
        if (isRaised) return 30;
        if (!gc.firstElementChild) return 30;
        const bottom = gc.firstElementChild.getBoundingClientRect().bottom;
        return Math.min(30, Math.max(0, window.innerHeight - bottom));
    }

    init() {
        if (this.tooltipEl || typeof document === 'undefined') return;
        
        this.tooltipEl = document.createElement('div');
        this.tooltipEl.id = 'global-card-tooltip';
        
        // Ensure the tooltip is actually in the DOM so custom web components 
        // are forced to fire their connectedCallback and render immediately.
        this.tooltipEl.style.position = 'fixed';
        this.tooltipEl.style.pointerEvents = 'none';
        this.tooltipEl.style.zIndex = '9999';
        document.body.appendChild(this.tooltipEl);
        
        this.tooltipEl.classList.remove('opacity-0', 'scale-95');
        
        // Give it 150ms to fade out before destroying the HTML
        setTimeout(() => {
            if (!this.isVisible) this.tooltipEl.innerHTML = '';
        }, 150);
    }

    shouldSuppress() {
        // Mobile Suppression: If the user is actively scrubbing a hand card, kill the tooltip
        if (this.scrubActive || window._forceHoverCardId) return true;
        
        // Based on interactions.js, suppress if dragging or targeting
        if (window._isDragging === true) return true;
        if (window.ClientState && window.ClientState.pendingAbility != null) return true;
        
        // Final sanity check: If the device doesn't support hover, suppress it globally
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none)').matches) {
            return true;
        }
        
        // Suppress if a touch event happened recently (mobile guard)
        if (Date.now() - this.lastTouchTime < 1000) {
            return true;
        }
        
        return false;
    }

    onMouseEnter(targetEl, cacheId) {
//            console.log(`%c[HOVER MGR] onMouseEnter: ${cacheId}`, 'color: #3b82f6', { current: this.currentCardId, visible: this.isVisible, lastHide: this.lastHiddenTime });
        if (this.shouldSuppress()) {
//            console.log(`%c[HOVER MGR] Suppressed during enter!`, 'color: #ef4444');
            return;
        }

        clearTimeout(this.hideTimer);

        // If hovering the exact same card, do nothing
        if (this.currentCardId === cacheId && this.isVisible) {
//            console.log(`%c[HOVER MGR] Already visible and hovering same card. Ignored.`, 'color: #6b7280');
            return;
        }

        this.currentCardId = cacheId;
        
        // Phase 2: Check if we are currently visible, OR if we were visible very recently (within 300ms)
        const isWarm = this.isVisible || (Date.now() - this.lastHiddenTime < 300);
        const delay = isWarm ? this.FAST_FOLLOW_DELAY : this.SHOW_DELAY;
//        console.log(`%c[HOVER MGR] isWarm: ${isWarm}, Using delay: ${delay}ms`, 'color: #8b5cf6');

        clearTimeout(this.showTimer);
        this.showTimer = setTimeout(() => {
//            console.log(`%c[HOVER MGR] showTimer completed for ${cacheId}`, 'color: #10b981');
            this._showTooltip(targetEl, cacheId);
        }, delay);
    }

    // Phase 1: Accept the cacheId of the departing card
    onMouseLeave(cacheId) {
//        console.log(`%c[HOVER MGR] onMouseLeave: ${cacheId}`, 'color: #f59e0b', { current: this.currentCardId });
        
        // Phase 1: If Card A says it's leaving, but we are already focused on Card B, ignore Card A!
        if (cacheId && this.currentCardId !== cacheId) {
//            console.log(`%c[HOVER MGR] Ignoring leave for ${cacheId} because focus is already on ${this.currentCardId}`, 'color: #6b7280');
            return;
        }

        clearTimeout(this.showTimer);
        this.hideTimer = setTimeout(() => {
//            console.log(`%c[HOVER MGR] hideTimer completed. Forcing hide.`, 'color: #f59e0b');
            this.forceHide();
        }, this.HIDE_DELAY);
    }

    forceHide() {
//        console.log(`%c[HOVER MGR] forceHide executed.`, 'color: #ef4444');
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
//        console.log(`%c[HOVER MGR] _showTooltip Initialized for ${cacheId}`, 'color: #10b981');
        if (this.shouldSuppress()) {
//            console.log(`%c[HOVER MGR] Suppressed inside _showTooltip!`, 'color: #ef4444');
            this.forceHide();
            return;
        }

        if (!this.tooltipEl) this.init();

        // Dynamically inject the Jumbo card via the Singleton cache ID
        this.tooltipEl.innerHTML = `<game-card cache-id="${cacheId}" size="jumbo"></game-card>`;
        this.isVisible = true;

        let attempts = 0;
        const maxAttempts = 60; // Increased to 1 full second of polling to guarantee it catches slow renders

        const attemptPositioning = () => {
            if (!this.isVisible || this.currentCardId !== cacheId) {
//                console.log(`%c[HOVER MGR] Aborted positioning (No longer visible or ID mismatch)`, 'color: #ef4444');
                return;
            }
            
            // Because <game-card> is display:contents, we must measure its first real wrapper child
            const jumboWrapper = this.tooltipEl.firstElementChild?.firstElementChild;
            
            // If the Web Component hasn't stamped its template yet, wait until the next frame.
            if (!jumboWrapper) {
                attempts++;
                if (attempts < maxAttempts) {
                    requestAnimationFrame(attemptPositioning);
                } else {
//                    console.log(`%c[HOVER MGR] ERROR: jumboWrapper not found in DOM after ${maxAttempts} attempts!`, 'color: #ef4444', this.tooltipEl.innerHTML);
                }
                return;
            }

//            console.log(`%c[HOVER MGR] jumboWrapper successfully mounted on frame ${attempts + 1}`, 'color: #10b981');

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
//                console.log(`%c[HOVER MGR] _showTooltip fading in`, 'color: #10b981');
                if (!this.isVisible || this.currentCardId !== cacheId) return;
                this.tooltipEl.classList.remove('opacity-0', 'scale-95', '-translate-x-3', 'translate-x-3');
                this.tooltipEl.classList.add('opacity-100', 'scale-100', 'translate-x-0');
            });
        };

        // Start the polling loop
        requestAnimationFrame(attemptPositioning);
    }
}

export const HoverManager = new CardHoverManager();

if (typeof window !== 'undefined') {
    window.HoverManager = HoverManager;

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        HoverManager.init();
    } else {
        window.addEventListener('DOMContentLoaded', () => HoverManager.init());
    }
}