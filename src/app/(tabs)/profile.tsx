import { router } from "expo-router";
import { Text } from "react-native";

import { Button, Screen } from "@/components/ui";

// PLACEHOLDER — M11 (Profile & Settings) UI is not built in this prompt.
export default function Profile() {
  return (
    <Screen className="items-center justify-center gap-4 bg-bg">
      <Text className="text-heading text-2xl">Profile</Text>
      {__DEV__ ? (
        // DEV-ONLY: /health has no in-app entry point by design (it's a
        // wiring probe, not a real screen) — this is a temporary way in
        // until real Profile UI lands. Remove when M11 is built.
        <Button
          label="DEV: Open health probe"
          variant="outlined"
          onPress={() => router.push("/health")}
        />
      ) : null}
    </Screen>
  );
}
