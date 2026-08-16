/**
 * Композиционный корень приложения: каким проводом отображение дотягивается до ядра.
 *
 * Единственное место, где отображение видит логику. Корень на то и корень, что видит всё; всем
 * остальным довольно договора.
 *
 * Провод выбирается здесь и только здесь, переменной сборки. Ядро приезжает динамическим импортом:
 * статический положил бы его в бандл при любом выборе, и сетевая сборка возила бы с собой логику,
 * к которой не обращается ни разу.
 */

"use client";

import { useEffect, type ReactNode } from "react";

import { createClient } from "@/contract/client";
import { createHttpTransport } from "@/contract/httpTransport";
import type { ArcaneApi } from "@/contract/port";
import type { Transport } from "@/contract/transport";

import { createSessionStore } from "@/ui/entities/session/model/sessionStore";
import { createCastDraftStore } from "@/ui/features/cast-spell/model/castDraftStore";
import { StoresContext, type AppStores } from "@/ui/shared/model/storeContext";

/** Бэкенд своего же происхождения: маршруты живут в этой самой сборке. */
const BACKEND_URL = "/api/arcane";

const NETWORKED = process.env.NEXT_PUBLIC_ARCANE_BACKEND === "http";

/** Сторы вокруг двери ядра: одинаково для приложения и для прогона, каким бы ни был провод. */
export function connectStores(api: ArcaneApi, nextCommandId: () => string): AppStores {
  return {
    session: createSessionStore({ api, nextCommandId }),
    draft: createCastDraftStore(),
  };
}

async function localWire(): Promise<Transport> {
  const { createBrowserWire } = await import("@/core/browserWire");
  return createBrowserWire();
}

/**
 * Провод до ядра. Сетевой готов сразу, локальный ждёт, пока приедет ядро: сообщение всё равно
 * доставляется обещанием, и ждать его отправки — то же самое, что ждать ответа.
 */
function chosenWire(): Transport {
  if (NETWORKED) return createHttpTransport(BACKEND_URL);

  const opened = localWire();
  return {
    read: async () => (await opened).read(),
    readRaw: async () => (await opened).readRaw(),
    send: async (command) => (await opened).send(command),
    ask: async (question) => (await opened).ask(question),
  };
}

/**
 * Сторы для браузера: состояние держит ядро — своё в процессе или бэкенда.
 *
 * Идентификатор попытки выдаёт эта сторона: он описывает попытку доставки, а не намерение, и часов
 * ядра для него не нужно — по сети их и нет.
 */
export function createBrowserStores(): AppStores {
  return connectStores(createClient(chosenWire()), () => crypto.randomUUID());
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
