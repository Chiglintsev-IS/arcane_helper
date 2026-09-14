"use client";

import { useState } from "react";

import type { CommandOf } from "@/contract/commands";
import type { PreviewOf, Question } from "@/contract/questions";
import type { RecoveryView } from "@/contract/views";

import { ARCANE_RECOVERY_LABEL } from "@/ui/entities/character/lib/labels";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { usePreview } from "@/ui/shared/model/usePreview";
import { Sheet } from "@/ui/shared/ui/Sheet";
import { SURFACE_CONTROL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

type SlotRecoveryPlan = CommandOf<"use_arcane_recovery">["plan"];

export function ArcaneRecoverySheet({
  recovery,
  onConfirm,
  onCancel,
}: {
  recovery: RecoveryView["arcaneRecovery"];
  onConfirm: (plan: SlotRecoveryPlan) => void;
  onCancel: () => void;
}) {
  const [plan, setPlan] = useState<SlotRecoveryPlan>({});

  const question: Question = { kind: "arcane_recovery_preview", plan };
  const answer = usePreview(question);
  const preview: PreviewOf<"arcane_recovery_preview"> | null =
    answer?.kind === "arcane_recovery_preview" ? answer : null;

  const change = (level: number, delta: number): void => {
    setPlan({ ...plan, [level]: Math.max(0, (plan[level] ?? 0) + delta) });
  };

  return (
    <Sheet
      titleRu={ARCANE_RECOVERY_LABEL}
      aside={
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {preview?.levelsSpent ?? 0} из {recovery.remaining}
        </span>
      }
      subtitleRu="Суммарный уровень возвращаемых ячеек"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            disabled={preview === null || preview.unavailabilityRu !== undefined}
            onClick={() => onConfirm(plan)}
            className={`min-h-11 flex-1 ${SURFACE_PRIMARY} px-3 text-sm font-semibold disabled:opacity-50`}
          >
            {BUTTON_LABELS.confirm}
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
      {recovery.recoverable.length === 0 ? (
        <p className="text-sm text-ink-quiet">
          Все ячейки на месте — возвращать нечего.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {recovery.recoverable.map((slot) => (
            <li key={slot.level} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {slot.level} ур.{" "}
                <span className="text-ink-quiet">
                  потрачено {slot.spent}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => change(slot.level, -1)}
                  aria-label={`Убрать ячейку ${slot.level} уровня`}
                  className={`min-h-11 min-w-11 ${SURFACE_CONTROL}`}
                >
                  <span aria-hidden="true">−</span>
                </button>
                <span className="w-6 text-center font-semibold tabular-nums">
                  {plan[slot.level] ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => change(slot.level, 1)}
                  aria-label={`Вернуть ячейку ${slot.level} уровня`}
                  className={`min-h-11 min-w-11 ${SURFACE_CONTROL}`}
                >
                  <span aria-hidden="true">+</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {preview?.unavailabilityRu === undefined ? null : (
        <p className="text-xs text-ink-quiet">{preview.unavailabilityRu}</p>
      )}
    </Sheet>
  );
}
