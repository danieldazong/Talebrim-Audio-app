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
 * M5 Reader pages, keyed by `ReaderTheme` (store/reader-store.ts), for props
 * that take no className: the safe areas, icons and the StatusBar. The
 * matching classNames live in `components/reader/reader-theme.ts`.
 * `secondary` on light pages is ink at 65% (`A6`), the `text-ink/65` class.
 */
export const readerColors = {
  light: { page: colors.readerLight, text: colors.ink, secondary: `${colors.ink}A6` },
  sepia: { page: colors.readerSepia, text: colors.ink, secondary: `${colors.ink}A6` },
  dark: { page: colors.bg, text: colors.body, secondary: colors.muted },
} as const;

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

/**
 * M3 hero card's bottom fade, blending its cover art into the card's own
 * `surface` background below it. Same deviation as `collageFadeGradient` —
 * a flat scrim leaves a hard visible seam where the design shows a smooth
 * blend; approved on 2026-09-23 to match the reference exactly.
 */
export const heroCardFadeGradient = [
  "transparent",
  `${colors.surface}CC`,
  colors.surface,
] as const;
