// filepath: src/studio/ability/triggers.js

import { StudioState } from './state.js';
import { ACTION_MANIFEST, ACTION_CATEGORIES } from '../../engine/actions/index.js';
import { updateJSONPreview } from './catalog_sync.js';
import { getValidScopes, getValidActivationMethods } from '../../ability_validation.js';
import { generateQuickMatrixHTML } from './ability_renderer.js';

export function populateBaseTriggers() {
    const baseTriggerSelect = document.getElementById('ab-base-trigger');
    if (!baseTriggerSelect) return;

    const basics = [
        { val: 'MANUAL', label: 'Manual Activation' },
        { val: 'ON_BE_PLAYED', label: 'When Played (Mandatory)' },
        { val: 'PLAY_OPTIONAL', label: 'When Played (Optional)' },
        { val: 'UNTRIGGERABLE', label: 'Passive / Untriggerable' },
        { val: 'TURN_STARTING', label: 'Turn Starting' },
        { val: 'TURN_STARTED', label: 'Turn Started' },
        { val: 'TURN_ENDING', label: 'Turn Ending' },
        { val: 'TURN_ENDED', label: 'Turn Ended' }
    ];
    
    let baseOptionsHtml = `<optgroup label="Basic Triggers">` + basics.map(t => `<option value="${t.val}">${t.label}</option>`).join('') + `</optgroup>`;
    
    Object.entries(ACTION_CATEGORIES).forEach(([categoryName, actions]) => {
        baseOptionsHtml += `<optgroup label="${categoryName} Events">` + actions.map(t => `<option value="${t}">${t.replace(/_/g, ' ')}</option>`).join('') + `</optgroup>`;
    });

    baseTriggerSelect.innerHTML = baseOptionsHtml;
}

export function parseTriggerToComposite(triggerString) {
    const basics = ['MANUAL', 'ON_BE_PLAYED', 'PLAY_OPTIONAL', 'UNTRIGGERABLE', 'TURN_STARTING', 'TURN_STARTED', 'TURN_ENDING', 'TURN_ENDED'];
    if (basics.includes(triggerString)) return { base: triggerString, phase: 'ON', role: 'ACTIVE' };

    for (const effect in ACTION_MANIFEST) {
        const passive = ACTION_MANIFEST[effect].passiveType;
        for (const phase of ['ON', 'WOULD', 'MODIFY']) {
            if (triggerString === `${phase}_${effect}`) return { base: effect, phase, role: 'ACTIVE' };
            if (passive && triggerString === `${phase}_${passive}`) return { base: effect, phase, role: 'PASSIVE' };
        }
        if (triggerString === effect) return { base: effect, phase: 'ON', role: 'ACTIVE' };
        if (passive && triggerString === passive) return { base: effect, phase: 'ON', role: 'PASSIVE' };
    }
    return { base: 'MANUAL', phase: 'ON', role: 'ACTIVE' };
}

