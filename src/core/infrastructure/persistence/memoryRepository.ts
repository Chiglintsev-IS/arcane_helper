/**
 * Хранилище в памяти: реализация порта для тестов и для окружения без IndexedDB.
 *
 * Ведёт себя как настоящее: возвращает копии, чтобы никто не смог изменить сохранённое,
 * держа ссылку на переданный объект.
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
      return parsePersisted(structuredClone(stored));
    },

    async save(session: PersistedSession): Promise<void> {
      stored = structuredClone(session);
    },

    async clear(): Promise<void> {
      stored = null;
    },
  };
}
