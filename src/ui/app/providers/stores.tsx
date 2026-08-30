"use client";

import { useEffect, type ReactNode } from "react";

import { createClient } from "@/contract/client";
import { createHttpTransport } from "@/contract/httpTransport";
import type { ArcaneApi } from "@/contract/port";
import type { Transport } from "@/contract/transport";

import { createSessionStore } from "@/ui/entities/session/model/sessionStore";
import { createCastDraftStore } from "@/ui/features/cast-spell/model/castDraftStore";
import { StoresContext, type AppStores } from "@/ui/shared/model/storeContext";

const BACKEND_URL = "/api/arcane";

const NETWORKED = process.env.NEXT_PUBLIC_ARCANE_BACKEND === "http";

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

export function createBrowserStores(): AppStores {
  return connectStores(createClient(chosenWire()), () => crypto.randomUUID());
}

export function StoreProvider({ stores, children }: { stores: AppStores; children: ReactNode }) {
  useEffect(() => {
    if (stores.session.getState().status === "loading") {
      void stores.session.getState().hydrate();
    }
  }, [stores]);

  return <StoresContext.Provider value={stores}>{children}</StoresContext.Provider>;
}
