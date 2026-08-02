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
  action: "border-action/50 bg-action/10 text-action-strong dark:text-action",
  bonus: "border-bonus/50 bg-bonus/10 text-bonus-strong dark:text-bonus",
  reaction: "border-reaction/50 bg-reaction/10 text-reaction-strong dark:text-reaction",
  concentration:
    "border-concentration/50 bg-concentration/10 text-concentration-strong dark:text-concentration",
  ritual: "border-ritual/50 bg-ritual/10 text-ritual-strong dark:text-ritual",
  offense: "border-offense/50 bg-offense/10 text-offense-strong dark:text-offense",
  defense: "border-defense/50 bg-defense/10 text-defense-strong dark:text-defense",
  muted: "border-slate-400/50 bg-slate-400/10 text-slate-700 dark:text-slate-300",
};
