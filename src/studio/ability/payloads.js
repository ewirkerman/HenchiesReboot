import { StudioState } from './state.js';
import { updateJSONPreview } from './catalog_sync.js';
import { ACTION_MANIFEST, EFFECT_TYPES, ACTION_CATEGORIES } from '../../engine/actions/action_index.js';
import { getValidTargetMethods, getValidEffectTypes } from '../../ability_validation.js';
import { generateEffectsHTML } from './ability_renderer.js';
import { formatJavaScript } from './javascript_formatter.js';
import { CARD_TYPES } from '../../engine/card_types.js';
import { findAbilityByOptionValue } from '../card/ability_options.js';

function resolveGrantedAbilityId(value) {
    const match = findAbilityByOptionValue(StudioState.allAbilities, value)
        || StudioState.allAbilities.find(ability => ability.abilityId === value);
    return match ? match.abilityId : value;
}

export function getValidActionsForZones(selectedZones) {
    if (!selectedZones || selectedZones.length === 0) return [];
    return Object.keys(ACTION_MANIFEST).filter(action => {
        const validZones = ACTION_MANIFEST[action].validZones;
        if (validZones === 'ALL') return true;
        return selectedZones.every(z => validZones.includes(z));
    });
}

export function calculateEffectiveZones(baseZones, payloads, currentIndex) {
    let effectiveZones = [...(baseZones || ['FIELD'])];
    for (let i = 0; i < currentIndex; i++) {
        const p = payloads[i];
        const pt = p.type;
        const manifest = ACTION_MANIFEST[pt];
        if (manifest && manifest.endZone) {
            effectiveZones = [...manifest.endZone];
        } else if (pt === 'CHANGE_DESTINATION' && p.zone) {
            effectiveZones = [p.zone];
        } else if (pt === 'SUMMON' && p.zone) {
            effectiveZones = [p.zone];
        }
    }
    return effectiveZones;
}

export function handleAddEffectGroup() {
    StudioState.effectGroups.push({
        targetMethod: 'SAME_AS_ACTIVATION',
        targetCount: 1,
        targetCountIsX: false,
        quickTargeting: {
            zones: [...(StudioState.activationQuickTargeting.zones || ['FIELD'])],
            alignment: [...(StudioState.activationQuickTargeting.alignment || ['ENEMY'])],
            entityType: [...(StudioState.activationQuickTargeting.entityType || [CARD_TYPES.UNIT.toUpperCase(), CARD_TYPES.AVATAR.toUpperCase()])],
            ignoreBattlelines: StudioState.activationQuickTargeting.ignoreBattlelines || false
        },
        showAdvanced: false,
        logicTree: { type: 'group', logicalOperator: 'AND', children: [] },
        payloads: [
            { type: 'DEAL_DAMAGE', amount: 1, duration: 'INSTANT' }
        ]
    });
    revalidatePayloadTypes();
    renderEffects();
    updateJSONPreview();
}

export function removeEffectGroup(index) {
    StudioState.effectGroups.splice(index, 1);
    renderEffects();
    updateJSONPreview();
}

export function moveEffectGroup(index, direction) {
    if (index + direction < 0 || index + direction >= StudioState.effectGroups.length) return;
    const temp = StudioState.effectGroups[index];
    StudioState.effectGroups[index] = StudioState.effectGroups[index + direction];
    StudioState.effectGroups[index + direction] = temp;
    renderEffects();
    updateJSONPreview();
}

export function updateEffectGroup(index, field, value) {
    if (!StudioState.effectGroups[index]) return;
    StudioState.effectGroups[index][field] = value;
    if (field === 'targetMethod') {
        if (!['AUTO_RANDOM', 'AUTO_FIRST', 'AUTO_LAST'].includes(value)) {
            delete StudioState.effectGroups[index].targetCountIsX;
        }
        revalidatePayloadTypes();
    }
    renderEffects();
    updateJSONPreview();
}

