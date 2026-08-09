/**
 * Стор сессии: зеркало ядра, а не владелец состояния.
 *
 * Состоянием, хранилищем и часами владеет ядро; сюда приходит то, что оно рассказало о себе. Стор
 * отправляет намерения и держит показанное — снимок, причину последнего отказа, признак загрузки.
 *
 * Намерение уходит данными, а не замыканием: у команды есть имя, схема и идентификатор попытки,
 * поэтому её можно проверить, повторить и однажды отправить по сети. Замыкание не умеет ничего из
 * этого.
 *
 * Персонаж и каталог лежат здесь временно, на срок переезда: отображение ещё выводит числа из
 * состояния само. Оба поля уходят вместе с последним таким местом, и снимок остаётся единственным
 * чтением.
 */

import { createStore, type StoreApi } from "zustand/vanilla";

import type { Command } from "@/contract/commands";
import type { ArcaneApi } from "@/contract/port";
import type { Snapshot } from "@/contract/snapshot";

import type { Session, SpellCatalogSource } from "@/core/application/session";
import type { Spell } from "@/core/domain/catalog/spell";

export type SessionStatus = "loading" | "ready" | "error";

/** Откуда стор берёт то, чего ядро по проводу не отдаёт. Уходит вместе с проекциями. */
export type LiveReader = () => {
  session: Session;
  spellCatalog: readonly Spell[];
  spellCatalogSource: SpellCatalogSource;
} | null;

export type SessionStoreState = {
  snapshot: Snapshot | null;
  session: Session | null;
  spellCatalog: readonly Spell[];
  spellCatalogSource: SpellCatalogSource;
  status: SessionStatus;
  /** Причина последнего отказа: показывается игроку, состояние при этом не испорчено. */
  error: string | null;

  /** Открыть сессию: ядро прочитает сохранённое либо начнёт заново. Повтор безвреден. */
  hydrate: () => Promise<void>;
  /**
   * Отправить намерение. Возвращает причину отказа или `null` при успехе — так вызывающий узнаёт,
   * почему не прошло, не разбирая исключений.
   *
   * Идентификатор попытки ставится здесь, в момент вызова: повторная доставка — забота провода, и
   * когда она появится, повторять он будет ровно этот идентификатор.
   */
  execute: (command: Command) => Promise<string | null>;
  /** Снять сообщение об ошибке. */
  dismissError: () => void;
};

export type SessionStoreDependencies = {
  api: ArcaneApi;
  /** Идентификаторы попыток. Те же часы, что у ядра, но здесь они нужны только для этого. */
  nextCommandId: () => string;
  /** Временная дверь к состоянию: отображение ещё считает по нему. */
  readLive: LiveReader;
};

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createSessionStore(
  dependencies: SessionStoreDependencies,
): StoreApi<SessionStoreState> {
  const { api, nextCommandId, readLive } = dependencies;

  return createStore<SessionStoreState>((set) => {
    /** Показанное подтягивается за снимком: пока проекций нет, часть чисел живёт в состоянии. */
    const mirror = (snapshot: Snapshot): void => {
      const live = readLive();
      set({
        snapshot,
        ...(live === null
          ? {}
          : {
              session: live.session,
              spellCatalog: live.spellCatalog,
              spellCatalogSource: live.spellCatalogSource,
            }),
      });
    };

    return {
      snapshot: null,
      session: null,
      spellCatalog: [],
      spellCatalogSource: "built_in",
      status: "loading",
      error: null,

      async hydrate() {
        set({ status: "loading", error: null });
        try {
          mirror(await api.open());
          set({ status: "ready" });
        } catch (error: unknown) {
          // Данные остаются в хранилище: их можно выгрузить руками, а начать с чистого листа
          // молча — потерять игру.
          set({ session: null, status: "error", error: describe(error) });
        }
      },

      async execute(command) {
        try {
          const result = await api.execute({ commandId: nextCommandId(), command });
          if (!result.ok) {
            set({ error: result.reasonRu });
            return result.reasonRu;
          }
          mirror(result.snapshot);
          set({ error: null });
          return null;
        } catch (error: unknown) {
          const reason = describe(error);
          set({ error: reason });
          return reason;
        }
      },

      dismissError() {
        set({ error: null });
      },
    };
  });
}
