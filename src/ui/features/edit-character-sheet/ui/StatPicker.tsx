"use client";

import { useState } from "react";

import type { ChoicesView } from "@/contract/views";
import {
  statFamilyLabel,
  statHint,
  statKindLabel,
  statLabel,
} from "@/ui/entities/character/lib/labels";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { FIELD_TEXT } from "@/ui/shared/ui/field";
import { Sheet } from "@/ui/shared/ui/Sheet";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

const SAVES_FAMILY = "saves";

const TITLE = "К чему прибавка";

const TAKEN_HINT = "уже есть";

function matching(labelRu: string, search: string): boolean {
  return labelRu.toLowerCase().includes(search.trim().toLowerCase());
}

export function StatPicker({
  stats,
  taken,
  onPick,
  onPickFamily,
  onCancel,
}: {
  stats: ChoicesView["stats"];
  taken: readonly string[];
  onPick: (stat: string) => void;
  onPickFamily: (stats: readonly string[]) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState("");

  const found = stats.filter((stat) => matching(statLabel(stats, stat.id), search));
  const kinds = [...new Set(found.map((stat) => stat.kind))];
  const saves = stats.filter((stat) => stat.kind === "save").map((stat) => stat.id);

  return (
    <Sheet
      titleRu={TITLE}
      overSheet
      footer={
        <button
          type="button"
          onClick={onCancel}
          className={`min-h-11 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          {BUTTON_LABELS.dismiss}
        </button>
      }
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-quiet">Поиск</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={`min-h-11 px-3 ${FIELD_TEXT} ${SURFACE_CONTROL}`}
        />
      </label>

      <div className="flex flex-col gap-3">
        {found.length === 0 ? <p className="text-xs text-ink-quiet">Ничего не нашлось.</p> : null}

        {kinds.map((kind) => (
          <section key={kind} className="flex flex-col gap-1">
            <h3 className="text-xs text-ink-quiet">{statKindLabel(kind)}</h3>
            <div className="flex flex-wrap gap-1">
              {kind !== "save" ? null : (
                <button
                  type="button"
                  onClick={() => onPickFamily(saves)}
                  className={`min-h-11 px-2 py-1 text-left text-xs font-medium text-action ${SURFACE_CONTROL}`}
                >
                  {statFamilyLabel(SAVES_FAMILY)}
                </button>
              )}
              {found
                .filter((stat) => stat.kind === kind)
                .map((stat) => {
                  const labelRu = statLabel(stats, stat.id);
                  const hintRu = taken.includes(stat.id) ? TAKEN_HINT : statHint(stat.id);
                  return (
                    <button
                      key={stat.id}
                      type="button"
                      aria-label={hintRu === undefined ? labelRu : `${labelRu}: ${hintRu}`}
                      onClick={() => onPick(stat.id)}
                      className={`flex min-h-11 flex-col justify-center px-2 py-1 text-left text-xs ${SURFACE_CONTROL}`}
                    >
                      <span>{labelRu}</span>
                      {hintRu === undefined ? null : (
                        <span className="text-ink-quiet">{hintRu}</span>
                      )}
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
