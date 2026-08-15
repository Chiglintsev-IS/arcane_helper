"use client";

import { Fragment, type ReactNode } from "react";

import type { ChoicesView, ItemView } from "@/contract/views";

import { itemMeta } from "../lib/itemMeta";

const FACT_SEPARATOR = " · ";

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
  const hasDetails = facts.length > 0 || note !== undefined;

  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Открыть: ${item.nameRu}`}
        className="min-h-11 min-w-0 flex-1 rounded-lg px-1 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-900"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 text-sm font-medium">{item.nameRu}</span>
          {countRu === undefined ? null : (
            <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {countRu}
            </span>
          )}
        </span>
        {/*
         * Подробности — не больше двух строк, и перенос идёт между фактами: рваная посередине
         * прибавка читается как две. Целиком вещь показывает своя шторка, и открывает её эта же
         * строка.
         */}
        {!hasDetails ? null : (
          <span className="line-clamp-2 text-xs leading-snug text-slate-500 dark:text-slate-400">
            {facts.map((fact, index) => (
              <Fragment key={fact}>
                {index === 0 ? null : FACT_SEPARATOR}
                <span className="whitespace-nowrap">{fact}</span>
              </Fragment>
            ))}
            {note === undefined ? null : (
              <Fragment>
                {facts.length === 0 ? null : FACT_SEPARATOR}
                {note}
              </Fragment>
            )}
          </span>
        )}
      </button>

      <span className="flex shrink-0 items-center gap-1">{children}</span>
    </li>
  );
}
