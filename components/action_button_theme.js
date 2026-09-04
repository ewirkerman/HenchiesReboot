export const ACTION_BUTTON_THEME = {
  play: {
    baseClass: "border-emerald-700 bg-emerald-900/80 hover:bg-emerald-800 hover:border-emerald-400 text-emerald-50 shadow-[0_0_18px_rgba(16,185,129,0.18)]",
    lineColor: "#34d399",
    label: "primary"
  },
  secondary: {
    baseClass: "border-violet-700 bg-violet-950/80 hover:bg-violet-900 hover:border-violet-400 text-violet-50 shadow-[0_0_18px_rgba(168,85,247,0.18)]",
    lineColor: "#a78bfa",
    label: "secondary"
  },
  attack: {
    baseClass: "border-red-900 bg-red-950/80 hover:bg-red-900 hover:border-red-400 text-red-100 shadow-[0_0_18px_rgba(239,68,68,0.18)]",
    lineColor: "#f87171",
    label: "attack"
  },
  default: {
    baseClass: "border-violet-700 bg-violet-950/80 hover:bg-violet-900 hover:border-violet-400 text-violet-50 shadow-[0_0_18px_rgba(168,85,247,0.18)]",
    lineColor: "#a78bfa",
    label: "secondary"
  }
};

export function getActionButtonTheme(actionType) {
  if (actionType === 'PLAY') return ACTION_BUTTON_THEME.play;
  if (actionType === 'ATTACK') return ACTION_BUTTON_THEME.attack;
  return ACTION_BUTTON_THEME.secondary;
}