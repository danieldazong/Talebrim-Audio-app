import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { markStoreHydrated, registerHydratingStore } from "@/store/hydration";

const STORE_NAME = "reader";
export const READER_STORAGE_KEY = "talebrim.store.reader";

// AGENTS.md § Design System / M5: light is the default; sepia and dark are
// user choices.
export type ReaderTheme = "light" | "sepia" | "dark";

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 28;
const FONT_SIZE_DEFAULT = 18; // AGENTS.md § Typography — Literata 18sp.

const LINE_SPACING_MIN = 1.4;
const LINE_SPACING_MAX = 2.2;
const LINE_SPACING_DEFAULT = 1.7; // AGENTS.md § Typography.

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface ReaderState {
  theme: ReaderTheme;
  fontSize: number;
  lineSpacing: number;
  /** AGENTS.md § Typography — the Atkinson Hyperlegible reader accessibility font. */
  atkinsonEnabled: boolean;
  setTheme: (theme: ReaderTheme) => void;
  setFontSize: (size: number) => void;
  setLineSpacing: (spacing: number) => void;
  setAtkinsonEnabled: (enabled: boolean) => void;
}

registerHydratingStore(STORE_NAME);

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      theme: "light",
      fontSize: FONT_SIZE_DEFAULT,
      lineSpacing: LINE_SPACING_DEFAULT,
      atkinsonEnabled: false,
      setTheme: (theme) => set({ theme }),
      setFontSize: (size) =>
        set({ fontSize: clamp(size, FONT_SIZE_MIN, FONT_SIZE_MAX) }),
      setLineSpacing: (spacing) =>
        set({
          lineSpacing: clamp(spacing, LINE_SPACING_MIN, LINE_SPACING_MAX),
        }),
      setAtkinsonEnabled: (enabled) => set({ atkinsonEnabled: enabled }),
    }),
    {
      name: READER_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persisted) => persisted as ReaderState,
      onRehydrateStorage: () => () => {
        markStoreHydrated(STORE_NAME);
      },
    },
  ),
);
