"use client";

import type { SheetBlockData } from "../model/rows";

export function SheetBlock({
  block,
  onEdit,
  onSecondaryEdit,
}: {
  block: SheetBlockData;
  onEdit: () => void;
  onSecondaryEdit: () => void;
}) {
  return (
    <section className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{block.titleRu}</h2>
        <div className="flex gap-1">
          {block.secondary === undefined ? null : (
            <button
              type="button"
              onClick={onSecondaryEdit}
              aria-label={`Править: ${block.secondary.labelRu}`}
              className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-800"
            >
              {block.secondary.labelRu}
            </button>
          )}
          {block.editable ? (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Править: ${block.titleRu}`}
              className="min-h-11 min-w-11 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-800"
            >
              Править
            </button>
          ) : null}
        </div>
      </div>
      <dl className="flex flex-col gap-0.5 text-sm">
        {block.rows.map((row) => (
          <div key={row.labelRu} className="flex items-baseline justify-between gap-2">
            <dt className="text-slate-600 dark:text-slate-400">{row.labelRu}</dt>
            <dd className="tabular-nums">
              {row.value}
              {row.hint === undefined ? null : (
                <span className="ml-1 text-xs text-slate-500">({row.hint})</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
