/**
 * Магическое восстановление (FR-131, FR-215).
 *
 * Игрок выбирает, какие ячейки вернуть; движок правил не даёт превысить ни суммарный бюджет, ни
 * потраченное по каждому уровню. Проверка здесь не повторяется, а вызывается: расхождение проверки
 * в интерфейсе и проверки в правилах — ровно та ошибка, из-за которой перестают доверять числам.
 *
 * Уровни без единой потраченной ячейки не показываются: возвращать там нечего, а строка со
 * счётчиком, который нельзя увеличить, читается как неисправность.
 */

"use client";

import { useState } from "react";

import type { CharacterState } from "@/data/schemas/character";
import {
  ARCANE_RECOVERY_MAXIMUM_SLOT_LEVEL,
  arcaneRecoveryBudget,
  validateArcaneRecovery,
  type SlotRecoveryPlan,
} from "@/rules/slots";

export function ArcaneRecoverySheet({
  character,
  onConfirm,
  onCancel,
}: {
  character: CharacterState;
  onConfirm: (plan: SlotRecoveryPlan) => void;
  onCancel: () => void;
}) {
  const [plan, setPlan] = useState<SlotRecoveryPlan>({});

  const budget = arcaneRecoveryBudget(character.level);
  const spentBudget = Object.entries(plan).reduce(
    (sum, [level, count]) => sum + Number(level) * count,
    0,
  );

  const recoverable = Object.entries(character.spellSlots)
    .map(([level, slot]) => ({ level: Number(level), ...slot }))
    .filter(
      (slot) =>
        slot.level <= ARCANE_RECOVERY_MAXIMUM_SLOT_LEVEL && slot.remaining < slot.maximum,
    )
    .sort((left, right) => left.level - right.level);

  const validation = validateArcaneRecovery(character.spellSlots, plan, character.level);

  const change = (level: number, delta: number): void => {
    const next = { ...plan, [level]: Math.max(0, (plan[level] ?? 0) + delta) };
    // Проверяем до применения: кнопка «+» не должна уводить план за бюджет молча.
    if (delta > 0 && !validateArcaneRecovery(character.spellSlots, next, character.level).valid) {
      return;
    }
    setPlan(next);
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Магическое восстановление"
      className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      {character.shortRestSinceLongRest === true ? null : (
        // Предупреждение, а не запрет (FR-131): израсходованность приложение знает наверняка, а
        // короткий отдых мог случиться за столом без нажатия кнопки. Подтвердить всё равно можно.
        <p className="rounded-lg border border-reaction/50 bg-reaction/10 p-2 text-sm">
          Магическое восстановление берётся после короткого отдыха, а его не было.
        </p>
      )}

      <p className="text-sm">
        Суммарный уровень возвращаемых ячеек:{" "}
        <span className="font-semibold tabular-nums">
          {spentBudget} из {budget}
        </span>
      </p>

      {recoverable.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Все ячейки на месте — возвращать нечего.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {recoverable.map((slot) => (
            <li key={slot.level} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {slot.level} ур.{" "}
                <span className="text-slate-600 dark:text-slate-400">
                  потрачено {slot.maximum - slot.remaining}
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

      {validation.valid ? null : (
        <p className="text-xs text-slate-600 dark:text-slate-400">{validation.reason}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!validation.valid}
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
