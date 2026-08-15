"use client";

import type { ReactNode } from "react";

import type { ChoicesView, ItemView } from "@/contract/views";

import { itemMeta } from "../lib/itemMeta";

/** Видимых фактов без счёта. Сверх них строка называет число, а вещь целиком показывает шторка. */
const VISIBLE_FACTS = 3;

/** Прятать за счётом единственный факт нельзя: счёт занимает не меньше места, чем он сам. */
const LEAST_HIDDEN = 2;

/**
 * Строка вещи: имя со своим числом и подробностями — кнопка, открывающая вещь целиком; справа — то,
 * что с вещью делают в этом списке.
 *
 * Своё число стоит при имени, а не у края строки: подробностям под ними остаётся вся ширина, и к
 * глаголу число не примеряется. Что именно с вещью делают, строка не решает: у счётной вещи это
 * запас, у надеваемой — глагол, и знает об этом список, в котором строка стоит. Число приезжает
 * словами по той же причине: «надето» и «в сумке» — два разных счёта, и назвать свой обязан тот,
 * кто строку показывает.
 */
export function ItemRow({
  item,
  stats,
  countRu,
  onOpen,
  children,
}: {
  item: ItemView;
  /** Величины с разбором: ими подписаны прибавки вещи. */
  stats: ChoicesView["stats"];
  /** Своё число этой строки словами; нет вовсе — число называет само управление рядом. */
  countRu?: string;
  onOpen: () => void;
  children?: ReactNode;
}) {
  const { facts, note } = itemMeta(item, stats);
  const hiddenCount = facts.length - VISIBLE_FACTS >= LEAST_HIDDEN ? facts.length - VISIBLE_FACTS : 0;
  const visibleFacts = hiddenCount === 0 ? facts : facts.slice(0, VISIBLE_FACTS);

  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Открыть: ${item.nameRu}`}
        className="min-h-11 min-w-0 flex-1 rounded-lg px-1 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-900"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 text-sm font-medium">{item.nameRu}</span>
          {countRu === undefined ? null : (
            <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {countRu}
            </span>
          )}
        </span>
        {visibleFacts.length === 0 && note === undefined ? null : (
          <span className="mt-1 flex flex-wrap items-center gap-1">
            {visibleFacts.map((fact) => (
              <span
                key={fact.labelRu}
                className="whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 text-xs leading-tight text-slate-600 dark:bg-slate-800/60 dark:text-slate-400"
              >
                {fact.labelRu}
                {fact.valueRu === undefined ? null : (
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {" "}
                    {fact.valueRu}
                  </span>
                )}
              </span>
            ))}
            {hiddenCount === 0 ? null : (
              <span className="whitespace-nowrap rounded-md border border-dashed border-slate-300 px-1.5 py-0.5 text-xs leading-tight text-slate-500 dark:border-slate-700 dark:text-slate-400">
                ещё {hiddenCount}
              </span>
            )}
            {note === undefined ? null : (
              <span className="min-w-0 text-xs leading-snug text-slate-500 dark:text-slate-400">
                {note}
              </span>
            )}
          </span>
        )}
      </button>

      <span className="flex shrink-0 items-center gap-1">{children}</span>
    </li>
  );
}
