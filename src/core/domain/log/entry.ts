/**
 * Запись лога: факт изменения состояния и снимок, которым его возвращают.
 *
 * Чьё это состояние, лог не знает: снимок для него — набор полей, которые он вернёт на место.
 * Тип состояния приходит параметром, и по умолчанию лог согласен на любое: читающему запись —
 * экрану, схватке — нужны время, вид и подпись, а не устройство снимка.
 */

/**
 * Виды записей лога. Перечнем, а не объединением строк: тот же список читает разбор прочитанного
 * из хранилища, и вид, забытый в одном из двух мест, отличался бы молча.
 */
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
  /** Прежний вид записи: обмен хитов на очки. Живёт ради сохранений, сделанных до отмены очков. */
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

/** Что потрачено внутри хода. Словарь один на лог и на проверку доступности. */
export type TurnResource = "action" | "bonus_action" | "reaction";

export type LogEntry<TState = Record<string, unknown>> = {
  readonly id: string;
  readonly at: string;
  readonly kind: LogKind;
  readonly summaryRu: string;
  /**
   * Снимок затронутых полей ДО изменения — основа отмены. Состояние неизменяемо, поэтому снимок
   * держит те же значения, а не их копию.
   *
   * `null` — снимка нет вовсе, и это не то же самое, что пустой снимок: пустой говорит «событие
   * ничего не стоило», а его отсутствие — «возвращать по этой записи нечего». Запись при этом
   * остаётся: лог ещё и история.
   */
  readonly undoPatch: Partial<TState> | null;
  /**
   * По какой попытке запись появилась. Ею узнаётся повтор: одно намерение, доставленное дважды —
   * оборвалась связь, дрогнул палец, — не должно списать ресурс дважды.
   *
   * Необязателен: запись бывает и не по команде, а сделанные до того, как попытки обзавелись
   * идентификаторами, остаются читаемыми — повтор для них просто неузнаваем, как и был.
   */
  readonly commandId?: string | undefined;
  readonly spellId?: string | undefined;
  readonly slotLevel?: number | undefined;
  readonly actionUsed?: TurnResource | undefined;
  /**
   * Сколько урона принесло событие. Тем и отличается полученный урон от прочих изменений здоровья:
   * от него зависит сложность проверки концентрации, и восстановить его по снимку отмены нельзя —
   * упавшие в ноль хиты урон обрезают, а сложность нет.
   */
  readonly damage?: number | undefined;
};

/** Что записывает операция; время и идентификатор добавляет лог. */
export type Recorded = {
  kind: LogKind;
  summaryRu: string;
  spellId?: string;
  slotLevel?: number;
  actionUsed?: TurnResource;
  damage?: number;
};
