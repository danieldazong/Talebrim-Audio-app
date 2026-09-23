// Font registration data for expo-font's useFonts().
//
// The KEYS are the React Native family names and MUST match the --font-*
// token values in src/global.css exactly. RN resolves fontFamily by this
// string; a typo fails silently to the system font rather than erroring.
//
// One family per weight: RN cannot select a weight from a family, so there
// is no "Inter" entry that font-semibold could thicken. See global.css.

export const fontMap = {
  "Fraunces-SemiBold": require("@/assets/fonts/Fraunces_72pt-SemiBold.ttf"),

  // Static files from Google Fonts (Inter/static/, Literata/static/), never
  // the variable ones beside them: those filenames contain commas (a Metro
  // asset-resolution hazard) and their weight axes are unreliable on
  // Android. The 18pt optical size is the cut drawn for 14–18sp text.
  // Licences: assets/fonts/*-OFL.txt, which must ship with the files.
  "Literata-Regular": require("@/assets/fonts/Literata_18pt-Regular.ttf"),
  "Literata-Italic": require("@/assets/fonts/Literata_18pt-Italic.ttf"),
  "Literata-SemiBold": require("@/assets/fonts/Literata_18pt-SemiBold.ttf"),
  "Inter-Regular": require("@/assets/fonts/Inter_18pt-Regular.ttf"),
  "Inter-Medium": require("@/assets/fonts/Inter_18pt-Medium.ttf"),
  "Inter-SemiBold": require("@/assets/fonts/Inter_18pt-SemiBold.ttf"),

  // The reader's accessibility font (AGENTS.md § Typography). The original
  // Atkinson Hyperlegible family: 400 and 700, each with an italic, so bold
  // inside italic gets a real file here.
  "AtkinsonHyperlegible-Regular": require("@/assets/fonts/AtkinsonHyperlegible-Regular.ttf"),
  "AtkinsonHyperlegible-Italic": require("@/assets/fonts/AtkinsonHyperlegible-Italic.ttf"),
  "AtkinsonHyperlegible-Bold": require("@/assets/fonts/AtkinsonHyperlegible-Bold.ttf"),
  "AtkinsonHyperlegible-BoldItalic": require("@/assets/fonts/AtkinsonHyperlegible-BoldItalic.ttf"),
} as const;
