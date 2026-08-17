export class MatchLobby extends HTMLElement {
    connectedCallback() {
        this.style.display = 'contents';
        this.innerHTML = `
        <div id="match-setup-screen" class="flex-1 max-w-xl w-full mx-auto p-4 flex flex-col justify-center my-auto">
            <div class="glass-panel rounded-3xl p-6 shadow-2xl border border-slate-800 flex flex-col gap-5">
            
            <div class="text-center border-b border-slate-800 pb-3">
                <h1 class="text-2xl font-black text-amber-400 tracking-wider">⚔️ HENCHIES 2 MATCH LOBBY</h1>
                <p class="text-xs text-slate-400 mt-1">Configure your player identity, room code, and select your 40-card deck to launch the match.</p>
            </div>

            <div class="flex flex-col gap-3">
                <div>
                <label class="text-xs font-bold text-slate-300 block mb-1">Your Player Username</label>
                <input type="text" id="setup-username" value="Warlord Player" class="bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-amber-300 font-extrabold text-sm w-full focus:outline-none focus:border-amber-500" />
                </div>

                <div>
                <label class="text-xs font-bold text-slate-300 block mb-1">Match Room Code (Share with opponent to join)</label>
                <input type="text" id="setup-room-code" value="ROOM_HENCHIES_1" class="bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-xs text-amber-300 font-extrabold w-full" />
                </div>

                <div>
                <label class="text-xs font-bold text-amber-400 block mb-1">Select Battle Deck (41 Cards)</label>
                <select id="setup-deck-select" class="bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-xs text-white font-bold w-full focus:outline-none focus:border-amber-500">
                    <option value="">-- Enter Username to Load Decks --</option>
                </select>
                </div>

                <div class="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="setup-allow-undo" checked class="w-4 h-4 accent-amber-500" />
                    <label for="setup-allow-undo" class="text-xs font-bold text-slate-300">Enable Undo Feature</label>
                </div>
            </div>

            <button id="launch-match-btn" class="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-sm p-4 rounded-2xl shadow-2xl transition transform hover:scale-[1.02] flex items-center justify-center gap-2">
                🚀 Launch Battleboard Tabletop
            </button>

            </div>
        </div>
        `;
    }
}
customElements.define('match-lobby', MatchLobby);