export const ATTRIBUTE_TYPES = {
    'entity': { label: 'Entity Type', type: 'select', options: ['SELF', 'AVATAR', 'UNIT', 'EQUIPMENT', 'ARTIFACT', 'SPELL', 'BOON'] },
    'alignment': { label: 'Alignment', type: 'select', options: ['FRIENDLY', 'ENEMY'] },
    'zone': { label: 'Zone', type: 'select', options: ['HAND', 'DECK', 'FIELD', 'DISCARD', 'BANISH', 'ORIGINAL_DECK'] },
    'tribe': { label: 'Tribe', type: 'select', options: ['Robot', 'Mythic', 'Elemental', 'Pirate', 'Undead', 'Carnie', 'Viking', 'Ninja', 'Stalker', 'Alien', 'Luchador'] },
    'family': { label: 'Family (Text)', type: 'text' },
    'genus': { label: 'Genus (Text)', type: 'text' },
    'health': { label: 'Current Health', type: 'number' },
    'maxHealth': { label: 'Max Health', type: 'number' },
    'strength': { label: 'Strength', type: 'number' },
    'armor': { label: 'Armor', type: 'number' },
    'power': { label: 'Power', type: 'number' },
    'cost': { label: 'Cost', type: 'number' },
    'readiness': { label: 'Readiness', type: 'number' },
    'acts': { label: 'Available Acts', type: 'number' },
    'maxActs': { label: 'Max Acts', type: 'number' },
    'isCombat': { label: 'Is Combat Damage (Event)', type: 'select', options: ['true', 'false'] },
    'isAttacking': { label: 'Is the Active Attacker (Event)', type: 'select', options: ['true', 'false'] },
    'hasAbility': { label: 'Has Ability ID', type: 'text' }
};

export const OPERATORS = { '==': 'Is (==)', '!=': 'Is Not (!=)', '>': 'Greater Than (>)', '<': 'Less Than (<)', '>=': 'X or more (>=)', '<=': 'X or less (<=)' };

export function generateQuickMatrixHTML(context, targetState, index = null) {
    const activeBg = context === 'activation' ? 'bg-indigo-600 border-indigo-500' : 'bg-fuchsia-600 border-fuchsia-500';
    const hoverBg = context === 'activation' ? 'hover:bg-indigo-900/50' : 'hover:bg-fuchsia-900/50';

    const buildMultiPills = (field, options, currentArray) => {
        const arr = currentArray || [];
        return options.map(opt => {
            const isActive = arr.includes(opt.value);
            const baseClass = "px-3 py-1.5 text-[10px] font-bold rounded-md cursor-pointer transition-all border whitespace-nowrap";
            const activeClass = isActive 
            ? `${activeBg} text-white shadow-md` 
            : `bg-slate-800 border-slate-700 text-slate-400 ${hoverBg}`;
            
            const clickHandler = context === 'activation' 
                ? `window.toggleQuickMatrixArray('activation', null, '${field}', '${opt.value}')`
                : `window.toggleQuickMatrixArray('effect', ${index}, '${field}', '${opt.value}')`;

            return `<button type="button" onclick="${clickHandler}" class="${baseClass} ${activeClass}">${opt.label}</button>`;
        }).join('');
    };

    const zoneOptions = [
        {label: 'Field', value: 'FIELD'}, {label: 'Hand', value: 'HAND'}, 
        {label: 'Deck', value: 'DECK'}, {label: 'Discard', value: 'DISCARD'},
        {label: 'Banish', value: 'BANISH'}, {label: 'Orig. Deck', value: 'ORIGINAL_DECK'}
    ];
    const alignmentOptions = [{label: 'Friendly', value: 'FRIENDLY'}, {label: 'Enemy', value: 'ENEMY'}];
    const entityOptions = [{label: 'Unit', value: 'UNIT'}, {label: 'Avatar', value: 'AVATAR'}, {label: 'Equipment', value: 'EQUIPMENT'}, {label: 'Spell', value: 'SPELL'}, {label: 'Boon', value: 'BOON'}];

    const toggleBoolHandler = context === 'activation'
        ? `window.toggleQuickMatrixBoolean('activation', null, 'ignoreBattlelines')`
        : `window.toggleQuickMatrixBoolean('effect', ${index}, 'ignoreBattlelines')`;
        
    const isIgnoreLines = targetState.ignoreBattlelines;
    const boolActiveClass = isIgnoreLines ? `${activeBg} text-white shadow-md` : `bg-slate-800 border-slate-700 text-slate-400 ${hoverBg}`;

    return `
        <div class="flex flex-col gap-4 bg-slate-900/70 p-3 rounded-lg border border-slate-700/50 shadow-inner">
            <div class="w-full">
                <label class="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Zone Scope (Multi)</label>
                <div class="flex flex-wrap gap-1.5">${buildMultiPills('zones', zoneOptions, targetState.zones)}</div>
            </div>
            <div class="flex flex-col md:flex-row flex-wrap gap-4">
                <div class="flex-1 min-w-[150px]">
                    <label class="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Target Alignment (Multi)</label>
                    <div class="flex flex-wrap gap-1.5">${buildMultiPills('alignment', alignmentOptions, targetState.alignment)}</div>
                </div>
                <div class="flex-1 min-w-[200px]">
                    <label class="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Entity Type (Multi)</label>
                    <div class="flex flex-wrap gap-1.5">${buildMultiPills('entityType', entityOptions, targetState.entityType)}</div>
                </div>
                <div class="w-full md:w-auto flex flex-col justify-end">
                    <label class="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Restrictions</label>
                    <button type="button" onclick="${toggleBoolHandler}" class="px-3 py-1.5 text-[10px] font-bold rounded-md cursor-pointer transition-all border whitespace-nowrap flex items-center gap-2 ${boolActiveClass}">
                        <div class="w-3 h-3 rounded-sm border ${isIgnoreLines ? 'border-white bg-white/20' : 'border-slate-500'} flex items-center justify-center transition-colors">
                            ${isIgnoreLines ? '✓' : ''}
                        </div>
                        Ignore Battlelines
                    </button>
                </div>
            </div>
        </div>
    `;
}

