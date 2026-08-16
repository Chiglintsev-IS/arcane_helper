/**
 * Импорт и экспорт данных.
 *
 * Экспорт — единственный способ не потерять персонажа: приложение живёт в браузере телефона, а
 * браузер вправе очистить хранилище. Импорт — обратная сторона, и он обязан быть безопасным: файл
 * приходит извне, может быть от другой версии приложения или отредактирован руками.
 *
 * Проверка и типы — одна и та же Zod-схема, что читает собственный контент.
 * Второй валидатор рано или поздно разошёлся бы с первым, и импорт принимал бы то, чего приложение
 * не умеет показать.
 */

import { type CharacterState, EXPORT_SCHEMA_VERSION, characterStateSchema, exportFileSchema } from "@/core/domain/assembly/state";
import { migrateCharacterState } from "@/core/domain/assembly/migration";
import { spellSchema, type Spell } from "@/core/domain/catalog/spell";
import { fieldsOf } from "@/core/domain/shared/fields";

export type ExportFile = {
  schemaVersion: number;
  exportedAt: string;
  character: CharacterState;
  spells: Spell[];
};

/** Что делать с существующими данными: заменить всё или обновить только карточки. */
type ImportMode = "replace" | "spells_only";

type ImportOutcome =
  | { ok: true; file: ExportFile }
  | { ok: false; reasonRu: string };

/**
 * Снимок для выгрузки.
 *
 * Персонаж выгружается целиком, включая заметки, подготовку и остаток ресурсов: смысл резервной
 * копии в том, чтобы восстановиться ровно там, где остановились, а не начать заново.
 */
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

/** Читаемое имя файла: дата в имени избавляет от папки из десяти «export (3).json». */
export function exportFileName(now: string): string {
  return `${FILE_PREFIX}-${now.slice(0, 10)}.json`;
}

/**
 * Имя копии сырого сохранения — содержимого хранилища, которое разбор отверг.
 *
 * Названо иначе, чем файл выгрузки: загрузка такой файл не принимает, и одинаковое имя обещало бы
 * игроку обратный путь, которого у этой копии нет. Её читают руками и по ней сохранение чинят.
 */
export function rawSaveFileName(now: string): string {
  return `${FILE_PREFIX}-raw-${now.slice(0, 10)}.json`;
}

function describeIssues(error: { issues: readonly { path: PropertyKey[]; message: string }[] }): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join(".") || "файл"}: ${issue.message}`)
    .join("; ");
}

/**
 * Разбор файла импорта.
 *
 * Ошибка называет путь до поля и то, что именно не так: «Ошибка импорта» без деталей делает функцию
 * бесполезной — пользователю остаётся править JSON вслепую.
 *
 * Версия проверяется раньше структуры. Файл более новой версии отклоняется с внятным сообщением, а
 * не разбирается по частям: приложение не знает, что в нём изменилось, и «частично понял» здесь
 * означает «молча потерял».
 */
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

  const file = exportFileSchema.safeParse(migrated);
  if (!file.success) {
    return { ok: false, reasonRu: `Файл не прошёл проверку — ${describeIssues(file.error)}` };
  }

  const spells: Spell[] = [];
  for (const [index, raw] of file.data.spells.entries()) {
    const spell = spellSchema.safeParse(raw);
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

/** Как назвать набор игроку: имя поля схемы ему ничего не говорит. */
const SET_LABELS_RU = {
  cantripIds: "заговоры",
  spellbookSpellIds: "книга заклинаний",
  preparedSpellIds: "подготовленное",
} as const;

/**
 * Ссылочная целостность: заговоры, книга и подготовленное ссылаются на существующие карточки
 *
 * Схема одного объекта этого не видит — она не знает про соседнюю коллекцию. Пропустить сюда
 * ссылку в пустоту значит получить приложение, которое показывает подготовленное заклинание без
 * карточки: строка есть, открыть нечего.
 *
 * Сообщение говорит про каталог, а не про файл: с появлением собственного каталога та же проверка
 * стоит на возврате к встроенным карточкам и на чтении сохранённого, где никакого файла нет.
 */
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

/**
 * Состояние после импорта.
 *
 * Функция чистая и возвращает новое состояние целиком: неудачный разбор до неё просто не доходит, и
 * частично применённого импорта не существует. «Только карточки» сохраняет ресурсы — это режим для
 * игры: поправить формулировку заклинания, не потеряв израсходованные ячейки.
 *
 * Записывает результат не эта функция, а стор сессии: персонаж и каталог меняются вместе, одной
 * записью, и там же стоит `checkIntegrity`. Для «только карточек» целостность проверяется
 * не против персонажа из файла, а против нынешнего — его эта функция не выбирала.
 */
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
