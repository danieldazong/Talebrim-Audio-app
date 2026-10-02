import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button, Chip, Screen } from "@/components/ui";
import { useContactSupport } from "@/hooks/use-contact-support";
import {
  SUPPORT_COUNTER_FROM,
  SUPPORT_INTRO,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_NOTE,
  SUPPORT_SENT,
  SUPPORT_TOPICS,
  canSendMessage,
  type SupportTopic,
} from "@/lib/support";
import { colors, fonts, layout } from "@/theme";

// Contact support — M11's Help (the owner's request, 2026-10-01): a message
// that reaches the support inbox (support@nouvrix.com) by email, through the
// `contact-support` Edge Function, with the reader's account address to reply
// to. Works without the website. No frame: built from Updates' header, M2's
// chips and M8's field look, for design review. A pushed route over the tab
// shell (no tab bar, no mini player). "Send message" is the screen's one ember
// action.
//
// The screen names no address, neither the inbox's nor the reader's: the
// reply goes to the email on the account, which it says in words.

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export default function SupportRoute() {
  const { online, sending, sent, line, send } = useContactSupport();
  const [topic, setTopic] = useState<SupportTopic | null>(null);
  const [message, setMessage] = useState("");

  const length = message.trim().length;
  const canSend = online && !sending && canSendMessage(message);

  return (
    <Screen>
      <View className="flex-row items-center pb-2 pl-1.5 pr-4 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={goBack}
          // No className beside a `style` function (AGENTS.md § Style Exception Rules).
          style={({ pressed }) => [styles.back, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.body} />
        </Pressable>
        <Text accessibilityRole="header" className="text-heading ml-1 text-2xl leading-8" maxFontSizeMultiplier={1.3}>
          Contact support
        </Text>
      </View>

      {sent ? (
        <Sent />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView
            className="no-scrollbar"
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="font-ui text-muted text-[15px] leading-[22px]" maxFontSizeMultiplier={1.5}>
              {SUPPORT_INTRO}
            </Text>

            <Text className="font-ui-medium text-body mt-6 text-[15px]" maxFontSizeMultiplier={1.3}>
              What&apos;s it about?
            </Text>
            <View accessibilityLabel="Topic" className="mt-2 flex-row flex-wrap gap-x-2">
              {SUPPORT_TOPICS.map((option) => (
                // 44dp to tap, around the 36dp chip, as on M2.
                <View key={option.value} className="min-h-11 justify-center">
                  <Chip
                    label={option.label}
                    selected={topic === option.value}
                    disabled={sending}
                    onPress={() => setTopic((current) => (current === option.value ? null : option.value))}
                  />
                </View>
              ))}
            </View>

            <Text nativeID="support-message-label" className="font-ui-medium text-body mt-5 text-[15px]" maxFontSizeMultiplier={1.3}>
              Your message
            </Text>
            <View className="mt-2 rounded-field border border-raised bg-surface px-4 py-3">
              <TextInput
                value={message}
                onChangeText={setMessage}
                editable={!sending}
                multiline
                maxLength={SUPPORT_MESSAGE_MAX}
                placeholder="What happened, and on which story or chapter?"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Your message"
                accessibilityLabelledBy="support-message-label"
                maxFontSizeMultiplier={1.3}
                underlineColorAndroid="transparent"
                textAlignVertical="top"
                style={styles.input}
              />
            </View>
            {length >= SUPPORT_COUNTER_FROM ? (
              <Text className="font-ui text-muted mt-1 self-end text-[13px]" maxFontSizeMultiplier={1.3}>
                {`${length} / ${SUPPORT_MESSAGE_MAX}`}
              </Text>
            ) : null}

            <Text className="font-ui text-muted mt-3 text-[13px] leading-[18px]" maxFontSizeMultiplier={1.5}>
              {SUPPORT_NOTE}
            </Text>

            {line ? (
              <Text
                accessibilityLiveRegion="polite"
                className="font-ui text-body mt-4 text-sm leading-5"
                maxFontSizeMultiplier={1.5}
              >
                {line}
              </Text>
            ) : null}

            <Button
              label="Send message"
              loading={sending}
              disabled={!canSend}
              onPress={() => void send(topic, message)}
              className="mt-6 h-12"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

/** Sent: what happens next, and the way back. No ember: nothing is left to do. */
function Sent() {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8" accessibilityLiveRegion="polite">
      <Ionicons name="checkmark-circle-outline" size={40} color={colors.teal} />
      <Text accessibilityRole="header" className="text-heading text-center text-2xl leading-8" maxFontSizeMultiplier={1.3}>
        Message sent
      </Text>
      <Text className="font-ui text-muted text-center text-[15px] leading-[22px]" maxFontSizeMultiplier={1.5}>
        {SUPPORT_SENT}
      </Text>
      <Button label="Done" variant="outlined" onPress={goBack} className="mt-3" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: 32,
  },
  input: {
    minHeight: 160,
    color: colors.body,
    fontFamily: fonts.ui,
    fontSize: 16,
    lineHeight: 22,
    padding: 0,
  },
});
