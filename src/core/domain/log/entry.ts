export const LOG_KINDS = [
  "spell_cast",
  "reaction_cast",
  "slot_spent",
  "slot_refunded",
  "concentration_started",
  "concentration_ended",
  "manual_effect_started",
  "effect_ended",
  "long_rest",
  "short_rest",
  "arcane_recovery",
  "turn_started",
  "manual_adjustment",
  "blood_exchange",
  "rune_spent",
  "hit_points_changed",
  "combat_started",
  "combat_ended",
  "suppression_changed",
  "sheet_edited",
  "batch_crafted",
] as const;

type LogKind = (typeof LOG_KINDS)[number];

export type TurnResource = "action" | "bonus_action" | "reaction";

export type LogEntry<TState = Record<string, unknown>> = {
  readonly id: string;
  readonly at: string;
  readonly kind: LogKind;
  readonly summaryRu: string;
  readonly undoPatch: Partial<TState> | null;
  readonly commandId?: string | undefined;
  readonly spellId?: string | undefined;
  readonly slotLevel?: number | undefined;
  readonly actionUsed?: TurnResource | undefined;
  readonly damage?: number | undefined;
};

export type Recorded = {
  kind: LogKind;
  summaryRu: string;
  spellId?: string;
  slotLevel?: number;
  actionUsed?: TurnResource;
  damage?: number;
};