export function generateConditionHTML(treeType, cond, path, parentBorderClass) {
    const pathStr = JSON.stringify(path);
    const typeDef = ATTRIBUTE_TYPES[cond.attribute] || ATTRIBUTE_TYPES['entity'];
    const attrOptions = Object.entries(ATTRIBUTE_TYPES).map(([key, def]) => `<option value="${key}" ${cond.attribute === key ? 'selected' : ''}>${def.label}</option>`).join('');
    const opOptions = Object.entries(OPERATORS).map(([val, label]) => `<option value="${val}" ${cond.operator === val ? 'selected' : ''}>${label}</option>`).join('');

    let valueInputHTML = '';
    if (typeDef.type === 'select') {
    valueInputHTML = `<select onchange="window.updateNodeField('${treeType}', '${pathStr}', 'value', this.value)" class="bg-slate-900 border border-slate-700 p-1 rounded text-white flex-1 min-w-[80px]">
        ${typeDef.options.map(opt => `<option value="${opt}" ${cond.value === opt ? 'selected' : ''}>${opt}</option>`).join('')}
    </select>`;
    } else if (typeDef.type === 'text') {
    valueInputHTML = `<input type="text" value="${cond.value || ''}" placeholder="Value..." onchange="window.updateNodeField('${treeType}', '${pathStr}', 'value', this.value)" class="bg-slate-900 border border-slate-700 p-1 rounded text-white flex-1 min-w-[80px]" />`;
    } else {
    valueInputHTML = `<input type="number" value="${cond.value}" onchange="window.updateNodeField('${treeType}', '${pathStr}', 'value', this.value)" class="bg-slate-900 border border-slate-700 p-1 rounded text-white flex-1 min-w-[80px]" />`;
    }

    return `
    <div class="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded border border-slate-700 ml-4 logic-group-border ${parentBorderClass} hover:border-slate-500 transition-colors">
        <select onchange="window.updateNodeField('${treeType}', '${pathStr}', 'attribute', this.value)" class="bg-slate-950 border border-slate-700 p-1 rounded text-cyan-300 font-bold w-1/3">${attrOptions}</select>
        <select onchange="window.updateNodeField('${treeType}', '${pathStr}', 'operator', this.value)" class="bg-slate-950 border border-slate-700 p-1 rounded text-pink-300 font-bold w-24">${opOptions}</select>
        ${valueInputHTML}
        <button type="button" onclick='window.removeNode("${treeType}", "${pathStr}")' class="text-slate-500 hover:text-red-400 font-bold px-2">&times;</button>
    </div>
    `;
}

export function generateGroupHTML(treeType, group, path) {
    const pathStr = JSON.stringify(path);
    const isRoot = path.length === 0;
    const isAnd = group.logicalOperator === 'AND';
    const borderClass = isAnd ? 'border-and' : 'border-or';
    const isActivation = treeType === 'activation';
    const bgClass = isActivation 
    ? (isAnd ? 'bg-indigo-950/40' : 'bg-amber-950/40') 
    : (isAnd ? 'bg-fuchsia-950/40' : 'bg-amber-950/40');
    const textClass = isActivation
    ? (isAnd ? 'text-indigo-400' : 'text-amber-400')
    : (isAnd ? 'text-fuchsia-400' : 'text-amber-400');
    
    let childrenHTML = '';
    if (group.children && group.children.length > 0) {
    childrenHTML = group.children.map((child, index) => {
        const childPath = [...path, index];
        if (child.type === 'group') return generateGroupHTML(treeType, child, childPath);
        else return generateConditionHTML(treeType, child, childPath, borderClass);
    }).join('');
    } else {
    childrenHTML = `<div class="text-[10px] text-slate-500 italic p-2 ml-4">Empty Group. (Always evaluates to true)</div>`;
    }

    return `
    <div class="flex flex-col gap-2 rounded-lg border border-slate-700/50 p-2 ${bgClass} ${isRoot ? '' : 'ml-4 logic-group-border ' + borderClass}">
        <div class="flex justify-between items-center bg-slate-900/60 p-1.5 rounded border border-slate-800">
        <div class="flex items-center gap-2">
            <span class="text-[10px] font-black uppercase tracking-widest ${textClass}">${isRoot ? 'ROOT MATCH' : 'SUB-GROUP'}</span>
            <select onchange="window.updateNodeField('${treeType}', '${pathStr}', 'logicalOperator', this.value)" class="bg-slate-950 border border-slate-700 px-1 py-0.5 rounded text-xs font-bold ${textClass}">
            <option value="AND" ${group.logicalOperator === 'AND' ? 'selected' : ''}>Match ALL (AND)</option>
            <option value="OR" ${group.logicalOperator === 'OR' ? 'selected' : ''}>Match ANY (OR)</option>
            </select>
        </div>
        <div class="flex items-center gap-1">
            <button type="button" onclick='window.addConditionToGroup("${treeType}", "${pathStr}")' class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded transition">+ Condition</button>
            <button type="button" onclick='window.addGroupToGroup("${treeType}", "${pathStr}")' class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded transition">+ Group</button>
            ${!isRoot ? `<button type="button" onclick='window.removeNode("${treeType}", "${pathStr}")' class="text-slate-500 hover:text-red-400 font-black px-1.5 ml-1 transition">&times;</button>` : ''}
        </div>
        </div>
        <div class="flex flex-col gap-1.5">${childrenHTML}</div>
    </div>
    `;
}

