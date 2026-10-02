import { Pressable, ScrollView, Text, View } from "react-native";

import type { DiscoverTab } from "@/lib/discover-tabs";
import { layout } from "@/theme";

// M3's Discover tab strip — AGENTS.md prompt 09 step 3.
//
// This is a FILTER, not navigation: selecting an entry never pushes a route
// or changes the bottom tab, it only changes which carousel content this
// screen requests. Selected state is an ember underline, a new visual
// distinct from `Chip`/`chip--selected` (blush-filled, used by M2/M8) — see
// the `tab-strip__*` utilities in global.css.
//
// It draws the tabs it is given. Which exist, and in what order, is
// `lib/discover-tabs.ts`: one per genre a published story carries.

type GenreTabStripProps = {
  /** The tabs to list, in order (`visibleTabs()`). */
  tabs: readonly DiscoverTab[];
  /** The selected tab's id. */
  value: string;
  onChange: (id: string) => void;
};

export function GenreTabStrip({ tabs, value, onChange }: GenreTabStripProps) {
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
        {tabs.map((tab) => {
          const isActive = tab.id === value;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
              hitSlop={8}
              onPress={() => onChange(tab.id)}
              style={{ minHeight: layout.minTouchTarget }}
              className="tab-strip__item"
            >
              <Text
                className={`tab-strip__label ${isActive ? "tab-strip__label--active" : ""}`}
                maxFontSizeMultiplier={1.3}
              >
                {tab.label}
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
