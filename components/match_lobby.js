export class MatchLobby extends HTMLElement {
    connectedCallback() {
        const isTestMode = window.location.hash.startsWith('#test_');
        this.style.display = isTestMode ? 'none' : 'contents';
        this.innerHTML = `
        <div id="match-setup-screen" class="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col justify-center my-auto ${isTestMode ? 'hidden' : ''}">
            <div class="glass-panel rounded-3xl p-6 shadow-2xl border border-slate-800 flex flex-col gap-5">
            
            <div class="text-center border-b border-slate-800 pb-3">
                <h1 class="text-2xl font-black text-amber-400 tracking-wider">⚔️ HENCHIES 2 MATCH LOBBY</h1>
                <p class="text-xs text-slate-400 mt-1">Select your deck and start a match or rejoin an active battle.</p>
            </div>

            <!-- Identity & Deck Section -->
            <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row gap-4">
                <div class="flex-1">
                    <label class="text-xs font-bold text-slate-300 block mb-1">Your Player Username</label>
                    <input type="text" id="setup-username" value="Warlord Player" class="bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-amber-300 font-extrabold text-sm w-full focus:outline-none focus:border-amber-500" />
                </div>
                <div class="flex-1">
                    <label class="text-xs font-bold text-amber-400 block mb-1">Select Battle Deck (41 Cards)</label>
                    <select id="setup-deck-select" class="bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-xs text-white font-bold w-full focus:outline-none focus:border-amber-500">
                        <option value="">-- Enter Username to Load Decks --</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Queue & Challenge -->
                <div class="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50 flex flex-col gap-3">
                     <h3 class="text-amber-400 font-black uppercase tracking-wider border-b border-slate-700/50 pb-1 text-sm">Start a Match</h3>
                     <div class="flex gap-2">
                         <button id="queue-match-btn" class="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-yellow-500 text-black font-black text-[11px] p-3 rounded-lg shadow-md transition transform hover:scale-[1.02] whitespace-nowrap">🎲 Queue Random</button>
                         <button id="ai-match-btn" class="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-black text-[11px] p-3 rounded-lg shadow-md transition transform hover:scale-[1.02] whitespace-nowrap">🤖 Play vs AI</button>
                     </div>
                     <div class="mt-2">
                         <label class="text-xs font-bold text-slate-300 block mb-1">Challenge a Friend</label>
                         <div class="flex gap-2">
                             <input type="text" id="challenge-username" placeholder="Friend's Username" class="bg-slate-950 border border-slate-700 p-2 rounded-lg text-amber-300 font-extrabold text-xs w-full focus:outline-none focus:border-amber-500" />
                             <button id="send-challenge-btn" class="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 rounded-lg shadow-md transition whitespace-nowrap">Send ⚔️</button>
                         </div>
                     </div>
                </div>
                
                <!-- Active Matches & Invites -->
                <div class="flex flex-col gap-4">
                    <div class="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50 flex flex-col gap-2 h-full">
                         <h3 class="text-sky-400 font-black uppercase tracking-wider border-b border-slate-700/50 pb-1 text-sm flex justify-between items-center">
                            <span>Incoming Invites</span>
                            <span id="invites-count" class="bg-sky-900 text-sky-200 px-2 py-0.5 rounded text-[9px]">0</span>
                         </h3>
                         <div id="invites-list" class="flex flex-col gap-2 min-h-[50px] max-h-[120px] overflow-y-auto minimal-scrollbar">
                             <span class="text-xs text-slate-500 italic">No pending invites.</span>
                         </div>
                    </div>
                    <div class="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50 flex flex-col gap-2 h-full">
                         <h3 class="text-emerald-400 font-black uppercase tracking-wider border-b border-slate-700/50 pb-1 text-sm flex justify-between items-center">
                            <span>Active Matches</span>
                            <span id="matches-count" class="bg-emerald-900 text-emerald-200 px-2 py-0.5 rounded text-[9px]">0</span>
                         </h3>
                         <div id="active-matches-list" class="flex flex-col gap-2 min-h-[50px] max-h-[120px] overflow-y-auto minimal-scrollbar">
                             <span class="text-xs text-slate-500 italic">No active matches.</span>
                         </div>
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-2 justify-center border-t border-slate-800 pt-3 mt-1">
                <input type="checkbox" id="setup-allow-undo" checked class="w-4 h-4 accent-amber-500" />
                <label for="setup-allow-undo" class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enable Undo Feature in new matches</label>
            </div>

            </div>
        </div>
        `;
    }
}
customElements.define('match-lobby', MatchLobby);