// filepath: src/studio/ability/mentions.js

import { StudioState } from './state.js';
import { updateJSONPreview } from './catalog_sync.js';

export function handleDescriptionInput(e) {
  const val = e.target.value;
  const cursor = e.target.selectionStart;
  const textBeforeCursor = val.slice(0, cursor);
  const lastAt = textBeforeCursor.lastIndexOf('@');

  if (lastAt !== -1) {
    const query = textBeforeCursor.slice(lastAt + 1);
    if (!query.includes(' ') && !query.includes('\n')) {
      StudioState.mentionActive = true;
      StudioState.mentionStart = lastAt;
      showMentionDropdown(query);
      return;
    }
  }
  closeMentionDropdown();
}

export function handleDescriptionKeydown(e) {
  if (!StudioState.mentionActive) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); StudioState.selectedMentionIndex = Math.min(StudioState.selectedMentionIndex + 1, StudioState.filteredMentions.length - 1); renderMentionDropdown(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); StudioState.selectedMentionIndex = Math.max(StudioState.selectedMentionIndex - 1, 0); renderMentionDropdown(); }
  else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(StudioState.filteredMentions[StudioState.selectedMentionIndex]); }
  else if (e.key === 'Escape') { closeMentionDropdown(); }
}

export function showMentionDropdown(query) {
  const q = query.toLowerCase();
  StudioState.filteredMentions = StudioState.allAbilities.filter(a => a.name.toLowerCase().includes(q));
  if (StudioState.filteredMentions.length === 0) { closeMentionDropdown(); return; }
  StudioState.selectedMentionIndex = 0;
  document.getElementById('mention-dropdown').classList.remove('hidden');
  renderMentionDropdown();
}

export function renderMentionDropdown() {
  const dropdown = document.getElementById('mention-dropdown');
  dropdown.innerHTML = StudioState.filteredMentions.map((a, i) => `
    <div class="p-2 cursor-pointer border-b border-slate-700 last:border-0 ${i === StudioState.selectedMentionIndex ? 'bg-amber-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-700'}" 
         onmousedown="event.preventDefault(); window.insertMentionById('${a.abilityId}')">
        ${a.name}
    </div>
  `).join('');
}

export function closeMentionDropdown() {
  StudioState.mentionActive = false;
  document.getElementById('mention-dropdown').classList.add('hidden');
}

export function insertMentionById(id) {
  const ab = StudioState.allAbilities.find(a => a.abilityId === id);
  if (ab) insertMention(ab);
}

export function insertMention(ability) {
  if (!ability) return;
  const descInput = document.getElementById('ab-description');
  const val = descInput.value;
  const cursor = descInput.selectionStart;
  const before = val.slice(0, StudioState.mentionStart);
  const after = val.slice(cursor);
  const insertText = "@[" + ability.name + "]"; 
  descInput.value = before + insertText + ' ' + after;
  descInput.focus();
  const newCursor = before.length + insertText.length + 1;
  descInput.setSelectionRange(newCursor, newCursor);
  closeMentionDropdown();
  updateJSONPreview();
}

// Bind to window
window.insertMentionById = insertMentionById;