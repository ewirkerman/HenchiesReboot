import { formatAbilityCostBadge } from '../src/ui.js';
import { ClientState } from '../src/tabletop/client_state.js';
import { getActionButtonTheme } from './action_button_theme.js';

export class UnitActionModal extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <div id="unit-action-modal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm hidden">
            <div class="glass-panel rounded-2xl p-5 shadow-2xl border border-slate-700 max-w-sm w-full mx-4 flex flex-col gap-4 relative">
                <button onclick="window.closeUnitActionModal()" class="absolute top-3 right-3 text-slate-400 hover:text-white font-bold text-lg leading-none">&times;</button>
                <div class="text-center border-b border-slate-800 pb-3">
                    <h2 id="modal-unit-name" class="text-xl font-black text-amber-400 tracking-wider">Unit Name</h2>
                    <p class="text-xs text-slate-400 mt-1">Select an action for this unit (Press 1-9 to select).</p>
                </div>
                <div id="modal-abilities-container" class="flex flex-col gap-2">
                    <!-- Buttons dynamically injected here -->
                </div>
                <button onclick="window.closeUnitActionModal()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold p-3 rounded-xl border border-slate-700 mt-2 transition">Cancel [ESC]</button>
            </div>
        </div>
        `;
    }

    open(entityId, entityName, actions, isHand = false) {
        this.entityId = entityId;
        this.actions = [...actions];
        this.isHand = isHand;

        this.actions.sort((a, b) => {
            if (a.type === 'ATTACK' && b.type !== 'ATTACK') return -1;
            if (b.type === 'ATTACK' && a.type !== 'ATTACK') return 1;
            if (a.type === 'PLAY' && b.type !== 'PLAY') return -1;
            if (b.type === 'PLAY' && a.type !== 'PLAY') return 1;
            return 0;
        });

        this.querySelector('#modal-unit-name').innerText = entityName;
        const container = this.querySelector('#modal-abilities-container');
        let btnsHtml = '';

        this.actions.forEach((act, i) => {
            let desc = '';
            if (act.type === 'PLAY') desc = 'Play this card normally.';
            else if (act.type === 'ATTACK') desc = 'Attack a valid target on the board.';
            else {
                const ab = ClientState.allAbilitiesRegistry.find(a => a.abilityId === act.abilityId);
                desc = ab ? (ab.displayDescription || ab.description) : 'Activate this ability.';
            }

            const theme = getActionButtonTheme(act.type);
            const baseClass = theme.baseClass;

            let undoWarn = !act.undoable ? `<span class="text-red-400 drop-shadow-md ml-1" title="Cannot be undone">⚠️</span>` : "";
            let costHtml = formatAbilityCostBadge(act.cost, 'Generic');

            // Determine tooltip placement (if near bottom, pop up instead of down, etc. Here we just use left/right)
            btnsHtml += `
                <div class="relative group">
                    <button id="action-btn-${i}" onclick="document.querySelector('unit-action-modal').selectAction(${i})" 
                            class="w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border-2 transition-all hover:scale-[1.02] ${baseClass}">
                        <span class="font-black drop-shadow-md">${act.name}</span>
                        ${costHtml}
                        ${undoWarn}
                    </button>
                    
                    <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 w-56 bg-slate-950/95 backdrop-blur-sm border border-slate-700 p-3 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-0 group-hover:delay-500 pointer-events-none z-50">
                        <h4 class="text-amber-400 font-bold text-[11px] uppercase tracking-wider mb-1.5">${act.name}</h4>
                        <p class="text-slate-300 text-[11px] leading-relaxed whitespace-normal break-words">${desc.replace(/"/g, '&quot;')}</p>
                    </div>
                </div>
            `;
        });

        container.innerHTML = btnsHtml;
        this.querySelector('#unit-action-modal').classList.remove('hidden');
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
        this.querySelector('#unit-action-modal').classList.add('hidden');
    }
}
customElements.define('unit-action-modal', UnitActionModal);