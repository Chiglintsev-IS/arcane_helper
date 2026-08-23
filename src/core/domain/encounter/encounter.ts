/**
 * Схватка: идёт ли бой, какой раунд и чем ещё можно сходить.
 *
 * Состояния у схватки своего нет — она выводится из лога. Хранимый признак «бой идёт» разошёлся
 * бы с записями, и следующий бой начинался бы шестым раундом вместо первого.
 */

import type { LogEntry, TurnResource } from "@/core/domain/log/entry";

export type TurnEconomy = {
  /** Номер раунда — число отметок начала хода плюс текущий. */
  round: number;
  /** Отмечен ли бой начатым. Он же признак того, что ведётся счёт ходов. */
  inFight: boolean;
  actionAvailable: boolean;
  bonusActionAvailable: boolean;
  reactionAvailable: boolean;
};

const ALL_AVAILABLE = {
  actionAvailable: true,
  bonusActionAvailable: true,
  reactionAvailable: true,
} as const;

export class Encounter {
  private constructor(private readonly entries: readonly LogEntry[]) {}

  static fromLog(entries: readonly LogEntry[]): Encounter {
    return new Encounter(entries);
  }

  /**
   * Экономия хода: доступно то, что не потрачено после последней отметки начала хода.
   *
   * Прежний бой в счёт не идёт — и раунды, и потраченное считаются от последней отметки о конце боя.
   * Если отметки хода нет вовсе, считаем всё доступным: нехватка истории не повод запрещать.
   */
  get economy(): TurnEconomy {
    // Границей служит последняя отметка о начале или конце боя: обе закрывают прежний бой.
    const boundary = this.entries.findLastIndex(
      (entry) => entry.kind === "combat_started" || entry.kind === "combat_ended",
    );
    const inFight = this.entries[boundary]?.kind === "combat_started";
    const sinceBoundary = this.entries.slice(boundary + 1);
    const lastTurnIndex = sinceBoundary.findLastIndex((entry) => entry.kind === "turn_started");
    // Начало боя — это и первый ход: «Мой ход» после него открывает второй раунд, а не первый.
    const turns = sinceBoundary.filter((entry) => entry.kind === "turn_started").length;
    const round = Math.max(1, turns + (inFight ? 1 : 0));

    // Учёт хода включает отметка начала боя и ничто другое: вне боя ходов нет, и правило отвечает
    // «всё доступно» независимо от записей.
    if (!inFight) {
      return { round, inFight, ...ALL_AVAILABLE };
    }

    const spent = new Set<TurnResource>();
    for (const entry of sinceBoundary.slice(lastTurnIndex + 1)) {
      if (entry.actionUsed !== undefined) spent.add(entry.actionUsed);
    }

    const reactionAvailable = !spent.has("reaction");
    return {
      round,
      inFight,
      actionAvailable: !spent.has("action"),
      bonusActionAvailable: !spent.has("bonus_action"),
      reactionAvailable,
    };
  }

  /**
   * Сколько раундов прошло с начала эффекта.
   *
   * Отметка, ради которой считают, ещё не записана, поэтому она добавляется единицей — иначе эффект
   * на один раунд пережил бы свой раунд.
   */
  roundsSince(startedAt: string): number {
    return (
      this.entries.filter((entry) => entry.kind === "turn_started" && entry.at > startedAt).length + 1
    );
  }
}