export function addPayload(groupIndex) {
    const group = StudioState.effectGroups[groupIndex];
    if (!group) return;
    let baseZones = group.quickTargeting?.zones || ['FIELD'];
    if (group.targetMethod === 'SAME_AS_ACTIVATION') baseZones = StudioState.activationQuickTargeting?.zones || ['FIELD'];

    let effectiveZones = calculateEffectiveZones(baseZones, group.payloads, group.payloads.length);

    const validActions = typeof getValidActionsForZones !== 'undefined'
        ? (group.targetMethod === 'SELF' ? EFFECT_TYPES : getValidActionsForZones(effectiveZones))
        : EFFECT_TYPES;

    const initialType = validActions.length > 0 ? validActions[0] : 'CUSTOM_SCRIPT';
    group.payloads.push({ type: initialType, amount: 1, duration: 'INSTANT' });

    renderEffects();
    updateJSONPreview();
}

export function removePayload(groupIndex, payloadIndex) {
    StudioState.effectGroups[groupIndex].payloads.splice(payloadIndex, 1);
    renderEffects();
    updateJSONPreview();
}

export function handlePayloadDragStart(e, gIdx, pIdx) {
    StudioState.draggedPayloadInfo = { gIdx, pIdx };
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('opacity-50'), 0);
}

export function handlePayloadDragOver(e, gIdx) {
    e.preventDefault();
    if (StudioState.draggedPayloadInfo && StudioState.draggedPayloadInfo.gIdx === gIdx) {
        e.dataTransfer.dropEffect = 'move';
    } else {
        e.dataTransfer.dropEffect = 'none';
    }
}

export function handlePayloadDrop(e, targetGIdx, targetPIdx) {
    e.preventDefault();
    if (!StudioState.draggedPayloadInfo || StudioState.draggedPayloadInfo.gIdx !== targetGIdx) return;
    const srcPIdx = StudioState.draggedPayloadInfo.pIdx;
    if (srcPIdx === targetPIdx) return;

    const group = StudioState.effectGroups[targetGIdx];
    const [movedItem] = group.payloads.splice(srcPIdx, 1);
    group.payloads.splice(targetPIdx, 0, movedItem);

    renderEffects();
    updateJSONPreview();
}

export function handlePayloadDragEnd(e) {
    StudioState.draggedPayloadInfo = null;
    e.target.classList.remove('opacity-50');
    renderEffects();
}

export function getPayloadAtPath(groupIndex, payloadIndex, nestedPath = []) {
    let payload = StudioState.effectGroups[groupIndex]?.payloads?.[payloadIndex];
    for (let i = 0; i < nestedPath.length; i++) {
        const nestedIndex = nestedPath[i];
        if (nestedIndex === 'else') {
            payload = payload?.elsePayloads || [];
        } else if (Array.isArray(payload)) {
            payload = payload[nestedIndex];
        } else {
            payload = payload?.nestedGroup?.payloads?.[nestedIndex];
        }
    }
    return payload;
}

