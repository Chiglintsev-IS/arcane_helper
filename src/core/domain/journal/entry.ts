/**
 * Запись журнала: факт изменения состояния и снимок, которым его возвращают.
 *
 * Чьё это состояние, журнал не знает: снимок для него — набор полей, которые он вернёт на место.
 * Тип состояния приходит параметром, и по умолчанию журнал согласен на любое: читающему запись —
 * экрану, схватке — нужны время, вид и подпись, а не устройство снимка.
 */

/**
 * Виды записей журнала. Перечнем, а не объединением строк: тот же список читает разбор прочитанного
 * из хранилища, и вид, забытый в одном из двух мест, отличался бы молча.
 */
export const JOURNAL_KINDS = [
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
] as const;

type JournalKind = (typeof JOURNAL_KINDS)[number];

/** Что потрачено внутри хода. Словарь один на журнал и на проверку доступности. */
export type TurnResource = "action" | "bonus_action" | "reaction";

export type JournalEntry<TState = Record<string, unknown>> = {
  readonly id: string;
  readonly at: string;
  readonly kind: JournalKind;
  readonly summaryRu: string;
  /**
   * Снимок затронутых полей ДО изменения — основа отмены. Состояние неизменяемо, поэтому снимок
   * держит те же значения, а не их копию.
   *
   * `null` — снимка нет вовсе, и это не то же самое, что пустой снимок: пустой говорит «событие
   * ничего не стоило», а его отсутствие — «возвращать по этой записи нечего». Запись при этом
   * остаётся: журнал ещё и история.
   */
  readonly undoPatch: Partial<TState> | null;
  readonly spellId?: string | undefined;
  readonly slotLevel?: number | undefined;
  readonly actionUsed?: TurnResource | undefined;
};

/** Что записывает операция; время и идентификатор добавляет журнал. */
export type Recorded = {
  kind: JournalKind;
  summaryRu: string;
  spellId?: string;
  slotLevel?: number;
  actionUsed?: TurnResource;
};
