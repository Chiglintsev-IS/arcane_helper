/**
 * Журнал: последовательность записей, дополняемая только с конца, и отмена последней.
 *
 * Снимок отмены вычисляется сравнением состояния до и после, а не пишется руками под каждую
 * операцию. Поэтому новая операция не требует писать обратную к себе, а отмена остаётся одной
 * функцией на все случаи.
 *
 * Чьё это состояние и какие его поля обратимы, журнал не знает: список сравниваемых полей приходит
 * при создании. Знай он это сам, обратимость персонажа стала бы правилом журнала, и запись о чём
 * угодно другом потребовала бы второго журнала.
 */

import { DomainError } from "@/core/domain/shared/errors";
import type { JournalEntry, Recorded } from "./entry";

/** Глубина журнала: механизм обратимости, а не история кампании. */
const JOURNAL_LIMIT = 100;

/**
 * Поля, значения которых изменились. Сравнение по сериализации: состояние заведомо сериализуемо,
 * а глубокое сравнение вручную дало бы больше кода и больше мест для ошибки.
 */
function changedFields<TState extends object>(
  before: TState,
  after: TState,
  mutableKeys: readonly (keyof TState)[],
): Partial<TState> {
  const patch: Partial<TState> = {};
  for (const key of mutableKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      Object.assign(patch, { [key]: before[key] });
    }
  }
  return patch;
}

export class Journal<TState extends object = Record<string, unknown>> {
  private constructor(
    private readonly entries: readonly JournalEntry<TState>[],
    /** Поля, обратимые отменой. Чьи они и почему именно эти — знает вызывающий. */
    private readonly mutableKeys: readonly (keyof TState)[],
  ) {}

  static of<TState extends object>(
    entries: readonly JournalEntry<TState>[],
    mutableKeys: readonly (keyof TState)[],
  ): Journal<TState> {
    return new Journal(entries, mutableKeys);
  }

  get list(): readonly JournalEntry<TState>[] {
    return this.entries;
  }

  get last(): JournalEntry<TState> | undefined {
    return this.entries.at(-1);
  }

  /**
   * Пустой снимок допустим: заговор вне схватки не тратит ни ячейки, ни действия, но остаётся
   * применением заклинания, которое журнал обязан записать. Отмена такой записи просто убирает
   * строку.
   */
  append(
    before: TState,
    after: TState,
    recorded: Recorded,
    stamp: { id: string; at: string; commandId?: string },
  ): Journal<TState> {
    const entry: JournalEntry<TState> = {
      id: stamp.id,
      at: stamp.at,
      kind: recorded.kind,
      summaryRu: recorded.summaryRu,
      undoPatch: changedFields(before, after, this.mutableKeys),
      ...(stamp.commandId === undefined ? {} : { commandId: stamp.commandId }),
      ...(recorded.spellId === undefined ? {} : { spellId: recorded.spellId }),
      ...(recorded.slotLevel === undefined ? {} : { slotLevel: recorded.slotLevel }),
      ...(recorded.actionUsed === undefined ? {} : { actionUsed: recorded.actionUsed }),
    };
    const entries = [...this.entries, entry];
    return new Journal(
      entries.length > JOURNAL_LIMIT ? entries.slice(-JOURNAL_LIMIT) : entries,
      this.mutableKeys,
    );
  }

  /** Отмена последней записи: применить снимок и снять строку. */
  undoLast(state: TState): { state: TState; journal: Journal<TState> } {
    const last = this.last;
    if (last === undefined) {
      throw new DomainError("Журнал пуст, отменять нечего");
    }
    if (last.undoPatch === null) {
      throw new DomainError("У записи нет снимка отмены: она осталась историей, возвращать нечего");
    }
    return {
      state: { ...state, ...last.undoPatch },
      journal: new Journal(this.entries.slice(0, -1), this.mutableKeys),
    };
  }
}