export function renderAdditionalTriggers() {
    const container = document.getElementById('additional-triggers-container');
    if (StudioState.additionalTriggers.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const basics = [
        { val: 'MANUAL', label: 'Manual Activation' },
        { val: 'ON_BE_PLAYED', label: 'When Played (Mandatory)' },
        { val: 'PLAY_OPTIONAL', label: 'When Played (Optional)' },
        { val: 'UNTRIGGERABLE', label: 'Passive / Untriggerable' },
        { val: 'TURN_STARTING', label: 'Turn Starting' },
        { val: 'TURN_STARTED', label: 'Turn Started' },
        { val: 'TURN_ENDING', label: 'Turn Ending' },
        { val: 'TURN_ENDED', label: 'Turn Ended' }
    ];
    
    let baseOptionsHtml = `<optgroup label="Basic Triggers">` + basics.map(t => `<option value="${t.val}">${t.label}</option>`).join('') + `</optgroup>`;
    
    Object.entries(ACTION_CATEGORIES).forEach(([categoryName, actions]) => {
        baseOptionsHtml += `<optgroup label="${categoryName} Events">` + actions.map(t => `<option value="${t}">${t.replace(/_/g, ' ')}</option>`).join('') + `</optgroup>`;
    });

    container.innerHTML = StudioState.additionalTriggers.map((trigStr, idx) => {
        const comp = parseTriggerToComposite(trigStr);
        const manifest = ACTION_MANIFEST[comp.base] || {};
        const isAction = !!manifest.validDurations;
        const hasDual = isAction && manifest.passiveType;
        
        return `
        <div class="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded border border-slate-700/80">
            <span class="text-[9px] text-slate-500 font-black uppercase tracking-widest px-1">OR</span>
            <select onchange="window.updateAdditionalTrigger(${idx}, 'base', this.value)" class="bg-slate-950 border border-slate-700 p-1 rounded text-amber-300 text-[10px] font-bold flex-1 w-full min-w-[80px]">
                ${baseOptionsHtml.replace(`value="${comp.base}"`, `value="${comp.base}" selected`)}
            </select>
            ${isAction ? `
            <select onchange="window.updateAdditionalTrigger(${idx}, 'phase', this.value)" class="bg-slate-950 border border-slate-700 p-1 rounded text-amber-300 text-[10px] font-bold w-20 shrink-0">
                <option value="ON" ${comp.phase==='ON'?'selected':''}>React</option>
                <option value="WOULD" ${comp.phase==='WOULD'?'selected':''}>Int</option>
                <option value="MODIFY" ${comp.phase==='MODIFY'?'selected':''}>Mod</option>
            </select>
            ` : ''}
            ${hasDual ? `
            <select onchange="window.updateAdditionalTrigger(${idx}, 'role', this.value)" class="bg-slate-950 border border-slate-700 p-1 rounded text-amber-300 text-[10px] font-bold w-20 shrink-0">
                <option value="ACTIVE" ${comp.role==='ACTIVE'?'selected':''}>Subj</option>
                <option value="PASSIVE" ${comp.role==='PASSIVE'?'selected':''}>Obj</option>
            </select>
            ` : ''}
            <button type="button" onclick="window.removeAdditionalTrigger(${idx})" class="text-red-400 hover:text-red-300 font-black px-1.5">&times;</button>
        </div>
        `;
    }).join('');
}

export function addAdditionalTrigger() {
    StudioState.additionalTriggers.push('TURN_STARTING');
    renderAdditionalTriggers();
    updateJSONPreview();
}

export function removeAdditionalTrigger(idx) {
    StudioState.additionalTriggers.splice(idx, 1);
    renderAdditionalTriggers();
    updateJSONPreview();
}

export function updateAdditionalTrigger(idx, field, value) {
    const comp = parseTriggerToComposite(StudioState.additionalTriggers[idx]);
    comp[field] = value;
    
    const manifest = ACTION_MANIFEST[comp.base] || {};
    const isAction = !!manifest.validDurations;
    const hasDual = isAction && manifest.passiveType;
    
    if (field === 'base') {
        comp.phase = 'ON';
        comp.role = 'ACTIVE';
    }

    let finalStr = comp.base;
    if (isAction) {
        let verb = comp.base;
        if (comp.role === 'PASSIVE' && hasDual) verb = manifest.passiveType;
        finalStr = `${comp.phase}_${verb}`;
    }
    
    StudioState.additionalTriggers[idx] = finalStr;
    renderAdditionalTriggers();
    updateJSONPreview();
}

export function updateTriggerComposite() {
    const base = document.getElementById('ab-base-trigger').value;
    const phaseSelect = document.getElementById('ab-trigger-phase');
    const roleSelect = document.getElementById('ab-trigger-role');
    const hiddenTrigger = document.getElementById('ab-trigger');
    const preview = document.getElementById('ab-trigger-preview');

    const manifest = ACTION_MANIFEST[base];
    const isAction = !!manifest;
    const hasDual = isAction && manifest.passiveType;

    if (isAction) {
        phaseSelect.classList.remove('hidden');
        if (hasDual) {
            roleSelect.classList.remove('hidden');
        } else {
            roleSelect.classList.add('hidden');
            roleSelect.value = 'ACTIVE';
        }

        let verb = base;
        if (roleSelect.value === 'PASSIVE' && hasDual) {
            verb = manifest.passiveType;
        }

        hiddenTrigger.value = `${phaseSelect.value}_${verb}`;
    } else {
        phaseSelect.classList.add('hidden');
        roleSelect.classList.add('hidden');
        hiddenTrigger.value = base;
    }

    preview.innerText = `Final Event: ${hiddenTrigger.value}`;
    updateTargetingUI();
}

export function updateTargetingUI() {
    const triggerValue = document.getElementById('ab-trigger').value.toUpperCase();
    const baseTrigger = document.getElementById('ab-base-trigger').value.toUpperCase();
    const actMethodSelect = document.getElementById('ab-act-method');
    const triggerLimitSelect = document.getElementById('ab-trigger-limit');
    const scopeSelect = document.getElementById('ab-trigger-scope');

    const validScopes = getValidScopes(baseTrigger);
    const scopeContainer = document.getElementById('trigger-scope-container');
    
    if (validScopes.length > 1) {
         scopeContainer.classList.remove('hidden');
         scopeSelect.innerHTML = validScopes.map(s => `<option value="${s}" ${scopeSelect.value === s ? 'selected' : ''}>${s === 'PERSONAL' ? 'Personal (Self only)' : 'Global (Board-wide)'}</option>`).join('');
    } else {
         scopeContainer.classList.add('hidden');
         scopeSelect.innerHTML = `<option value="${validScopes[0]}" selected>${validScopes[0] === 'PERSONAL' ? 'Personal (Self only)' : 'Global (Board-wide)'}</option>`;
    }
    
    const scope = scopeSelect.value;

    if (triggerValue !== StudioState.lastTriggerValue) {
         if (baseTrigger === 'ON_BE_PLAYED' || baseTrigger === 'PLAY' || baseTrigger === 'PLAY_OPTIONAL') {
             StudioState.activationQuickTargeting.ignoreBattlelines = true;
         } else if (baseTrigger === 'MANUAL') {
             StudioState.activationQuickTargeting.ignoreBattlelines = false;
         }
         StudioState.lastTriggerValue = triggerValue;
    }

    if (baseTrigger === 'UNTRIGGERABLE') {
      triggerLimitSelect.disabled = true;
      triggerLimitSelect.title = "Not applicable for UNTRIGGERABLE abilities";
    } else {
      triggerLimitSelect.disabled = false;
      triggerLimitSelect.title = "";
    }
    
    const validActMethods = getValidActivationMethods(baseTrigger, scope);
    if (!validActMethods.includes(actMethodSelect.value)) actMethodSelect.value = validActMethods[0];
    
    actMethodSelect.innerHTML = validActMethods.map(m => {
        const label = m === 'NONE' ? 'None (Self, Global, or Auto-Trigger)' : 'Player Choice (Click 1 Target)';
        return `<option value="${m}" ${actMethodSelect.value === m ? 'selected' : ''}>${label}</option>`;
    }).join('');
    
    const matrixContainer = document.getElementById('act-quick-matrix-container');
    const advancedToggleContainer = document.getElementById('act-advanced-toggle-container');
    const advancedTreeWrapper = document.getElementById('act-logic-tree-wrapper');
    const advancedIcon = document.getElementById('act-advanced-icon');
    
    const section3Header = document.getElementById('section3-header');
    const actMethodContainer = document.getElementById('act-method-container');
    
    if (scope === 'GLOBAL') {
         actMethodContainer.classList.add('hidden');
         matrixContainer.classList.remove('hidden');
         advancedToggleContainer.classList.remove('hidden');
         section3Header.innerText = "3. Global Event Filter (Who triggered this?)";
         
         matrixContainer.innerHTML = generateQuickMatrixHTML('activation', StudioState.activationQuickTargeting);
         
         if (StudioState.showAdvancedActivation) {
             advancedTreeWrapper.classList.remove('hidden');
             advancedIcon.style.transform = 'rotate(90deg)';
         } else {
             advancedTreeWrapper.classList.add('hidden');
             advancedIcon.style.transform = 'rotate(0deg)';
         }
    } else {
         actMethodContainer.classList.remove('hidden');
         
         if (actMethodSelect.value === 'PLAYER_CHOICE') {
           section3Header.innerText = "3. Player Activation Targets (Input)";
           matrixContainer.classList.remove('hidden');
           advancedToggleContainer.classList.remove('hidden');
           matrixContainer.innerHTML = generateQuickMatrixHTML('activation', StudioState.activationQuickTargeting);
           
           if (StudioState.showAdvancedActivation) {
             advancedTreeWrapper.classList.remove('hidden');
             advancedIcon.style.transform = 'rotate(90deg)';
           } else {
             advancedTreeWrapper.classList.add('hidden');
             advancedIcon.style.transform = 'rotate(0deg)';
           }
         } else {
           section3Header.innerText = "3. Event Conditions (Optional)";
           matrixContainer.classList.add('hidden');
           advancedToggleContainer.classList.remove('hidden');
           
           if (StudioState.showAdvancedActivation) {
             advancedTreeWrapper.classList.remove('hidden');
             advancedIcon.style.transform = 'rotate(90deg)';
           } else {
             advancedTreeWrapper.classList.add('hidden');
             advancedIcon.style.transform = 'rotate(0deg)';
           }
         }
    }
    
    updateJSONPreview();
}

// Bind to window for HTML inline access
window.parseTriggerToComposite = parseTriggerToComposite;
window.renderAdditionalTriggers = renderAdditionalTriggers;
window.addAdditionalTrigger = addAdditionalTrigger;
window.removeAdditionalTrigger = removeAdditionalTrigger;
window.updateAdditionalTrigger = updateAdditionalTrigger;
window.updateTriggerComposite = updateTriggerComposite;
window.updateTargetingUI = updateTargetingUI;