/**
 * Импорт и экспорт данных (F-11).
 *
 * Экспорт — единственный способ не потерять персонажа: приложение живёт в браузере телефона, а
 * браузер вправе очистить хранилище. Импорт — обратная сторона, и он обязан быть безопасным: файл
 * приходит извне, может быть от другой версии приложения или отредактирован руками.
 *
 * Проверка и типы — одна и та же Zod-схема, что читает собственный контент ([ADR-0004](../../docs/decisions.md#adr-0004)).
 * Второй валидатор рано или поздно разошёлся бы с первым, и импорт принимал бы то, чего приложение
 * не умеет показать.
 */

import {
  characterStateSchema,
  exportFileSchema,
  EXPORT_SCHEMA_VERSION,
  type CharacterState,
} from "@/data/schemas/character";
import { spellSchema, type Spell } from "@/data/schemas/spell";

export type ExportFile = {
  schemaVersion: number;
  exportedAt: string;
  character: CharacterState;
  spells: Spell[];
};

/** Что делать с существующими данными: заменить всё или обновить только карточки. */
export type ImportMode = "replace" | "spells_only";

export type ImportOutcome =
  | { ok: true; file: ExportFile }
  | { ok: false; reasonRu: string };

/**
 * Снимок для выгрузки (FR-120).
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

/** Читаемое имя файла: дата в имени избавляет от папки из десяти «export (3).json». */
export function exportFileName(now: string): string {
  return `arcane-helper-${now.slice(0, 10)}.json`;
}

function describeIssues(error: { issues: readonly { path: PropertyKey[]; message: string }[] }): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join(".") || "файл"}: ${issue.message}`)
    .join("; ");
}

/**
 * Разбор файла импорта (FR-121).
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

  const version = (parsed as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof version === "number" && version > EXPORT_SCHEMA_VERSION) {
    return {
      ok: false,
      reasonRu: `Файл версии ${version}, приложение понимает до ${EXPORT_SCHEMA_VERSION}. Обновите приложение.`,
    };
  }

  const file = exportFileSchema.safeParse(parsed);
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
 * (FR-121, FR-123).
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
 * Состояние после импорта (FR-122).
 *
 * Функция чистая и возвращает новое состояние целиком: неудачный разбор до неё просто не доходит, и
 * частично применённого импорта не существует. «Только карточки» сохраняет ресурсы — это режим для
 * игры: поправить формулировку заклинания, не потеряв израсходованные ячейки.
 *
 * Записывает результат не эта функция, а стор сессии: персонаж и каталог меняются вместе, одной
 * записью, и там же стоит `checkIntegrity` (FR-123). Для «только карточек» целостность проверяется
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
