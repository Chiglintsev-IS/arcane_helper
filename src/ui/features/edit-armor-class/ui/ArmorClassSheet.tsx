"use client";

import { useId, useState } from "react";

import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { SURFACE_CONTROL, SURFACE_GROUP, SURFACE_PANEL } from "@/ui/shared/ui/surface";

/**
 * Поправка к КД: одно число со знаком, как «Хиты» правят временные хиты. Новое значение заменяет
 * прежнее, а ноль снимает поправку вовсе.
 *
 * Поправку кладёт на стол мастер, и потому нажатие здесь не правит запись листа, а совершает
 * случившееся: слово на кнопке то же, каким подтверждают урон и сотворение. Тем же признаком выбран
 * и заголовок — он называет число, которого поправка касается, а самоё поправку называет поле.
 */

/** Что здесь набирают. Тем же словом зовёт эту шторку плитка, которая её открывает. */
export const ARMOR_CLASS_ADJUSTMENT = "Поправка";
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
  const titleId = useId();
  const [text, setText] = useState(value === 0 ? "" : String(value));
  const trimmed = text.trim();
  const parsed = trimmed === "" ? 0 : Number(trimmed);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl p-3 ${SURFACE_PANEL}`}
    >
      <h2 id={titleId} className="text-base font-semibold leading-tight">
        КД
      </h2>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{ARMOR_CLASS_ADJUSTMENT}</span>
        <input
          type="number"
          inputMode="numeric"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className={`min-h-11 rounded-lg px-3 text-base tabular-nums ${SURFACE_CONTROL}`}
        />
      </label>

      <p className="text-xs text-slate-600 dark:text-slate-400">
        Складывается с прочими вкладами в Класс Доспеха. Ноль снимает поправку.
      </p>

      {error === null ? null : (
        <p role="alert" className={`rounded-lg bg-reaction/10 p-2 text-sm ${SURFACE_GROUP}`}>
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(parsed)}
          className="min-h-11 flex-1 rounded-xl bg-action-strong px-3 text-sm font-semibold text-white"
        >
          {BUTTON_LABELS.confirm}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`min-h-11 shrink-0 rounded-xl px-3 text-sm ${SURFACE_CONTROL}`}
        >
          {BUTTON_LABELS.dismiss}
        </button>
      </div>
    </section>
  );
}
