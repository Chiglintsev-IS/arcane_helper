/**
 * Журнал: последовательность записей, дополняемая только с конца, и отмена последней.
 *
 * Снимок отмены вычисляется сравнением состояния до и после, а не пишется руками под каждую
 * операцию. Поэтому новая операция не требует писать обратную к себе, а отмена остаётся одной
 * функцией на все случаи.
 */

import { DomainError } from "@/core/domain/shared/errors";
import type { CharacterState } from "@/core/domain/character/state";
import { MUTABLE_STATE_KEYS } from "@/core/domain/character/state";
import type { JournalEntry, Recorded } from "./entry";

/** Глубина журнала: механизм обратимости, а не история кампании. */
export const JOURNAL_LIMIT = 100;

/**
 * Поля, значения которых изменились. Сравнение по сериализации: состояние заведомо сериализуемо,
 * а глубокое сравнение вручную дало бы больше кода и больше мест для ошибки.
 */
function changedFields(before: CharacterState, after: CharacterState): Partial<CharacterState> {
  const patch: Partial<CharacterState> = {};
  for (const key of MUTABLE_STATE_KEYS) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      Object.assign(patch, { [key]: structuredClone(before[key]) });
    }
  }
  return patch;
}

export class Journal {
  private constructor(private readonly entries: readonly JournalEntry[]) {}

  static of(entries: readonly JournalEntry[]): Journal {
    return new Journal(entries);
  }

  get list(): readonly JournalEntry[] {
    return this.entries;
  }

  get last(): JournalEntry | undefined {
    return this.entries.at(-1);
  }

  /**
   * Пустой снимок допустим: заговор вне схватки не тратит ни ячейки, ни действия, но остаётся
   * применением заклинания, которое журнал обязан записать. Отмена такой записи просто убирает
   * строку.
   */
  append(
    before: CharacterState,
    after: CharacterState,
    recorded: Recorded,
    stamp: { id: string; at: string },
  ): Journal {
    const entry: JournalEntry = {
      id: stamp.id,
      at: stamp.at,
      kind: recorded.kind,
      summaryRu: recorded.summaryRu,
      undoPatch: changedFields(before, after),
      ...(recorded.spellId === undefined ? {} : { spellId: recorded.spellId }),
      ...(recorded.slotLevel === undefined ? {} : { slotLevel: recorded.slotLevel }),
      ...(recorded.actionUsed === undefined ? {} : { actionUsed: recorded.actionUsed }),
    };
    const entries = [...this.entries, entry];
    return new Journal(entries.length > JOURNAL_LIMIT ? entries.slice(-JOURNAL_LIMIT) : entries);
  }

  /** Отмена последней записи: применить снимок и снять строку. */
  undoLast(character: CharacterState): { character: CharacterState; journal: Journal } {
    const last = this.last;
    if (last === undefined) {
      throw new DomainError("Журнал пуст, отменять нечего");
    }
    return {
      character: { ...character, ...structuredClone(last.undoPatch) },
      journal: new Journal(this.entries.slice(0, -1)),
    };
  }
}
