"use client";

import type { BagView, ChoicesView, ItemView } from "@/contract/views";
import { ItemRow } from "@/ui/entities/character/ui/ItemRow";
import { Purse } from "@/ui/entities/character/ui/Purse";
import { StockControls } from "@/ui/entities/character/ui/StockControls";
import { Choices } from "@/ui/shared/ui/Choices";
import { QuickAddField } from "@/ui/shared/ui/QuickAddField";
import { RULE_BETWEEN } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP } from "@/ui/shared/ui/surface";

export const BAG_FILTERS = ["all", "gear", "consumable", "ingredient", "other"] as const;

export type BagFilter = (typeof BAG_FILTERS)[number];

const FILTER_TITLES: Record<BagFilter, string> = {
  all: "Всё",
  gear: "Экипировка",
  consumable: "Расходники",
  ingredient: "Ингредиенты",
  other: "Другое",
};

const ADD_LABELS: Record<BagFilter, string | null> = {
  all: "Новая вещь",
  gear: "Новая экипировка",
  consumable: "Новый расходник",
  ingredient: "Новый ингредиент",
  other: "Новая вещь",
};

const ADDED_KINDS: Record<BagFilter, readonly string[]> = {
  all: [],
  gear: ["gear"],
  consumable: ["consumable"],
  ingredient: ["ingredient"],
  other: [],
};

const EMPTY_LIST: Record<BagFilter, string> = {
  all: "При себе ничего нет.",
  gear: "Экипировки при себе нет.",
  consumable: "Расходников при себе нет.",
  ingredient: "Ингредиентов при себе нет.",
  other: "Неопознанного при себе нет.",
};

function atHand(item: ItemView): boolean {
  return item.bagCount > 0 || item.wornCount > 0;
}

function suits(item: ItemView, filter: BagFilter): boolean {
  if (!atHand(item)) return false;
  if (filter === "all") return true;
  if (filter === "other") return item.kinds.length === 0;
  return item.kinds.includes(filter);
}

function countRu(item: ItemView): string {
  const inBag = `в сумке ${item.bagCount}`;
  return item.wornCount === 0 ? inBag : `надето ${item.wornCount} · ${inBag}`;
}

export function Bag({
  bag,
  stats,
  filter,
  onChangeFilter,
  onEditMoney,
  onOpenItem,
  onAddItem,
  onAdjustBagCount,
  onAdjustWornCount,
}: {
  bag: BagView;
  stats: ChoicesView["stats"];
  filter: BagFilter;
  onChangeFilter: (filter: BagFilter) => void;
  onEditMoney: () => void;
  onOpenItem: (id: string) => void;
  onAddItem: (kinds: readonly string[], nameRu: string) => void;
  onAdjustBagCount: (id: string, delta: number) => void;
  onAdjustWornCount: (id: string, delta: number) => void;
}) {
  const { money, items, armorClass } = bag;
  const shown = items.filter((item) => suits(item, filter));
  const wears = filter === "gear";
  const addLabelRu = ADD_LABELS[filter];

  return (
    <div className="flex flex-col gap-2">
      <Purse money={money} onEdit={onEditMoney} />

      <Choices
        labelRu="Что в рюкзаке"
        values={BAG_FILTERS}
        titles={FILTER_TITLES}
        chosen={filter}
        onChoose={onChangeFilter}
      />

      {wears ? (
        <section className={`flex items-center gap-3 px-3 py-2 ${SURFACE_GROUP}`}>
          <h2 className="shrink-0 text-sm font-semibold">Защита</h2>
          <p className="text-sm tabular-nums">
            КД {armorClass.value}
            {armorClass.baseNameRu === undefined ? null : (
              <span className="text-ink-quiet">
                {" · "}
                {armorClass.baseNameRu}
              </span>
            )}
          </p>
        </section>
      ) : null}

      <section className={`flex flex-col gap-1 p-3 ${SURFACE_GROUP}`}>
        {addLabelRu === null ? null : (
          <QuickAddField
            labelRu={addLabelRu}
            onAdd={(nameRu) => onAddItem(ADDED_KINDS[filter], nameRu)}
          />
        )}

        {shown.length === 0 ? (
          <p className="text-xs text-ink-quiet">{EMPTY_LIST[filter]}</p>
        ) : (
          <ul aria-label={FILTER_TITLES[filter]} className={`flex flex-col ${RULE_BETWEEN}`}>
            {shown.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                stats={stats}
                countRu={countRu(item)}
                onOpen={() => onOpenItem(item.id)}
              >
                <StockControls
                  item={item}
                  onAdjustBagCount={(delta) => onAdjustBagCount(item.id, delta)}
                  onAdjustWornCount={(delta) => onAdjustWornCount(item.id, delta)}
                />
              </ItemRow>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
