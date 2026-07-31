/**
 * Ввод полученного урона (FR-083, FR-180).
 *
 * Одно место на два следствия: хиты уменьшаются, а огненный урон подавляет расовые особенности.
 * Признак огня стоит здесь, потому что спрашивать про него отдельно значит спрашивать дважды об
 * одном событии (F-16).
 *
 * Кнопка «Записать» неактивна при пустом или нулевом вводе: пустая запись журнала — мусор в отмене.
 */

import { useState } from "react";

export function DamagePrompt({
  onSubmit,
  onCancel,
}: {
  onSubmit: (damage: number, fire: boolean) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [fire, setFire] = useState(false);
  const damage = Number.parseInt(value, 10);
  const valid = Number.isInteger(damage) && damage > 0;

  return (
    <section
      role="dialog"
      aria-modal="true"
      // Имя листа отличается от подписи поля: иначе доступное имя ведёт к двум элементам сразу.
      aria-label="Ввод урона"
      className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Полученный урон</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-11 rounded-lg border border-slate-200 px-3 text-base tabular-nums dark:border-slate-800 dark:bg-slate-900"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={fire}
          onChange={(event) => setFire(event.target.checked)}
          className="size-5"
        />
        <span>Урон огнём</span>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!valid}
          onClick={() => onSubmit(damage, fire)}
          className="min-h-11 flex-1 rounded-xl bg-reaction-strong px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Записать
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