function updatePayloadFields(payload, field, value) {
    if (field === 'stat') {
        if (value === 'line') payload.amount = 'mid';
        else if (payload.stat === 'line' && value !== 'line') payload.amount = 1;
    }

    payload[field] = value;

    if (field === 'targetPool' && value === 'MAX') {
        payload.respectMax = false;
    }

    if (field === 'type') {
        const manifest = ACTION_MANIFEST[value];
        if (!manifest) return;

        if (value === 'CUSTOM_SCRIPT') {
            payload.undoSafe = payload.undoSafe === true;
        } else {
            delete payload.undoSafe;
        }

        const requiresAmount = manifest.requiresAmount || value === 'HARVEST';
        const requiresResource = manifest.requiresResource || value === 'HARVEST';

        if (requiresAmount) {
            payload.amount = 1;
            delete payload.amountIsX;
        } else {
            delete payload.amount;
            delete payload.amountIsX;
        }

        if (requiresResource) {
            payload.resource = value === 'HARVEST' ? 'default' : 'Carnie';
            if (value === 'MODIFY_RESOURCE') {
                payload.targetPool = 'CURRENT';
                payload.respectMax = false;
            } else {
                delete payload.targetPool;
                delete payload.respectMax;
            }
        } else {
            delete payload.resource;
            delete payload.targetPool;
            delete payload.respectMax;
        }

        if (manifest.requiresStat) payload.stat = 'strength'; else delete payload.stat;
        if (manifest.requiresGrantedAbility) payload.grantedAbilityId = ''; else delete payload.grantedAbilityId;
        if (manifest.requiresAbility) payload.abilityId = ''; else delete payload.abilityId;
        if (value === 'UPDATE_ABILITY_LEVEL') payload.modify = false; else delete payload.modify;
        if (value !== 'GRANT_ABILITY') { delete payload.grantedAbilityParamX; delete payload.grantedAbilityParamXIsX; }
        if (manifest.requiresCardId) payload.cardId = ''; else delete payload.cardId;
        if (manifest.requiresScript) { payload.script = 'state.players[state.activePlayerId].health += params.amount;'; payload.description = ''; } else { delete payload.script; delete payload.description; }
        if (manifest.requiresZone) payload.zone = 'FIELD'; else delete payload.zone;
        if (manifest.requiresZoneOwner) payload.zoneOwner = 'CASTER'; else delete payload.zoneOwner;
        if (manifest.canLimitStacks) payload.maxStacks = 0; else delete payload.maxStacks;
        if (!manifest.canOverheal) delete payload.overheal;
        if (!manifest.canBlockDuplicates) delete payload.blockDuplicates;
        if (!manifest.canInvert) delete payload.invertRoles;
        if (!manifest.canBeCost) delete payload.isCost;

        if (manifest.hasNestedGroup) {
            payload.nestedGroup = manifest.hasLogicTree
                ? { logicTree: { type: 'group', logicalOperator: 'AND', children: [] }, payloads: [] }
                : { targetMethod: 'AUTO_ALL', targetCount: 1, targetCountIsX: false, quickTargeting: { zones: ['FIELD'], alignment: ['FRIENDLY'], entityType: [CARD_TYPES.UNIT.toUpperCase()], ignoreBattlelines: false }, logicTree: { type: 'group', logicalOperator: 'AND', children: [] }, payloads: [] };
            if (manifest.hasLogicTree) payload.elsePayloads = payload.elsePayloads || [];
        } else {
            delete payload.nestedGroup;
            delete payload.elsePayloads;
        }

        if (!manifest.validDurations.includes(payload.duration)) {
            payload.duration = manifest.validDurations[0] || 'INSTANT';
        }
    }
}

export function updatePayloadAtPath(groupIndex, payloadIndex, nestedPath, field, value) {
    const payload = getPayloadAtPath(groupIndex, payloadIndex, nestedPath);
    if (!payload) return;
    updatePayloadFields(payload, field, value);
    renderEffects();
    updateJSONPreview();
}

export function updatePayload(groupIndex, payloadIndex, field, value) {
    updatePayloadAtPath(groupIndex, payloadIndex, [], field, value);
}

export function prettifyPayloadScript(groupIndex, payloadIndex, isNested = false, nestedIndex = null, button = null) {
    prettifyPayloadScriptAtPath(groupIndex, payloadIndex, isNested ? [nestedIndex] : [], button);
}

export function prettifyPayloadScriptAtPath(groupIndex, payloadIndex, nestedPath, button = null) {
    const payload = getPayloadAtPath(groupIndex, payloadIndex, nestedPath);
    if (!payload || typeof payload.script !== 'string') return;

    const textarea = button?.closest('[data-script-editor]')?.querySelector('textarea');
    payload.script = formatJavaScript(textarea ? textarea.value : payload.script, 2);
    renderEffects();
    updateJSONPreview();
}

