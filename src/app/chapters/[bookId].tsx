import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { Screen } from "@/components/ui";

// PLACEHOLDER — M9 Full Chapter List UI is not built in this prompt.
export default function ChapterList() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  return (
    <Screen className="items-center justify-center bg-bg">
      <Text className="text-heading text-2xl">Chapters for {bookId}</Text>
    </Screen>
  );
}
