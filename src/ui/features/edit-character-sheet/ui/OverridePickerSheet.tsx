"use client";

import { DERIVED_IDS, type DerivedNumber } from "@/core/domain/sheet/derived";
import { DERIVED_LABELS } from "@/ui/entities/character/lib/labels";

/**
 * Какое из чисел боя править.
 *
 * Отдельный шаг, а не кнопка в каждой строке просмотра: перебивают одно число за игру, а шесть
 * кнопок в блоке читались бы как приглашение вводить руками то, что и так посчитано.
 */
export function OverridePickerSheet({
  numbers,
  onPick,
  onCancel,
}: {
  numbers: DerivedNumber[];
  onPick: (id: DerivedNumber["id"]) => void;
  onCancel: () => void;
}) {
  const byId = new Map(numbers.map((number) => [number.id, number]));

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Правка: Числа боя"
      className="fixed inset-x-0 bottom-0 z-20 flex max-h-[80dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <h2 className="text-sm font-semibold">Числа боя</h2>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Числа считаются из листа. Задать руками стоит только то, что за столом действует иначе.
      </p>

      {DERIVED_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onPick(id)}
          className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-800"
        >
          <span>{DERIVED_LABELS[id]}</span>
          <span className="tabular-nums">
            {byId.get(id)?.value}
            {byId.get(id)?.overridden === true ? " (введено руками)" : ""}
          </span>
        </button>
      ))}

      <button
        type="button"
        onClick={onCancel}
        className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
      >
        Отмена
      </button>
    </section>
  );
}
