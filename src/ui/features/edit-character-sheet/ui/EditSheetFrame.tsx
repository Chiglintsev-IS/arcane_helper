"use client";

import type { ReactNode } from "react";

/**
 * Рамка шторки правки: заголовок, содержимое, «Сохранить» и «Отмена».
 *
 * Одна на восемь шторок — иначе кнопка «Сохранить» рано или поздно поехала бы в одной из них, и
 * пришлось бы проверять каждую.
 */
export function EditSheetFrame({
  titleRu,
  children,
  canSave = true,
  onSave,
  onCancel,
}: {
  titleRu: string;
  children: ReactNode;
  canSave?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={`Правка: ${titleRu}`}
      className="fixed inset-x-0 bottom-0 z-20 flex max-h-[80dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <h2 className="text-sm font-semibold">{titleRu}</h2>
      {children}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={onSave}
          className="min-h-11 flex-1 rounded-xl bg-action-strong px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Сохранить
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

/** Числовое поле шторки: подпись слева, число справа. Одинаковое во всех восьми. */
export function NumberField({
  labelRu,
  value,
  onChange,
  min,
  max,
}: {
  labelRu: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span>{labelRu}</span>
      <input
        type="number"
        inputMode="numeric"
        {...(min === undefined ? {} : { min })}
        {...(max === undefined ? {} : { max })}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-20 rounded-lg border border-slate-200 px-3 text-base tabular-nums dark:border-slate-800 dark:bg-slate-900"
      />
    </label>
  );
}

/** Текстовое поле шторки. */
export function TextField({
  labelRu,
  value,
  onChange,
}: {
  labelRu: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span>{labelRu}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-40 rounded-lg border border-slate-200 px-3 text-base dark:border-slate-800 dark:bg-slate-900"
      />
    </label>
  );
}
