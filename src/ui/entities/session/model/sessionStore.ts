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
 * Состояния персонажа здесь нет ни поля: снимок — единственное чтение, и второго способа узнать то
 * же самое не существует.
 */

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
  /** Причина последнего отказа: показывается игроку, состояние при этом не испорчено. */
  error: string | null;
  /**
   * Копия сохранения, которое не прочиталось, — содержимое хранилища как есть. `null` — копировать
   * нечего. Её забирают до того, как начать заново: после очистки её больше нет нигде.
   */
  rawSave: RawSave;

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
  /**
   * Спросить про набранное, но ещё не отправленное. Ответ никуда не зеркалится: состояние им не
   * менялось. Недоступный ответчик даёт `null` — предпросмотр молчит, а игрок всё равно вправе
   * подтвердить и получить настоящий отказ.
   */
  ask: (question: Question) => Promise<Preview | null>;
  /** Снять сообщение об ошибке. */
  dismissError: () => void;
};

export type SessionStoreDependencies = {
  api: ArcaneApi;
  /** Идентификаторы попыток. Те же часы, что у ядра, но здесь они нужны только для этого. */
  nextCommandId: () => string;
};

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Ответ отстал от показанного: две команды в полёте возвращаются в любом порядке, и снимок
 * прежней вернул бы экран в прошлое — с потраченной ячейкой на месте.
 *
 * Сравнение только для ответов. Чтение приносит новую правду целиком: ядро могло начаться заново,
 * и его версия тогда меньше показанной.
 */
function outdated(shown: Snapshot | null, answered: Snapshot): boolean {
  return shown !== null && answered.version < shown.version;
}

export function createSessionStore(
  dependencies: SessionStoreDependencies,
): StoreApi<SessionStoreState> {
  const { api, nextCommandId } = dependencies;

  return createStore<SessionStoreState>((set) => {
    /** Хранилище, не отдавшее и сырого содержимого, копией не притворяется: копировать нечего. */
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
          // Данные остаются в хранилище, а копия — под рукой у игрока: начать с чистого листа
          // молча значит потерять игру, а без копии — потерять её одним нажатием.
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
          // Ядро ответило состоянием — значит читать его больше не мешает ничто, и копии
          // непрочитанного взяться неоткуда.
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
