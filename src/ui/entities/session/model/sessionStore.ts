import { createStore, type StoreApi } from "zustand/vanilla";

import type { Command } from "@/contract/commands";
import type { ArcaneApi } from "@/contract/port";
import type { Preview, Question } from "@/contract/questions";
import type { RawSave } from "@/contract/rawSave";
import type { Snapshot } from "@/contract/snapshot";

export type SessionStatus = "loading" | "ready" | "error";

export type SessionStoreState = {
  snapshot: Snapshot | null;
  status: SessionStatus;
  error: string | null;
  rawSave: RawSave;

  hydrate: () => Promise<void>;
  execute: (command: Command) => Promise<string | null>;
  ask: (question: Question) => Promise<Preview | null>;
  dismissError: () => void;
};

export type SessionStoreDependencies = {
  api: ArcaneApi;
  nextCommandId: () => string;
};

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function outdated(shown: Snapshot | null, answered: Snapshot): boolean {
  return shown !== null && answered.version < shown.version;
}

export function createSessionStore(
  dependencies: SessionStoreDependencies,
): StoreApi<SessionStoreState> {
  const { api, nextCommandId } = dependencies;

  return createStore<SessionStoreState>((set) => {
    const copyOfStored = (): Promise<RawSave> => api.readRaw().catch(() => null);

    return {
      snapshot: null,
      status: "loading",
      error: null,
      rawSave: null,

      async hydrate() {
        set({ status: "loading", error: null });
        try {
          set({ snapshot: await api.open() });
          set({ status: "ready", rawSave: null });
        } catch (error: unknown) {
          set({ status: "error", error: describe(error), rawSave: await copyOfStored() });
        }
      },

      async execute(command) {
        try {
          const result = await api.execute({ commandId: nextCommandId(), command });
          if (!result.ok) {
            set({ error: result.reasonRu });
            return result.reasonRu;
          }
          set((shown) => ({
            snapshot: outdated(shown.snapshot, result.snapshot) ? shown.snapshot : result.snapshot,
            status: "ready",
            error: null,
            rawSave: null,
          }));
          return null;
        } catch (error: unknown) {
          const reason = describe(error);
          set({ error: reason });
          return reason;
        }
      },

      async ask(question) {
        try {
          return await api.ask(question);
        } catch {
          return null;
        }
      },

      dismissError() {
        set({ error: null });
      },
    };
  });
}
