import type { ChoicesView, ItemView } from "@/contract/views";
import { plural, signed } from "@/shared/language";

import { itemTraitsOf } from "./itemTraits";
import { statFamilyLabel, statLabel } from "./labels";

const BETWEEN = " · ";

export function neededForLine(spellNamesRu: readonly string[]): string | undefined {
  return spellNamesRu.length === 0 ? undefined : `Требуется для: ${spellNamesRu.join(BETWEEN)}`;
}

/** Прибавки одной строкой: у каждой величины своё число со знаком — «+1 Класс Доспеха». */
export function bonusLine(item: ItemView, stats: ChoicesView["stats"]): string {
  return item.bonusFacts
    .flatMap((fact) =>
      fact.targets.map(
        (target) =>
          `${signed(fact.value)} ${
            target.kind === "family" ? statFamilyLabel(target.id) : statLabel(stats, target.id)
          }`,
      ),
    )
    .join(BETWEEN);
}

const PORTION_FORMS: [string, string, string] = ["порция", "порции", "порций"];

const PIECE_RU = "шт";

/** Единицу счёта называет признак: ингредиент копят порциями, а прочее считают штуками. */
export function unitRu(item: ItemView, count: number): string {
  return itemTraitsOf(item).includes("ingredient") ? plural(count, PORTION_FORMS) : PIECE_RU;
}

export function traitLine(traitsRu: readonly string[]): string {
  return traitsRu.join(BETWEEN);
}
