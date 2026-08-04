/**
 * Проводка правки: одна дверь и один способ узнать, почему правка не прошла.
 *
 * Экран не решает, годится ли набранное, — он передаёт его владельцу и получает либо изменённое
 * состояние, либо причину отказа словами. Причина остаётся у шторки, в которой набирали: общая шапка
 * сообщает о том, что случилось вне шторки, и та же ошибка, показанная дважды, читается как две.
 */

import type { Session } from "@/core/application/session";
import type { StoreApi } from "zustand/vanilla";

import type { SessionStoreState } from "@/ui/entities/session/model/sessionStore";

/** `null` — состояние изменилось; строка — причина отказа владельца. */
export function applyEdit(
  store: StoreApi<SessionStoreState>,
  operation: (session: Session) => Session,
): string | null {
  const reason = store.getState().apply(operation);
  if (reason !== null) store.getState().dismissError();
  return reason;
}
