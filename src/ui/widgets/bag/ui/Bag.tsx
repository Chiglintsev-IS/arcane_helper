"use client";

import type { BagView, ChoicesView } from "@/contract/views";
import { currencyAbbr } from "@/ui/entities/character/lib/labels";
import { ItemRow } from "@/ui/entities/character/ui/ItemRow";
import { ItemSection } from "@/ui/shared/ui/ItemSection";
import { EDIT_LABEL, editName } from "@/ui/shared/ui/buttonLabels";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

const SECTIONS: { kind: string; titleRu: string; addLabelRu: string }[] = [
  { kind: "consumable", titleRu: "Расходники", addLabelRu: "Новый расходник" },
  { kind: "ingredient", titleRu: "Ингредиенты", addLabelRu: "Новый ингредиент" },
  { kind: "other", titleRu: "Другое", addLabelRu: "Новая вещь" },
];

export function Bag({
  bag,
  stats,
  onEditMoney,
  onOpenItem,
  onAddItem,
  onAdjustBagCount,
}: {
  bag: BagView;
  stats: ChoicesView["stats"];
  onEditMoney: () => void;
  onOpenItem: (id: string) => void;
  onAddItem: (kind: string, nameRu: string) => void;
  onAdjustBagCount: (id: string, delta: number) => void;
}) {
  const { money, items, missingMaterials } = bag;
  const moneyRu = "Деньги";
  const shopping = new Set(
    missingMaterials.flatMap((need) => (need.itemId === undefined ? [] : [need.itemId])),
  );

  return (
    <div className="flex flex-col gap-2">
      <section className={`flex items-center gap-3 px-3 py-2 ${SURFACE_GROUP}`}>
        <h2 className="shrink-0 text-sm font-semibold">{moneyRu}</h2>
        <ul
          aria-label="Кошелёк"
          className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums"
        >
          {money.map(({ currency, amount }) => (
            <li key={currency}>
              <span className="text-ink-quiet">{currencyAbbr(currency)}</span>{" "}
              {amount}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onEditMoney}
          aria-label={editName(moneyRu)}
          className={`min-h-11 shrink-0 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          {EDIT_LABEL}
        </button>
      </section>

      {SECTIONS.map((section) => {
        const sectionItems = items.filter(
          (item) => item.kind === section.kind && !shopping.has(item.id),
        );
        return (
          <ItemSection
            key={section.kind}
            titleRu={section.titleRu}
            addLabelRu={section.addLabelRu}
            onAdd={(nameRu) => onAddItem(section.kind, nameRu)}
          >
            {sectionItems.length === 0 ? null : (
              <ul aria-label={section.titleRu} className="flex flex-col gap-0.5">
                {sectionItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    stats={stats}
                    onOpen={() => onOpenItem(item.id)}
                  >
                    <button
                      type="button"
                      aria-label={`Потратить один из сумки: ${item.nameRu}`}
                      disabled={item.bagCount === 0}
                      onClick={() => onAdjustBagCount(item.id, -1)}
                      className={`min-h-11 min-w-11 text-base disabled:opacity-40 ${SURFACE_CONTROL}`}
                    >
                      −
                    </button>
                    <span className="min-w-6 text-center text-sm tabular-nums">
                      {item.bagCount}
                    </span>
                    <button
                      type="button"
                      aria-label={`Добавить один в сумку: ${item.nameRu}`}
                      onClick={() => onAdjustBagCount(item.id, 1)}
                      className={`min-h-11 min-w-11 text-base ${SURFACE_CONTROL}`}
                    >
                      +
                    </button>
                  </ItemRow>
                ))}
              </ul>
            )}
          </ItemSection>
        );
      })}
    </div>
  );
}
