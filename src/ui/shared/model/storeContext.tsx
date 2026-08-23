/**
 * Доступ к сторам из компонентов.
 *
 * Контекст живёт в общем слое, потому что читают его все: экран, виджет и фича. Создание сторов —
 * наоборот, дело слоя приложения: только он знает, каким проводом дотянуться до ядра.
 */

"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";

import type { SessionStoreState } from "@/ui/entities/session/model/sessionStore";
import type { CastDraftState } from "@/ui/features/cast-spell/model/castDraftStore";

/**
 * Сторы приложения: зеркало ядра и черновик мастера.
 *
 * Часов здесь нет: время выгрузки и записей лога ставит ядро, а показывающему оно не нужно ни
 * для чего.
 */
export type AppStores = {
  session: StoreApi<SessionStoreState>;
  draft: StoreApi<CastDraftState>;
};

export const StoresContext = createContext<AppStores | null>(null);

/** Сторы напрямую: нужно там, где действие вызывается вне рендера. */
export function useStores(): AppStores {
  const stores = useContext(StoresContext);
  if (stores === null) {
    throw new Error("Компонент использует сторы вне StoreProvider");
  }
  return stores;
}

/** Часть состояния сессии. */
export function useSession<T>(selector: (state: SessionStoreState) => T): T {
  return useStore(useStores().session, selector);
}

/** Часть черновика применения. */
export function useDraft<T>(selector: (state: CastDraftState) => T): T {
  return useStore(useStores().draft, selector);
}
