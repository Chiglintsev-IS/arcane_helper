/**
 * Вторая строка вещи: прибавки и цена — неделимые факты, заметка — свободный текст.
 *
 * Порознь, а не одной фразой, потому что читаются они по-разному: факт сканируют по имени величины
 * и её числу, заметку читают словами. Прибавки стоят раньше цены: за столом вещь спрашивают о том,
 * что она делает, а не почём она.
 *
 * Сколько прибавок вещи — сколько фактов, здесь не решается: прибавки приезжают уже названными, и
 * названное целым семейством так фактом и остаётся. Разобрать его обратно значило бы завести второй
 * ответ на вопрос правил и потерять целое ровно там, где оно и нужно.
 */

import type { ChoicesView, ItemView } from "@/contract/views";
import { signed } from "@/shared/language";

import { currencyAbbr, statFamilyLabel, statLabel } from "./labels";

export function itemMeta(
  item: ItemView,
  stats: ChoicesView["stats"],
): {
  facts: { labelRu: string; valueRu: string | undefined }[];
  note: string | undefined;
} {
  return {
    facts: [
      ...item.bonusFacts.map((fact) => ({
        labelRu: fact.kind === "family" ? statFamilyLabel(fact.id) : statLabel(stats, fact.id),
        valueRu: signed(fact.value),
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