export function updateGrantedAbility(gIdx, pIdx, value) {
    StudioState.effectGroups[gIdx].payloads[pIdx].grantedAbilityId = resolveGrantedAbilityId(value);
    renderEffects(); updateJSONPreview();
}

export function updateSummonCard(gIdx, pIdx, value) {
    const match = StudioState.allCards.find(c => c.name.toLowerCase() === value.toLowerCase());
    StudioState.effectGroups[gIdx].payloads[pIdx].cardId = match ? match.id : value;
    renderEffects(); updateJSONPreview();
}

export function updateNestedSummonCard(gIdx, pIdx, nIdx, value) {
    updateSummonCardAtPath(gIdx, pIdx, [nIdx], value);
}

export function updateSummonCardAtPath(gIdx, pIdx, nestedPath, value) {
    const payload = getPayloadAtPath(gIdx, pIdx, nestedPath);
    if (!payload) return;
    const match = StudioState.allCards.find(c => c.name.toLowerCase() === value.toLowerCase());
    payload.cardId = match ? match.id : value;
    renderEffects();
    updateJSONPreview();
}

export function addNestedPayloadAtPath(gIdx, pIdx, parentPath) {
    const payload = getPayloadAtPath(gIdx, pIdx, parentPath);
    if (!payload?.nestedGroup) return;
    payload.nestedGroup.payloads.push({ type: 'MODIFY_STAT', amount: 1, stat: 'strength', duration: 'INSTANT' });
    renderEffects();
    updateJSONPreview();
}

export function removeNestedPayloadAtPath(gIdx, pIdx, parentPath, nestedIndex) {
    const payload = getPayloadAtPath(gIdx, pIdx, parentPath);
    if (!payload?.nestedGroup?.payloads) return;
    payload.nestedGroup.payloads.splice(nestedIndex, 1);
    renderEffects();
    updateJSONPreview();
}

export function addElsePayload(gIdx, pIdx) {
    const payload = StudioState.effectGroups[gIdx]?.payloads?.[pIdx];
    if (!payload) return;
    payload.elsePayloads = Array.isArray(payload.elsePayloads) ? payload.elsePayloads : [];
    payload.elsePayloads.push({ type: 'MODIFY_STAT', amount: 1, stat: 'strength', duration: 'INSTANT' });
    renderEffects();
    updateJSONPreview();
}

export function removeElsePayload(gIdx, pIdx, elseIndex) {
    const payload = StudioState.effectGroups[gIdx]?.payloads?.[pIdx];
    if (!Array.isArray(payload?.elsePayloads)) return;
    payload.elsePayloads.splice(elseIndex, 1);
    renderEffects();
    updateJSONPreview();
}

export function updateGrantedAbilityAtPath(gIdx, pIdx, nestedPath, value) {
    const payload = getPayloadAtPath(gIdx, pIdx, nestedPath);
    if (!payload) return;
    payload.grantedAbilityId = resolveGrantedAbilityId(value);
    renderEffects();
    updateJSONPreview();
}

export function updateAbilitySelectionAtPath(gIdx, pIdx, nestedPath, value) {
    const payload = getPayloadAtPath(gIdx, pIdx, nestedPath);
    if (!payload) return;
    payload.abilityId = resolveGrantedAbilityId(value);
    renderEffects();
    updateJSONPreview();
}

export function updateNestedGroupAtPath(gIdx, pIdx, nestedPath, field, value) {
    const payload = getPayloadAtPath(gIdx, pIdx, nestedPath);
    if (!payload?.nestedGroup) return;
    payload.nestedGroup[field] = value;
    if (field === 'targetMethod' && !['AUTO_RANDOM', 'AUTO_FIRST'].includes(value)) {
        delete payload.nestedGroup.targetCountIsX;
    }
    renderEffects();
    updateJSONPreview();
}

export function updateNestedPayload(gIdx, pIdx, nIdx, field, value) {
    updatePayloadAtPath(gIdx, pIdx, [nIdx], field, value);
}

