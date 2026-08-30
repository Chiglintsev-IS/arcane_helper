import { DomainError } from "@/core/domain/shared/errors";
import type { LogEntry, Recorded } from "./entry";

const LOG_LIMIT = 100;

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

export class Log<TState extends object = Record<string, unknown>> {
  private constructor(
    private readonly entries: readonly LogEntry<TState>[],
    private readonly mutableKeys: readonly (keyof TState)[],
  ) {}

  static of<TState extends object>(
    entries: readonly LogEntry<TState>[],
    mutableKeys: readonly (keyof TState)[],
  ): Log<TState> {
    return new Log(entries, mutableKeys);
  }

  get list(): readonly LogEntry<TState>[] {
    return this.entries;
  }

  get last(): LogEntry<TState> | undefined {
    return this.entries.at(-1);
  }

  append(
    before: TState,
    after: TState,
    recorded: Recorded,
    stamp: { id: string; at: string; commandId?: string },
  ): Log<TState> {
    const entry: LogEntry<TState> = {
      id: stamp.id,
      at: stamp.at,
      kind: recorded.kind,
      summaryRu: recorded.summaryRu,
      undoPatch: changedFields(before, after, this.mutableKeys),
      ...(stamp.commandId === undefined ? {} : { commandId: stamp.commandId }),
      ...(recorded.spellId === undefined ? {} : { spellId: recorded.spellId }),
      ...(recorded.slotLevel === undefined ? {} : { slotLevel: recorded.slotLevel }),
      ...(recorded.actionUsed === undefined ? {} : { actionUsed: recorded.actionUsed }),
      ...(recorded.damage === undefined ? {} : { damage: recorded.damage }),
    };
    const entries = [...this.entries, entry];
    return new Log(
      entries.length > LOG_LIMIT ? entries.slice(-LOG_LIMIT) : entries,
      this.mutableKeys,
    );
  }

  undoLast(state: TState): { state: TState; log: Log<TState> } {
    const last = this.last;
    if (last === undefined) {
      throw new DomainError("Лог пуст, отменять нечего");
    }
    if (last.undoPatch === null) {
      throw new DomainError("У записи нет снимка отмены: она осталась историей, возвращать нечего");
    }
    return {
      state: { ...state, ...last.undoPatch },
      log: new Log(this.entries.slice(0, -1), this.mutableKeys),
    };
  }
}