export function generateEffectsHTML(ctx) {
    const {
        effectGroups, baseTrigger, scope, actMethod, activationQuickTargeting,
        getValidActionsForZones, calculateEffectiveZones, EFFECT_TYPES, getValidEffectTypes, ACTION_MANIFEST, ACTION_CATEGORIES,
        allAbilities, allCards, customTribesList, getValidTargetMethods
    } = ctx;

    return effectGroups.map((group, gIdx) => {
        const payloadsHtml = group.payloads.map((payload, pIdx) => {
            let baseZones = group.quickTargeting?.zones || ['FIELD'];
            if (group.targetMethod === 'SAME_AS_ACTIVATION') baseZones = activationQuickTargeting?.zones || ['FIELD'];
                
            let effectiveZones = calculateEffectiveZones(baseZones, group.payloads, pIdx);

            const baseValidEffectTypes = typeof getValidActionsForZones !== 'undefined' 
                ? (group.targetMethod === 'SELF' ? EFFECT_TYPES : getValidActionsForZones(effectiveZones))
                : EFFECT_TYPES;

            const validEffectTypes = getValidEffectTypes(baseTrigger, baseValidEffectTypes);
            
            if (!validEffectTypes.includes(payload.type)) {
                payload.type = validEffectTypes.includes('DEAL_DAMAGE') ? 'DEAL_DAMAGE' : (validEffectTypes.length > 0 ? validEffectTypes[0] : 'CUSTOM_SCRIPT');
            }

            const typeOptions = Object.entries(ACTION_CATEGORIES).map(([cat, actions]) => {
                const validActions = actions.filter(a => validEffectTypes.includes(a));
                if (validActions.length === 0) return '';
                return `<optgroup label="${cat}">${validActions.map(t => `<option value="${t}" ${payload.type === t ? 'selected' : ''}>${t.replace(/_/g, ' ')}</option>`).join('')}</optgroup>`;
            }).join('');

            const manifest = ACTION_MANIFEST[payload.type] || { canInvert: true, canBeCost: true, validDurations: ['INSTANT'] };
            
            let basicParamsHtml = '';
            
            if (manifest.requiresAmount) {
                if (payload.type === 'SET_STAT' && payload.stat === 'line') {
                  basicParamsHtml += `<div class="w-24 pb-0.5"><label class="block text-[10px] font-bold text-slate-400 mb-0.5">Line</label><select onchange="window.updatePayload(${gIdx}, ${pIdx}, 'amount', this.value)" class="bg-slate-950 border border-slate-700 p-1.5 rounded text-white font-black w-full">
                      <option value="front" ${payload.amount === 'front' ? 'selected' : ''}>Front</option>
                      <option value="mid" ${payload.amount === 'mid' ? 'selected' : ''}>Mid</option>
                      <option value="back" ${payload.amount === 'back' ? 'selected' : ''}>Back</option>
                      <option value="sheltered" ${payload.amount === 'sheltered' ? 'selected' : ''}>Sheltered</option>
                      <option value="sideline" ${payload.amount === 'sideline' ? 'selected' : ''}>Sideline</option>
                      <option value="taunt" ${payload.amount === 'taunt' ? 'selected' : ''}>Taunt</option>
                      <option value="bodyguard" ${payload.amount === 'bodyguard' ? 'selected' : ''}>Bodyguard</option>
                  </select></div>`;
                } else {
                  basicParamsHtml += `<div class="w-24 pb-0.5"><label class="block text-[10px] font-bold text-slate-400 mb-0.5">Magnitude/Amt</label><input type="number" value="${payload.amount !== undefined ? payload.amount : 1}" onchange="window.updatePayload(${gIdx}, ${pIdx}, 'amount', parseInt(this.value))" class="bg-slate-950 border border-slate-700 p-1.5 rounded text-white font-black w-full" /></div>`;
                }
            }

            if (manifest.canLimitStacks) {
                basicParamsHtml += `<div class="w-20 pb-0.5"><label class="block text-[10px] font-bold text-pink-400 mb-0.5" title="Max allowed from this specific ability (0 = no limit)">Src Cap</label><input type="number" value="${payload.maxStacks || 0}" min="0" onchange="window.updatePayload(${gIdx}, ${pIdx}, 'maxStacks', parseInt(this.value))" class="bg-slate-950 border border-slate-700 p-1.5 rounded text-white font-black w-full" /></div>`;
            }

            if (manifest.requiresStat) {
              let statOptions = `
                  <option value="strength" ${payload.stat === 'strength' ? 'selected' : ''}>Strength</option>
                  <option value="health" ${payload.stat === 'health' ? 'selected' : ''}>Current Health</option>
                  <option value="maxHealth" ${payload.stat === 'maxHealth' ? 'selected' : ''}>Max Health</option>
                  <option value="armor" ${payload.stat === 'armor' ? 'selected' : ''}>Armor</option>
                  <option value="amount" ${payload.stat === 'amount' ? 'selected' : ''}>Event Amount</option>
                  <option value="readiness" ${payload.stat === 'readiness' ? 'selected' : ''}>Readiness</option>
                  <option value="acts" ${payload.stat === 'acts' ? 'selected' : ''}>Available Acts</option>
                  <option value="maxActs" ${payload.stat === 'maxActs' ? 'selected' : ''}>Max Acts</option>
                  <option value="power" ${payload.stat === 'power' ? 'selected' : ''}>Power</option>
              `;
              if (payload.type === 'SET_STAT') {
                  statOptions += `<option value="line" ${payload.stat === 'line' ? 'selected' : ''}>Battleline</option>`;
              }
              basicParamsHtml += `<div class="flex-1 min-w-[120px] pb-0.5"><label class="block text-[10px] font-bold text-amber-400 mb-0.5">Target Stat</label><select onchange="window.updatePayload(${gIdx}, ${pIdx}, 'stat', this.value)" class="bg-slate-950 border border-slate-700 p-1.5 rounded text-amber-300 font-bold w-full">${statOptions}</select></div>`;
            }

            if (manifest.requiresResource) {
                let resourceOptions = `
                    <option value="Carnie" ${payload.resource === 'Carnie' ? 'selected' : ''}>Carnie (Current)</option>
                    <option value="maxCarnie" ${payload.resource === 'maxCarnie' ? 'selected' : ''}>Max Carnie</option>
                `;
                if (customTribesList) {
                    customTribesList.forEach(t => {
                        if (t.name !== 'Carnie' && t.name !== 'Generic') {
                            resourceOptions += `<option value="${t.id}" ${payload.resource === t.id ? 'selected' : ''}>${t.name}</option>`;
                        }
                    });
                }
                
                basicParamsHtml += `<div class="flex-1 min-w-[120px] pb-0.5"><label class="block text-[10px] font-bold text-amber-400 mb-0.5">Resource Type</label><select onchange="window.updatePayload(${gIdx}, ${pIdx}, 'resource', this.value)" class="bg-slate-950 border border-slate-700 p-1.5 rounded text-amber-300 font-bold w-full">${resourceOptions}</select></div>`;
            }

            if (manifest.requiresGrantedAbility) {
                const customOptions = allAbilities.map(a => `<option value="${a.name}"></option>`).join('');
                let displayValue = payload.grantedAbilityId || '';
                const foundAb = allAbilities.find(a => a.abilityId === displayValue);
                if (foundAb) displayValue = foundAb.name;
                const abLabel = payload.type === 'REMOVE_ABILITY' ? 'Ability to Remove' : 'Ability to Grant';
                basicParamsHtml += `<div class="flex-1 min-w-[150px] pb-0.5"><label class="block text-[10px] font-bold text-cyan-400 mb-0.5">${abLabel}</label><input list="ability-list-${gIdx}-${pIdx}" value="${displayValue}" onchange="window.updateGrantedAbility(${gIdx}, ${pIdx}, this.value)" placeholder="Search or type name..." class="bg-slate-950 border border-slate-700 p-1.5 rounded text-cyan-300 font-bold w-full" />
                <datalist id="ability-list-${gIdx}-${pIdx}">${customOptions}</datalist></div>`;
            }

            if (manifest.canBlockDuplicates) {
                basicParamsHtml += `<div class="flex items-end pb-1.5"><label class="flex items-center gap-1.5 cursor-pointer hover:text-white transition whitespace-nowrap"><input type="checkbox" ${payload.blockDuplicates ? 'checked' : ''} onchange="window.updatePayload(${gIdx}, ${pIdx}, 'blockDuplicates', this.checked)" class="accent-cyan-500 w-3 h-3" /><span class="text-[9px] font-black text-cyan-400 uppercase tracking-wider">Block Duplicates</span></label></div>`;
            }

            if (manifest.requiresCardId) {
                const cardOptions = allCards.map(c => `<option value="${c.name}"></option>`).join('');
                let displayValue = payload.cardId || '';
                const foundCard = allCards.find(c => c.id === displayValue);
                if (foundCard) displayValue = foundCard.name;
                basicParamsHtml += `<div class="flex-1 min-w-[150px] pb-0.5"><label class="block text-[10px] font-bold text-fuchsia-400 mb-0.5">Card to Summon</label><input list="card-list-${gIdx}-${pIdx}" value="${displayValue}" onchange="window.updateSummonCard(${gIdx}, ${pIdx}, this.value)" placeholder="Search or type card name..." class="bg-slate-950 border border-slate-700 p-1.5 rounded text-fuchsia-300 font-bold w-full" />
                <datalist id="card-list-${gIdx}-${pIdx}">${cardOptions}</datalist></div>`;
            }

            if (manifest.requiresZone) {
                basicParamsHtml += `<div class="w-32 pb-0.5"><label class="block text-[10px] font-bold text-sky-400 mb-0.5">Destination Zone</label><select onchange="window.updatePayload(${gIdx}, ${pIdx}, 'zone', this.value)" class="bg-slate-950 border border-slate-700 p-1.5 rounded text-white font-bold w-full">
                    ${['FIELD', 'HAND', 'DECK', 'DISCARD', 'BANISH'].map(z => `<option value="${z}" ${payload.zone === z ? 'selected' : ''}>${z}</option>`).join('')}
                </select></div>`;
            }
            
            if (manifest.requiresZoneOwner) {
                basicParamsHtml += `<div class="w-28 pb-0.5"><label class="block text-[10px] font-bold text-sky-400 mb-0.5">Zone Owner</label><select onchange="window.updatePayload(${gIdx}, ${pIdx}, 'zoneOwner', this.value)" class="bg-slate-950 border border-slate-700 p-1.5 rounded text-white font-bold w-full">
                    <option value="CASTER" ${payload.zoneOwner === 'CASTER' || !payload.zoneOwner ? 'selected' : ''}>Caster</option>
                    <option value="TARGET" ${payload.zoneOwner === 'TARGET' ? 'selected' : ''}>Target</option>
                </select></div>`;
            }

            let fullWidthHtml = '';
            if (manifest.requiresScript) {
                fullWidthHtml += `<div class="w-full mt-2 border-t border-slate-700/50 pt-2"><label class="block text-[10px] font-bold text-amber-400 mb-1 flex justify-between items-end"><span>⚡ Execution Script</span><span class="text-slate-500 font-normal">Signature: (state, target, params)</span></label><textarea onchange="window.updatePayload(${gIdx}, ${pIdx}, 'script', this.value)" rows="3" class="bg-slate-950 border border-slate-700 p-2 rounded text-amber-300 font-mono text-[11px] w-full focus:outline-none focus:border-amber-500">${payload.script || ''}</textarea><label class="block text-[10px] font-bold text-amber-400 mb-1 mt-2">Script Language Description</label><input type="text" onchange="window.updatePayload(${gIdx}, ${pIdx}, 'description', this.value)" value="${payload.description || ''}" placeholder="e.g. set {POSS} health to 1" class="bg-slate-950 border border-slate-700 p-1.5 rounded text-white font-bold w-full text-[10px]" /></div>`;
            }
            
            if (manifest.hasNestedGroup && payload.nestedGroup) {
                  const ng = payload.nestedGroup;
                  const nestedPayloadsHtml = ng.payloads.map((np, nIdx) => {
                    const nMan = ACTION_MANIFEST[np.type] || { validDurations: ['INSTANT'] };
                    let npParamsHtml = '';
                    
                    if (nMan.requiresAmount && nMan.requiresStat) {
                       let amountHtml = '';
                       if (np.type === 'SET_STAT' && np.stat === 'line') {
                           amountHtml = `<div class="w-20"><select onchange="window.updateNestedPayload(${gIdx}, ${pIdx}, ${nIdx}, 'amount', this.value)" class="bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold w-full text-[10px]">
                               <option value="front" ${np.amount === 'front' ? 'selected' : ''}>Front</option>
                               <option value="mid" ${np.amount === 'mid' ? 'selected' : ''}>Mid</option>
                               <option value="back" ${np.amount === 'back' ? 'selected' : ''}>Back</option>
                               <option value="sheltered" ${np.amount === 'sheltered' ? 'selected' : ''}>Sheltered</option>
                               <option value="sideline" ${np.amount === 'sideline' ? 'selected' : ''}>Sideline</option>
                               <option value="taunt" ${np.amount === 'taunt' ? 'selected' : ''}>Taunt</option>
                               <option value="bodyguard" ${np.amount === 'bodyguard' ? 'selected' : ''}>Bodyguard</option>
                           </select></div>`;
                       } else {
                           amountHtml = `<div class="w-16"><input type="number" value="${np.amount !== undefined ? np.amount : 1}" onchange="window.updateNestedPayload(${gIdx}, ${pIdx}, ${nIdx}, 'amount', parseInt(this.value))" class="bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold w-full text-[10px]" /></div>`;
                       }
                       
                       let nestedStatOptions = `
                                <option value="strength" ${np.stat === 'strength' ? 'selected' : ''}>Strength</option>
                                <option value="health" ${np.stat === 'health' ? 'selected' : ''}>Health</option>
                                <option value="maxHealth" ${np.stat === 'maxHealth' ? 'selected' : ''}>Max Health</option>
                                <option value="armor" ${np.stat === 'armor' ? 'selected' : ''}>Armor</option>
                                <option value="amount" ${np.stat === 'amount' ? 'selected' : ''}>Event Amount</option>
                                <option value="readiness" ${np.stat === 'readiness' ? 'selected' : ''}>Readiness</option>
                                <option value="acts" ${np.stat === 'acts' ? 'selected' : ''}>Available Acts</option>
                                <option value="maxActs" ${np.stat === 'maxActs' ? 'selected' : ''}>Max Acts</option>
                                <option value="power" ${np.stat === 'power' ? 'selected' : ''}>Power</option>
                       `;
                       if (np.type === 'SET_STAT') {
                           nestedStatOptions += `<option value="line" ${np.stat === 'line' ? 'selected' : ''}>Battleline</option>`;
                       }

                       npParamsHtml += `
                          ${amountHtml}
                          <div class="w-24">
                              <select onchange="window.updateNestedPayload(${gIdx}, ${pIdx}, ${nIdx}, 'stat', this.value)" class="bg-slate-900 border border-slate-700 p-1.5 rounded text-amber-300 font-bold text-[10px] w-full">
                                ${nestedStatOptions}
                              </select>
                          </div>
                       `;
                    } else if (nMan.requiresAmount) {
                       npParamsHtml += `<div class="w-16"><input type="number" value="${np.amount !== undefined ? np.amount : 1}" onchange="window.updateNestedPayload(${gIdx}, ${pIdx}, ${nIdx}, 'amount', parseInt(this.value))" class="bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold w-full text-[10px]" /></div>`;
                    } 
                    
                    if (nMan.canLimitStacks) {
                       npParamsHtml += `<div class="w-16"><input type="number" value="${np.maxStacks || 0}" min="0" onchange="window.updateNestedPayload(${gIdx}, ${pIdx}, ${nIdx}, 'maxStacks', parseInt(this.value))" class="bg-slate-900 border border-pink-700/50 p-1.5 rounded text-white font-bold w-full text-[10px]" title="Source Cap" /></div>`;
                    }

                    if (nMan.requiresGrantedAbility) {
                       const customOptions = allAbilities.map(a => `<option value="${a.name}"></option>`).join('');
                       let displayValue = np.grantedAbilityId || '';
                       const foundAb = allAbilities.find(a => a.abilityId === displayValue);
                       if (foundAb) displayValue = foundAb.name;
                       npParamsHtml += `<div class="flex-1 min-w-[120px]"><input list="nest-ability-list-${gIdx}-${pIdx}-${nIdx}" value="${displayValue}" onchange="window.updateNestedGrantedAbility(${gIdx}, ${pIdx}, ${nIdx}, this.value)" placeholder="Ability name..." class="bg-slate-900 border border-slate-700 p-1.5 rounded text-cyan-300 font-bold w-full text-[10px]" /><datalist id="nest-ability-list-${gIdx}-${pIdx}-${nIdx}">${customOptions}</datalist></div>`;
                    } 

                    if (nMan.canBlockDuplicates) {
                       npParamsHtml += `<div class="flex items-center px-1"><label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" ${np.blockDuplicates ? 'checked' : ''} onchange="window.updateNestedPayload(${gIdx}, ${pIdx}, ${nIdx}, 'blockDuplicates', this.checked)" class="accent-cyan-500 w-3 h-3" /><span class="text-[9px] font-bold text-cyan-400">No Dupes</span></label></div>`;
                    }
                    
                    if (nMan.requiresCardId) {
                       const cardOptions = allCards.map(c => `<option value="${c.name}"></option>`).join('');
                       let displayValue = np.cardId || '';
                       const foundCard = allCards.find(c => c.id === displayValue);
                       if (foundCard) displayValue = foundCard.name;
                       npParamsHtml += `<div class="flex-1 min-w-[120px]"><input list="nest-card-list-${gIdx}-${pIdx}-${nIdx}" value="${displayValue}" onchange="window.updateNestedSummonCard(${gIdx}, ${pIdx}, ${nIdx}, this.value)" placeholder="Card name..." class="bg-slate-900 border border-slate-700 p-1.5 rounded text-fuchsia-300 font-bold w-full text-[10px]" /><datalist id="nest-card-list-${gIdx}-${pIdx}-${nIdx}">${cardOptions}</datalist></div>`;
                    }
                    
                    if (nMan.requiresScript) {
                       npParamsHtml += `<div class="flex-1 min-w-[150px]"><input type="text" value="${np.script || ''}" onchange="window.updateNestedPayload(${gIdx}, ${pIdx}, ${nIdx}, 'script', this.value)" placeholder="state.players..." class="bg-slate-900 border border-slate-700 p-1.5 rounded text-amber-300 font-mono w-full text-[10px]" /></div>`;
                       npParamsHtml += `<div class="flex-1 min-w-[150px]"><input type="text" value="${np.description || ''}" onchange="window.updateNestedPayload(${gIdx}, ${pIdx}, ${nIdx}, 'description', this.value)" placeholder="desc (e.g. destroy {TARGET})" class="bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold w-full text-[10px]" /></div>`;
                    }

                    let nestedDurHtml = '';
                    if (nMan.validDurations && nMan.validDurations.length > 1) {
                       nestedDurHtml = `
                          <div class="w-24">
                              <select onchange="window.updateNestedPayload(${gIdx}, ${pIdx}, ${nIdx}, 'duration', this.value)" class="bg-slate-900 border border-slate-700 p-1.5 rounded text-sky-300 font-bold text-[10px] w-full">
                                  <option value="INSTANT" ${np.duration === 'INSTANT' ? 'selected' : ''}>Instant</option>
                                  <option value="ACTION" ${np.duration === 'ACTION' ? 'selected' : ''}>Action (Event)</option>
                                  <option value="BRIEF" ${np.duration === 'BRIEF' ? 'selected' : ''}>Brief (Turn)</option>
                                  <option value="TEMPORARY" ${np.duration === 'TEMPORARY' ? 'selected' : ''}>Temporary (Round)</option>
                                  <option value="WHILE_ATTACHED" ${np.duration === 'WHILE_ATTACHED' ? 'selected' : ''}>While Attached</option>
                                  <option value="PERMANENT" ${np.duration === 'PERMANENT' ? 'selected' : ''}>Permanent</option>
                              </select>
                          </div>
                       `;
                    }

                    return `
                    <div class="flex flex-wrap items-center gap-2 bg-slate-950 p-2 rounded border border-slate-800 relative shadow-sm mt-1">
                        <button type="button" onclick="window.removeNestedPayload(${gIdx}, ${pIdx}, ${nIdx})" class="absolute top-1/2 -translate-y-1/2 right-2 text-slate-500 hover:text-red-400 font-bold px-1 text-[12px]">&times;</button>
                        <div class="w-1/3 min-w-[120px]">
                            <select onchange="window.updateNestedPayload(${gIdx}, ${pIdx}, ${nIdx}, 'type', this.value)" class="bg-slate-900 border border-slate-700 p-1.5 rounded text-emerald-400 font-bold text-[10px] w-full">
                               ${typeOptions.replace(/selected/g, '').replace(new RegExp(`value="${np.type}"`), `value="${np.type}" selected`)}
                            </select>
                        </div>
                        ${npParamsHtml}
                        ${nestedDurHtml}
                    </div>
                  `;
                  }).join('');

                  const nestedGroupHtml = `
                    <div class="w-full mt-4 bg-slate-900/80 p-3 rounded-lg border border-fuchsia-700/50 shadow-inner">
                        <div class="flex justify-between items-center mb-3 border-b border-fuchsia-900/50 pb-2">
                           <label class="block text-[11px] font-black text-fuchsia-400 tracking-wider">🎯 POST-SUMMON ACTIONS</label>
                           <button type="button" onclick="window.addNestedPayload(${gIdx}, ${pIdx})" class="text-[10px] bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-3 py-1 rounded shadow transition">+ Add Nested Action</button>
                        </div>
                        <div class="flex gap-3 mb-3 w-full">
                            <div class="flex-1">
                                <label class="block text-[9px] font-bold text-slate-500 mb-1 uppercase">Target Scope</label>
                                <select onchange="window.updateNestedGroup(${gIdx}, ${pIdx}, 'targetMethod', this.value)" class="bg-slate-950 border border-slate-700 p-1.5 rounded text-white text-[10px] w-full">
                                    <option value="AUTO_ALL" ${ng.targetMethod === 'AUTO_ALL' ? 'selected' : ''}>Apply to ALL Summoned Units</option>
                                    <option value="AUTO_RANDOM" ${ng.targetMethod === 'AUTO_RANDOM' ? 'selected' : ''}>Apply to RANDOM N Summoned Units</option>
                                    <option value="AUTO_FIRST" ${ng.targetMethod === 'AUTO_FIRST' ? 'selected' : ''}>Apply to FIRST N Summoned Units</option>
                                </select>
                            </div>
                            ${['AUTO_RANDOM', 'AUTO_FIRST'].includes(ng.targetMethod) ? `
                            <div class="w-24">
                                <label class="block text-[9px] font-bold text-slate-500 mb-1 uppercase">Count (N)</label>
                                <input type="number" value="${ng.targetCount || 1}" onchange="window.updateNestedGroup(${gIdx}, ${pIdx}, 'targetCount', parseInt(this.value))" class="bg-slate-950 border border-slate-700 p-1.5 rounded text-amber-300 font-bold w-full text-[10px]" />
                            </div>
                            ` : ''}
                        </div>
                        <div class="flex flex-col gap-2">
                            ${nestedPayloadsHtml}
                        </div>
                        ${ng.payloads.length === 0 ? `<div class="text-[10px] text-slate-500 italic mt-2 text-center p-2 border border-dashed border-slate-700 rounded">No post-summon actions defined.</div>` : ''}
                    </div>
                  `;
                  fullWidthHtml += nestedGroupHtml;
              }
              
            const showDuration = manifest.validDurations && manifest.validDurations.length > 1;
            
            return `
              <div draggable="true"
                   ondragstart="window.handlePayloadDragStart(event, ${gIdx}, ${pIdx})"
                   ondragover="window.handlePayloadDragOver(event, ${gIdx})"
                   ondrop="window.handlePayloadDrop(event, ${gIdx}, ${pIdx})"
                   ondragend="window.handlePayloadDragEnd(event)"
                   class="flex flex-col gap-2 bg-slate-950 p-3 pl-8 rounded-lg border border-slate-800 relative shadow-md transition-all">
                  <div class="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing text-lg" title="Drag to reorder">☰</div>
                  <button type="button" onclick="window.removePayload(${gIdx}, ${pIdx})" class="absolute top-2 right-2 text-slate-600 hover:text-red-400 font-black px-1.5 leading-none transition-colors">&times;</button>
                  <div class="w-full flex flex-wrap items-end gap-3 pr-6">
                      <div class="flex-1 min-w-[250px] flex flex-col pb-0.5">
                        <label class="block text-[10px] font-bold text-emerald-500 mb-0.5">Action Effect</label>
                        <div class="flex flex-wrap items-center gap-2 w-full">
                            <select onchange="window.updatePayload(${gIdx}, ${pIdx}, 'type', this.value)" class="bg-slate-900 border border-slate-700 p-1.5 rounded text-emerald-400 font-bold flex-1 min-w-[150px] focus:outline-none focus:border-emerald-500">
                              ${typeOptions}
                            </select>
                            ${manifest.canInvert ? `
                            <label class="flex items-center gap-1.5 bg-indigo-950/40 border border-indigo-900/50 px-2 py-1.5 rounded cursor-pointer hover:bg-indigo-900/40 transition whitespace-nowrap" title="Swap Source and Target roles for this action.">
                                <input type="checkbox" ${payload.invertRoles ? 'checked' : ''} onchange="window.updatePayload(${gIdx}, ${pIdx}, 'invertRoles', this.checked)" class="accent-indigo-500 w-3 h-3" />
                                <span class="text-[9px] font-black text-indigo-400 uppercase tracking-wider">Invert Roles</span>
                            </label>` : ''}
                            ${manifest.canBeCost ? `
                            <label class="flex items-center gap-1.5 bg-rose-950/40 border border-rose-900/50 px-2 py-1.5 rounded cursor-pointer hover:bg-rose-900/40 transition whitespace-nowrap" title="Require this action to execute for the ability to resolve.">
                                <input type="checkbox" ${payload.isCost ? 'checked' : ''} onchange="window.updatePayload(${gIdx}, ${pIdx}, 'isCost', this.checked)" class="accent-rose-500 w-3 h-3" />
                                <span class="text-[9px] font-black text-rose-400 uppercase tracking-wider">Is Cost</span>
                            </label>` : ''}
                        </div>
                      </div>
                      ${showDuration ? `
                      <div class="w-32 pb-0.5">
                        <label class="block text-[10px] font-bold text-sky-400 mb-0.5">Duration</label>
                        <select onchange="window.updatePayload(${gIdx}, ${pIdx}, 'duration', this.value)" class="bg-slate-900 border border-slate-700 p-1.5 rounded text-sky-300 font-bold w-full focus:outline-none focus:border-sky-500">
                          <option value="INSTANT" ${payload.duration === 'INSTANT' ? 'selected' : ''}>Instant</option>
                          <option value="ACTION" ${payload.duration === 'ACTION' ? 'selected' : ''}>Action (Current Event)</option>
                          <option value="BRIEF" ${payload.duration === 'BRIEF' ? 'selected' : ''}>Brief (End of Turn)</option>
                          <option value="TEMPORARY" ${payload.duration === 'TEMPORARY' ? 'selected' : ''}>Temporary (End of Round)</option>
                          <option value="WHILE_ATTACHED" ${payload.duration === 'WHILE_ATTACHED' ? 'selected' : ''}>While Attached</option>
                          <option value="INDEFINITE" ${payload.duration === 'INDEFINITE' ? 'selected' : ''}>Indefinite (While on Board)</option>
                          <option value="PERMANENT" ${payload.duration === 'PERMANENT' ? 'selected' : ''}>Permanent (Across Zones)</option>
                        </select>
                      </div>
                      ` : ''}
                      ${basicParamsHtml}
                  </div>
                  ${fullWidthHtml}
              </div>
            `;
        }).join('');

        group.quickTargeting = group.quickTargeting || { zones: ['FIELD'], alignment: ['ENEMY'], entityType: ['UNIT', 'AVATAR'], ignoreBattlelines: false };

        return `
          <div class="flex flex-col gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-700 relative shadow-inner">
            <button type="button" onclick="window.removeEffectGroup(${gIdx})" class="absolute top-2 right-2 text-slate-500 hover:text-red-400 font-black px-1.5 bg-slate-950 rounded">&times; Remove Target Group</button>
            <div class="absolute top-2 right-40 flex gap-1">
                <button type="button" onclick="window.moveEffectGroup(${gIdx}, -1)" class="bg-slate-800 hover:bg-slate-700 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow ${gIdx === 0 ? 'opacity-30 cursor-not-allowed' : ''}">↑ Move Up</button>
                <button type="button" onclick="window.moveEffectGroup(${gIdx}, 1)" class="bg-slate-800 hover:bg-slate-700 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow ${gIdx === effectGroups.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}">↓ Move Down</button>
            </div>
            
            <div class="flex flex-col gap-2">
              <h4 class="text-[11px] font-black text-fuchsia-400 uppercase tracking-widest flex items-center gap-1">
                <span>🎯 Target Group ${gIdx + 1}</span>
              </h4>
              <div class="flex flex-wrap gap-2 w-full md:w-5/6">
                <select onchange="window.updateEffectGroup(${gIdx}, 'targetMethod', this.value)" class="bg-slate-950 border border-slate-700 p-1.5 rounded text-white flex-1 font-bold min-w-[200px]">
                  ${(function() {
                      const validTargets = getValidTargetMethods(baseTrigger, scope, actMethod);
                      if (!validTargets.includes(group.targetMethod)) {
                          group.targetMethod = validTargets.includes('SAME_AS_ACTIVATION') ? 'SAME_AS_ACTIVATION' : validTargets[0];
                      }
                      const labels = {
                          'SAME_AS_ACTIVATION': 'Run on Activated Target(s) / Event Trigger',
                          'EVENT_SOURCE': 'Run on Event Source (e.g. Attacker, Caster)',
                          'EVENT_TARGET': 'Run on Event Target (e.g. Defender, Victim)',
                          'SELF': 'Run on Self (Card with ability)',
                          'AVATAR': 'Run on Your Avatar',
                          'ENEMY_AVATAR': 'Run on Enemy Avatar',
                          'AUTO_ALL': 'Auto-Target ALL Valid Below',
                          'AUTO_RANDOM': 'Auto-Target N RANDOM Below',
                          'AUTO_FIRST': 'Auto-Target FIRST N Valid Below',
                          'AUTO_LAST': 'Auto-Target LAST N Valid Below'
                      };
                      return validTargets.map(t => `<option value="${t}" ${group.targetMethod === t ? 'selected' : ''}>${labels[t]}</option>`).join('');
                  })()}
                </select>
                ${['AUTO_RANDOM', 'AUTO_FIRST', 'AUTO_LAST'].includes(group.targetMethod) ? `<input type="number" value="${group.targetCount || 1}" onchange="window.updateEffectGroup(${gIdx}, 'targetCount', parseInt(this.value))" title="Number of targets (N)" class="bg-slate-950 border border-slate-700 p-1.5 rounded text-amber-300 font-bold w-16" />` : ''}
              </div>
              
              ${group.targetMethod.startsWith('AUTO_') ? `
              <div class="flex flex-col gap-2 mt-2">
                ${generateQuickMatrixHTML('effect', group.quickTargeting, gIdx)}
              </div>
              ` : ''}
              
              <div class="mt-2">
                 <button type="button" onclick="window.toggleAdvancedLogic('effect', ${gIdx})" class="text-[10px] font-bold text-slate-400 hover:text-fuchsia-400 flex items-center gap-1.5 transition-colors bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/50 w-max">
                   <span style="transform: rotate(${group.showAdvanced ? '90deg' : '0deg'});" class="transition-transform duration-200">▶</span>
                   <span>⚙️ Advanced Filters (Conditions & Scope)</span>
                 </button>
              </div>

              ${group.showAdvanced ? `
              <div class="flex flex-col gap-2 mt-2 pl-3 border-l-2 border-fuchsia-500/30">
                <label class="font-bold text-fuchsia-300 block mb-1 text-[9px]">Advanced Execution Conditions</label>
                <div class="flex flex-col gap-2 min-h-[40px]">
                  ${generateGroupHTML(`effect_${gIdx}`, group.logicTree || { type: 'group', logicalOperator: 'AND', children: [] }, [])}
                </div>
              </div>
              ` : ''}
            </div>

            <div class="mt-3 pl-3 md:pl-5 border-l-2 border-emerald-500/30 flex flex-col gap-3">
               <h5 class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center pr-2 border-b border-slate-800 pb-1">
                  <span>⚡ Executed Actions (${group.payloads.length})</span>
                  <button type="button" onclick="window.addPayload(${gIdx})" class="text-emerald-400 hover:text-emerald-300 transition-colors">+ Add Action</button>
               </h5>
               ${payloadsHtml}
               ${group.payloads.length === 0 ? `<div class="text-xs text-slate-500 italic">No actions defined for this target.</div>` : ''}
            </div>

          </div>
        `;
    }).join('');
}