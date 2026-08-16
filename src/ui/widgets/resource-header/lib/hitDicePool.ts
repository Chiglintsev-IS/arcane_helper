import type { SheetView } from "@/contract/views";

/** Пул костей хитов плиткой: имя с размером кости, остаток из общего числа и есть ли чем платить. */
export function hitDicePool(dice: SheetView["hitPoints"]["hitDice"]): {
  nameRu: string;
  remaining: string;
  available: boolean;
} {
  if (dice === undefined) return { nameRu: "Кости", remaining: "нет", available: false };
  return {
    nameRu: `Кости d${dice.size}`,
    remaining: `${dice.remaining}/${dice.total}`,
    available: dice.remaining > 0,
  };
}
