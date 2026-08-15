/** Вторая строка вещи: цена, прибавки, заметка — только то, что у вещи действительно есть. */

import type { ChoicesView, ItemView } from "@/contract/views";
import { signed } from "@/shared/language";

import { currencyAbbr, statLabel } from "./labels";

export function itemMeta(item: ItemView, stats: ChoicesView["stats"]): string {
  return [
    ...(item.price === undefined ? [] : [`${item.price.amount} ${currencyAbbr(item.price.currency)}`]),
    ...item.bonuses.map((bonus) => `${statLabel(stats, bonus.stat)} ${signed(bonus.value)}`),
    ...(item.note === undefined ? [] : [item.note]),
  ].join(" · ");
}
