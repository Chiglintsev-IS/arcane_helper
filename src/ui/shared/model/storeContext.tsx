"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";

import type { SessionStoreState } from "@/ui/entities/session/model/sessionStore";
import type { CastDraftState } from "@/ui/features/cast-spell/model/castDraftStore";

export type AppStores = {
  session: StoreApi<SessionStoreState>;
  draft: StoreApi<CastDraftState>;
};

export const StoresContext = createContext<AppStores | null>(null);

export function useStores(): AppStores {
  const stores = useContext(StoresContext);
  if (stores === null) {
    throw new Error("Компонент использует сторы вне StoreProvider");
  }
  return stores;
}

export function useSession<T>(selector: (state: SessionStoreState) => T): T {
  return useStore(useStores().session, selector);
}

export function useDraft<T>(selector: (state: CastDraftState) => T): T {
  return useStore(useStores().draft, selector);
}
