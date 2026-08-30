import { type CharacterState, EXPORT_SCHEMA_VERSION, characterStateSchema, exportFileSchema } from "@/core/domain/assembly/state";
import { migrateCharacterState } from "@/core/domain/assembly/migration";
import { spellSchema, type Spell } from "@/core/domain/catalog/spell";
import { fieldsOf } from "@/core/domain/shared/fields";
import { parsedBySchema } from "@/core/domain/shared/schema";

export type ExportFile = {
  schemaVersion: number;
  exportedAt: string;
  character: CharacterState;
  spells: Spell[];
};

type ImportMode = "replace" | "spells_only";

type ImportOutcome =
  | { ok: true; file: ExportFile }
  | { ok: false; reasonRu: string };

export function exportSnapshot(
  character: CharacterState,
  spells: readonly Spell[],
  now: string,
): ExportFile {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now,
    character,
    spells: [...spells],
  };
}

const FILE_PREFIX = "arcane-helper";

export function exportFileName(now: string): string {
  return `${FILE_PREFIX}-${now.slice(0, 10)}.json`;
}

export function rawSaveFileName(now: string): string {
  return `${FILE_PREFIX}-raw-${now.slice(0, 10)}.json`;
}

function describeIssues(error: { issues: readonly { path: PropertyKey[]; message: string }[] }): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join(".") || "файл"}: ${issue.message}`)
    .join("; ");
}

export function parseImport(raw: string): ImportOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reasonRu: "Это не JSON: файл не разбирается как текст данных." };
  }

  const fields = fieldsOf(parsed);
  const version = fields.schemaVersion;
  if (typeof version === "number" && version > EXPORT_SCHEMA_VERSION) {
    return {
      ok: false,
      reasonRu: `Файл версии ${version}, приложение понимает до ${EXPORT_SCHEMA_VERSION}. Обновите приложение.`,
    };
  }

  const migrated =
    parsed === null || typeof parsed !== "object"
      ? parsed
      : {
          ...fields,
          schemaVersion: EXPORT_SCHEMA_VERSION,
          character: migrateCharacterState(fields.character),
        };

  const file = parsedBySchema(exportFileSchema, migrated);
  if (!file.success) {
    return { ok: false, reasonRu: `Файл не прошёл проверку — ${describeIssues(file.error)}` };
  }

  const spells: Spell[] = [];
  for (const [index, raw] of file.data.spells.entries()) {
    const spell = parsedBySchema(spellSchema, raw);
    if (!spell.success) {
      return {
        ok: false,
        reasonRu: `Карточка №${index + 1} не прошла проверку — ${describeIssues(spell.error)}`,
      };
    }
    spells.push(spell.data);
  }

  const integrity = checkIntegrity(file.data.character, spells);
  if (integrity !== null) return { ok: false, reasonRu: integrity };

  return { ok: true, file: { ...file.data, spells } };
}

const SET_LABELS_RU = {
  cantripIds: "заговоры",
  spellbookSpellIds: "книга заклинаний",
  preparedSpellIds: "подготовленное",
} as const;

export function checkIntegrity(
  character: CharacterState,
  spells: readonly Spell[],
): string | null {
  const known = new Set(spells.map((spell) => spell.id));
  for (const field of ["cantripIds", "spellbookSpellIds", "preparedSpellIds"] as const) {
    for (const id of character[field]) {
      if (!known.has(id)) {
        return `В каталоге нет карточки «${id}», на которую ссылается набор «${SET_LABELS_RU[field]}».`;
      }
    }
  }
  return null;
}

export function applyImport(
  current: CharacterState,
  file: ExportFile,
  mode: ImportMode,
): { character: CharacterState; spells: Spell[] } {
  if (mode === "replace") {
    return { character: characterStateSchema.parse(file.character), spells: file.spells };
  }
  return { character: current, spells: file.spells };
}
