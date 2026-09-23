import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { Screen } from "@/components/ui";

// PLACEHOLDER — M4 Story Detail UI is not built in this prompt. Registered
// as a stack screen outside (tabs) so it covers the bar when pushed.
export default function BookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen className="items-center justify-center bg-bg">
      <Text className="text-heading text-2xl">Book {id}</Text>
    </Screen>
  );
}
