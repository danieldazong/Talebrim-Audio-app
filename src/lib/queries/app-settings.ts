import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";

/**
 * The single live `app_settings` row. Read-only config (AGENTS.md Data
 * Contract) — never insert/update/delete it from this app.
 *
 * `resolveChapterState()` (types/states.ts) needs `free_chapters_at_start`
 * from here; never hardcode 3 and never trust the migration default, since
 * the live row governs.
 */
export const appSettingsOptions = () =>
  queryOptions({
    queryKey: queryKeys.appSettings.all(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select(
          "free_chapters_at_start, default_chapter_access, public_cdn_domain, bucket_name",
        )
        .single();

      if (error) throw error;
      return data;
    },
    // Config-like: safe to treat as effectively static within a session.
    staleTime: 60 * 60 * 1000,
  });
