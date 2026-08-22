/**
 * Магическое восстановление.
 *
 * Игрок выбирает, какие ячейки вернуть; годится ли набранное, отвечают правила — тем же ответом,
 * которым потом откажет или согласится подтверждение. Проверка здесь не повторяется, а спрашивается:
 * расхождение проверки в интерфейсе и проверки в правилах — ровно та ошибка, из-за которой
 * перестают доверять числам.
 *
 * Уровни без единой потраченной ячейки не показываются: возвращать там нечего, а строка со
 * счётчиком, который нельзя увеличить, читается как неисправность.
 */

"use client";

import { useId, useState } from "react";

import type { CommandOf } from "@/contract/commands";
import type { PreviewOf, Question } from "@/contract/questions";
import type { RecoveryView } from "@/contract/views";

import { ARCANE_RECOVERY_LABEL } from "@/ui/entities/character/lib/labels";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { usePreview } from "@/ui/shared/model/usePreview";
import { SURFACE_CONTROL, SURFACE_PANEL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

type SlotRecoveryPlan = CommandOf<"use_arcane_recovery">["plan"];

export function ArcaneRecoverySheet({
  recovery,
  onConfirm,
  onCancel,
}: {
  /** Что вернуть и сколько бюджета осталось: отбор уровней сделали правила. */
  recovery: RecoveryView["arcaneRecovery"];
  onConfirm: (plan: SlotRecoveryPlan) => void;
  onCancel: () => void;
}) {
  const [plan, setPlan] = useState<SlotRecoveryPlan>({});
  const titleId = useId();

  const question: Question = { kind: "arcane_recovery_preview", plan };
  const answer = usePreview(question);
  const preview: PreviewOf<"arcane_recovery_preview"> | null =
    answer?.kind === "arcane_recovery_preview" ? answer : null;

  const change = (level: number, delta: number): void => {
    setPlan({ ...plan, [level]: Math.max(0, (plan[level] ?? 0) + delta) });
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 p-3 ${SURFACE_PANEL}`}
    >
      <header className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold leading-tight">
            {ARCANE_RECOVERY_LABEL}
          </h2>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {preview?.levelsSpent ?? 0} из {recovery.remaining}
          </span>
        </div>
        <p className="text-xs text-ink-quiet">
          Суммарный уровень возвращаемых ячеек
        </p>
      </header>

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

      {/* Набрать лишнее не запрещено — запрещено вернуть: причина стоит там же, где набирают. */}
      {preview?.unavailabilityRu === undefined ? null : (
        <p className="text-xs text-ink-quiet">{preview.unavailabilityRu}</p>
      )}

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
    </section>
  );
}
