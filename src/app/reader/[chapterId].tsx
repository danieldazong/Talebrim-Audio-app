import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { Screen } from "@/components/ui";

// PLACEHOLDER — M5 Reader UI is not built in this prompt. Registered as a
// stack screen outside (tabs): no tab bar and no mini player, by
// construction, since this route never mounts inside the Tabs navigator.
export default function Reader() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();

  return (
    <Screen className="items-center justify-center bg-bg">
      <Text className="text-heading text-2xl">Reader {chapterId}</Text>
    </Screen>
  );
}
