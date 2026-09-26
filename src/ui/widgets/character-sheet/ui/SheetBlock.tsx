"use client";

import { Fragment, type ReactNode } from "react";

import { DASH } from "@/ui/entities/character/lib/labels";
import { SURFACE_GROUP } from "@/ui/shared/ui/surface";
import { ValueRow } from "@/ui/shared/ui/ValueRow";

import type { SheetBlockData, SheetField, SheetRow } from "../model/rows";

export function SheetBlock({
  block,
  opened,
  formOf,
  onOpen,
}: {
  block: SheetBlockData;
  opened: SheetField | null;
  formOf: (row: SheetRow) => ReactNode;
  onOpen: (field: SheetField) => void;
}) {
  const { features } = block;

  return (
    <section className={`flex flex-col gap-1 p-3 ${SURFACE_GROUP}`}>
      <h2 className="text-sm font-semibold">{block.titleRu}</h2>
      {block.rows.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          {block.rows.map((row) => (
            <Fragment key={row.field}>
              <ValueRow labelRu={row.labelRu} valueRu={row.value} onOpen={() => onOpen(row.field)} />
              {opened === row.field ? formOf(row) : null}
            </Fragment>
          ))}
        </div>
      )}
      {features === undefined ? null : features.length === 0 ? (
        <p className="text-sm text-ink-quiet">{DASH}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {features.map((feature) => (
            <li key={feature.nameRu} className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{feature.nameRu}</span>
              <span className="text-xs leading-snug text-ink-quiet">
                {feature.summaryRu}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
