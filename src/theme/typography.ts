// ⚠️ MIRROR of the --font-* tokens in src/global.css. See colors.ts for why
// this file exists and when it is legitimate to import it.

export const fonts = {
  display: "Fraunces-SemiBold",
  body: "Literata-Regular",
  bodyItalic: "Literata-Italic",
  bodyEmphasis: "Literata-SemiBold",
  ui: "Inter-Regular",
  uiMedium: "Inter-Medium",
  uiSemibold: "Inter-SemiBold",
} as const;

/**
 * Reader font choices offered in M11 settings.
 *
 * `atkinson` is offered per AGENTS.md § Design System, but the Atkinson
 * Hyperlegible Next files are NOT bundled. readerFontFamily() maps it to
 * Literata so the setting can be shown and persisted without ever producing
 * a font reference React Native cannot resolve.
 */
export type ReaderFont = "literata" | "atkinson";

export function readerFontFamily(choice: ReaderFont): string {
  switch (choice) {
    case "atkinson":
      // Not bundled yet. Degrade to Literata rather than name a font RN
      // cannot resolve, which would silently fall back to the system font.
      return fonts.body;
    case "literata":
      return fonts.body;
  }
}

/** AGENTS.md § Design System: Literata 18sp, line-height 1.7. */
export const readerType = { fontSize: 18, lineHeight: 18 * 1.7 } as const;
