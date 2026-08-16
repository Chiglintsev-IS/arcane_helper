/**
 * Смысловые тона интерфейса: цвет несёт значение, а не украшает.
 *
 * Живут в общем слое, потому что ими пользуются и примитивы, и карточки: держать их у карточки
 * значило бы заставить кнопку знать про заклинание. Цвет всегда идёт с иконкой и подписью:
 * один цвет не читается ни при ярком свете, ни при дальтонизме.
 */

/** Смысловые роли цвета из. Цвет всегда с иконкой и подписью. */
export type Tone =
  | "action"
  | "bonus"
  | "reaction"
  | "concentration"
  | "ritual"
  | "offense"
  | "defense"
  | "muted";

export const TONE_CLASS: Record<Tone, string> = {
  action: "bg-action/10 text-action-strong dark:text-action",
  bonus: "bg-bonus/10 text-bonus-strong dark:text-bonus",
  reaction: "bg-reaction/10 text-reaction-strong dark:text-reaction",
  concentration: "bg-concentration/10 text-concentration-strong dark:text-concentration",
  ritual: "bg-ritual/10 text-ritual-strong dark:text-ritual",
  offense: "bg-offense/10 text-offense-strong dark:text-offense",
  defense: "bg-defense/10 text-defense-strong dark:text-defense",
  muted: "bg-slate-400/10 text-slate-700 dark:text-slate-300",
};
