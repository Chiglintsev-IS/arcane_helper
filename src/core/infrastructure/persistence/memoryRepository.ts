/**
 * Запись сохраняет копию: браузерная база сериализует переданное, и подмена, работающая по ссылке,
 * вела бы себя иначе, чем та, которую она подменяет.
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

    async loadRaw(): Promise<unknown> {
      return stored;
    },

    async save(session: PersistedSession): Promise<void> {
      stored = structuredClone(session);
    },

    async clear(): Promise<void> {
      stored = null;
    },
  };
}
