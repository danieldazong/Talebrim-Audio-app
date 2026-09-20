// ⚠️ MIRROR of the --radius-* tokens in src/global.css plus the fixed
// measurements in AGENTS.md § Layout. See colors.ts for when to import this.

export const radius = {
  card: 16,
  cover: 12,
  field: 12,
  pill: 999,
} as const;

export const layout = {
  /** 16dp side padding — AGENTS.md § Layout. */
  screenPadding: 16,
  /** 56dp mini player. In classNames this is `h-14`. */
  miniPlayerHeight: 56,
  /** AGENTS.md § UI Quality Bar: large touch targets (≥ 44dp). */
  minTouchTarget: 44,
  /** 2:3 covers — AGENTS.md § Layout / § Image Rule. */
  coverAspectRatio: 2 / 3,
} as const;
