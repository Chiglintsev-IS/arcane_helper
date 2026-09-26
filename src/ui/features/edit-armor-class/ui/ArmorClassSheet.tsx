"use client";

import { useId, useState } from "react";

import { signed } from "@/shared/language";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { RULE_MARK } from "@/ui/shared/ui/rule";
import { Sheet } from "@/ui/shared/ui/Sheet";
import { SURFACE_CONTROL, SURFACE_GROUP_BARE, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

export const ARMOR_CLASS_ADJUSTMENT = "Поправка";

const LESS_MARK = "−";
const MORE_MARK = "+";

const STEP_CLASS = `size-13 shrink-0 text-2xl ${SURFACE_CONTROL}`;

/**
 * Поправку мастер называет малым числом со знаком, и набирают её кнопками, а не клавиатурой:
 * цифровая клавиатура телефона минуса не даёт.
 */
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
  const [adjustment, setAdjustment] = useState(value);
  const labelId = useId();

  return (
    <Sheet
      titleRu="КД"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSave(adjustment)}
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
      }
    >
      <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1 text-sm">
        <span id={labelId} className="font-medium">
          {ARMOR_CLASS_ADJUSTMENT}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`${ARMOR_CLASS_ADJUSTMENT}: на единицу меньше`}
            onClick={() => setAdjustment(adjustment - 1)}
            className={STEP_CLASS}
          >
            <span aria-hidden="true">{LESS_MARK}</span>
          </button>
          <output
            aria-live="polite"
            aria-label={`${ARMOR_CLASS_ADJUSTMENT} ${signed(adjustment)}`}
            className="flex-1 text-center text-2xl font-semibold tabular-nums"
          >
            {signed(adjustment)}
          </output>
          <button
            type="button"
            aria-label={`${ARMOR_CLASS_ADJUSTMENT}: на единицу больше`}
            onClick={() => setAdjustment(adjustment + 1)}
            className={STEP_CLASS}
          >
            <span aria-hidden="true">{MORE_MARK}</span>
          </button>
        </div>
      </div>

      <p className="text-xs text-ink-quiet">
        Складывается с прочими вкладами в Класс Доспеха. Ноль снимает поправку.
      </p>

      {error === null ? null : (
        <p role="alert" className={`${RULE_MARK.reaction} p-2 text-sm ${SURFACE_GROUP_BARE}`}>
          {error}
        </p>
      )}
    </Sheet>
  );
}
