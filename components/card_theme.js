export const CARD_THEME = {
    // Layout Wrappers
    standardWrapper: "card-wrapper-std group",
    jumboWrapper: "card-wrapper-jumbo",

    // Core Layout Sections
    artSection: "w-full border-b-2 relative overflow-hidden flex items-center justify-center",
    textSection: "w-full flex flex-col relative overflow-hidden",
    bgArtImage: "bg-art-image",
    bgArtMute: "bg-art-mute",

    // Floating Name Badge (Standard/Nano/Jumbo)
    nameWrapper: "absolute flex justify-center z-30 pointer-events-none w-[90%] left-1/2 -translate-x-1/2",
    nameBadge: "bg-black/20 backdrop-blur-sm text-white font-black rounded-full truncate text-center max-w-full shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-tight uppercase tracking-wide border-none",

    // Corner Badges (Standard/Nano)
    cornerCost: "corner-badge stat-text-base rounded-br-lg bg-amber-500 border-black border-r-2 border-b-2",
    cornerPower: "corner-badge stat-text-base rounded-br-lg bg-purple-600 border-black border-r-2 border-b-2",
    cornerStrength: "corner-badge stat-text-base rounded-tr-lg bg-yellow-500 border-black border-r-2 border-t-2",
    cornerArmor: "corner-badge stat-text-base rounded-t-lg bg-cyan-600 border-black border-x-2 border-t-2",
    cornerHealth: "corner-badge stat-text-base rounded-tl-lg bg-red-600 border-black border-l-2 border-t-2",

    // Floating Badges (Jumbo)
    floatingCost: "corner-badge stat-text-base rounded-full bg-amber-500 border-black border-2",
    floatingPower: "corner-badge stat-text-base rounded-full bg-purple-600 border-black border-2",
    floatingStrength: "corner-badge stat-text-base rounded-full bg-yellow-500 border-black border-2 shrink-0",
    floatingArmor: "corner-badge stat-text-base rounded bg-cyan-600 border-black border-2 shrink-0",
    floatingHealth: "corner-badge stat-text-base rounded-full bg-red-600 border-black border-2 shrink-0",

    // Overlays & Attachments
    inspectButton: "corner-badge rounded-bl-lg bg-slate-900/80 hover:bg-slate-700 text-white border-l-2 border-b-2 border-slate-500 z-30 transition-colors backdrop-blur-sm cursor-pointer",
    fastBadge: "corner-badge rounded-full bg-yellow-400 text-black border shadow-lg z-30",
    attachBadge: "corner-badge rounded bg-fuchsia-600 text-white border shadow-lg z-30",

    // Readiness States
    readinessBase: "readiness-badge rounded-b-lg border-x-2 border-b-2",
    readinessJumbo: "readiness-badge rounded-md border-2",
    readinessReady: "bg-emerald-500 text-black",
    readinessUnready: "bg-yellow-500 text-black",
    readinessExhausted: "bg-red-950 text-red-400 border-red-700",

    // Abilities Text Formatting
    stdEvergreen: "ability-evergreen",
    stdBespoke: "ability-bespoke",
    stdActiveWrap: "ability-active-wrap",

    jmbEvergreen: "jmb-ability-evergreen",
    jmbBespoke: "jmb-ability-bespoke",
    jmbActiveWrap: "jmb-ability-active-wrap",

    // Active Ability Usability States
    activeUsableName: "text-amber-400",
    activeUnusableName: "text-slate-500",
    activeUsableText: "text-slate-200",
    activeUnusableText: "text-slate-500 opacity-80",

    // Inline/Markdown Text Elements
    eventName: "font-bold [font-variant:small-caps] text-amber-300 tracking-wide mr-1",
    boldText: "font-black text-amber-400"
};