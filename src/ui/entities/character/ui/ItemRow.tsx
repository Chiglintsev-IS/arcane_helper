"use client";

import { Fragment, type ReactNode } from "react";

import type { ChoicesView, ItemView } from "@/contract/views";
import { editName } from "@/ui/shared/ui/buttonLabels";
import { RULE_MARK } from "@/ui/shared/ui/rule";

import { propertyNumberRu, rarityLabel } from "@/ui/shared/lib/alchemyLabels";

import { itemMeta } from "../lib/itemMeta";

export function ItemRow({
  item,
  stats,
  countRu,
  onOpen,
  children,
}: {
  item: ItemView;
  stats: ChoicesView["stats"];
  countRu?: string;
  onOpen: () => void;
  children?: ReactNode;
}) {
  const { facts, marksRu, neededFor, note } = itemMeta(item, stats);

  return (
    <li className="flex flex-col py-1">
      <button
        type="button"
        onClick={onOpen}
        aria-label={editName(item.nameRu)}
        className="min-h-11 w-full px-1 py-1.5 text-left"
      >
        <span className="block text-sm font-medium">{item.nameRu}</span>
        {facts.length === 0 &&
        marksRu.length === 0 &&
        neededFor === undefined &&
        note === undefined ? null : (
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
            {marksRu.map((markRu) => (
              <span
                key={markRu}
                className={`px-1.5 py-0.5 text-xs leading-tight text-ink-quiet ${RULE_MARK.muted}`}
              >
                {markRu}
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

      {item.alchemicalProperties.length === 0 ? null : (
        <ul className="flex flex-col gap-0.5 px-1 pb-1">
          {item.alchemicalProperties.map((property) => (
            <li key={property.number} className="flex items-baseline gap-2 text-xs">
              <span className="shrink-0 font-semibold tabular-nums text-ink-quiet">
                {propertyNumberRu(property.number)}
              </span>
              <span className="min-w-0 flex-1 leading-snug">{property.nameRu}</span>
              <span className="shrink-0 text-ink-quiet">{rarityLabel(property.rarity)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 pb-1 pl-1">
        {countRu === undefined ? (
          <span />
        ) : (
          <span className="min-w-0 text-xs tabular-nums text-ink-quiet">{countRu}</span>
        )}
        <span className="flex shrink-0 items-center gap-1">{children}</span>
      </div>
    </li>
  );
}
