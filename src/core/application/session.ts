/**
 * Сессия: состояние персонажа и лог, живущие вместе.
 *
 * Здесь только обвязка — тип сессии, оформление перехода в запись лога и отмена. Сами операции
 * лежат в юз-кейсах рядом; правила, которые они применяют, — в домене.
 */

import type { CharacterState } from "@/core/domain/assembly/state";
import { characterStateSchema, MUTABLE_STATE_KEYS } from "@/core/domain/assembly/state";
import type { Character } from "@/core/domain/assembly/character";
import type { Spell } from "@/core/domain/catalog/spell";
import { DomainError } from "@/core/domain/shared/errors";
import { Log } from "@/core/domain/log/log";
import type { LogEntry, Recorded } from "@/core/domain/log/entry";
import type { Clock } from "@/core/application/ports/clock";

export type Session = {
  character: CharacterState;
  log: readonly LogEntry<CharacterState>[];
};

/** Чем играют прямо сейчас: карточками из сборки или загруженными игроком. */
type SpellCatalogSource = "built_in" | "imported";

/**
 * Живая сессия: персонаж с логом и карточки, по которым идёт игра.
 *
 * Держится одним значением, потому что меняется одним: подменённый каталог без персонажа — ссылка
 * в пустоту, а персонаж без каталога — заклинание, которое нечем открыть. То же, что уходит в
 * хранилище сохранённой сессией, только в памяти ядра.
 */
export type LiveSession = {
  session: Session;
  spellCatalog: readonly Spell[];
  spellCatalogSource: SpellCatalogSource;
};

/**
 * Лог персонажа: какие поля обратимы, знает состояние, а не лог.
 *
 * Список приходит сюда, а не импортируется логом: лог — механизм обратимости чего угодно, и
 * привязка к персонажу сделала бы его вторым местом, где перечислены поля листа.
 */
function characterLog(entries: readonly LogEntry<CharacterState>[]) {
  return Log.of(entries, MUTABLE_STATE_KEYS);
}

/**
 * Обстоятельства одного применения: когда оно случилось, какими идентификаторами обзавелось и по
 * какой попытке пришло.
 *
 * Идентификатор попытки выдаёт тот, кто её поставил, и повторяет при пересылке. Идентификаторы
 * самих записей выдаёт ядро: порядок событий — факт его стороны, а не той, что попросила.
 */
export type Occasion = Clock & { commandId: string };

/**
 * Применялась ли уже эта попытка.
 *
 * Узнаётся по логу, а не по отдельному реестру: лог и так единственное место, где видно
 * случившееся, и на нём держится обратимость. Второй список разошёлся бы с ним на первой же отмене.
 */
export function alreadyApplied(session: Session, commandId: string): boolean {
  return session.log.some((entry) => entry.commandId === commandId);
}

export function createSession(character: CharacterState): Session {
  return { character, log: [] };
}

/**
 * Оформляет переход состояния в запись лога. Одно действие — одна запись.
 *
 * Принимает только корень: голое состояние было бы дверью мимо агрегата, а дописанное к нему поле
 * затрёт владелец при следующей правке.
 */
export function commit(
  session: Session,
  after: Character,
  recorded: Recorded,
  occasion: Occasion,
): Session {
  const character = after.toState();
  const log = characterLog(session.log).append(session.character, character, recorded, {
    id: occasion.nextId(),
    at: occasion.now(),
    commandId: occasion.commandId,
  });
  return { character, log: [...log.list] };
}

/** Изменение, которое лога не касается: заметки и пометки игрового состояния не меняют. */
export function withoutRecord(session: Session, character: Character): Session {
  return { character: character.toState(), log: session.log };
}

/**
 * Отмена последнего действия.
 *
 * Собранное состояние проверяется целиком, до записи: лог по замыслу всеяден и значений снимка не
 * знает, а испорченная запись из хранилища иначе стала бы состоянием персонажа одним нажатием.
 * Проверяется именно целое — доводчики и умолчания к части состояния не применимы.
 */
export function undoLast(session: Session): Session {
  const { state, log } = characterLog(session.log).undoLast(session.character);
  const restored = characterStateSchema.safeParse(state);
  if (!restored.success) {
    const reasons = restored.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new DomainError(`Снимок отмены не складывается в состояние персонажа — ${reasons}`);
  }
  return { character: restored.data, log: [...log.list] };
}

/**
 * Замена состояния импортом.
 *
 * Лог начинается заново: записи прежнего персонажа к новому состоянию не относятся, и отмена
 * после импорта вернула бы ячейку тому, кого уже нет.
 */
export function replaceCharacter(character: CharacterState): Session {
  return createSession(character);
}