export function addNestedPayload(gIdx, pIdx) {
    addNestedPayloadAtPath(gIdx, pIdx, []);
}

export function removeNestedPayload(gIdx, pIdx, nIdx) {
    removeNestedPayloadAtPath(gIdx, pIdx, [], nIdx);
}

export function updateNestedGrantedAbility(gIdx, pIdx, nIdx, value) {
    updateGrantedAbilityAtPath(gIdx, pIdx, [nIdx], value);
}

export function updateNestedGroup(gIdx, pIdx, field, value) {
    updateNestedGroupAtPath(gIdx, pIdx, [], field, value);
}

export function revalidatePayloadTypes() {
    if (typeof getValidActionsForZones === 'undefined') return;

    const fullTrigger = document.getElementById('ab-trigger') ? document.getElementById('ab-trigger').value.toUpperCase() : 'MANUAL';

    StudioState.effectGroups.forEach((group, gIdx) => {
        let baseZones = group.quickTargeting?.zones || ['FIELD'];
        if (group.targetMethod === 'SAME_AS_ACTIVATION') baseZones = StudioState.activationQuickTargeting?.zones || ['FIELD'];

        group.payloads.forEach((payload, pIdx) => {
            let effectiveZones = calculateEffectiveZones(baseZones, group.payloads, pIdx);
            const baseValidActions = group.targetMethod === 'SELF' ? EFFECT_TYPES : getValidActionsForZones(effectiveZones);
            const validActions = getValidEffectTypes(fullTrigger, baseValidActions);

            if (!validActions.includes(payload.type)) {
                const fallback = validActions.includes('DEAL_DAMAGE') ? 'DEAL_DAMAGE' : (validActions.length > 0 ? validActions[0] : 'CUSTOM_SCRIPT');
                payload.type = fallback;

                const manifest = ACTION_MANIFEST[fallback];
                if (manifest) {
                    const requiresAmount = manifest.requiresAmount || fallback === 'HARVEST';
                    const requiresResource = manifest.requiresResource || fallback === 'HARVEST';

                    if (requiresAmount) payload.amount = 1; else delete payload.amount;

                    if (requiresResource) {
                        payload.resource = fallback === 'HARVEST' ? 'default' : 'Carnie';
                        if (fallback === 'MODIFY_RESOURCE') {
                            payload.targetPool = 'CURRENT';
                            payload.respectMax = false;
                        } else {
                            delete payload.targetPool;
                            delete payload.respectMax;
                        }
                    } else {
                        delete payload.resource;
                        delete payload.targetPool;
                        delete payload.respectMax;
                    }

                    if (manifest.requiresStat) payload.stat = 'strength'; else delete payload.stat;
                    if (manifest.requiresGrantedAbility) payload.grantedAbilityId = ''; else delete payload.grantedAbilityId;
                    if (manifest.requiresAbility) payload.abilityId = ''; else delete payload.abilityId;
                    if (fallback === 'UPDATE_ABILITY_LEVEL') payload.modify = false; else delete payload.modify;
                    if (fallback !== 'GRANT_ABILITY') { delete payload.grantedAbilityParamX; delete payload.grantedAbilityParamXIsX; }
                    if (manifest.requiresCardId) payload.cardId = ''; else delete payload.cardId;
                    if (manifest.requiresScript) { payload.script = 'state.players[state.activePlayerId].health += params.amount;'; payload.description = ''; } else { delete payload.script; delete payload.description; }
                    if (manifest.requiresZone) payload.zone = 'FIELD'; else delete payload.zone;
                    if (manifest.requiresZoneOwner) payload.zoneOwner = 'CASTER'; else delete payload.zoneOwner;
                    if (manifest.canLimitStacks) payload.maxStacks = 0; else delete payload.maxStacks;
                    if (!manifest.canOverheal) delete payload.overheal;
                    if (!manifest.canBlockDuplicates) delete payload.blockDuplicates;
                    if (!manifest.canInvert) delete payload.invertRoles;
                    if (!manifest.canBeCost) delete payload.isCost;

                    if (manifest.hasNestedGroup) {
                        payload.nestedGroup = { targetMethod: 'AUTO_ALL', targetCount: 1, targetCountIsX: false, quickTargeting: { zones: ['FIELD'], alignment: ['FRIENDLY'], entityType: [CARD_TYPES.UNIT.toUpperCase()], ignoreBattlelines: false }, logicTree: { type: 'group', logicalOperator: 'AND', children: [] }, payloads: [] };
                    } else { delete payload.nestedGroup; }

                    if (!manifest.validDurations.includes(payload.duration)) {
                        payload.duration = manifest.validDurations[0] || 'INSTANT';
                    }
                }
            }
        });
    });
}

