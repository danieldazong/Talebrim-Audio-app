import type { ReaderTheme } from "@/store/reader-store";
import { readerColors, type ReaderFont } from "@/theme";

// M5's three page themes — prompt 14 step 6. Tokens only.
//
// The class strings live under components/ on purpose: global.css only
// scans app/ and components/ for classes, so a class written anywhere else
// is never generated.
//
// Secondary text is `ink/65` on light pages, not the frame's tan (#958675,
// no token, fails AA) and not `muted`, which also fails there.

export type ReaderPalette = {
  /** Page, top bar and safe areas. */
  page: string;
  /** Body text, back and the top bar's `Aa`. */
  text: string;
  /** Fraunces: chapter title, `## ` headings, the top bar's "Chapter N". */
  display: string;
  /** Book-title label, "CHAPTER N" label, state captions. */
  secondary: string;
  /** Top-bar hairline. */
  hairline: string;
  /** Skeleton bars. */
  skeleton: string;
  /** The theme-aware outlined pill (step 12). */
  pillBorder: string;
  /** The same colours for props that take no className. */
  colors: (typeof readerColors)[ReaderTheme];
  statusBar: "dark" | "light";
};

const light: ReaderPalette = {
  page: "bg-reader-light",
  text: "text-ink",
  display: "text-ink",
  secondary: "text-ink/65",
  hairline: "border-ink/10",
  skeleton: "bg-ink/10",
  pillBorder: "border-ink/20",
  colors: readerColors.light,
  statusBar: "dark",
};

export const READER_PALETTES: Record<ReaderTheme, ReaderPalette> = {
  light,
  sepia: { ...light, page: "bg-reader-sepia", colors: readerColors.sepia },
  dark: {
    page: "bg-bg",
    text: "text-body",
    display: "text-champagne",
    secondary: "text-muted",
    hairline: "border-raised",
    skeleton: "bg-raised",
    pillBorder: "border-muted/40",
    colors: readerColors.dark,
    statusBar: "light",
  },
};

/** The brightness button's cycle: light → sepia → dark → light. */
export const NEXT_THEME: Record<ReaderTheme, ReaderTheme> = {
  light: "sepia",
  sepia: "dark",
  dark: "light",
};

export const THEME_LABEL: Record<ReaderTheme, string> = {
  light: "Light",
  sepia: "Sepia",
  dark: "Dark",
};

/** Body-text font files. Bold and italic switch the FILE, never the weight or style. */
export type ReaderFaces = {
  regular: string;
  italic: string;
  bold: string;
  boldItalic: string;
};

export const READER_FACES: Record<ReaderFont, ReaderFaces> = {
  literata: {
    regular: "font-body",
    italic: "font-body-italic",
    bold: "font-body-emphasis",
    // No SemiBold Italic file: bold wins inside italic.
    boldItalic: "font-body-emphasis",
  },
  atkinson: {
    regular: "font-reader-accessible",
    italic: "font-reader-accessible-italic",
    bold: "font-reader-accessible-bold",
    boldItalic: "font-reader-accessible-bold-italic",
  },
};
