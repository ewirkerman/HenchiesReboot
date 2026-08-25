/**
   * Henchies 2 Shared UI Rendering Components, Modals & Toast System
   * 5:7 Ratio Physical Card Layout, Lighter Bottom Area, Double-Click Inspection, Armor Badge.
   */

  import { fetchCustomTribes } from './firebase.js';
  import { generateAbilityDescription } from './language_description.js';

  export const TRIBE_STYLES = {
    Robot: { bg: 'bg-pink-900', lightBg: 'bg-pink-950/90', border: 'border-black', text: 'text-pink-300' },
    Mythic: { bg: 'bg-emerald-900', lightBg: 'bg-emerald-950/90', border: 'border-black', text: 'text-emerald-300' },
    Elemental: { bg: 'bg-orange-900', lightBg: 'bg-orange-950/90', border: 'border-black', text: 'text-orange-300' },
    Pirate: { bg: 'bg-amber-900', lightBg: 'bg-amber-950/90', border: 'border-black', text: 'text-amber-300' },
    Undead: { bg: 'bg-slate-800', lightBg: 'bg-slate-900/90', border: 'border-black', text: 'text-blue-300' },
    Carnie: { bg: 'bg-purple-900', lightBg: 'bg-purple-950/90', border: 'border-black', text: 'text-purple-300' },
    Viking: { bg: 'bg-cyan-900', lightBg: 'bg-cyan-950/90', border: 'border-black', text: 'text-cyan-300' },
    Ninja: { bg: 'bg-slate-900', lightBg: 'bg-slate-950/90', border: 'border-black', text: 'text-slate-300' },
    Stalker: { bg: 'bg-red-900', lightBg: 'bg-red-950/90', border: 'border-black', text: 'text-red-300' },
    Alien: { bg: 'bg-lime-900', lightBg: 'bg-lime-950/90', border: 'border-black', text: 'text-lime-300' },
    Luchador: { bg: 'bg-yellow-900', lightBg: 'bg-yellow-950/90', border: 'border-black', text: 'text-yellow-300' }
  };

  export const CARD_BASE_CLASSES = "w-[128px] h-[179px] sm:w-[144px] sm:h-[201px]";

  import { SVG_CLASS, SVG_EXHAUST, SVG_UNREADY, SVG_FREE, SVG_DAZED, SVG_STUNNED, SYSTEM_GLOSSARY, getSystemLineAbility, getIconSvg, getLineIconSvg } from './glossary.js';
  export { SVG_CLASS, SVG_EXHAUST, SVG_UNREADY, SVG_FREE, SVG_DAZED, SVG_STUNNED, SYSTEM_GLOSSARY, getSystemLineAbility, getIconSvg, getLineIconSvg };

  import '../components/game_card.js';
  import '../components/card_preview.js';

  if (typeof document !== 'undefined' && !document.getElementById('raw-svg-styles')) {
      const style = document.createElement('style');
      style.id = 'raw-svg-styles';
      style.innerHTML = `
          .raw-user-svg-container { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
          .raw-user-svg-container svg { width: 100% !important; height: 100% !important; display: block !important; opacity: 0.9 !important; }
          .raw-user-svg-container svg, .raw-user-svg-container svg * { fill: #ffffff !important; }
          .raw-user-svg-container svg [fill="none"] { fill: none !important; }
          .raw-user-svg-container svg [stroke]:not([stroke="none"]) { stroke: #ffffff !important; }
      `;
      document.head.appendChild(style);
  }

  export async function loadUI() {
      try {
          const tribes = await fetchCustomTribes();
          tribes.forEach(t => {
              TRIBE_STYLES[t.id] = {
                  bg: t.colorBgClass || 'bg-slate-900',
                  lightBg: t.colorLightBgClass || 'bg-slate-950/90',
                  border: t.colorBorderClass || 'border-black',
                  text: t.colorTextClass || 'text-slate-300',
                  hexBg: t.colorBgHex,
                  hexLightBg: t.colorLightBgHex,
                  hexBorder: t.colorBorderHex,
                  hexText: t.colorTextHex,
                  iconSvg: t.iconSvg,
                  bgImageUrl: t.bgImageUrl,
                  bgImageX: t.bgImageX,
                  bgImageY: t.bgImageY,
                  bgImageScale: t.bgImageScale,
                  name: t.name
              };
              if (t.name) TRIBE_STYLES[t.name] = TRIBE_STYLES[t.id];
          });
      } catch (e) {
          console.warn("Failed to load custom tribes into UI", e);
      }
  }

  export function formatAbilityCostBadge(cost, cardTribe) {
    if (!cost) return '';
    let badgeStr = '';
    const carnieCost = cost.carnie || cost.tent || 0;
    for (let i = 0; i < carnieCost; i++) {
      badgeStr += `<span class="inline-block w-[1.1em] h-[1.1em] align-middle -translate-y-[0.1em] ml-px text-purple-400 drop-shadow-sm">${getIconSvg('tent')}</span>`
    }
    if (cost.power > 0) badgeStr += `${cost.power}⚡`;
    if (cost.tribeAmount > 0) {
        const tType = cost.tribeType || cardTribe || 'Generic';
        if (tType && tType !== 'NONE' && tType !== 'Generic') {
            const style = TRIBE_STYLES[tType];
            if (style && style.iconSvg) {
                badgeStr += `${cost.tribeAmount}<span class="inline-block w-[1.1em] h-[1.1em] overflow-hidden align-middle -translate-y-[0.1em] ml-px mr-0.5"><div class="raw-user-svg-container w-full h-full">${style.iconSvg}</div></span>`;
            } else {
                const tribeName = style && style.name ? style.name : tType;
                badgeStr += `${cost.tribeAmount}${tribeName.charAt(0).toUpperCase()}`;
            }
        } else {
            badgeStr += `${cost.tribeAmount}💎`;
        }
    }
    
    if (cost.readinessCost === 'EXHAUSTS') badgeStr += SVG_EXHAUST;
    if (cost.readinessCost === 'UNREADIES') badgeStr += SVG_UNREADY;
    if (cost.freeAction) badgeStr += SVG_FREE;
    
    return badgeStr.trim() ? `<span class="text-[9px] text-amber-300 font-bold ml-1 tracking-tighter whitespace-nowrap opacity-90">${badgeStr}</span>` : '';
  }

  export const hasEngineFlag = (card, flag) => {
      if (!card) return false;
      if (card.passiveFlags && card.passiveFlags.includes(flag)) return true;
      if (card.abilities && card.abilities.some(a => a.passiveFlags && a.passiveFlags.includes(flag))) return true;
      if (card.activeEffects && card.activeEffects.some(e => e.type === flag)) return true;
      return false;
  };

  export function formatCardText(text) {
      if (!text) return '';
      let formatted = text;

      // 1. Markdown Bolding (Used by NLG Triggers)
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<span class="font-black text-amber-400 uppercase tracking-widest">$1</span>');

      // 2. Stat/Resource Token Placeholders -> SVGs
      const statMap = {
          'strength': getIconSvg('attack'),
          'health': getIconSvg('health'),
          'maxhealth': getIconSvg('health'),
          'power': getIconSvg('power'),
          'armor': getIconSvg('armor'),
          'acts': getIconSvg('fast'),
          'carnie': getIconSvg('tent'),
          'tent': getIconSvg('tent'),
          'readiness': getIconSvg('hourglass-full')
      };

      // Support [STAT:x], [RESOURCE:x], and [[RESOURCES:x]] syntax
      // Dynamically captures and colors preceding text based on context
      formatted = formatted.replace(/((?:(?:gain|lose|heal|deal|take|pay|recover|harvest)\s*)?[+-]?\s*\d*\s*)\[\[?(?:STAT|RESOURCE|RESOURCES):([a-zA-Z]+)\]\]?/gi, (match, prefix, p1) => {
          const key = p1.toLowerCase();
          const svg = statMap[key];
          
          let tokenColor = (key === 'carnie' || key === 'tent') ? 'text-purple-400' : 'text-amber-300';
          let prefixColor = 'text-slate-200';
          
          const lowerPrefix = prefix.toLowerCase();
          if (lowerPrefix.includes('+') || lowerPrefix.includes('gain') || lowerPrefix.includes('heal') || lowerPrefix.includes('recover') || lowerPrefix.includes('harvest')) {
              prefixColor = 'text-emerald-400';
          } else if (lowerPrefix.includes('-') || lowerPrefix.includes('lose') || lowerPrefix.includes('deal') || lowerPrefix.includes('take') || lowerPrefix.includes('pay')) {
              prefixColor = 'text-red-400';
          }

          let prefixHtml = prefix ? `<span class="${prefixColor} font-bold drop-shadow-sm">${prefix}</span>` : '';

          if (svg) {
              return `<span class="whitespace-nowrap">${prefixHtml}<span class="inline-block w-[1.1em] h-[1.1em] align-middle -translate-y-[0.1em] ml-0.5 ${tokenColor} drop-shadow-md">${svg}</span></span>`;
          }
          return `<span class="whitespace-nowrap">${prefixHtml}<span class="font-bold ${tokenColor} uppercase">${p1}</span></span>`;
      });

      // 3. Zone Token Placeholders
      formatted = formatted.replace(/((?:(?:move|return|shuffle|draw|discard|banish|trash)\s*)?(?:to|from|in|into)?\s*)\[ZONE:([a-zA-Z_]+)\]/gi, (match, prefix, p1) => {
          const line = p1.toLowerCase();
          const svg = getLineIconSvg(line);
          
          let prefixColor = 'text-slate-200';
          const lowerPrefix = prefix.toLowerCase();
          if (lowerPrefix.includes('move') || lowerPrefix.includes('return') || lowerPrefix.includes('draw')) {
              prefixColor = 'text-sky-400';
          } else if (lowerPrefix.includes('discard') || lowerPrefix.includes('banish') || lowerPrefix.includes('trash')) {
              prefixColor = 'text-red-400';
          } else if (lowerPrefix.includes('shuffle')) {
              prefixColor = 'text-fuchsia-400';
          }

          let prefixHtml = prefix ? `<span class="${prefixColor} font-bold drop-shadow-sm">${prefix}</span>` : '';

          if (svg) {
              return `<span class="whitespace-nowrap">${prefixHtml}<span class="inline-block w-[1.1em] h-[1.1em] align-middle -translate-y-[0.1em] ml-0.5 text-sky-300 drop-shadow-md">${svg}</span></span>`;
          }
          return `<span class="whitespace-nowrap">${prefixHtml}<span class="font-bold text-sky-300 uppercase">${p1.replace(/_/g, ' ')}</span></span>`;
      });
      
      // 4. Manual Glossary Links
      formatted = formatted.replace(/@\[(.*?)\]/g, '<span class="text-fuchsia-400 font-bold cursor-help border-b border-fuchsia-400/30" title="See Glossary: $1">$1</span>');

      return formatted;
  }

  export function renderCardHTML(card, options = {}) {
    const json = encodeURIComponent(JSON.stringify(card)).replace(/'/g, "%27");
    const instanceId = card.instanceId || card.id;
    let attrs = `card-data="${json}" data-instance-id="${instanceId}"`;
    if (options.isMicro) attrs += ` size="micro"`;
    else if (options.isNano) attrs += ` size="nano"`;
    if (options.isHand) attrs += ` is-hand="true"`;
    if (options.isSelected) attrs += ` is-selected="true"`;
    if (options.isTargetable) attrs += ` is-targetable="true"`;
    if (options.isCasting) attrs += ` is-casting="true"`;
    if (options.actionState) attrs += ` action-state="${options.actionState}"`;
    if (options.readiness !== undefined && options.readiness !== null) attrs += ` readiness="${options.readiness}"`;
    if (options.onClick) attrs += ` on-click="${options.onClick.replace(/"/g, '&quot;')}"`;
    if (options.onInspect) attrs += ` on-inspect="${options.onInspect.replace(/"/g, '&quot;')}"`;
    if (options.abilityUses) attrs += ` ability-uses="${encodeURIComponent(JSON.stringify(options.abilityUses))}"`;
    
    return `<game-card ${attrs}></game-card>`;
  }

  export function buildAbilitiesHTML(card, options, isInspectMode, allAbilitiesRegistry = []) {
      let abilitiesHTML = isInspectMode ? '<div class="flex flex-col gap-1 mt-1">' : '';
      let displayAbilities = card.abilities ? [...card.abilities] : [];
      const isUnit = card.type === 'unit' || card.type === 'avatar';
      const isAvatar = card.type === 'avatar';
      const defLine = card.defaultLine || 'mid';
      
      if (isUnit && !isAvatar && defLine !== 'mid') {
          if (isInspectMode) {
              const lineAb = getSystemLineAbility(defLine);
              if (lineAb) displayAbilities.push(lineAb);
          } else {
              displayAbilities.push({
                  abilityId: 'sys_line_' + defLine,
                  name: defLine.charAt(0).toUpperCase() + defLine.slice(1) + ' Line',
                  trigger: 'UNTRIGGERABLE',
                  isKeyword: true,
                  cost: {}
              });
          }
      }
      
      if (displayAbilities.length === 0) return '';
      
      const evergreen = [];
      const bespoke = [];
      const active = [];

      displayAbilities.forEach(a => {
          const ab = isInspectMode ? (allAbilitiesRegistry.find(reg => reg.abilityId === a.abilityId) || a) : a;
          const isKeyword = ab.isKeyword || (ab.trigger === 'UNTRIGGERABLE' && (!ab.effects || ab.effects.length === 0 || ab.passiveFlags?.length > 0));
          if (isKeyword) {
              evergreen.push(ab);
          } else if (ab.trigger === 'MANUAL') {
              active.push(ab);
          } else {
              bespoke.push(ab);
          }
      });

      if (evergreen.length > 0) {
          const namesHtml = evergreen.map(a => {
              const costBadge = formatAbilityCostBadge(a.cost, card.tribe);
              return a.name + (costBadge ? ' ' + costBadge : '');
          }).join(', ');
          
          if (isInspectMode) {
              abilitiesHTML += `<div class="text-sm sm:text-base font-black text-amber-300 text-center leading-tight mb-2 drop-shadow-md">${namesHtml}</div>`;
          } else {
              const tooltips = evergreen.map(a => {
                  let rawDesc = a.displayDescription || a.description || '';
                  if (!rawDesc) {
                      try { rawDesc = generateAbilityDescription(a); } catch (e) {}
                  }
                  return `${a.name}: ${rawDesc || 'System Keyword'}`;
              }).join('\n\n');
              abilitiesHTML += `<div class="text-[10px] sm:text-[11px] font-black text-amber-300 text-center leading-tight cursor-help drop-shadow-md" title="${tooltips.replace(/"/g, '&quot;')}">${namesHtml}</div>`;
          }
      }

      if (bespoke.length > 0) {
          bespoke.forEach(ab => {
              let rawDesc = ab.displayDescription || ab.description || '';
              if (!rawDesc) {
                  try { rawDesc = generateAbilityDescription(ab, allAbilitiesRegistry); } catch (e) {}
              }
              if (!rawDesc && ab.name) rawDesc = `**${ab.name}**`;
              let desc = rawDesc;
              
              const costBadge = formatAbilityCostBadge(ab.cost, card.tribe);
              const hasCost = costBadge && costBadge.trim() !== '';
              
              if (hasCost) {
                  const triggerMatch = desc.match(/^(\*\*[^*]+?):\*\*\s*(.*)/);
                  if (triggerMatch) {
                      desc = `${triggerMatch[1]} ${costBadge}:** ${triggerMatch[2]}`;
                  } else {
                      desc = `**${ab.name} ${costBadge}:** ${desc}`;
                  }
              }
              
              const formatted = formatCardText(desc);
              
              if (isInspectMode) {
                  abilitiesHTML += `<div class="bg-black/40 backdrop-blur-sm p-2 rounded-lg border border-white/10 shadow-sm text-sm sm:text-base text-slate-200 text-center leading-snug px-2">${formatted}</div>`;
              } else {
                  abilitiesHTML += `<div class="text-[9px] text-slate-200 font-bold leading-tight text-center w-full">${formatted}</div>`;
              }
          });
      }

      if (active.length > 0) {
          active.forEach(ab => {
              let rawDesc = ab.displayDescription || ab.description || '';
              if (!rawDesc) {
                  try { rawDesc = generateAbilityDescription(ab, allAbilitiesRegistry); } catch (e) {}
              }
              let desc = rawDesc;
              
              if (isInspectMode) {
                  const abName = ab.name || ab.abilityId;
                  if (abName && desc.startsWith(abName)) {
                      desc = desc.substring(abName.length).trim();
                      if (desc.startsWith(':') || desc.startsWith('-')) desc = desc.substring(1).trim();
                  }
              }
              const formatted = formatCardText(desc);
              
              const abilityKey = `${card.instanceId}_${ab.abilityId}`;
              const uses = (options.abilityUses || {})[abilityKey] || 0;
              let isUsable = true;
              let showHourglass = false;
              
              if (ab.triggerLimit === 'ONCE_PER_ROUND' && uses >= 1) { isUsable = false; showHourglass = true; }
              if (ab.triggerLimit === 'TWICE_PER_ROUND' && uses >= 2) { isUsable = false; showHourglass = true; }

              const isAttack = ab.effects && ab.effects.some(g => g.payloads && g.payloads.some(p => p.type === 'ATTACK'));

              if (!options.isHand && card.readiness !== undefined) {
                  const checkBlock = (flag) => {
                      if (!hasEngineFlag(card, flag)) return null;
                      if (card.passiveFlags?.includes(flag)) return 'permanent';
                      if (card.abilities?.some(a => a.passiveFlags?.includes(flag))) return 'permanent';
                      const effect = card.activeEffects?.find(e => e.type === flag);
                      if (effect && ['INDEFINITE', 'PERMANENT', 'WHILE_ATTACHED', 'INSTANT'].includes(effect.duration)) return 'permanent';
                      return 'temporary';
                  };

                  const actBlock = checkBlock('BLOCK_ACT');
                  const attackBlock = checkBlock('BLOCK_ATTACK');

                  if (isAttack && attackBlock) {
                      isUsable = false;
                      if (attackBlock === 'temporary') showHourglass = true;
                  }
                  if (!isAttack && actBlock) {
                      isUsable = false;
                      if (actBlock === 'temporary') showHourglass = true;
                  }
                  
                  if (isUsable) {
                      const cost = ab.cost || {};
                      if (!cost.freeAction && !isAttack && (card.acts === undefined || card.acts < 1)) {
                          isUsable = false;
                          showHourglass = true;
                      }
                  }
              }

              if (options.isHand || card.readiness === undefined) {
                  isUsable = true;
                  showHourglass = false;
              }

              if (isInspectMode) {
                  const iconContent = isAttack ? `<span class="inline-block w-4 h-4 align-middle mr-1">${getIconSvg('attack')}</span>` : '';
                  const hourglassIcon = (!isUsable && showHourglass) ? `<span class="inline-block w-4 h-4 align-middle mr-1 text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.8)]">${getIconSvg('hourglass-full')}</span>` : '';
                  
                  const nameColorClass = isUsable ? 'text-amber-400' : 'text-slate-500';
                  const textColorClass = isUsable ? 'text-slate-200' : 'text-slate-500 opacity-80';

                  const nameContent = `<span class="font-black ${nameColorClass} drop-shadow-sm">${hourglassIcon}${iconContent}</span>`;
                  const costBadge = formatAbilityCostBadge(ab.cost, card.tribe);
                  
                  abilitiesHTML += `
                  <div class="bg-black/40 backdrop-blur-sm p-2.5 rounded-lg border border-white/10 shadow-md text-sm sm:text-base flex flex-col gap-0.5 items-center">
                      <div class="flex items-center gap-2">${nameContent}${costBadge}</div>
                      <div class="${textColorClass} text-center leading-snug px-1">${formatted}</div>
                  </div>`;
              } else {
                  const iconContent = isAttack ? `<span class="inline-block w-2.5 h-2.5 align-middle mr-0.5">${getIconSvg('attack')}</span>` : '';
                  const hourglassIcon = (!isUsable && showHourglass) ? `<span class="inline-block w-2.5 h-2.5 align-middle mr-0.5 text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.8)]">${getIconSvg('hourglass-full')}</span>` : '';
                  
                  const textColorClass = isUsable ? 'text-slate-200' : 'text-slate-500 opacity-80';
                  let rawDesc = ab.displayDescription || ab.description || '';
                  if (!rawDesc) {
                      try { rawDesc = generateAbilityDescription(ab); } catch (e) {}
                  }
                  const safeTooltip = rawDesc.replace(/"/g, '&quot;');
                  
                  abilitiesHTML += `
                    <div class="text-[9px] ${textColorClass} font-bold leading-tight w-full cursor-help bg-black/20 rounded py-0.5 border border-white/5 flex justify-center items-center px-1" title="${safeTooltip}">
                      <div class="flex items-center gap-0.5 truncate pr-1">
                          ${hourglassIcon}${iconContent}
                          <span class="truncate">${ab.name || 'Action'}</span>
                      </div>
                      <div class="shrink-0 flex items-center">
                          ${formatAbilityCostBadge(ab.cost, card.tribe)}
                      </div>
                    </div>
                  `;
              }
          });
      }
      
      if (isInspectMode) {
          abilitiesHTML += '</div>';
      }
      
      return abilitiesHTML;
  }

  export function extractGlossary(baseAbilities, allAbilitiesRegistry, cardText = '') {
      if (!allAbilitiesRegistry || allAbilitiesRegistry.length === 0) return [];
      
      let glossaryMap = new Map();
      let systemMap = new Map();
      let baseIds = new Set((baseAbilities || []).map(a => a.abilityId));

      if (baseAbilities) {
          baseAbilities.forEach(a => {
              // Automatically extract Evergreen Keywords into the Glossary, even if they aren't explicitly mentioned in text!
              if (a.isKeyword || a.trigger === 'UNTRIGGERABLE') {
                  if (!glossaryMap.has(a.abilityId) && a.name) {
                      glossaryMap.set(a.abilityId, a);
                  }
              }
          });
      }

      function processAbility(current) {
          if (!current) return;
          let text = (current.displayDescription || current.description || '');
          if (!text) {
              try { text = generateAbilityDescription(current, allAbilitiesRegistry); } catch (e) {}
          }

          const mentionRegex = /@\[(.*?)\]/g;
          let match;
          while ((match = mentionRegex.exec(text)) !== null) {
              const matchedName = match[1];
              const found = allAbilitiesRegistry.find(a => a.name.toLowerCase() === matchedName.toLowerCase());
              if (found && !glossaryMap.has(found.abilityId) && !baseIds.has(found.abilityId)) {
                  glossaryMap.set(found.abilityId, found);
                  processAbility(found);
              }
          }

          // Find deeply nested GRANT_ABILITY effects
          if (current.effects) {
              current.effects.forEach(group => {
                  if (group.payloads) {
                      group.payloads.forEach(eff => {
                          if (eff.type === 'GRANT_ABILITY') {
                              const found = allAbilitiesRegistry.find(a => a.abilityId === eff.grantedAbilityId || a.name === eff.grantedAbilityId);
                              if (found && !glossaryMap.has(found.abilityId) && !baseIds.has(found.abilityId)) {
                                  glossaryMap.set(found.abilityId, found);
                                  processAbility(found);
                              }
                          }
                          if (eff.nestedGroup && eff.nestedGroup.payloads) {
                              eff.nestedGroup.payloads.forEach(neff => {
                                  if (neff.type === 'GRANT_ABILITY') {
                                      const found = allAbilitiesRegistry.find(a => a.abilityId === neff.grantedAbilityId || a.name === neff.grantedAbilityId);
                                      if (found && !glossaryMap.has(found.abilityId) && !baseIds.has(found.abilityId)) {
                                          glossaryMap.set(found.abilityId, found);
                                          processAbility(found);
                                      }
                                  }
                              });
                          }
                      });
                  }
              });
          }

          SYSTEM_GLOSSARY.forEach(sys => {
              if (!systemMap.has(sys.id) && sys.regex.test(text)) {
                  systemMap.set(sys.id, sys);
              }
          });
      }

      if (baseAbilities) {
          baseAbilities.forEach(a => processAbility(a));
      }
      if (cardText) {
          processAbility({ displayDescription: cardText, abilityId: 'card_text_dummy' });
      }

      return [...Array.from(glossaryMap.values()), ...Array.from(systemMap.values())];
  }

  export function openInspectionModal(cardOrUnit, allAbilitiesRegistry = [], isNested = false, abilityUses = {}, isHand = false) {
    if (!window._inspectHistory) window._inspectHistory = [];
    if (!isNested) window._inspectHistory = [];
    
    const currentRef = cardOrUnit.instanceId || cardOrUnit.id || cardOrUnit.name;
    const lastInHistory = window._inspectHistory.length > 0 ? window._inspectHistory[window._inspectHistory.length - 1] : null;
    const lastRef = lastInHistory ? (lastInHistory.card.instanceId || lastInHistory.card.id || lastInHistory.card.name) : null;
    
    if (currentRef !== lastRef) {
        window._inspectHistory.push({ card: cardOrUnit, registry: allAbilitiesRegistry });
    }

    let modal = document.getElementById('inspection-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'inspection-modal';
      modal.className = 'fixed inset-0 z-[100] bg-black/20 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none';
      
      const handleBack = () => {
        if (window._inspectHistory && window._inspectHistory.length > 1) {
          window._inspectHistory.pop();
          const prev = window._inspectHistory[window._inspectHistory.length - 1];
          openInspectionModal(prev.card, prev.registry, true, abilityUses, isHand);
        } else {
          modal.classList.add('hidden');
          window._inspectHistory = [];
        }
      };

      window._handleModalBack = handleBack;
      modal.onclick = (e) => { if (e.target === modal) handleBack(); };
      modal.oncontextmenu = (e) => { if (e.target === modal) { e.preventDefault(); handleBack(); } };
      
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
          handleBack();
        }
      });
      
      document.body.appendChild(modal);
    }

    window.closeInspectionModal = () => {
      window._inspectHistory = [];
      const m = document.getElementById('inspection-modal');
      if (m) m.classList.add('hidden');
    };

    window._toggleGlossaryMode = () => {
      const chk = document.getElementById('glossary-toggle-chk');
      const newMode = chk.checked ? 'full' : 'essentials';
      localStorage.setItem('henchies_glossary_mode', newMode);
      
      const items = document.querySelectorAll('.glossary-item');
      items.forEach(el => {
          if (el.dataset.isSystem === 'true') {
              el.style.display = newMode === 'essentials' ? 'none' : 'flex';
          }
      });
    };

    window.inspectNestedCard = (cardJson) => {
      const card = JSON.parse(decodeURIComponent(cardJson));
      const currentRegistry = window._inspectHistory.length > 0 ? window._inspectHistory[window._inspectHistory.length - 1].registry : [];
      openInspectionModal(card, currentRegistry, true);
    };

    const isUnit = cardOrUnit.type === 'unit' || cardOrUnit.type === 'avatar' || cardOrUnit.currentHealth !== undefined;
    const isAvatar = cardOrUnit.type === 'avatar';
    const isToken = !!cardOrUnit.isToken;
    const style = TRIBE_STYLES[cardOrUnit.tribe] || TRIBE_STYLES.Mythic;
    
    const hexBg = style.hexBg ? `background-color: ${style.hexBg};` : '';
    const hexLightBg = style.hexLightBg ? `background-color: ${style.hexLightBg};` : '';
    const hexBorder = style.hexBorder ? `border-color: ${style.hexBorder};` : '';

    const activeLine = cardOrUnit.line || cardOrUnit.defaultLine || (isAvatar ? 'avatar' : 'mid');
    const isTempLine = cardOrUnit.line && cardOrUnit.defaultLine && cardOrUnit.line !== cardOrUnit.defaultLine;
    const hasReadiness = isUnit || cardOrUnit.type === 'equipment' || cardOrUnit.type === 'artifact';

    const hasStrength = cardOrUnit.strength !== undefined && cardOrUnit.strength !== null;
    const defaultHealth = isAvatar ? 20 : (isUnit ? 1 : null);
    const displayHealth = cardOrUnit.currentHealth ?? cardOrUnit.health ?? defaultHealth;
    const showHealth = displayHealth !== null;
    const hasArmor = cardOrUnit.armor && cardOrUnit.armor > 0;
    
    const isHidden = hasEngineFlag(cardOrUnit, 'BLOCK_TARGETING');

    let inspectBorderClass = isToken ? 'border-white/50 shadow-[0_0_24px_rgba(255,255,255,0.25)]' : style.border;
    let inspectBorderStyle = isToken ? '' : hexBorder;
    if (isHidden && !isHand) {
        inspectBorderClass = 'border-dashed border-white/80 shadow-[0_0_15px_rgba(255,255,255,0.4)]';
        inspectBorderStyle = '';
    }
    
    const separatorClass = isToken ? 'border-white/40' : 'border-black';
    
    // Extract Glossary
    const glossaryAbilities = extractGlossary(cardOrUnit.abilities || [], allAbilitiesRegistry, cardOrUnit.description);

    const cardArtUrl = cardOrUnit.artUrl;
    const bgArtUrl = style.bgImageUrl;

    const bgTransX = style.bgImageX ?? 0;
    const bgTransY = style.bgImageY ?? 0;
    const bgScale = style.bgImageScale ?? 100;
    const bgArtStyle = `object-position: center; transform: translate(${bgTransX}px, ${bgTransY}px) scale(${bgScale / 100});`;

    let transX = cardOrUnit.artX ?? 0;
    let transY = cardOrUnit.artY ?? 0;
    let scale = cardOrUnit.artScale ?? 100;
    const artStyle = `object-position: center; transform: translate(${transX}px, ${transY}px) scale(${scale / 100});`;

    modal.innerHTML = `
      <!-- Close Button (Fixed Top Right) -->
      <button 
        onclick="window.closeInspectionModal()"
        class="fixed top-4 right-4 sm:top-6 sm:right-6 text-slate-400 hover:text-white text-xl font-bold w-10 h-10 rounded-full bg-slate-900/80 backdrop-blur flex items-center justify-center border border-slate-700 z-[60] shadow-2xl transition-transform hover:scale-110 pointer-events-auto"
      >✕</button>

      <div class="w-full h-full max-w-[1400px] text-slate-100 flex flex-col md:flex-row items-center justify-center gap-8 pointer-events-none mx-auto" onclick="if(event.target === this) window._handleModalBack()">
        
        <!-- LEFT SPACER (Forces card to perfect center) -->
        <div class="hidden md:block md:w-[350px] shrink-0 pointer-events-none" onclick="if(event.target === this) window._handleModalBack()"></div>

        <!-- CENTER: The Giant 5x7 Card Layout -->
        <div class="flex items-center justify-center pointer-events-auto shrink-0">
          <div class="relative h-[75vh] min-h-[450px] max-h-[750px] aspect-[5/7] rounded-2xl overflow-hidden border-4 ${inspectBorderClass} shadow-2xl flex flex-col shrink-0 ${style.bg} transition-transform duration-300" style="${hexBg} ${inspectBorderStyle}">
            
            <!-- Top Section: Art & Cost (60%) -->
            <div class="relative w-full h-[60%] bg-slate-900 border-b-2 ${separatorClass} shrink-0 overflow-hidden flex items-center justify-center">
              ${bgArtUrl ? `<img src="${bgArtUrl}" class="absolute inset-0 w-full h-full object-cover object-center z-0 opacity-60 mix-blend-overlay" style="${bgArtStyle}" draggable="false" />` : ''}
              ${cardArtUrl ? `<img src="${cardArtUrl}" alt="${cardOrUnit.name}" class="w-full h-full object-contain relative z-10" style="${artStyle}" draggable="false" />` : `
                <div class="relative z-10 w-full h-full bg-slate-800/60 flex items-center justify-center text-slate-400 text-6xl font-bold">
                  ${cardOrUnit.type === 'unit' ? '⚔️' : cardOrUnit.type === 'avatar' ? '👑' : cardOrUnit.type === 'boon' ? '✨' : cardOrUnit.type === 'buff' ? '🛡️' : '📜'}
                </div>
              `}
              
              <div class="absolute bottom-2 left-1/2 -translate-x-1/2 w-[90%] flex justify-center z-30 pointer-events-none">
                <div class="bg-black/20 backdrop-blur-sm text-white text-xl sm:text-2xl font-black px-4 py-1 rounded-full truncate text-center max-w-full shadow-[0_4px_8px_rgba(0,0,0,0.8)] leading-tight uppercase tracking-wide border-none">
                    ${cardOrUnit.name}
                </div>
              </div>

              <div class="absolute top-3 left-3 flex flex-col items-center gap-2 z-10">
                ${!isAvatar ? `
                  <div class="w-12 h-12 rounded-full bg-amber-500 text-black font-black text-2xl flex items-center justify-center border-2 border-black shadow-lg" title="Cost">
                    ${cardOrUnit.cost ?? 0}
                  </div>
                ` : ''}
                ${cardOrUnit.power > 0 ? `
                  <div class="w-12 h-12 rounded-full bg-purple-600 text-white font-black text-2xl flex items-center justify-center border-2 border-black shadow-lg" title="Power">
                    ${cardOrUnit.power}
                  </div>
                ` : ''}
                ${isUnit ? `
                  <div class="w-8 h-8 flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isTempLine ? 'text-green-300 drop-shadow-[0_0_8px_rgba(134,239,172,0.9)]' : 'text-white'}" title="${isTempLine ? 'Temporary Line: ' : 'Line: '}${activeLine.charAt(0).toUpperCase() + activeLine.slice(1)}">
                    ${getLineIconSvg(activeLine)}
                  </div>
                ` : ''}
                ${(cardOrUnit.fast > 0) ? `
                  <div class="w-8 h-8 rounded-full bg-yellow-400 text-black font-black text-sm flex items-center justify-center border-2 border-black shadow-lg mt-1" title="Fast Charges">
                    <div class="w-4 h-4 mr-0.5">${getIconSvg('fast')}</div>${cardOrUnit.fast}
                  </div>
                ` : ''}
              </div>

              ${(hasReadiness && cardOrUnit.readiness !== undefined && cardOrUnit.readiness !== null) ? `
                <div class="absolute top-3 right-3 text-sm px-2.5 py-1 rounded-md font-black uppercase tracking-wider z-20 border-2 border-black shadow-lg ${
                  cardOrUnit.readiness >= 1 ? 'bg-emerald-500 text-black' : 
                  cardOrUnit.readiness === 0 ? 'bg-yellow-500 text-black' : 'bg-red-950 text-red-400 border-red-700'
                }">
                  ${cardOrUnit.readiness > 1 ? 'OVER-READY' : cardOrUnit.readiness === 1 ? 'READY' : cardOrUnit.readiness === 0 ? 'UNREADY' : 'EXHAUSTED'}
                </div>
              ` : ''}
            </div>

            <!-- Bottom Section: Details & Abilities (40%) -->
            <div class="w-full h-[40%] ${style.lightBg} p-2 sm:p-3 flex flex-col relative overflow-hidden" style="${hexLightBg}">
              ${isToken ? '<div class="absolute inset-0 bg-white/5 pointer-events-none"></div>' : ''}
              
              <!-- Type Band -->
              <div class="flex justify-center pb-1 shrink-0 mb-1 z-10 pointer-events-none relative">
                <div class="text-[10px] font-bold text-slate-200 capitalize tracking-wider bg-black/40 px-3 py-0.5 rounded-full shadow-inner">
                  ${style.name || cardOrUnit.tribe} • ${cardOrUnit.type}${cardOrUnit.genus ? ` • ${cardOrUnit.genus}` : ''}${cardOrUnit.family ? ` • ${cardOrUnit.family}` : ''}
                </div>
              </div>

              <!-- Scrollable Traits & Abilities Box -->
              <div class="flex-1 flex flex-col gap-1.5 overflow-y-auto pb-16 minimal-scrollbar pr-1 pointer-events-auto relative z-10">

                <!-- Attachments -->
                ${cardOrUnit.attachments && cardOrUnit.attachments.length > 0 ? `
                  <div class="flex flex-wrap justify-center gap-1.5 mt-1">
                    ${cardOrUnit.attachments.map(a => {
                      const aJson = encodeURIComponent(JSON.stringify(a)).replace(/'/g, "%27");
                      let rBadge = '';
                      if (a.readiness !== undefined && a.readiness < 1) {
                          rBadge = a.readiness < 0 ? '<span class="text-red-400 ml-1 drop-shadow-md">[EXH]</span>' : '<span class="text-yellow-400 ml-1 drop-shadow-md">[UNRDY]</span>';
                      }
                      return `<span oncontextmenu="event.preventDefault(); event.stopPropagation(); window.inspectNestedCard('${aJson}')" onclick="event.stopPropagation(); window.inspectNestedCard('${aJson}')" class="text-xs sm:text-sm bg-fuchsia-950/80 text-fuchsia-200 px-2 py-1 rounded border border-fuchsia-800 font-extrabold uppercase tracking-wider shadow-sm cursor-pointer hover:bg-fuchsia-900 transition-colors flex items-center" title="Inspect ${a.name}"><div class="w-3.5 h-3.5 mr-1">${getIconSvg('attach')}</div> ${a.name}${rBadge}</span>`;
                    }).join('')}
                  </div>
                ` : ''}

                <!-- Full Abilities with Registry Lookup -->
                ${buildAbilitiesHTML(cardOrUnit, { abilityUses, isHand }, true, allAbilitiesRegistry)}

              </div>

              <!-- Combined Footer (Stats & Flavor Text) Anchored to Extreme Bottom -->
              <div class="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none z-20">
                
                <!-- Left: Strength -->
                ${hasStrength ? `
                  <div class="w-12 h-12 rounded-full bg-yellow-500 border-2 border-black text-black font-black text-xl flex items-center justify-center shadow-xl pointer-events-auto shrink-0" title="Strength">${Math.max(0, cardOrUnit.strength)}</div>
                ` : '<div class="w-12 h-12 shrink-0"></div>'}
                
                <!-- Center: Armor & Flavor Text -->
                <div class="flex-1 flex flex-col items-center justify-end pb-1 px-1 gap-1 pointer-events-none">
                  ${hasArmor ? `
                    <div class="w-10 h-10 rounded bg-cyan-600 border-2 border-black text-white font-black text-base flex items-center justify-center shadow-xl pointer-events-auto shrink-0" title="Armor: ${cardOrUnit.armor}"><div class="w-4 h-4 mr-0.5">${getIconSvg('armor')}</div>${cardOrUnit.armor}</div>
                  ` : ''}
                  ${cardOrUnit.description ? `
                    <div class="text-xs sm:text-sm italic text-slate-300 text-center leading-snug w-full opacity-90 drop-shadow-md">
                      "${cardOrUnit.description}"
                    </div>
                  ` : ''}
                </div>
                
                <!-- Right: Health -->
                ${showHealth ? `
                  <div class="w-12 h-12 rounded-full bg-red-600 border-2 border-black text-white font-black text-xl flex items-center justify-center shadow-xl pointer-events-auto shrink-0" title="Health">${displayHealth}</div>
                ` : '<div class="w-12 h-12 shrink-0"></div>'}
              </div>

            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Recursive Glossary Bubbles -->
        <div class="w-full md:w-[350px] flex flex-col h-[75vh] min-h-[450px] max-h-[750px] pointer-events-auto shrink-0" onclick="if(event.target === this) window._handleModalBack()">
          
          <!-- Fixed Sticky Header -->
          <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-700/50 shrink-0">
             <span class="text-xs font-black text-slate-400 uppercase tracking-widest">Glossary</span>
             <label class="relative inline-flex items-center cursor-pointer" title="Toggle System Definitions">
               <input type="checkbox" id="glossary-toggle-chk" onchange="window._toggleGlossaryMode()" class="sr-only peer" ${localStorage.getItem('henchies_glossary_mode') !== 'essentials' ? 'checked' : ''}>
               <div class="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
               <span id="glossary-toggle-label" class="ml-2 text-[10px] font-bold text-slate-300 whitespace-nowrap">Full Glossary</span>
             </label>
          </div>
          
          <!-- Scrollable Items List -->
          <div class="flex-1 overflow-y-auto minimal-scrollbar pr-2 pb-8" onclick="if(event.target === this) window._handleModalBack()">
            ${glossaryAbilities.length > 0 ? `
              <div class="flex flex-col gap-3">
                ${glossaryAbilities.map(a => {
                  const isSystem = a.id && a.id.startsWith('sys_');
                  const displayStyle = localStorage.getItem('henchies_glossary_mode') === 'essentials' && isSystem ? 'none' : 'flex';
                  let rawDesc = a.displayDescription || a.description || '';
                  if (!rawDesc) {
                      try { rawDesc = generateAbilityDescription(a, allAbilitiesRegistry); } catch (e) {}
                  }
                  return `
                  <div class="glossary-item bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-2xl flex-col gap-1.5 transform transition-transform hover:scale-[1.02]" data-is-system="${isSystem}" style="display: ${displayStyle};">
                    <div class="flex justify-between items-center border-b border-slate-700/50 pb-1.5">
                        <div class="font-black text-fuchsia-300 text-sm drop-shadow-md">${a.name || a.abilityId || a.id}</div>
                        <span class="text-[9px] bg-slate-950 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-bold uppercase tracking-wider">${a.trigger || 'MANUAL'}</span>
                    </div>
                    <div class="text-slate-200 text-xs leading-snug">${rawDesc || 'No details.'}</div>
                  </div>
                `}).join('')}
              </div>
            ` : ''}
          </div>
        </div>

      </div>
    `;
    modal.classList.remove('hidden');
  }

  export function renderHistorySlider(container, historyLog, currentStep, onStepChange, label = "Replay Scrub:") {
    if (!container) return;

    container.innerHTML = `
      <div class="flex items-center gap-3 bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2 shadow-xl backdrop-blur-md">
        <span class="text-xs font-black text-amber-400 uppercase tracking-wider">${label}</span>
        <input 
          type="range" 
          min="0" 
          max="${Math.max(0, historyLog.length - 1)}" 
          value="${currentStep}" 
          onchange="${onStepChange}(this.value)"
          class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
        <span class="text-xs text-slate-300 font-mono font-bold whitespace-nowrap">${currentStep} / ${Math.max(0, historyLog.length - 1)}</span>
      </div>
    `;
  }

  export function renderJSONPreview(containerId, jsonObject, copyCallbackName, title = "Data Structure Preview") {
      const container = document.getElementById(containerId);
      if (!container) return;
      
      container.innerHTML = `
        <div class="glass-panel rounded-2xl p-4 flex flex-col gap-2 shadow-2xl border border-slate-800 w-full h-full relative flex-1">
          <div class="flex justify-between items-center border-b border-slate-800 pb-1 shrink-0">
            <h2 class="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              ${title}
            </h2>
            <button type="button" onclick="window.${copyCallbackName}()" class="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded transition shadow font-bold border border-slate-600">
              📋 Copy JSON
            </button>
          </div>
          <div class="flex-1 w-full overflow-y-auto minimal-scrollbar bg-slate-950/80 rounded-lg border border-slate-900 shadow-inner p-3 relative">
              <pre id="${containerId}-pre" class="text-[10px] text-cyan-400 font-mono m-0 leading-tight w-full break-all whitespace-pre-wrap selection:bg-cyan-900/50">${JSON.stringify(jsonObject, null, 2)}</pre>
          </div>
        </div>
      `;
  }

  export function openJSONImportModal(onImport) {
    let modal = document.getElementById('json-import-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'json-import-modal';
      modal.className = 'fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4';
      document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
      <div class="glass-panel rounded-2xl p-6 shadow-2xl border border-slate-700 max-w-lg w-full flex flex-col gap-4 relative">
        <div class="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 class="text-lg font-black text-emerald-400 uppercase tracking-wider">📥 Import JSON</h3>
          <button onclick="document.getElementById('json-import-modal').classList.add('hidden')" class="text-slate-400 hover:text-white font-bold text-xl leading-none">&times;</button>
        </div>
        <p class="text-xs text-slate-400">Paste your JSON data below to import it into the editor. It will be loaded as an unsaved draft.</p>
        <textarea id="import-json-textarea" rows="10" class="bg-slate-900 border border-slate-700 p-2 rounded text-emerald-300 font-mono text-[10px] w-full focus:outline-none focus:border-emerald-500 custom-scrollbar" placeholder="{...}"></textarea>
        <div class="flex justify-end gap-3 mt-2">
          <button onclick="document.getElementById('json-import-modal').classList.add('hidden')" class="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2 rounded transition">Cancel</button>
          <button id="confirm-import-btn" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded shadow transition">Import Data</button>
        </div>
      </div>
    `;
    modal.classList.remove('hidden');

    document.getElementById('confirm-import-btn').onclick = () => {
      const val = document.getElementById('import-json-textarea').value;
      try {
        const parsed = JSON.parse(val);
        onImport(parsed);
        modal.classList.add('hidden');
      } catch (e) {
        showToast('Invalid JSON format', 'error');
      }
    };
  }

  export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container') || document.body;
    const toast = document.createElement('div');
    const bgColors = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-red-600 text-white',
      info: 'bg-cyan-600 text-white',
      warning: 'bg-amber-600 text-black'
    };
    const colorClass = bgColors[type] || bgColors.info;
    toast.className = `${colorClass} px-4 py-2 rounded-xl shadow-2xl text-xs font-bold pointer-events-auto transition-all duration-300 z-[100]`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }