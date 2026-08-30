"use client";

import { RULE_MARK } from "@/ui/shared/ui/rule";
import { useId, useState } from "react";

import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { SURFACE_CONTROL, SURFACE_GROUP_BARE, SURFACE_PANEL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

export const ARMOR_CLASS_ADJUSTMENT = "Поправка";
export function ArmorClassSheet({
  value,
  onSave,
  onCancel,
  error = null,
}: {
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
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 p-3 ${SURFACE_PANEL}`}
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
          className={`min-h-11 px-3 text-base tabular-nums ${SURFACE_CONTROL}`}
        />
      </label>

      <p className="text-xs text-ink-quiet">
        Складывается с прочими вкладами в Класс Доспеха. Ноль снимает поправку.
      </p>

      {error === null ? null : (
        <p role="alert" className={`${RULE_MARK.reaction} p-2 text-sm ${SURFACE_GROUP_BARE}`}>
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(parsed)}
          className={`min-h-11 flex-1 ${SURFACE_PRIMARY} px-3 text-sm font-semibold`}
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
