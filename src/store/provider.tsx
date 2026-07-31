/**
 * Связка сторов с React.
 *
 * Сторы создаются снаружи и передаются провайдером: компонент не выбирает ни хранилище, ни часы,
 * поэтому те же компоненты проверяются на хранилище в памяти без браузера (ADR-0009).
 *
 * Черновик применения — отдельный стор рядом с сессией, а не поле внутри неё: это техническая
 * гарантия FR-022.
 */

"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";

import { loadThorneSpells } from "@/data/content/thorne";
import { createThorne } from "@/data/content/thorne/character";
import { createCastDraftStore, type CastDraftState } from "./castDraftStore";
import { createDexieRepository } from "./dexieRepository";
import type { Clock } from "./session";
import { createSessionStore, type SessionStoreState } from "./sessionStore";

export type AppStores = {
  session: StoreApi<SessionStoreState>;
  draft: StoreApi<CastDraftState>;
  /** Время и идентификаторы: операции состояния их не изобретают. */
  clock: Clock;
};

/** Часы приложения. Идентификаторы — `crypto.randomUUID`: он есть и в браузере, и в Node. */
export function systemClock(): Clock {
  return {
    now: () => new Date().toISOString(),
    nextId: () => crypto.randomUUID(),
  };
}

/**
 * Сторы для браузера: состояние в IndexedDB, персонаж по умолчанию — Торн, каталог заклинаний —
 * встроенный, пока игрок не загрузил свой (FR-123).
 *
 * Контент подставляется здесь, а не берётся стором самостоятельно: так стор не зависит от сборки
 * и проверяется на любом наборе карточек.
 */
export function createBrowserStores(): AppStores {
  const clock = systemClock();
  return {
    session: createSessionStore({
      repository: createDexieRepository(),
      clock,
      createInitialCharacter: createThorne,
      loadBuiltInCatalog: loadThorneSpells,
    }),
    draft: createCastDraftStore(),
    clock,
  };
}

const StoresContext = createContext<AppStores | null>(null);

/**
 * Провайдер сторов. Загрузка состояния запускается здесь: интерфейсу не нужно помнить,
 * что состояние приходит из базы асинхронно.
 */
export function StoreProvider({
  stores,
  children,
}: {
  stores: AppStores;
  children: ReactNode;
}) {
  useEffect(() => {
    if (stores.session.getState().status === "loading") {
      void stores.session.getState().hydrate();
    }
  }, [stores]);

  return <StoresContext.Provider value={stores}>{children}</StoresContext.Provider>;
}

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
