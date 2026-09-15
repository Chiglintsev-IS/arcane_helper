"use client";

import type { ChoicesView, ItemView } from "@/contract/views";
import { RULE_COLUMN, RULE_EDGE_ACTIVE, RULE_EDGE_QUIET } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";

import { bonusLine, traitLine, unitRu } from "../lib/itemMeta";
import { itemTraitLabel, itemTraitsOf } from "../lib/itemTraits";

const SPEND_MARK = "−";

const STOCK_MARK = "+";

function wornRu(item: ItemView): string {
  return `надето ${item.wornCount} из ${item.ownedCount}`;
}

/**
 * Строка наличия: число со своей единицей и два нажатия рядом с ним. Прибавки, надетое и признаки
 * подписаны под именем, потому что за столом спрашивают «сколько осталось», а не «что это».
 */
export function ItemRow({
  item,
  stats,
  opened,
  onOpen,
  onSpend,
  onStock,
}: {
  item: ItemView;
  stats: ChoicesView["stats"];
  opened: boolean;
  onOpen: () => void;
  onSpend: () => void;
  onStock: () => void;
}) {
  const bonusesRu = bonusLine(item, stats);
  const traitsRu = traitLine(itemTraitsOf(item).map(itemTraitLabel));
  const empty = item.ownedCount === 0;

  return (
    <li
      className={`flex items-stretch ${opened ? `${SURFACE_GROUP_BARE} ${RULE_EDGE_ACTIVE}` : RULE_EDGE_QUIET}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`text-sm leading-tight ${empty ? "text-ink-quiet" : ""}`}>
            {item.nameRu}
          </span>
          {item.wornCount === 0 ? null : (
            <span className="text-[0.65rem] leading-tight text-accent">{wornRu(item)}</span>
          )}
          {bonusesRu === "" ? null : (
            <span className="text-[0.65rem] leading-snug text-ink-soft">{bonusesRu}</span>
          )}
          {traitsRu === "" ? null : (
            <span className="text-[0.625rem] leading-tight text-ink-quiet lowercase">{traitsRu}</span>
          )}
        </span>
        <span className="flex shrink-0 items-baseline gap-1">
          <span
            className={`text-lg font-semibold leading-none tabular-nums ${empty ? "text-off" : ""}`}
          >
            {item.ownedCount}
          </span>
          <span className="text-[0.6rem] text-ink-quiet">{unitRu(item, item.ownedCount)}</span>
        </span>
      </button>

      <button
        type="button"
        aria-label={`Потратить один из сумки: ${item.nameRu}`}
        disabled={item.bagCount === 0}
        onClick={onSpend}
        className={`w-12 shrink-0 text-lg text-accent disabled:text-off ${RULE_COLUMN}`}
      >
        <span aria-hidden="true">{SPEND_MARK}</span>
      </button>
      <button
        type="button"
        aria-label={`Добавить один в сумку: ${item.nameRu}`}
        onClick={onStock}
        className={`w-12 shrink-0 text-base text-ink-quiet ${RULE_COLUMN}`}
      >
        <span aria-hidden="true">{STOCK_MARK}</span>
      </button>
    </li>
  );
}
