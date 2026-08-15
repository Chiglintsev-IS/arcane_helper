"use client";

import type { ReactNode } from "react";

import type { ChoicesView, ItemView } from "@/contract/views";

import { itemMeta } from "../lib/itemMeta";

/**
 * Строка вещи: имя с подробностями — кнопка, открывающая вещь целиком; справа — своё число и то, что
 * с вещью делают в этом списке.
 *
 * Что именно делают, строка не решает: у счётной вещи это запас, у надеваемой — глагол, и знает об
 * этом список, в котором строка стоит. Число приезжает словами по той же причине: «надето» и «в
 * сумке» — два разных счёта, и назвать свой обязан тот, кто строку показывает.
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
  const meta = itemMeta(item, stats);

  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Открыть: ${item.nameRu}`}
        className="min-h-11 min-w-0 flex-1 rounded-lg px-1 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-900"
      >
        <span className="block text-sm">{item.nameRu}</span>
        {/*
         * Подробности — две строки: у вещи, которая двигает все шесть спасбросков, перечень
         * занимает треть экрана и отодвигает за край соседние вещи. Целиком вещь показывает своя
         * шторка, и открывает её эта же строка.
         */}
        {meta === "" ? null : (
          <span className="line-clamp-2 text-xs leading-snug text-slate-500 dark:text-slate-400">
            {meta}
          </span>
        )}
      </button>

      {countRu === undefined ? null : (
        <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {countRu}
        </span>
      )}

      <span className="flex shrink-0 items-center gap-1">{children}</span>
    </li>
  );
}
