export const CARD_THEME = {
    // Layout Wrappers
    standardWrapper: "group relative flex-shrink-0 rounded-xl cursor-pointer transition-all duration-200 flex flex-col select-none overflow-hidden",
    jumboWrapper: "w-[280px] sm:w-[360px] md:w-[420px] relative aspect-[5/7] rounded-2xl overflow-hidden shadow-2xl flex flex-col shrink-0 transition-transform duration-300",
    
    // Core Layout Sections
    artSection: "w-full border-b-2 relative overflow-hidden flex items-center justify-center",
    textSection: "w-full flex flex-col relative overflow-hidden",
    bgArtImage: "absolute inset-0 w-full h-full object-cover object-center z-0 opacity-50 pointer-events-none",
    bgArtMute: "absolute inset-0 bg-slate-950/50 z-0 pointer-events-none",
    
    // Floating Name Badge (Standard/Nano/Jumbo)
    nameWrapper: "absolute flex justify-center z-30 pointer-events-none w-[90%] left-1/2 -translate-x-1/2",
    nameBadge: "bg-black/20 backdrop-blur-sm text-white font-black rounded-full truncate text-center max-w-full shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-tight uppercase tracking-wide border-none",
    
    // Corner Badges (Standard/Nano)
    cornerCost: "rounded-br-lg bg-amber-500 text-black font-black flex items-start justify-start border-r-2 border-b-2 border-black shadow-lg pointer-events-auto leading-none",
    cornerPower: "rounded-br-lg bg-purple-600 text-white font-black flex items-start justify-start border-r-2 border-b-2 border-black shadow-lg pointer-events-auto leading-none",
    cornerStrength: "rounded-tr-lg bg-yellow-500 border-r-2 border-t-2 border-black text-black font-black flex items-end justify-start shadow-lg pointer-events-auto leading-none",
    cornerArmor: "rounded-t-lg bg-cyan-600 border-x-2 border-t-2 border-black text-white font-black flex items-end justify-center shadow-lg pointer-events-auto leading-none",
    cornerHealth: "rounded-tl-lg bg-red-600 border-l-2 border-t-2 border-black text-white font-black flex items-end justify-end shadow-lg pointer-events-auto leading-none",
    
    // Floating Badges (Jumbo)
    floatingCost: "rounded-full bg-amber-500 text-black font-black flex items-center justify-center border-2 border-black shadow-lg",
    floatingPower: "rounded-full bg-purple-600 text-white font-black flex items-center justify-center border-2 border-black shadow-lg",
    floatingStrength: "rounded-full bg-yellow-500 border-2 border-black text-black font-black flex items-center justify-center shadow-xl pointer-events-auto shrink-0",
    floatingArmor: "rounded bg-cyan-600 border-2 border-black text-white font-black flex items-center justify-center shadow-xl pointer-events-auto shrink-0",
    floatingHealth: "rounded-full bg-red-600 border-2 border-black text-white font-black flex items-center justify-center shadow-xl pointer-events-auto shrink-0",
    
    // Overlays & Attachments
    inspectButton: "rounded-bl-lg bg-slate-900/80 hover:bg-slate-700 text-white font-black flex items-start justify-end border-l-2 border-b-2 border-slate-500 shadow-lg z-30 transition-colors backdrop-blur-sm leading-none cursor-pointer",
    fastBadge: "rounded-full bg-yellow-400 text-black font-black flex items-center justify-center border border-black shadow-lg z-30",
    attachBadge: "rounded bg-fuchsia-600 border border-black text-white font-black flex items-center justify-center shadow-lg z-30",
    
    // Readiness States
    readinessBase: "px-2 py-0.5 rounded-b-lg font-black uppercase tracking-wider z-20 border-x-2 border-b-2 border-black shadow-md",
    readinessJumbo: "px-2.5 py-1 rounded-md font-black uppercase tracking-wider z-20 border-2 border-black shadow-lg",
    readinessReady: "bg-emerald-500 text-black",
    readinessUnready: "bg-yellow-500 text-black",
    readinessExhausted: "bg-red-950 text-red-400 border-red-700",
    
    // Abilities Text Formatting (Standard/Nano)
    stdEvergreen: "font-roboto-condensed text-[11px] leading-tight font-black text-amber-300 text-center cursor-help drop-shadow-md",
    stdBespoke: "font-roboto-condensed text-[11px] leading-tight text-slate-200 font-bold text-center w-full",
    stdActiveWrap: "font-roboto-condensed text-[11px] leading-tight font-bold w-full cursor-help bg-black/20 rounded py-0.5 border border-white/5 flex justify-center items-center px-1",
    
    // Abilities Text Formatting (Jumbo)
    jmbEvergreen: "text-sm sm:text-base font-black text-amber-300 text-center leading-tight mb-2 drop-shadow-md",
    jmbBespoke: "bg-black/40 backdrop-blur-sm p-2 rounded-lg border border-white/10 shadow-sm text-sm sm:text-base text-slate-200 text-center leading-snug px-2",
    jmbActiveWrap: "bg-black/40 backdrop-blur-sm p-2.5 rounded-lg border border-white/10 shadow-md text-sm sm:text-base flex flex-col gap-0.5 items-center",
    
    // Active Ability Usability States
    activeUsableName: "text-amber-400",
    activeUnusableName: "text-slate-500",
    activeUsableText: "text-slate-200",
    activeUnusableText: "text-slate-500 opacity-80"
};