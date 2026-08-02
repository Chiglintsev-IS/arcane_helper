/**
 * Запись журнала: факт изменения состояния и снимок, которым его возвращают.
 */

import type { CharacterState } from "@/core/domain/character/state";

export type JournalKind =
  | "spell_cast"
  | "reaction_cast"
  | "slot_spent"
  | "slot_refunded"
  | "concentration_started"
  | "concentration_ended"
  | "effect_ended"
  | "long_rest"
  | "short_rest"
  | "arcane_recovery"
  | "turn_started"
  | "manual_adjustment"
  | "blood_exchange"
  | "rune_spent"
  | "hit_points_changed"
  | "combat_started"
  | "combat_ended"
  | "suppression_changed";

/** Что потрачено внутри хода. Словарь один на журнал и на проверку доступности. */
export type TurnResource = "action" | "bonus_action" | "reaction";

export type JournalEntry = {
  id: string;
  at: string;
  kind: JournalKind;
  summaryRu: string;
  /** Снимок затронутых полей ДО изменения — основа отмены. */
  undoPatch: Partial<CharacterState>;
  spellId?: string;
  slotLevel?: number;
  actionUsed?: TurnResource;
};

/** Что записывает операция; время и идентификатор добавляет журнал. */
export type Recorded = {
  kind: JournalKind;
  summaryRu: string;
  spellId?: string;
  slotLevel?: number;
  actionUsed?: TurnResource;
};
