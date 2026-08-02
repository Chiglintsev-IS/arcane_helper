/**
 * Хранилище на IndexedDB через Dexie: браузерная реализация порта.
 *
 * Одна таблица с одной записью — сессия целиком. Схема версионируется средствами Dexie,
 * и миграция обязана сохранять содержимое: удаление таблицы состояния недопустимо
 */

import Dexie, { type Table } from "dexie";

import {
  parsePersisted,
  type PersistedSession,
  type SessionRepository,
} from "@/core/application/ports/sessionRepository";

/** Единственная запись состояния. Ключ фиксированный: сессия одна. */
const SESSION_KEY = "current";

type StoredRow = { key: string; payload: unknown };

class ArcaneHelperDatabase extends Dexie {
  readonly sessions!: Table<StoredRow, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ sessions: "key" });
  }
}

export const DATABASE_NAME = "arcane-helper";

/**
 * Создаёт браузерное хранилище. Имя базы — параметр, чтобы тесты не мешали друг другу
 * и не трогали настоящие данные пользователя.
 */
export function createDexieRepository(name: string = DATABASE_NAME): SessionRepository {
  const database = new ArcaneHelperDatabase(name);

  return {
    async load(): Promise<PersistedSession | null> {
      const row = await database.sessions.get(SESSION_KEY);
      if (row === undefined) return null;
      return parsePersisted(row.payload);
    },

    async save(session: PersistedSession): Promise<void> {
      await database.sessions.put({ key: SESSION_KEY, payload: session });
    },

    async clear(): Promise<void> {
      await database.sessions.delete(SESSION_KEY);
    },
  };
}
