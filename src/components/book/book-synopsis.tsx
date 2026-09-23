import { useState } from "react";
import { Pressable, Text, View } from "react-native";

/** Lines shown before "More" (material/6.png). */
const COLLAPSED_LINES = 5;

const BODY_CLASS = "font-ui text-body/70 text-[15px] leading-[22px]";

type BookSynopsisProps = {
  text: string;
};

/**
 * M4 synopsis, truncated with a teal "More" that expands in place.
 *
 * "More" shows only when the text really overflows. That is measured on an
 * invisible, unconstrained copy rather than on the visible text: what
 * `onTextLayout` reports for a `numberOfLines`-capped Text differs between
 * platforms, and a full copy reports every line on both.
 *
 * DEVIATION: the frame runs "More" inline after the ellipsis. It sits on its
 * own row here, because a nested Text cannot have a 44dp touch target or be
 * its own element for a screen reader.
 */
export function BookSynopsis({ text }: BookSynopsisProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  return (
    <View className="px-4">
      <Text
        accessibilityRole="header"
        className="text-heading text-xl leading-7"
        maxFontSizeMultiplier={1.3}
      >
        Synopsis
      </Text>

      <View className="mt-2">
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute inset-x-0 top-0 opacity-0"
        >
          <Text
            className={BODY_CLASS}
            maxFontSizeMultiplier={1.5}
            onTextLayout={(event) => setOverflows(event.nativeEvent.lines.length > COLLAPSED_LINES)}
          >
            {text}
          </Text>
        </View>

        <Text
          className={BODY_CLASS}
          numberOfLines={expanded ? undefined : COLLAPSED_LINES}
          maxFontSizeMultiplier={1.5}
        >
          {text}
        </Text>
      </View>

      {overflows && !expanded ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show the full synopsis"
          onPress={() => setExpanded(true)}
          className="min-h-11 self-start justify-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text
            className="font-ui-semibold text-teal text-[15px] leading-[22px]"
            maxFontSizeMultiplier={1.5}
          >
            More
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
