import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { accountSpokenLabel, planLabel, type AccountIdentity, type PlanState } from "@/lib/profile";

// M11's account card — prompt 25 step 2, material/10.png: `surface` with a
// `raised` hairline, a 48dp `raised` circle ringed `teal/20`, the name and
// email, and the plan pill. The circle holds the account's own photo when it
// has one (a Google sign-in brings it: the owner's call, 2026-10-01), or the
// initials.

/**
 * The account's photo, or its initials. The initials show until the photo
 * has loaded, and again if it can't (offline on a cold start, a failed
 * fetch). They are hidden once it has, because a cut-out photo with a
 * transparent background let them show through (seen on the owner's phone).
 */
function Avatar({ initials, photoUrl }: { initials: string; photoUrl: string | null }) {
  // The URL that has loaded, so a changed photo shows the initials again until it loads.
  const [loaded, setLoaded] = useState<string | null>(null);
  const photoShown = photoUrl !== null && loaded === photoUrl;

  return (
    <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-pill border border-teal/20 bg-raised">
      {photoShown ? null : (
        // Fixed inside the 48dp circle; the name beside it scales.
        <Text className="text-heading text-lg" maxFontSizeMultiplier={1}>
          {initials}
        </Text>
      )}
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          contentFit="cover"
          // Memory only: a reader's photo never stays on the phone's disk,
          // so it can't outlive their sign-out. It is small to fetch again.
          cachePolicy="memory"
          onLoad={() => setLoaded(photoUrl)}
          onError={() => setLoaded(null)}
          // Decorative: the card is one element that already says who it is.
          accessible={false}
          style={styles.photo}
        />
      ) : null}
    </View>
  );
}

type AccountCardProps = {
  identity: AccountIdentity;
  plan: PlanState;
};

/** One element for screen readers: "{title}, {email}, {plan}". */
export function AccountCard({ identity, plan }: AccountCardProps) {
  const planText = planLabel(plan);

  return (
    <View
      accessible
      accessibilityLabel={accountSpokenLabel(identity, planText)}
      className="flex-row items-center gap-3.5 rounded-card border border-raised bg-surface p-4"
    >
      <Avatar initials={identity.initials} photoUrl={identity.photoUrl} />

      <View className="flex-1">
        <Text className="text-heading text-lg leading-6" numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {identity.title}
        </Text>
        {identity.email ? (
          <Text className="font-ui text-muted text-sm leading-5" numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {identity.email}
          </Text>
        ) : null}
      </View>

      {plan === "loading" ? (
        <View className="h-6 w-[72px] rounded-pill bg-raised" />
      ) : planText ? (
        // `blush/10`, as material/10.png measures it (#33243F on `surface`).
        <View className="min-h-6 justify-center rounded-pill bg-blush/10 px-3">
          <Text className="font-ui-semibold text-blush text-xs" numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {planText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Clerk's user not loaded yet: the card's shape, never a spinner. */
export function AccountCardSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Loading your account"
      accessibilityState={{ busy: true }}
      className="flex-row items-center gap-3.5 rounded-card border border-raised bg-surface p-4"
    >
      <View className="h-12 w-12 rounded-pill bg-raised" />
      <View className="flex-1 gap-2">
        <View className="h-4 w-36 rounded-pill bg-raised" />
        <View className="h-3 w-44 rounded-pill bg-raised" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Over the initials, inside the ring; the circle's `overflow-hidden` rounds it. */
  photo: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
});
