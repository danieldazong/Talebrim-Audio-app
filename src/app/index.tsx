import { Link } from "expo-router";
import { Text, View } from "react-native";

// SCAFFOLDING for prompt 09: these links exist only so the auth screens are
// reachable before real routing lands. Remove when the navigation shell does.
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-bg">
      <Text className="text-heading text-4xl">Talebrim</Text>
      <Link
        href="/(auth)/onboarding"
        className="btn btn--outlined"
        accessibilityRole="link"
        accessibilityLabel="Open onboarding screen"
      >
        View onboarding
      </Link>
      <Link
        href="/(auth)/sign-in"
        className="btn btn--primary"
        accessibilityRole="link"
        accessibilityLabel="Open sign in screen"
      >
        View sign in
      </Link>
      <Link
        href="/(auth)/genres"
        className="btn btn--outlined"
        accessibilityRole="link"
        accessibilityLabel="Open genre picker screen"
      >
        View genre picker
      </Link>
      <Link
        href="/health"
        className="btn btn--outlined"
        accessibilityRole="link"
        accessibilityLabel="Open health check screen"
      >
        Health check
      </Link>
    </View>
  );
}
