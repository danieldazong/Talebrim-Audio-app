import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { Screen } from "@/components/ui";

// PLACEHOLDER — M6 Now Playing UI is not built in this prompt (including its
// gradient, which prompt 18 owns). Registered as a stack screen outside
// (tabs): no tab bar and no mini player, by construction.
export default function Player() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();

  return (
    <Screen className="items-center justify-center bg-bg">
      <Text className="text-heading text-2xl">Now Playing {chapterId}</Text>
    </Screen>
  );
}
