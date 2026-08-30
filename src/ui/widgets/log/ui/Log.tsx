"use client";

import { useState } from "react";

import type { Snapshot } from "@/contract/snapshot";
import { timeRu } from "@/ui/shared/lib/timeRu";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

export function Log({
  entries,
  onUndo,
  onData,
}: {
  entries: Snapshot["log"];
  onUndo: () => void;
  onData: () => void;
}) {
  const newestFirst = [...entries].reverse();

  const [asked, setAsked] = useState<{ id: string; summaryRu: string } | null>(null);
  const returned = asked !== null && entries.every((entry) => entry.id !== asked.id) ? asked : null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onData}
        className={`min-h-11 self-start px-3 text-sm font-medium ${SURFACE_CONTROL}`}
      >
        Данные
      </button>

      {returned === null ? null : (
        <div
          role="status"
          className={`flex flex-col gap-1 p-2 ${SURFACE_GROUP}`}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-ink-quiet">
            Вернулось
          </span>
          <span className="text-sm leading-tight">{returned.summaryRu}</span>
        </div>
      )}

      {newestFirst.length === 0 ? (
        <p className="text-sm text-ink-quiet">Пока ничего не произошло.</p>
      ) : (
        <ul aria-label="Лог событий" className="flex flex-col gap-2">
          {newestFirst.map((entry, index) => (
            <li
              key={entry.id}
              className={`flex flex-col gap-1 p-2 ${SURFACE_GROUP}`}
            >
              <span className="text-sm leading-tight">{entry.summaryRu}</span>
              <span className="text-xs tabular-nums text-ink-quiet">
                {timeRu(entry.at)}
              </span>
              {index === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setAsked({ id: entry.id, summaryRu: entry.summaryRu });
                    onUndo();
                  }}
                  aria-label={`${BUTTON_LABELS.undo}: ${entry.summaryRu}`}
                  className={`min-h-11 px-3 text-sm ${SURFACE_CONTROL}`}
                >
                  {BUTTON_LABELS.undo}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
