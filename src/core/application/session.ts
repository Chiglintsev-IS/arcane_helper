/**
 * Сессия: состояние персонажа и журнал, живущие вместе.
 *
 * Здесь только обвязка — тип сессии, оформление перехода в запись журнала и отмена. Сами операции
 * лежат в юз-кейсах рядом; правила, которые они применяют, — в домене.
 */

import type { CharacterState } from "@/core/domain/assembly/state";
import { MUTABLE_STATE_KEYS } from "@/core/domain/assembly/state";
import { Character } from "@/core/domain/assembly/character";
import { Journal, JOURNAL_LIMIT } from "@/core/domain/journal/journal";
import type { JournalEntry, Recorded, TurnResource } from "@/core/domain/journal/entry";


/** Что потрачено внутри хода. Имя сохранено ради вызывающих: словарь один на журнал и на правила. */
type ActionUsed = TurnResource;

export type Session = {
  character: CharacterState;
  journal: JournalEntry<CharacterState>[];
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

/** Отмена последнего действия. */
export function undoLast(session: Session): Session {
  const { state, journal } = characterJournal(session.journal).undoLast(session.character);
  return { character: state, journal: [...journal.list] };
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
