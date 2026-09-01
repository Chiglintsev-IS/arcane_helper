"use client";

import { useId, useState } from "react";

import type { CommandOf } from "@/contract/commands";
import type { ChoicesView, CraftingView } from "@/contract/views";

import { DIRECTION_LABELS } from "@/ui/entities/crafting/lib/labels";
import { labelled } from "@/ui/shared/lib/alchemyLabels";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import {
  SURFACE_CONTROL,
  SURFACE_PANEL,
  SURFACE_PRIMARY,
} from "@/ui/shared/ui/surface";

const NO_KIT_RU = "Набора нет";

const ALCHEMY = "Алхимия";

export function WorkshopSheet({
  workshop,
  choices,
  refusalRu,
  onConfirm,
  onCancel,
}: {
  workshop: CraftingView["workshop"];
  choices: ChoicesView;
  refusalRu: string | null;
  onConfirm: (next: CommandOf<"set_alchemy_workshop">) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const [apparatus, setApparatus] = useState<Record<string, string>>(
    Object.fromEntries(
      workshop.apparatus.map((kit) => [kit.direction, kit.gradeRu]),
    ),
  );
  const [studied, setStudied] = useState<readonly string[]>(
    workshop.studiedDirections,
  );

  const withGrade = (direction: string, grade: string): void => {
    const { [direction]: _dropped, ...rest } = apparatus;
    setApparatus(grade === "" ? rest : { ...rest, [direction]: grade });
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 p-3 ${SURFACE_PANEL}`}
    >
      <h2 id={titleId} className="text-base font-semibold leading-tight">
        Ремёсла
      </h2>

      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
        {ALCHEMY}
      </h3>

      <ul className="flex flex-col gap-3">
        {choices.alchemyDirections.map((direction) => {
          const closed = workshop.closedDirections.find(
            (one) => one.direction === direction,
          );
          return closed !== undefined ? (
            <li key={direction} className="flex flex-col gap-0.5">
              <span className="text-xs text-ink-quiet">
                {labelled(DIRECTION_LABELS, direction)}
              </span>
              <p className="text-xs leading-snug text-ink-soft">
                {closed.reasonRu}
              </p>
            </li>
          ) : (
            <li key={direction} className="flex flex-col gap-1">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ink-quiet">
                  {labelled(DIRECTION_LABELS, direction)}
                </span>
                <select
                  value={apparatus[direction] ?? ""}
                  onChange={(event) => withGrade(direction, event.target.value)}
                  className={`min-h-11 w-full px-2 text-sm ${SURFACE_CONTROL}`}
                >
                  <option value="">{NO_KIT_RU}</option>
                  {choices.apparatusGrades.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                aria-pressed={studied.includes(direction)}
                onClick={() =>
                  setStudied(
                    studied.includes(direction)
                      ? studied.filter((named) => named !== direction)
                      : [...studied, direction],
                  )
                }
                className={`min-h-11 px-2 text-xs ${SURFACE_CONTROL} ${
                  studied.includes(direction) ? "font-semibold" : ""
                }`}
              >
                Направление изучено
              </button>
            </li>
          );
        })}
      </ul>

      {refusalRu === null ? null : (
        <p className="text-xs text-ink-soft">{refusalRu}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            onConfirm({
              kind: "set_alchemy_workshop",
              apparatus,
              studiedDirections: [...studied],
            })
          }
          className={`min-h-11 flex-1 ${SURFACE_PRIMARY} px-3 text-sm font-semibold`}
        >
          {BUTTON_LABELS.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`min-h-11 shrink-0 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          {BUTTON_LABELS.dismiss}
        </button>
      </div>
    </section>
  );
}
