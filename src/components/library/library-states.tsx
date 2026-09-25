import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { Button } from "@/components/ui";
import { colors } from "@/theme";

// M7's My List states — prompt 21 step 10. All on `bg`, below the header,
// the segments and Continue, which stay mounted. Never a spinner, an alert
// or a toast.

const SKELETON_CELLS = [0, 1, 2, 3, 4, 5];

type LibraryGridSkeletonProps = {
  cellWidth: number;
  titleMinHeight: number;
};

/** Loading — the heading, then two rows of cover shapes and title lines at their real size. */
export function LibraryGridSkeleton({ cellWidth, titleMinHeight }: LibraryGridSkeletonProps) {
  return (
    <View accessible accessibilityLabel="Loading My List" accessibilityState={{ busy: true }} className="px-4">
      <View className="mb-3 mt-6 h-6 w-32 rounded-pill bg-surface" />
      <View className="flex-row flex-wrap gap-x-3 gap-y-4">
        {SKELETON_CELLS.map((cell) => (
          <View key={cell} style={{ width: cellWidth }}>
            <View className="aspect-[2/3] rounded-cover bg-surface" />
            <View className="mt-2 gap-2" style={{ minHeight: titleMinHeight }}>
              <View className="h-3 w-4/5 rounded-pill bg-surface" />
              <View className="h-3 w-1/2 rounded-pill bg-surface" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

type MyListMessageProps = {
  status: "offline" | "failed";
  onRetry: () => void;
};

/** Offline with nothing cached (the list loads on reconnect), or failed (Retry). */
export function MyListMessage({ status, onRetry }: MyListMessageProps) {
  const offline = status === "offline";

  return (
    <View className="items-center gap-3 px-8 pt-12" accessibilityLiveRegion="polite">
      <Ionicons name={offline ? "cloud-offline-outline" : "alert-circle-outline"} size={32} color={colors.muted} />
      <Text className="font-ui text-body text-center text-base" maxFontSizeMultiplier={1.5}>
        {offline ? "You're offline." : "We couldn't load My List."}
      </Text>
      <Text className="font-ui text-muted text-center text-sm" maxFontSizeMultiplier={1.5}>
        {offline
          ? "Your saved stories aren't on this device yet. They'll load when you reconnect."
          : "Check your connection and try again."}
      </Text>
      {offline ? null : <Button label="Retry" variant="secondary" className="mt-2" onPress={onRetry} />}
    </View>
  );
}

type MyListEmptyProps = {
  onBrowse: () => void;
};

/** Every new reader sees this first, so it is an invitation, not an absence. Not ember. */
export function MyListEmpty({ onBrowse }: MyListEmptyProps) {
  return (
    <View className="items-center gap-3 px-8 pt-12">
      {/* The plus of M4's "+ My List" pill. Never a bookmark: M5's marks a place in a chapter. */}
      <Ionicons name="add-circle-outline" size={32} color={colors.muted} />
      <Text accessibilityRole="header" className="text-heading text-center text-xl leading-7" maxFontSizeMultiplier={1.3}>
        Your list is empty
      </Text>
      <Text className="font-ui text-muted text-center text-base leading-6" maxFontSizeMultiplier={1.5}>
        Tap + My List on a story&apos;s page to save it here.
      </Text>
      <Button label="Browse stories" variant="secondary" className="mt-2" onPress={onBrowse} />
    </View>
  );
}

/** Audiobooks empty while Books is not. */
export function AudiobooksEmpty() {
  return (
    <View className="items-center px-8 pt-6">
      <Text className="font-ui text-muted text-center text-base leading-6" maxFontSizeMultiplier={1.5}>
        No audiobooks on your list yet.
      </Text>
    </View>
  );
}
