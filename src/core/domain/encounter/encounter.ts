import type { LogEntry, TurnResource } from "@/core/domain/log/entry";

export type TurnEconomy = {
  round: number;
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

  get economy(): TurnEconomy {
    const boundary = this.entries.findLastIndex(
      (entry) => entry.kind === "combat_started" || entry.kind === "combat_ended",
    );
    const inFight = this.entries[boundary]?.kind === "combat_started";
    const sinceBoundary = this.entries.slice(boundary + 1);
    const lastTurnIndex = sinceBoundary.findLastIndex((entry) => entry.kind === "turn_started");
    const turns = sinceBoundary.filter((entry) => entry.kind === "turn_started").length;
    const round = Math.max(1, turns + (inFight ? 1 : 0));

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

  roundsSince(startedAt: string): number {
    return (
      this.entries.filter((entry) => entry.kind === "turn_started" && entry.at > startedAt).length + 1
    );
  }
}
