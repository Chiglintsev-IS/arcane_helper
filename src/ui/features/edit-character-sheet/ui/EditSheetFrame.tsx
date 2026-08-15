"use client";

import { useId, type ReactNode } from "react";

import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";

/**
 * Рамка шторки правки: заголовок, содержимое, сохранение, уход и причина отказа.
 *
 * Одна на восемь шторок — иначе кнопка сохранения рано или поздно поехала бы в одной из них, и
 * пришлось бы проверять каждую. Слова на обеих кнопках приходят от их владельца: здесь правят
 * запись листа, и словом правки распоряжается не эта шторка.
 *
 * Годится ли набранное, шторка не знает и не спрашивает: она передаёт числа владельцу и показывает
 * его ответ. Своя проверка здесь была бы вторым правилом о том же — и разошлась бы с настоящим при
 * первой же правке предела.
 *
 * Прокручивается только содержимое: главное действие стоит внизу экрана и остаётся на месте. Пока
 * прокручивалась шторка целиком, на 320 × 568 кнопка сохранения у длинной шторки уходила за край, и
 * сохранение требовало сперва догадаться, что список полей продолжается.
 */
export function EditSheetFrame({
  titleRu,
  children,
  error = null,
  onSave,
  onCancel,
}: {
  titleRu: string;
  children: ReactNode;
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={`Правка: ${titleRu}`}
      className="fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col gap-3 rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <h2 className="text-sm font-semibold">{titleRu}</h2>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">{children}</div>
      {error === null ? null : (
        <p role="alert" className="rounded-lg border border-reaction bg-reaction/10 p-2 text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          className="min-h-11 flex-1 rounded-xl bg-action-strong px-3 text-sm font-semibold text-white"
        >
          {BUTTON_LABELS.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 shrink-0 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
        >
          {BUTTON_LABELS.dismiss}
        </button>
      </div>
    </section>
  );
}

/**
 * Числовое поле шторки: подпись слева, число справа. Одинаковое во всех восьми.
 *
 * Причина, по которой набранное не ушло, стоит второй строкой под самим полем и входит в его
 * описание: там, где набирали, а не поверх экрана.
 */
export function NumberField({
  labelRu,
  value,
  onChange,
  min,
  max,
  reasonRu = null,
}: {
  labelRu: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  /** Почему набранное не ушло. Причина стоит у поля, в котором набирали, а не поверх экрана. */
  reasonRu?: string | null;
}) {
  const reasonId = useId();
  return (
    // Причина стоит рядом с полем, но вне подписи: внутри неё она стала бы частью имени поля.
    <div className="flex flex-col gap-1">
      <label className="flex items-center justify-between gap-2 text-sm">
        <span>{labelRu}</span>
        <input
          type="number"
          inputMode="numeric"
          {...(min === undefined ? {} : { min })}
          {...(max === undefined ? {} : { max })}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={reasonRu !== null}
          aria-describedby={reasonRu === null ? undefined : reasonId}
          className={`min-h-11 w-20 rounded-lg border px-3 text-base tabular-nums dark:bg-slate-900 ${
            reasonRu === null ? "border-slate-200 dark:border-slate-800" : "border-reaction"
          }`}
        />
      </label>
      {reasonRu === null ? null : (
        <p
          id={reasonId}
          role="alert"
          className="text-xs font-medium text-reaction-strong dark:text-reaction"
        >
          {reasonRu}
        </p>
      )}
    </div>
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
