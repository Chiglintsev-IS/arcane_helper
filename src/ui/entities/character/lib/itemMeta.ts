/**
 * Вторая строка вещи: прибавки и цена — неделимые факты, заметка — свободный текст.
 *
 * Порознь, а не одной фразой, потому что читаются они по-разному: факт сканируют по числу, заметку
 * читают словами. Прибавки стоят раньше цены: за столом вещь спрашивают о том, что она делает, а не
 * почём она.
 *
 * Устроены оба факта одинаково: число, а при нём — всё, что этим числом названо. У прибавки это
 * величины, которые она двигает, у цены — её монета. Сколько чисел у вещи и что стоит при каждом,
 * здесь не решается: прибавки приезжают уже названными, и разобрать названное обратно значило бы
 * завести второй ответ на вопрос правил и потерять целое ровно там, где оно и нужно.
 */

import type { ChoicesView, ItemView } from "@/contract/views";
import { signed } from "@/shared/language";

import { currencyAbbr, statFamilyLabel, statLabel } from "./labels";

export function itemMeta(
  item: ItemView,
  stats: ChoicesView["stats"],
): {
  facts: { valueRu: string; labelsRu: string[] }[];
  note: string | undefined;
} {
  return {
    facts: [
      ...item.bonusFacts.map((fact) => ({
        valueRu: signed(fact.value),
        labelsRu: fact.targets.map((target) =>
          target.kind === "family" ? statFamilyLabel(target.id) : statLabel(stats, target.id),
        ),
      })),
      ...(item.price === undefined
        ? []
        : [
            {
              valueRu: String(item.price.amount),
              labelsRu: [currencyAbbr(item.price.currency)],
            },
          ]),
    ],
    note: item.note,
  };
}
