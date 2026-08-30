import type { ChoicesView, ItemView } from "@/contract/views";
import { signed } from "@/shared/language";

import { currencyAbbr, statFamilyLabel, statLabel } from "./labels";

export function neededForLine(spellNamesRu: readonly string[]): string | undefined {
  return spellNamesRu.length === 0 ? undefined : `Требуется для: ${spellNamesRu.join(" · ")}`;
}

export function itemMeta(
  item: ItemView,
  stats: ChoicesView["stats"],
): {
  facts: { valueRu: string; labelsRu: string[] }[];
  marksRu: string[];
  neededFor: string | undefined;
  note: string | undefined;
} {
  return {
    marksRu: [
      ...(item.worksCarried ? ["действует при себе"] : []),
      ...(item.wanted ? ["в покупках"] : []),
    ],
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
    neededFor: neededForLine(item.neededForRu),
    note: item.note,
  };
}
