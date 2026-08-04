/**
 * Хранилище в памяти: реализация порта для тестов и для окружения без IndexedDB.
 *
 * Ведёт себя как настоящее: запись сохраняет копию — браузерная база тоже сериализует переданное, и
 * подмена, работающая по ссылке, вела бы себя иначе, чем та, которую она подменяет. Чтение копии не
 * делает: разбор прочитанного и так собирает новые объекты.
 */

import {
  parsePersisted,
  type PersistedSession,
  type SessionRepository,
} from "@/core/application/ports/sessionRepository";

export function createMemoryRepository(initial?: unknown): SessionRepository {
  let stored: unknown = initial ?? null;

  return {
    async load(): Promise<PersistedSession | null> {
      if (stored === null || stored === undefined) return null;
      return parsePersisted(stored);
    },

    async save(session: PersistedSession): Promise<void> {
      stored = structuredClone(session);
    },

    async clear(): Promise<void> {
      stored = null;
    },
  };
}
