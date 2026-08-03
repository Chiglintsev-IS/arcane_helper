import type { HitDice } from "@/core/domain/vitality/schema";

/** «7d6» при полном пуле, «5d6 из 7» после трат: два одинаковых числа сверять незачем. */
export function hitDiceLabel(dice: HitDice | undefined): string {
  if (dice === undefined) return "не заведены";
  if (dice.remaining === dice.total) return `${dice.total}d${dice.size}`;
  return `${dice.remaining}d${dice.size} из ${dice.total}`;
}
