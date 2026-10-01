const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// `inlineRem: 16`: react-native-css turns `rem` into dp at build time, and on
// native it uses 14 unless told otherwise (its README, "Inline REM units").
// At 14 every Tailwind size rendered at 87.5% on the phone: `p-4` was 14dp,
// `min-h-11` 38.5dp (under the 44dp touch target), `text-sm` 12.25px, while
// the web preview used the browser's 16 (AGENTS.md, Decisions — 2026-10-01,
// "NativeWind's rem is 14 on native"). A change here needs Metro restarted
// with its cache cleared: `npx expo start -c`.
module.exports = withNativewind(config, { inlineRem: 16 });
