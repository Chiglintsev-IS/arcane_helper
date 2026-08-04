/**
 * Запись журнала: факт изменения состояния и снимок, которым его возвращают.
 *
 * Чьё это состояние, журнал не знает: снимок для него — набор полей, которые он вернёт на место.
 * Тип состояния приходит параметром, и по умолчанию журнал согласен на любое: читающему запись —
 * экрану, схватке — нужны время, вид и подпись, а не устройство снимка.
 */

type JournalKind =
  | "spell_cast"
  | "reaction_cast"
  | "slot_spent"
  | "slot_refunded"
  | "concentration_started"
  | "concentration_ended"
  | "manual_effect_started"
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
  | "suppression_changed"
  | "sheet_edited";

/** Что потрачено внутри хода. Словарь один на журнал и на проверку доступности. */
export type TurnResource = "action" | "bonus_action" | "reaction";

export type JournalEntry<TState = Record<string, unknown>> = {
  id: string;
  at: string;
  kind: JournalKind;
  summaryRu: string;
  /** Снимок затронутых полей ДО изменения — основа отмены. */
  undoPatch: Partial<TState>;
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
