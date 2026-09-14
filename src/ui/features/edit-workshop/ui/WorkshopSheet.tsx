"use client";

import { useState } from "react";

import type { CommandOf } from "@/contract/commands";
import type { ChoicesView, CraftingView } from "@/contract/views";

import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { FIELD_TEXT } from "@/ui/shared/ui/field";
import { Sheet } from "@/ui/shared/ui/Sheet";
import { SURFACE_CONTROL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

const NO_KIT_RU = "Набора нет";

const KIT_FIELD = "Набор";

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
  const [apparatus, setApparatus] = useState(workshop.apparatusRu ?? "");

  return (
    <Sheet
      titleRu="Ремёсла"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              onConfirm({
                kind: "set_alchemy_workshop",
                ...(apparatus === "" ? {} : { apparatus }),
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
      }
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
        {ALCHEMY}
      </h3>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-quiet">{KIT_FIELD}</span>
        <select
          value={apparatus}
          onChange={(event) => setApparatus(event.target.value)}
          className={`min-h-11 w-full px-2 ${FIELD_TEXT} ${SURFACE_CONTROL}`}
        >
          <option value="">{NO_KIT_RU}</option>
          {choices.apparatusGrades.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>
      </label>

      {refusalRu === null ? null : (
        <p className="text-xs text-ink-soft">{refusalRu}</p>
      )}
    </Sheet>
  );
}
