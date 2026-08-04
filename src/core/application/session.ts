/**
 * Сессия: состояние персонажа и журнал, живущие вместе.
 *
 * Здесь только обвязка — тип сессии, оформление перехода в запись журнала и отмена. Сами операции
 * лежат в юз-кейсах рядом; правила, которые они применяют, — в домене.
 */

import type { CharacterState } from "@/core/domain/assembly/state";
import { characterStateSchema, MUTABLE_STATE_KEYS } from "@/core/domain/assembly/state";
import { Character } from "@/core/domain/assembly/character";
import { DomainError } from "@/core/domain/shared/errors";
import { Journal, JOURNAL_LIMIT } from "@/core/domain/journal/journal";
import type { JournalEntry, Recorded, TurnResource } from "@/core/domain/journal/entry";


/** Что потрачено внутри хода. Имя сохранено ради вызывающих: словарь один на журнал и на правила. */
type ActionUsed = TurnResource;

export type Session = {
  character: CharacterState;
  journal: readonly JournalEntry<CharacterState>[];
};

/**
 * Журнал персонажа: какие поля обратимы, знает состояние, а не журнал.
 *
 * Список приходит сюда, а не импортируется журналом: журнал — механизм обратимости чего угодно, и
 * привязка к персонажу сделала бы его вторым местом, где перечислены поля листа.
 */
function characterJournal(entries: readonly JournalEntry<CharacterState>[]) {
  return Journal.of(entries, MUTABLE_STATE_KEYS);
}

/** Время и идентификаторы приходят снаружи: чистые функции их не изобретают. */
export type Clock = {
  now: () => string;
  nextId: () => string;
};

export function createSession(character: CharacterState): Session {
  return { character, journal: [] };
}

/**
 * Оформляет переход состояния в запись журнала. Одно действие — одна запись.
 *
 * Принимает и агрегат, и голое состояние: часть операций собирает результат по кускам, и заставлять
 * их заворачивать его обратно значило бы добавить обряд без смысла.
 */
export function commit(
  session: Session,
  after: Character | CharacterState,
  recorded: Recorded,
  clock: Clock,
): Session {
  const character = after instanceof Character ? after.toState() : after;
  const journal = characterJournal(session.journal).append(session.character, character, recorded, {
    id: clock.nextId(),
    at: clock.now(),
  });
  return { character, journal: [...journal.list] };
}

/** Изменение, которое журнала не касается: заметки и пометки игрового состояния не меняют. */
export function withoutRecord(session: Session, character: Character): Session {
  return { character: character.toState(), journal: session.journal };
}

/**
 * Отмена последнего действия.
 *
 * Собранное состояние проверяется целиком, до записи: журнал по замыслу всеяден и значений снимка не
 * знает, а испорченная запись из хранилища иначе стала бы состоянием персонажа одним нажатием.
 * Проверяется именно целое — доводчики и умолчания к части состояния не применимы.
 */
export function undoLast(session: Session): Session {
  const { state, journal } = characterJournal(session.journal).undoLast(session.character);
  const restored = characterStateSchema.safeParse(state);
  if (!restored.success) {
    const reasons = restored.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new DomainError(`Снимок отмены не складывается в состояние персонажа — ${reasons}`);
  }
  return { character: restored.data, journal: [...journal.list] };
}

/**
 * Замена состояния импортом.
 *
 * Журнал начинается заново: записи прежнего персонажа к новому состоянию не относятся, и отмена
 * после импорта вернула бы ячейку тому, кого уже нет.
 */
export function replaceCharacter(character: CharacterState): Session {
  return createSession(character);
}
