"use client";

import { useState } from "react";

import type { BagView, ChoicesView, ItemView } from "@/contract/views";
import { ItemRow } from "@/ui/entities/character/ui/ItemRow";
import { Purse } from "@/ui/entities/character/ui/Purse";
import { cycled, NO_SIFT, sifts, type TraitSift } from "@/ui/features/filter-items/model/itemFilter";
import { ItemSift, SIFT_TITLE } from "@/ui/features/filter-items/ui/ItemSift";
import { Magnifier } from "@/ui/shared/ui/Magnifier";
import { FIELD_TEXT } from "@/ui/shared/ui/field";
import { RULE_BETWEEN, RULE_COLUMN, RULE_EDGE_BOTTOM, RULE_GROUP } from "@/ui/shared/ui/rule";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

const SEARCH_LABEL = "Найти вещь";

const CLEAR_MARK = "✕";

const NOTHING_FOUND = "Ничего не нашлось.";

const EMPTY_BAG = "При себе ничего нет.";

/**
 * Рюкзак: что при персонаже и сколько его. Сито и поиск стоят над списком, деньги — первой строкой,
 * потому что за столом их трогают чаще всего.
 */
export function Bag({
  items,
  money,
  stats,
  openedId,
  onOpenItem,
  onSpend,
  onStock,
  onWriteMoney,
}: {
  items: readonly ItemView[];
  money: BagView["money"];
  stats: ChoicesView["stats"];
  openedId: string | null;
  onOpenItem: (id: string) => void;
  onSpend: (id: string) => void;
  onStock: (id: string) => void;
  onWriteMoney: (coins: Readonly<Record<string, number>>) => void;
}) {
  const [query, setQuery] = useState("");
  const [sift, setSift] = useState<TraitSift>(NO_SIFT);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [siftOpen, setSiftOpen] = useState(false);

  const shown = items.filter((item) => sifts(item, sift, query));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Purse
        money={money}
        opened={moneyOpen}
        aside={
          <button
            type="button"
            aria-expanded={siftOpen}
            onClick={() => setSiftOpen(!siftOpen)}
            className={`shrink-0 px-3 text-xs ${siftOpen ? "text-accent" : "text-ink-quiet"} ${RULE_COLUMN}`}
          >
            {SIFT_TITLE}
          </button>
        }
        onToggle={() => setMoneyOpen(!moneyOpen)}
        onWrite={onWriteMoney}
      />

      <div className={`flex shrink-0 items-center gap-2 px-3 py-2 ${RULE_EDGE_BOTTOM}`}>
        <label className={`flex min-h-11 flex-1 items-center gap-2 px-2.5 ${SURFACE_CONTROL}`}>
          <span className="shrink-0 text-ink-quiet">
            <Magnifier />
          </span>
          <input
            type="search"
            aria-label={SEARCH_LABEL}
            placeholder={SEARCH_LABEL}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`min-w-0 flex-1 bg-transparent py-2 outline-none ${FIELD_TEXT}`}
          />
        </label>
        {query === "" ? null : (
          <button
            type="button"
            aria-label={`${SEARCH_LABEL}: очистить`}
            onClick={() => setQuery("")}
            className={`shrink-0 px-3 text-xs text-ink-quiet ${RULE_GROUP}`}
          >
            <span aria-hidden="true">{CLEAR_MARK}</span>
          </button>
        )}
      </div>

      {!siftOpen ? null : (
        <div className={RULE_EDGE_BOTTOM}>
          <ItemSift sift={sift} onCycle={(trait) => setSift(cycled(sift, trait))} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="px-3 py-3 text-xs text-ink-quiet">
            {items.length === 0 ? EMPTY_BAG : NOTHING_FOUND}
          </p>
        ) : (
          <ul aria-label="Рюкзак" className={`flex flex-col ${RULE_BETWEEN}`}>
            {shown.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                stats={stats}
                opened={item.id === openedId}
                onOpen={() => onOpenItem(item.id)}
                onSpend={() => onSpend(item.id)}
                onStock={() => onStock(item.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