export function renderEffects() {
    const container = document.getElementById('effect-groups-container');
    if (!container) return;

    const triggerEl = document.getElementById('ab-trigger');
    const baseTrigger = triggerEl ? triggerEl.value.toUpperCase() : 'MANUAL';
    const scopeEl = document.getElementById('ab-trigger-scope');
    const scope = scopeEl ? scopeEl.value : 'PERSONAL';
    const actMethodEl = document.getElementById('ab-act-method');
    const actMethod = actMethodEl ? actMethodEl.value : 'NONE';

    const ctx = {
        effectGroups: StudioState.effectGroups,
        baseTrigger,
        scope,
        actMethod,
        activationQuickTargeting: StudioState.activationQuickTargeting,
        getValidActionsForZones,
        calculateEffectiveZones,
        EFFECT_TYPES,
        getValidEffectTypes,
        ACTION_MANIFEST,
        ACTION_CATEGORIES,
        allAbilities: StudioState.allAbilities,
        allCards: StudioState.allCards,
        customTribesList: StudioState.customTribesList,
        getValidTargetMethods
    };

    container.innerHTML = generateEffectsHTML(ctx);
}

window.removeEffectGroup = removeEffectGroup;
window.moveEffectGroup = moveEffectGroup;
window.updateEffectGroup = updateEffectGroup;
window.addPayload = addPayload;
window.removePayload = removePayload;
window.handlePayloadDragStart = handlePayloadDragStart;
window.handlePayloadDragOver = handlePayloadDragOver;
window.handlePayloadDrop = handlePayloadDrop;
window.handlePayloadDragEnd = handlePayloadDragEnd;
window.updatePayload = updatePayload;
window.updatePayloadAtPath = updatePayloadAtPath;
window.prettifyPayloadScript = prettifyPayloadScript;
window.prettifyPayloadScriptAtPath = prettifyPayloadScriptAtPath;
window.updateGrantedAbility = updateGrantedAbility;
window.updateSummonCard = updateSummonCard;
window.updateNestedSummonCard = updateNestedSummonCard;
window.addNestedPayload = addNestedPayload;
window.removeNestedPayload = removeNestedPayload;
window.updateNestedPayload = updateNestedPayload;
window.addNestedPayloadAtPath = addNestedPayloadAtPath;
window.removeNestedPayloadAtPath = removeNestedPayloadAtPath;
window.updateNestedGroupAtPath = updateNestedGroupAtPath;
window.updateGrantedAbilityAtPath = updateGrantedAbilityAtPath;
window.updateAbilitySelectionAtPath = updateAbilitySelectionAtPath;
window.updateSummonCardAtPath = updateSummonCardAtPath;
window.updateNestedGrantedAbility = updateNestedGrantedAbility;
window.updateNestedGroup = updateNestedGroup;
window.revalidatePayloadTypes = revalidatePayloadTypes;
window.addElsePayload = addElsePayload;
window.removeElsePayload = removeElsePayload;
window.addElsePayload = addElsePayload;
window.removeElsePayload = removeElsePayload;