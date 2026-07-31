/**
 * Порт хранилища сессии (ADR-0009).
 *
 * Три метода намеренно: сессия читается и пишется целиком, потому что она мала, а частичная
 * запись открыла бы возможность рассинхрона между полями. Логика состояния зависит от этого
 * интерфейса, а не от Dexie, поэтому проверяется без браузера.
 */

import { z } from "zod";

import { characterStateSchema } from "@/data/schemas/character";
import { spellSchema, type Spell } from "@/data/schemas/spell";
import { checkIntegrity } from "@/rules/dataIo";
import type { Session } from "./session";

/** Версия формата хранения. Читать чужое будущее приложение не берётся. */
export const STORAGE_SCHEMA_VERSION = 1;

const journalEntrySchema = z.object({
  id: z.string().min(1),
  at: z.string().min(1),
  kind: z.string().min(1),
  summaryRu: z.string().min(1),
  // Снимок отмены — произвольное подмножество полей состояния, поэтому проверяется как объект.
  undoPatch: z.record(z.string(), z.unknown()),
  spellId: z.string().min(1).optional(),
  slotLevel: z.number().int().optional(),
  actionUsed: z.enum(["action", "bonus_action", "reaction"]).optional(),
});

export const persistedSessionSchema = z.object({
  schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
  savedAt: z.string().min(1),
  character: characterStateSchema,
  journal: z.array(journalEntrySchema),
  /**
   * Каталог заклинаний, загруженный игроком (FR-123). Отсутствие поля означает встроенный каталог,
   * а не пустую книгу: копия встроенных карточек в хранилище заморозила бы книгу на дате установки
   * ([ADR-0019](../../docs/decisions.md#adr-0019)). Оно же делает записи, сделанные до FR-123,
   * читаемыми без миграции (NFR-003).
   */
  spellCatalog: z.array(spellSchema).optional(),
});

export type PersistedSession = z.infer<typeof persistedSessionSchema>;

/**
 * Хранилище сессии. Реализации взаимозаменяемы и проходят один набор тестов
 * (`describeRepositoryContract`).
 */
export type SessionRepository = {
  /** Прочитать сохранённую сессию. `null` — сохранений ещё не было. */
  load(): Promise<PersistedSession | null>;
  save(session: PersistedSession): Promise<void>;
  clear(): Promise<void>;
};

/**
 * Содержимое хранилища не прошло проверку. Данные при этом **не** затираются: испорченное
 * состояние можно выгрузить руками, а молча начать с чистого листа — потерять игру.
 */
export class StorageCorruptedError extends Error {
  constructor(readonly details: string) {
    super(`Сохранённое состояние повреждено: ${details}`);
    this.name = "StorageCorruptedError";
  }
}

/** Версия хранилища новее той, что понимает приложение. */
export class StorageVersionError extends Error {
  constructor(readonly found: unknown) {
    super(
      `Сохранение версии ${String(found)} новее поддерживаемой ${STORAGE_SCHEMA_VERSION}: обновите приложение`,
    );
    this.name = "StorageVersionError";
  }
}

/**
 * Готовит сессию к записи. Время берётся снаружи: модуль его не изобретает.
 *
 * Каталог передаётся явно и обязательным аргументом, `null` — «играем встроенным». Необязательный
 * аргумент здесь означал бы, что забытый вызов молча выбрасывает загруженные игроком карточки.
 */
export function toPersisted(
  session: Session,
  savedAt: string,
  spellCatalog: readonly Spell[] | null,
): PersistedSession {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    savedAt,
    character: session.character,
    journal: session.journal,
    // Ключа нет вовсе, а не `undefined`: «поля нет» и «каталог пуст» — разные состояния.
    ...(spellCatalog === null ? {} : { spellCatalog: [...spellCatalog] }),
  };
}

/** Восстанавливает сессию из прочитанного снимка. */
export function fromPersisted(persisted: PersistedSession): Session {
  return {
    character: persisted.character,
    journal: persisted.journal as Session["journal"],
  };
}

/**
 * Проверяет прочитанное. Разделяет два случая: версия новее — приложение старое; всё остальное —
 * данные повреждены. Сообщения разные потому, что действия пользователя разные.
 *
 * Ссылочная целостность проверяется здесь, а не только на входе импорта (FR-123). Пока каталог был
 * константой сборки, рассогласование могло прийти только из файла; с собственным каталогом оно
 * лежит в базе, и подняться с подготовленным заклинанием без карточки нельзя — открыть его нечем.
 */
export function parsePersisted(raw: unknown): PersistedSession {
  const version = (raw as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof version === "number" && version > STORAGE_SCHEMA_VERSION) {
    throw new StorageVersionError(version);
  }

  const result = persistedSessionSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "—"}: ${issue.message}`)
      .join("; ");
    throw new StorageCorruptedError(details);
  }

  const { spellCatalog } = result.data;
  if (spellCatalog !== undefined) {
    const broken = checkIntegrity(result.data.character, spellCatalog);
    if (broken !== null) throw new StorageCorruptedError(broken);
  }
  return result.data;
}
