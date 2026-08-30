import type { StoreApi } from "zustand/vanilla";

import type { Command } from "@/contract/commands";

import type { SessionStoreState } from "@/ui/entities/session/model/sessionStore";

export async function applyEdit(
  store: StoreApi<SessionStoreState>,
  command: Command,
): Promise<string | null> {
  const reason = await store.getState().execute(command);
  if (reason !== null) store.getState().dismissError();
  return reason;
}
