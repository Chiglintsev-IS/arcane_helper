/**
 * Сборка приложения: какие хранилище и часы подставить сторам.
 *
 * Слой приложения — единственное место, где выбирается реализация порта. Компоненты про Dexie и про
 * системные часы не знают и потому проверяются на хранилище в памяти без браузера.
 */

"use client";

import { useEffect, type ReactNode } from "react";

import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { createDexieRepository } from "@/core/infrastructure/persistence/dexieRepository";
import type { Clock } from "@/core/application/session";
import { createSessionStore } from "@/ui/entities/session/model/sessionStore";
import { createCastDraftStore } from "@/ui/features/cast-spell/model/castDraftStore";
import { StoresContext, type AppStores } from "@/ui/shared/model/storeContext";


/** Часы приложения. Идентификаторы — `crypto.randomUUID`: он есть и в браузере, и в Node. */
export function systemClock(): Clock {
  return {
    now: () => new Date().toISOString(),
    nextId: () => crypto.randomUUID(),
  };
}

/** Сторы для браузера: состояние в IndexedDB, персонаж по умолчанию — Торн, каталог встроенный. */
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

/** Провайдер сторов. Загрузка состояния запускается здесь: интерфейсу незачем помнить про базу. */
export function StoreProvider({ stores, children }: { stores: AppStores; children: ReactNode }) {
  useEffect(() => {
    if (stores.session.getState().status === "loading") {
      void stores.session.getState().hydrate();
    }
  }, [stores]);

  return <StoresContext.Provider value={stores}>{children}</StoresContext.Provider>;
}
