"use client";

import { useState } from "react";

/**
 * Правка поправки к КД: одно число со знаком, как «Хиты» правят временные хиты. Новое значение
 * заменяет прежнее, а ноль снимает поправку вовсе.
 */
export function ArmorClassSheet({
  value,
  onSave,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  value: number;
  onSave: (value: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value === 0 ? "" : String(value));
  const trimmed = text.trim();
  const parsed = trimmed === "" ? 0 : Number(trimmed);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Правка КД"
      className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Поправка</span>
        <input
          type="number"
          inputMode="numeric"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="min-h-11 rounded-lg border border-slate-200 px-3 text-base tabular-nums dark:border-slate-800 dark:bg-slate-900"
        />
      </label>

      <p className="text-xs text-slate-600 dark:text-slate-400">
        Складывается с прочими вкладами в Класс Доспеха. Ноль снимает поправку.
      </p>

      {error === null ? null : (
        <p role="alert" className="rounded-lg border border-reaction bg-reaction/10 p-2 text-sm">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(parsed)}
          className="min-h-11 flex-1 rounded-xl bg-action-strong px-3 text-sm font-semibold text-white"
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
