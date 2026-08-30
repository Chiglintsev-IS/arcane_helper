import { z } from "zod";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

import { migrateCharacterState, migrateUndoPatch } from "@/core/domain/assembly/migration";
import { characterStatePatchSchema, characterStateSchema } from "@/core/domain/assembly/state";
import { spellSchema, type Spell } from "@/core/domain/catalog/spell";
import { fieldsOf } from "@/core/domain/shared/fields";
import { parsedBySchema } from "@/core/domain/shared/schema";
import { checkIntegrity } from "@/core/application/dataExchange";
import { LOG_KINDS } from "@/core/domain/log/entry";
import type { Session } from "@/core/application/session";

const STORAGE_SCHEMA_VERSION = 3;

const LEGACY_LOG_FIELD = "journal";

const logEntrySchema = z.object({
  id: z.string().min(1),
  at: z.string().min(1),
  kind: z.enum(LOG_KINDS),
  summaryRu: z.string().min(1),
  undoPatch: characterStatePatchSchema.nullable(),
  commandId: z.string().min(1).optional(),
  spellId: z.string().min(1).optional(),
  slotLevel: z.number().int().optional(),
  actionUsed: z.enum(["action", "bonus_action", "reaction"]).optional(),
  damage: z.number().int().optional(),
});

const persistedSessionSchema = z.object({
  schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
  savedAt: z.string().min(1),
  character: characterStateSchema,
  log: z.array(logEntrySchema),
  spellCatalog: z.array(spellSchema).optional(),
});

export type PersistedSession = DeepReadonly<z.infer<typeof persistedSessionSchema>>;

export type SessionRepository = {
  load(): Promise<PersistedSession | null>;
  loadRaw(): Promise<unknown>;
  save(session: PersistedSession): Promise<void>;
  clear(): Promise<void>;
};

export class StorageCorruptedError extends Error {
  constructor(readonly details: string) {
    super(`Сохранённое состояние повреждено: ${details}`);
    this.name = "StorageCorruptedError";
  }
}

export class StorageVersionError extends Error {
  constructor(readonly found: unknown) {
    super(
      `Сохранение версии ${String(found)} новее поддерживаемой ${STORAGE_SCHEMA_VERSION}: обновите приложение`,
    );
    this.name = "StorageVersionError";
  }
}

export function toPersisted(
  session: Session,
  savedAt: string,
  spellCatalog: readonly Spell[] | null,
): PersistedSession {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    savedAt,
    character: session.character,
    log: session.log,
    ...(spellCatalog === null ? {} : { spellCatalog: [...spellCatalog] }),
  };
}

export function fromPersisted(persisted: PersistedSession): Session {
  return {
    character: persisted.character,
    log: persisted.log,
  };
}

export function parsePersisted(raw: unknown): PersistedSession {
  const stored = fieldsOf(raw);
  const storedEntries = Array.isArray(stored.log) ? stored.log : stored[LEGACY_LOG_FIELD];
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
          ...(Array.isArray(storedEntries)
            ? {
                log: storedEntries.map((entry) =>
                  entry !== null && typeof entry === "object" && "undoPatch" in entry
                    ? { ...entry, undoPatch: migrateUndoPatch(entry.undoPatch) }
                    : entry,
                ),
              }
            : {}),
        };

  const result = parsedBySchema(persistedSessionSchema, migrated);
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
