import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";

/**
 * The three `app_settings` values a reader needs — CDN domain, free chapter
 * count, default chapter access — through the `reader_settings()` function
 * (dashboard migration 20260923000001). Never select the `app_settings` table
 * from this app: its policy is admin-only, so a normal reader gets no row.
 * The function also works signed out, which the onboarding screen relies on.
 *
 * `.single()` turns "no row" (an empty `app_settings`) into an error on
 * purpose — surface it, never fall back to invented defaults (AGENTS.md
 * § Storage and the CDN).
 *
 * `resolveChapterState()` (types/states.ts) needs `free_chapters_at_start`
 * from here; never hardcode 3.
 */
export const appSettingsOptions = () =>
  queryOptions({
    queryKey: queryKeys.appSettings.all(),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("reader_settings").single();

      if (error) throw error;
      return data;
    },
    // Config-like: safe to treat as effectively static within a session.
    staleTime: 60 * 60 * 1000,
  });
