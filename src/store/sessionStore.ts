/**
 * Стор сессии: единственная точка изменения состояния в приложении.
 *
 * У стора одна операция изменения — `apply`, принимающая чистую функцию из `session.ts`. Благодаря
 * этому новая операция над состоянием не требует ни строчки правок здесь: стор не знает, что именно
 * делает переданная функция, он отвечает за загрузку, сохранение и показ ошибок.
 *
 * Зависимости приходят снаружи (хранилище, часы, начальное состояние): стор не выбирает реализацию
 * и потому проверяется без браузера — см. ADR-0009.
 */

import { createStore, type StoreApi } from "zustand/vanilla";

import type { CharacterState } from "@/data/schemas/character";
import { fromPersisted, toPersisted, type SessionRepository } from "./repository";
import { createSession, type Clock, type Session } from "./session";

export type SessionStatus = "loading" | "ready" | "error";

export type SessionStoreState = {
  session: Session | null;
  status: SessionStatus;
  /** Сообщение последней ошибки: показывается пользователю, состояние при этом не испорчено. */
  error: string | null;

  /** Прочитать сохранённое или начать с чистого состояния персонажа. */
  hydrate: () => Promise<void>;
  /**
   * Применить операцию над состоянием. Возвращает текст ошибки или `null` при успехе —
   * так вызывающий узнаёт о причине, не разбирая исключений.
   */
  apply: (operation: (session: Session) => Session) => string | null;
  /** Забыть сохранённое и начать заново. */
  reset: () => Promise<void>;
  /** Снять сообщение об ошибке. */
  dismissError: () => void;
};

export type SessionStoreDependencies = {
  repository: SessionRepository;
  clock: Clock;
  /** Как выглядит персонаж, если сохранений ещё нет. */
  createInitialCharacter: () => CharacterState;
};

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createSessionStore(
  dependencies: SessionStoreDependencies,
): StoreApi<SessionStoreState> {
  const { repository, clock, createInitialCharacter } = dependencies;

  return createStore<SessionStoreState>((set, get) => {
    /**
     * Немедленная запись после каждого изменения: дебаунс сложнее и теряет последнее действие,
     * если приложение закрыли. Ошибка записи показывается — молчать о ней значит обещать
     * сохранность, которой нет.
     */
    const persist = (session: Session): void => {
      void repository.save(toPersisted(session, clock.now())).catch((error: unknown) => {
        set({ error: `Не удалось сохранить состояние: ${describe(error)}` });
      });
    };

    return {
      session: null,
      status: "loading",
      error: null,

      async hydrate() {
        set({ status: "loading", error: null });
        try {
          const stored = await repository.load();
          if (stored === null) {
            const fresh = createSession(createInitialCharacter());
            set({ session: fresh, status: "ready" });
            persist(fresh);
            return;
          }
          set({ session: fromPersisted(stored), status: "ready" });
        } catch (error: unknown) {
          // Данные остаются в хранилище: их можно выгрузить руками, а начать с чистого листа
          // молча — потерять игру.
          set({ session: null, status: "error", error: describe(error) });
        }
      },

      apply(operation) {
        const { session } = get();
        if (session === null) {
          const message = "Состояние ещё не загружено";
          set({ error: message });
          return message;
        }
        try {
          const next = operation(session);
          set({ session: next, error: null });
          persist(next);
          return null;
        } catch (error: unknown) {
          const message = describe(error);
          set({ error: message });
          return message;
        }
      },

      async reset() {
        await repository.clear();
        const fresh = createSession(createInitialCharacter());
        set({ session: fresh, status: "ready", error: null });
        persist(fresh);
      },

      dismissError() {
        set({ error: null });
      },
    };
  });
}
