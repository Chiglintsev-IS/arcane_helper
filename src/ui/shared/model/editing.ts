/**
 * Проводка правки: одна дверь и один способ узнать, почему правка не прошла.
 *
 * Экран не решает, годится ли набранное, — он отправляет его владельцу и получает либо применённое
 * изменение, либо причину отказа словами. Причина остаётся у шторки, в которой набирали: общая
 * шапка сообщает о том, что случилось вне шторки, и та же ошибка, показанная дважды, читается как
 * две.
 */

import type { StoreApi } from "zustand/vanilla";

import type { Command } from "@/contract/commands";

import type { SessionStoreState } from "@/ui/entities/session/model/sessionStore";

/** `null` — изменение применено; строка — причина отказа владельца. */
export async function applyEdit(
  store: StoreApi<SessionStoreState>,
  command: Command,
): Promise<string | null> {
  const reason = await store.getState().execute(command);
  if (reason !== null) store.getState().dismissError();
  return reason;
}
