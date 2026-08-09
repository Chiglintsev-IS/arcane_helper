/**
 * Композиционный корень приложения: чем собрано ядро и каким проводом до него дотягиваются.
 *
 * Единственное место, где отображение видит логику. Корень на то и корень, что видит всё; всем
 * остальным довольно договора.
 *
 * Провод выбирается здесь и только здесь. Сегодня он внутри процесса — приложение играет само с
 * собой; подставить сетевой значит поменять одну ветку, а не переписать экраны.
 */

"use client";

import { useEffect, type ReactNode } from "react";

import { createClient } from "@/contract/client";

import { createCore, type Core } from "@/core/composition";
import type { Clock } from "@/core/application/ports/clock";
import { systemClock } from "@/core/infrastructure/clock";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { createDexieRepository } from "@/core/infrastructure/persistence/dexieRepository";
import { createLocalTransport } from "@/core/presentation/localTransport";
import { createSessionStore } from "@/ui/entities/session/model/sessionStore";
import { createCastDraftStore } from "@/ui/features/cast-spell/model/castDraftStore";
import { StoresContext, type AppStores } from "@/ui/shared/model/storeContext";

/** Клиент к собранному ядру и сторы вокруг него: одинаково для приложения и для прогона. */
export function connectStores(core: Core, clock: Clock): AppStores {
  return {
    session: createSessionStore({
      api: createClient(createLocalTransport(core)),
      nextCommandId: clock.nextId,
    }),
    draft: createCastDraftStore(),
  };
}

/** Сторы для браузера: состояние в IndexedDB, персонаж по умолчанию — Торн, каталог встроенный. */
export function createBrowserStores(): AppStores {
  const clock = systemClock();
  return connectStores(
    createCore({
      repository: createDexieRepository(),
      clock,
      createInitialCharacter: createThorne,
      loadBuiltInCatalog: loadThorneSpells,
    }),
    clock,
  );
}

/** Провайдер сторов. Открытие сессии запускается здесь: интерфейсу незачем помнить про базу. */
export function StoreProvider({ stores, children }: { stores: AppStores; children: ReactNode }) {
  useEffect(() => {
    if (stores.session.getState().status === "loading") {
      void stores.session.getState().hydrate();
    }
  }, [stores]);

  return <StoresContext.Provider value={stores}>{children}</StoresContext.Provider>;
}
