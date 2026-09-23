import { useSyncExternalStore } from "react";

import {
  isHydrationComplete,
  subscribeToHydration,
} from "@/store/hydration";

/** True once every persisted Zustand slice has rehydrated from AsyncStorage. */
export function useStoresHydrated(): boolean {
  return useSyncExternalStore(subscribeToHydration, isHydrationComplete);
}
