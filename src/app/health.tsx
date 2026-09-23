import { useAuth } from "@clerk/expo";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { Button, Screen } from "@/components/ui";
import { useSignOut } from "@/hooks/use-sign-out";
import { clearUserScopedState } from "@/lib/session";
import { supabase } from "@/lib/supabase";

// SCAFFOLDING for prompt 09: a wiring probe, not a product screen. Delete
// when the navigation shell lands.

/**
 * Dev-only clear-storage button (prompt 07 step 9). Calls the SAME
 * `clearUserScopedState()` sign-out calls, so the two paths cannot drift —
 * this exercises exactly what a real sign-out clears, without needing a
 * second account to test with.
 *
 * Lives here rather than at `/` (prompt 08 step 11): `app/index.tsx` was
 * deleted because it collided with `(tabs)/index.tsx` for the bare `/` URL.
 * `health` is the one screen this file already keeps reachable outside every
 * routing gate, so it is the button's new home.
 */
function DevClearStorageButton() {
  if (!__DEV__) return null;

  async function onPress() {
    await clearUserScopedState();
    router.replace("/health");
    Alert.alert("Storage cleared", "User-scoped local state was cleared.");
  }

  return (
    <Button
      label="DEV: Clear local storage"
      variant="outlined"
      className="mb-10 mt-3 h-14 w-full border-destructive"
      onPress={() => void onPress()}
    />
  );
}

type Claims = Record<string, unknown>;

/** Decodes a JWT payload for display. No verification — display only. */
function decodeClaims(token: string): Claims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    return JSON.parse(atob(padded)) as Claims;
  } catch {
    return null;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4 border-b border-muted/20 py-2">
      <Text className="font-ui text-muted text-sm">{label}</Text>
      <Text className="font-ui-medium text-body flex-1 text-right text-sm">
        {value}
      </Text>
    </View>
  );
}

export default function Health() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const signOut = useSignOut();

  const [claims, setClaims] = useState<Claims | null>(null);
  const [claimsNote, setClaimsNote] = useState<string>(
    "tap Refresh claims to decode the session token",
  );
  const [dbResult, setDbResult] = useState<string>("not run");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const loadClaims = useCallback(async () => {
    if (!isSignedIn) {
      setClaims(null);
      setClaimsNote("signed out — sign in to inspect the session token");
      return;
    }
    const token = await getToken();
    if (!token) {
      setClaims(null);
      setClaimsNote("getToken() returned null");
      return;
    }
    const decoded = decodeClaims(token);
    setClaims(decoded);
    setClaimsNote(decoded ? "decoded" : "could not decode token");

    // Printed once in development — step 6 of prompt 02.
    if (__DEV__) {
      console.log("[health] decoded Clerk session claims:", decoded);
    }
  }, [getToken, isSignedIn]);

  async function probeDatabase() {
    setRunning(true);
    setDbResult("running…");
    await loadClaims();
    const started = Date.now();
    try {
      // books_catalog only — never the `books`/`chapters` base tables or the
      // admin-only views. AGENTS.md § Data Contract.
      const { data, error } = await supabase
        .from("books_catalog")
        .select("id")
        .limit(1);

      setLatencyMs(Date.now() - started);
      setDbResult(
        error ? `error: ${error.message}` : `ok — ${data?.length ?? 0} row(s)`,
      );
    } catch (e) {
      setLatencyMs(Date.now() - started);
      setDbResult(`threw: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  }

  // The two claims RLS depends on — step 6.
  const roleClaim = claims?.role;
  const metadataClaim = claims?.metadata;
  const rolePass = roleClaim === "authenticated";
  const metadataPass = metadataClaim !== undefined;

  return (
    <Screen className="px-6">
      <ScrollView className="no-scrollbar" showsVerticalScrollIndicator={false}>
        <Text className="text-heading mt-6 text-2xl">Health</Text>
        <Text className="font-ui text-muted mt-1 text-sm">
          Scaffolding for prompt 09 — wiring probe only.
        </Text>

        <Text className="font-ui-semibold text-champagne mt-6 text-base">
          Clerk
        </Text>
        <Row label="isLoaded" value={String(isLoaded)} />
        <Row label="isSignedIn" value={String(isSignedIn)} />
        <Row label="userId" value={userId ?? "—"} />

        <Text className="font-ui-semibold text-champagne mt-6 text-base">
          Session claims
        </Text>
        <Row label="status" value={claimsNote} />
        <Row
          label="role === 'authenticated'"
          value={
            claims ? `${rolePass ? "PASS" : "FAIL"} (${String(roleClaim)})` : "—"
          }
        />
        <Row
          label="metadata claim present"
          value={claims ? (metadataPass ? "PASS" : "FAIL") : "—"}
        />
        {claims ? (
          <Text className="font-ui text-muted mt-3 text-xs">
            {JSON.stringify(claims, null, 2)}
          </Text>
        ) : null}

        <Text className="font-ui-semibold text-champagne mt-6 text-base">
          Supabase
        </Text>
        <Row label="books_catalog select" value={dbResult} />
        <Row
          label="round trip"
          value={latencyMs === null ? "—" : `${latencyMs} ms`}
        />

        <Button
          label="Run probe"
          variant="primary"
          loading={running}
          className="mt-6 h-14 w-full"
          onPress={probeDatabase}
        />
        <Button
          label="Refresh claims"
          variant="outlined"
          className="mt-3 h-14 w-full"
          onPress={() => void loadClaims()}
        />
        {isSignedIn ? (
          <Button
            label="Sign out"
            variant="secondary"
            className="mt-3 h-14 w-full"
            onPress={() => void signOut()}
          />
        ) : null}
        <DevClearStorageButton />
      </ScrollView>
    </Screen>
  );
}
