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

import { useState } from "react";

import type { CommandOf } from "@/contract/commands";
import type { PreviewOf, Question } from "@/contract/questions";
import type { RecoveryView } from "@/contract/views";

import { ARCANE_RECOVERY_LABEL } from "@/ui/entities/character/lib/labels";
import { usePreview } from "@/ui/shared/model/usePreview";

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
      aria-label={ARCANE_RECOVERY_LABEL}
      className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <p className="text-sm">
        Суммарный уровень возвращаемых ячеек:{" "}
        <span className="font-semibold tabular-nums">
          {preview?.levelsSpent ?? 0} из {recovery.remaining}
        </span>
      </p>

      {recovery.recoverable.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Все ячейки на месте — возвращать нечего.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {recovery.recoverable.map((slot) => (
            <li key={slot.level} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {slot.level} ур.{" "}
                <span className="text-slate-600 dark:text-slate-400">
                  потрачено {slot.spent}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => change(slot.level, -1)}
                  aria-label={`Убрать ячейку ${slot.level} уровня`}
                  className="min-h-11 min-w-11 rounded-lg border border-slate-200 dark:border-slate-800"
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
                  className="min-h-11 min-w-11 rounded-lg border border-slate-200 dark:border-slate-800"
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
        <p className="text-xs text-slate-600 dark:text-slate-400">{preview.unavailabilityRu}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={preview === null || preview.unavailabilityRu !== undefined}
          onClick={() => onConfirm(plan)}
          className="min-h-11 flex-1 rounded-xl bg-action-strong px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Вернуть ячейки
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 shrink-0 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
        >
          Отмена
        </button>
      </div>
    </section>
  );
}
