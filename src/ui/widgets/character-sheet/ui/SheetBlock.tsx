"use client";

import { DASH } from "@/ui/entities/character/lib/labels";

import type { SheetBlockData, SheetEdit } from "../model/rows";
import { EDIT_LABEL, editName } from "@/ui/shared/ui/buttonLabels";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

export function SheetBlock({
  block,
  onEdit,
}: {
  block: SheetBlockData;
  onEdit: (edit: SheetEdit) => void;
}) {
  const { edit, secondary, features } = block;

  return (
    <section className={`flex flex-col gap-1 rounded-xl p-3 ${SURFACE_GROUP}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{block.titleRu}</h2>
        <div className="flex gap-1">
          {secondary === undefined ? null : (
            <button
              type="button"
              onClick={() => onEdit(secondary.edit)}
              aria-label={editName(secondary.labelRu)}
              className={`min-h-11 rounded-lg px-3 text-sm ${SURFACE_CONTROL}`}
            >
              {secondary.labelRu}
            </button>
          )}
          {edit === undefined ? null : (
            <button
              type="button"
              onClick={() => onEdit(edit)}
              aria-label={editName(block.titleRu)}
              className={`min-h-11 min-w-11 rounded-lg px-3 text-sm ${SURFACE_CONTROL}`}
            >
              {EDIT_LABEL}
            </button>
          )}
        </div>
      </div>
      <dl className="flex flex-col gap-0.5 text-sm">
        {block.rows.map((row) => (
          <div key={row.labelRu} className="flex items-baseline justify-between gap-2">
            <dt className="text-slate-600 dark:text-slate-400">{row.labelRu}</dt>
            <dd className="tabular-nums">
              {row.value}
              {row.hint === undefined ? null : (
                <span className="ml-1 text-xs text-slate-600 dark:text-slate-400">({row.hint})</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {features === undefined ? null : features.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">{DASH}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {features.map((feature) => (
            <li key={feature.nameRu} className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{feature.nameRu}</span>
              <span className="text-xs leading-snug text-slate-600 dark:text-slate-400">
                {feature.summaryRu}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
