import { FunctionsHttpError } from "@supabase/supabase-js";
import { onlineManager } from "@tanstack/react-query";
import * as Application from "expo-application";
import * as Device from "expo-device";
import { useRef, useState } from "react";
import { Platform } from "react-native";

import { useIsOnline } from "@/hooks/use-downloads";
import { track } from "@/lib/analytics";
import {
  SUPPORT_PROBLEMS,
  canSendMessage,
  supportOutcome,
  supportPayload,
  type SupportContext,
  type SupportOutcome,
  type SupportTopic,
} from "@/lib/support";
import { supabase } from "@/lib/supabase";

function log(...args: unknown[]) {
  if (__DEV__) console.log("[support]", ...args);
}

/** The installed app and the phone, for the reply: never a name or an email. */
function appContext(): SupportContext {
  return {
    appVersion: Application.nativeApplicationVersion,
    appBuild: Application.nativeBuildVersion,
    platform: Platform.OS,
    osVersion: Device.osVersion,
    deviceModel: Device.modelName,
  };
}

/**
 * The `contact-support` Edge Function (the dashboard repo). The client sends
 * the reader's Clerk token as the bearer, as its `accessToken` does for every
 * request; the function emails the message to support@nouvrix.com, with the
 * account's own address to reply to.
 */
async function sendToSupport(body: ReturnType<typeof supportPayload>): Promise<SupportOutcome> {
  try {
    const { error } = await supabase.functions.invoke("contact-support", { body });
    if (!error) return "sent";
    const status = error instanceof FunctionsHttpError ? (error.context as Response).status : null;
    log("not sent", status);
    return supportOutcome(status);
  } catch (error) {
    log("not sent", error);
    return "failed";
  }
}

/**
 * M11's Help form (`app/support.tsx`): sends one message at a time. Offline,
 * nothing is sent and the draft stays on the screen. A refusal or a failure
 * keeps the draft too, with a line that says why, and a retry is safe.
 */
export function useContactSupport() {
  const online = useIsOnline();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<Exclude<SupportOutcome, "sent"> | null>(null);
  // A second tap lands before the re-render that disables the button.
  const busy = useRef(false);

  async function send(topic: SupportTopic | null, message: string) {
    if (busy.current || !canSendMessage(message) || !onlineManager.isOnline()) return;
    busy.current = true;
    setSending(true);
    setProblem(null);

    const outcome = await sendToSupport(supportPayload(topic, message, appContext()));
    busy.current = false;
    setSending(false);
    if (outcome === "sent") {
      track("support_message_sent", { topic: topic ?? "other" });
      setSent(true);
    } else {
      setProblem(outcome);
    }
  }

  const line = !online ? SUPPORT_PROBLEMS.offline : problem ? SUPPORT_PROBLEMS[problem] : null;
  return { online, sending, sent, line, send };
}
