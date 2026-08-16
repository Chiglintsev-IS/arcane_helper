/**
 * Порт хранилища сессии.
 *
 * Три метода намеренно: сессия читается и пишется целиком, потому что она мала, а частичная
 * запись открыла бы возможность рассинхрона между полями. Логика состояния зависит от этого
 * интерфейса, а не от Dexie, поэтому проверяется без браузера.
 */

import { z } from "zod";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

import { migrateCharacterState, migrateUndoPatch } from "@/core/domain/assembly/migration";
import { characterStatePatchSchema, characterStateSchema } from "@/core/domain/assembly/state";
import { spellSchema, type Spell } from "@/core/domain/catalog/spell";
import { fieldsOf } from "@/core/domain/shared/fields";
import { checkIntegrity } from "@/core/application/dataExchange";
import { JOURNAL_KINDS } from "@/core/domain/journal/entry";
import type { Session } from "@/core/application/session";

/** Версия формата хранения. Читать чужое будущее приложение не берётся. */
const STORAGE_SCHEMA_VERSION = 2;

const journalEntrySchema = z.object({
  id: z.string().min(1),
  at: z.string().min(1),
  kind: z.enum(JOURNAL_KINDS),
  summaryRu: z.string().min(1),
  /**
   * Снимок отмены — подмножество полей состояния, и проверяется он той же схемой: вид записи и форма
   * снимка приходят от владельцев, поэтому прочитанное не нужно приводить к типу силой. Снимка может
   * не быть: приведение снимает поля, которых состояние больше не знает, а запись остаётся.
   */
  undoPatch: characterStatePatchSchema.nullable(),
  /**
   * Идентификатор попытки, по которой запись появилась. Необязателен, поэтому версия формата не
   * растёт: сохранение без него читается ровно как прежде.
   */
  commandId: z.string().min(1).optional(),
  spellId: z.string().min(1).optional(),
  slotLevel: z.number().int().optional(),
  actionUsed: z.enum(["action", "bonus_action", "reaction"]).optional(),
  /**
   * Урон записи. Необязателен, поэтому версия формата не растёт: сохранение без него читается
   * ровно как прежде — проверка концентрации по такой записи просто неизвестна, как и была.
   */
  damage: z.number().int().optional(),
});

const persistedSessionSchema = z.object({
  schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
  savedAt: z.string().min(1),
  character: characterStateSchema,
  journal: z.array(journalEntrySchema),
  /**
   * Каталог заклинаний, загруженный игроком. Отсутствие поля означает встроенный каталог,
   * а не пустую книгу: копия встроенных карточек в хранилище заморозила бы книгу на дате установки
   *. Оно же делает записи, сделанные до,
   * читаемыми без миграции.
   */
  spellCatalog: z.array(spellSchema).optional(),
});

/** Снимок неизменяем, как и само состояние: в хранилище уходит то же, что лежит в сессии. */
export type PersistedSession = DeepReadonly<z.infer<typeof persistedSessionSchema>>;

/**
 * Хранилище сессии. Реализации взаимозаменяемы и проходят один набор тестов
 * (`describeRepositoryContract`).
 */
export type SessionRepository = {
  /** Прочитать сохранённую сессию. `null` — сохранений ещё не было. */
  load(): Promise<PersistedSession | null>;
  /**
   * Прочитать содержимое хранилища как есть, без разбора схемой. `null` — сохранений ещё не было.
   *
   * Отвергнутое сохранение схему не проходит по определению, а копия, по которой его чинят руками,
   * зависеть от схемы не вправе: разбор — это ровно то, что здесь отказало.
   */
  loadRaw(): Promise<unknown>;
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
    journal: persisted.journal,
  };
}

/**
 * Проверяет прочитанное. Разделяет два случая: версия новее — приложение старое; всё остальное —
 * данные повреждены. Сообщения разные потому, что действия пользователя разные.
 *
 * Ссылочная целостность проверяется здесь, а не только на входе импорта. Пока каталог был
 * константой сборки, рассогласование могло прийти только из файла; с собственным каталогом оно
 * лежит в базе, и подняться с подготовленным заклинанием без карточки нельзя — открыть его нечем.
 */
export function parsePersisted(raw: unknown): PersistedSession {
  const stored = fieldsOf(raw);
  const version = stored.schemaVersion;
  if (typeof version === "number" && version > STORAGE_SCHEMA_VERSION) {
    throw new StorageVersionError(version);
  }

  const migrated =
    raw === null || typeof raw !== "object"
      ? raw
      : {
          ...stored,
          schemaVersion: STORAGE_SCHEMA_VERSION,
          character: migrateCharacterState(stored.character),
          // Снимки отмены несут снаряжение прежней формы: без приведения отмена вернула бы его.
          ...(Array.isArray(stored.journal)
            ? {
                journal: stored.journal.map((entry) =>
                  entry !== null && typeof entry === "object" && "undoPatch" in entry
                    ? { ...entry, undoPatch: migrateUndoPatch(entry.undoPatch) }
                    : entry,
                ),
              }
            : {}),
        };

  const result = persistedSessionSchema.safeParse(migrated);
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
