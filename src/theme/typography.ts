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
  readerAccessible: "AtkinsonHyperlegible-Regular",
  readerAccessibleItalic: "AtkinsonHyperlegible-Italic",
  readerAccessibleBold: "AtkinsonHyperlegible-Bold",
  readerAccessibleBoldItalic: "AtkinsonHyperlegible-BoldItalic",
} as const;

/**
 * The reader's body font: Literata by default, Atkinson Hyperlegible when
 * the reader turns it on (M5's settings sheet, later M11).
 */
export type ReaderFont = "literata" | "atkinson";

export function readerFontFamily(choice: ReaderFont): string {
  switch (choice) {
    case "atkinson":
      return fonts.readerAccessible;
    case "literata":
      return fonts.body;
  }
}

/** AGENTS.md § Design System: Literata 18sp, line-height 1.7. */
export const readerType = { fontSize: 18, lineHeight: 18 * 1.7 } as const;
