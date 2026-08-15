/**
 * Вторая строка вещи: цена и прибавки — неделимые факты, заметка — свободный текст.
 *
 * Порознь, а не одной фразой, потому что переносятся они по-разному: факт на узком экране не рвётся
 * посередине, заметка переносится словами.
 */

import type { ChoicesView, ItemView } from "@/contract/views";
import { signed } from "@/shared/language";

import { currencyAbbr, statLabel } from "./labels";

export function itemMeta(
  item: ItemView,
  stats: ChoicesView["stats"],
): { facts: string[]; note: string | undefined } {
  return {
    facts: [
      ...(item.price === undefined
        ? []
        : [`${item.price.amount} ${currencyAbbr(item.price.currency)}`]),
      ...item.bonuses.map((bonus) => `${statLabel(stats, bonus.stat)} ${signed(bonus.value)}`),
    ],
    note: item.note,
  };
}
