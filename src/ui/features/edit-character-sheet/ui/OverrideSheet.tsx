"use client";

import { useState } from "react";

import type { DerivedId } from "@/core/domain/sheet/derived";
import { DERIVED_LABELS } from "@/ui/entities/character/lib/labels";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";

export function OverrideSheet({
  id,
  formulaValue,
  currentValue,
  onSave,
  onCancel,
}: {
  id: DerivedId;
  /** Что даёт формула: игрок обязан видеть, от чего отступает. */
  formulaValue: number;
  currentValue: number;
  onSave: (value: number | null) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(String(currentValue));
  const value = Number.parseInt(text, 10);

  return (
    <EditSheetFrame
      titleRu={DERIVED_LABELS[id]}
      canSave={Number.isInteger(value)}
      onCancel={onCancel}
      onSave={() => onSave(value)}
    >
      <NumberField labelRu="Значение" value={text} onChange={setText} />

      <p className="text-xs text-slate-600 dark:text-slate-400">По формуле — {formulaValue}.</p>

      <button
        type="button"
        onClick={() => onSave(null)}
        className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
      >
        По формуле
      </button>
    </EditSheetFrame>
  );
}
