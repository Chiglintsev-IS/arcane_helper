"use client";

import { useState } from "react";

import type { BagView, ChoicesView, ItemView } from "@/contract/views";
import { ItemRow } from "@/ui/entities/character/ui/ItemRow";
import { Purse } from "@/ui/entities/character/ui/Purse";
import { StockControls } from "@/ui/entities/character/ui/StockControls";
import { Choices } from "@/ui/shared/ui/Choices";
import { QuickAddField } from "@/ui/shared/ui/QuickAddField";
import { RULE_BETWEEN } from "@/ui/shared/ui/rule";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

export const BASE_FILTERS = [
  "all",
  "wanted",
  "absent",
  "gear",
  "consumable",
  "ingredient",
  "other",
] as const;

export type BaseFilter = (typeof BASE_FILTERS)[number];

const FILTER_TITLES: Record<BaseFilter, string> = {
  all: "Всё",
  wanted: "Покупки",
  absent: "Нет при себе",
  gear: "Экипировка",
  consumable: "Расходники",
  ingredient: "Ингредиенты",
  other: "Другое",
};

const WANTED_ADD_LABEL = "Что купить";

const RECORD_ADD_LABEL = "Просто запомнить";

const EMPTY_LIST: Record<BaseFilter, string> = {
  all: "Ни одной вещи ещё не заведено.",
  wanted: "Купить пока нечего.",
  absent: "Всё заведённое лежит при вас.",
  gear: "Экипировки не заведено.",
  consumable: "Расходников не заведено.",
  ingredient: "Ингредиентов не заведено.",
  other: "Неопознанного не заведено.",
};

function atHand(item: ItemView): boolean {
  return item.bagCount > 0 || item.wornCount > 0;
}

function suits(item: ItemView, filter: BaseFilter): boolean {
  if (filter === "all") return true;
  if (filter === "wanted") return item.wanted;
  if (filter === "absent") return !atHand(item);
  if (filter === "other") return item.kinds.length === 0;
  return item.kinds.includes(filter);
}

function found(item: ItemView, search: string): boolean {
  const asked = search.trim().toLowerCase();
  return asked === "" || item.nameRu.toLowerCase().includes(asked);
}

function countRu(item: ItemView): string {
  const inBag = `в сумке ${item.bagCount}`;
  return item.wornCount === 0 ? inBag : `надето ${item.wornCount} · ${inBag}`;
}

export function ItemBase({
  bag,
  stats,
  filter,
  onChangeFilter,
  onEditMoney,
  onOpenItem,
  onRecordItem,
  onAdjustBagCount,
  onAdjustWornCount,
}: {
  bag: BagView;
  stats: ChoicesView["stats"];
  filter: BaseFilter;
  onChangeFilter: (filter: BaseFilter) => void;
  onEditMoney: () => void;
  onOpenItem: (id: string) => void;
  onRecordItem: (nameRu: string, wanted: boolean) => void;
  onAdjustBagCount: (id: string, delta: number) => void;
  onAdjustWornCount: (id: string, delta: number) => void;
}) {
  const [search, setSearch] = useState("");

  const { money, items } = bag;
  const wanted = filter === "wanted";
  const shown = items.filter((item) => suits(item, filter) && found(item, search));

  return (
    <div className="flex flex-col gap-2">
      <Purse money={money} onEdit={onEditMoney} />

      <label className="flex flex-col gap-1 px-1 text-sm">
        <span className="text-ink-quiet">Поиск</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={`min-h-11 px-3 ${SURFACE_CONTROL}`}
        />
      </label>

      <Choices
        labelRu="Какие вещи"
        values={BASE_FILTERS}
        titles={FILTER_TITLES}
        chosen={filter}
        onChoose={onChangeFilter}
      />

      <section className={`flex flex-col gap-1 p-3 ${SURFACE_GROUP}`}>
        <QuickAddField
          labelRu={wanted ? WANTED_ADD_LABEL : RECORD_ADD_LABEL}
          onAdd={(nameRu) => onRecordItem(nameRu, wanted)}
        />

        {shown.length === 0 ? (
          <p className="text-xs text-ink-quiet">
            {search.trim() === "" ? EMPTY_LIST[filter] : "Ничего не нашлось."}
          </p>
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
