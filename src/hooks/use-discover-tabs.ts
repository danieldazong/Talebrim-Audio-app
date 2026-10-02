import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DISCOVER_TAB, resolveTab, visibleTabs } from "@/lib/discover-tabs";
import { genresInUseOptions } from "@/lib/queries/catalog";

/**
 * M3's tab strip: the tabs to list and the one selected. The genre tabs are
 * the genres the published stories carry, whether or not the app knew a genre
 * before: a story with a new genre adds its tab, and the last story of a genre
 * takes it away (`visibleTabs()`). Until the genres are known only "Discover"
 * and "New" show, and the genre tabs join them to the right, so nothing the
 * reader can already tap moves.
 */
export function useDiscoverTabs() {
  const [selectedId, setSelectedId] = useState(DISCOVER_TAB.id);
  const genresInUse = useQuery(genresInUseOptions());

  const tabs = useMemo(() => visibleTabs(genresInUse.data), [genresInUse.data]);
  const tab = resolveTab(tabs, selectedId);
  // A tab whose last story was unpublished while the reader was on it falls
  // back to "Discover". Forgetting it, rather than only hiding it, keeps the
  // reader there if that genre gets a story again.
  if (tab.id !== selectedId) setSelectedId(tab.id);

  return { tabs, tab, setTab: setSelectedId };
}
