/**
 * Вторая строка вещи: прибавки и цена — неделимые факты, заметка — свободный текст.
 *
 * Порознь, а не одной фразой, потому что читаются они по-разному: факт сканируют по имени величины
 * и её числу, заметку читают словами. Прибавки стоят раньше цены: за столом вещь спрашивают о том,
 * что она делает, а не почём она.
 */

import type { ChoicesView, ItemView } from "@/contract/views";
import { signed } from "@/shared/language";

import { currencyAbbr, statLabel } from "./labels";

export function itemMeta(
  item: ItemView,
  stats: ChoicesView["stats"],
): {
  facts: { labelRu: string; valueRu: string | undefined }[];
  note: string | undefined;
} {
  return {
    facts: [
      ...item.bonuses.map((bonus) => ({
        labelRu: statLabel(stats, bonus.stat),
        valueRu: signed(bonus.value),
      })),
      ...(item.price === undefined
        ? []
        : [
            {
              labelRu: `${item.price.amount} ${currencyAbbr(item.price.currency)}`,
              valueRu: undefined,
            },
          ]),
    ],
    note: item.note,
  };
}
