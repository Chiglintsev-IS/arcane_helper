"use client";

import { Fragment, type ReactNode } from "react";

import type { ChoicesView, ItemView } from "@/contract/views";
import { editName } from "@/ui/shared/ui/buttonLabels";
import { RULE_MARK } from "@/ui/shared/ui/rule";

import { itemMeta } from "../lib/itemMeta";

/**
 * Строка вещи: имя со своим числом и подробностями — дверь в правку вещи целиком; справа — то,
 * что с вещью делают в этом списке. Дверь зовётся тем же словом, что и шторка за ней: «открыть»
 * обещало бы чтение, а за строкой правят запись.
 *
 * Своё число стоит при имени, а не у края строки: подробностям под ними остаётся вся ширина, и к
 * глаголу число не примеряется. Что именно с вещью делают, строка не решает: у счётной вещи это
 * запас, у надеваемой — глагол, и знает об этом список, в котором строка стоит. Число приезжает
 * словами по той же причине: «надето» и «в сумке» — два разных счёта, и назвать свой обязан тот,
 * кто строку показывает.
 *
 * Прибавок строка не прячет и ради них не растёт: место берётся у повторов. Число в плашке стоит
 * впереди и один раз, имена при нём переносятся по одному, а плашка остаётся целой и на двух
 * строках — перечень с числом у каждого имени занял бы больше при том же составе.
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
  const { facts, neededFor, note } = itemMeta(item, stats);

  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={editName(item.nameRu)}
        className="min-h-11 min-w-0 flex-1 px-1 py-1.5 text-left"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 text-sm font-medium">{item.nameRu}</span>
          {countRu === undefined ? null : (
            <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-ink-quiet">
              {countRu}
            </span>
          )}
        </span>
        {facts.length === 0 && neededFor === undefined && note === undefined ? null : (
          <span className="mt-1 flex flex-wrap items-center gap-1">
            {facts.map((fact) => (
              <span
                key={`${fact.valueRu} ${fact.labelsRu.join(" ")}`}
                className={`px-1.5 py-0.5 text-xs leading-tight text-ink-quiet ${RULE_MARK.muted}`}
              >
                <span className="font-semibold tabular-nums text-ink">
                  {fact.valueRu}
                </span>
                {fact.labelsRu.map((labelRu) => (
                  <Fragment key={labelRu}>
                    {" "}
                    <span className="whitespace-nowrap">
                      {labelRu === fact.labelsRu.at(-1) ? labelRu : `${labelRu},`}
                    </span>
                  </Fragment>
                ))}
              </span>
            ))}
            {neededFor === undefined ? null : (
              <span className="min-w-0 text-xs leading-snug text-ink-quiet">
                {neededFor}
              </span>
            )}
            {note === undefined ? null : (
              <span className="min-w-0 text-xs leading-snug text-ink-quiet">
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
