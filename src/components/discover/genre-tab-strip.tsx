import { Pressable, ScrollView, Text, View } from "react-native";

import { layout } from "@/theme";

// M3's Discover tab strip — AGENTS.md prompt 09 step 3.
//
// This is a FILTER, not navigation: selecting an entry never pushes a route
// or changes the bottom tab, it only changes which carousel content this
// screen requests. Selected state is an ember underline, a new visual
// distinct from `Chip`/`chip--selected` (blush-filled, used by M2/M8) — see
// the `tab-strip__*` utilities in global.css.
//
// DEVIATION TO REPORT: this strip shows 6 entries; `data/genres.ts` holds
// the dashboard's 12. Most of those have no tab here, and "New" below is a
// recency filter, not a genre at all. Not reconciled here per prompt 09
// step 3 — reported as a conflict instead. Labels here are display text; the
// slug each genre tab filters on lives in `TAB_GENRE` (app/(tabs)/index.tsx).
export const DISCOVER_TABS = [
  "Discover",
  "New",
  "Werewolf",
  "Romance",
  "Vampire",
  "Fantasy",
] as const;

export type DiscoverTab = (typeof DISCOVER_TABS)[number];

type GenreTabStripProps = {
  value: DiscoverTab;
  onChange: (tab: DiscoverTab) => void;
};

export function GenreTabStrip({ value, onChange }: GenreTabStripProps) {
  return (
    // A View, not the ScrollView, sits in the screen's column: a ScrollView
    // defaults to flexShrink 1, and there it shrank under the tall content
    // below and cut the labels off.
    <View>
      {/* The frame's hairline, drawn first so the ember underline paints over it. */}
      <View className="tab-strip__divider" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 24, paddingHorizontal: 16 }}
        className="no-scrollbar"
      >
        {DISCOVER_TABS.map((tab) => {
          const isActive = tab === value;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityLabel={tab}
              accessibilityState={{ selected: isActive }}
              hitSlop={8}
              onPress={() => onChange(tab)}
              style={{ minHeight: layout.minTouchTarget }}
              className="tab-strip__item"
            >
              <Text
                className={`tab-strip__label ${isActive ? "tab-strip__label--active" : ""}`}
                maxFontSizeMultiplier={1.3}
              >
                {tab}
              </Text>
              {/* Drawn on every tab, filled only on the active one, so all the
                  labels share one baseline. */}
              <View className={`tab-strip__underline ${isActive ? "tab-strip__underline--active" : ""}`} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
