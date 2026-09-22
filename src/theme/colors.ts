// ⚠️ MIRROR — NOT THE SOURCE OF TRUTH.
//
// The source of truth is the @theme block in src/global.css (AGENTS.md
// § Styling Rules: "Raw hex appears in exactly one place"). This file exists
// ONLY for AGENTS.md § Style Exception Rules — props that accept no
// className: StatusBar, Stack contentStyle, Modal, TextInput
// placeholderTextColor, expo-linear-gradient colors, react-native-svg props.
//
// If you change a value here, change it in global.css too.
// Never import this to do something a className could do.

export const colors = {
  bg: "#150E1F",
  surface: "#1F1530",
  raised: "#2C1E42",
  ember: "#E8663F",
  emberPressed: "#FF8A5C",
  teal: "#9FD8D0",
  blush: "#E9A8C0",
  champagne: "#F4E3CE",
  body: "#F7F4F0",
  muted: "#A79BB5",
  readerLight: "#FBF7F1",
  readerSepia: "#F2E5D0",
  ink: "#1A1420",
  destructive: "#C9705F",
} as const;

export type ColorName = keyof typeof colors;

/**
 * M6 Now Playing's gradient. AGENTS.md § Design System says gradients are
 * reserved for M6 — the onboarding collage fade below is a deliberate,
 * user-approved deviation from that rule (a stacked-opacity-band
 * approximation was tried first and produces visible banding over
 * photographic cover art; a real gradient does not).
 */
export const nowPlayingGradient = [colors.bg, colors.raised] as const;

/** Onboarding collage fade — see the deviation note on `nowPlayingGradient`. */
export const collageFadeGradient = [
  "transparent",
  `${colors.bg}CC`,
  colors.bg,
] as const;
