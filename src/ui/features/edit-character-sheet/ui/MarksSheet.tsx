"use client";

import { useState } from "react";

import type { ChoicesView } from "@/contract/views";
import { EditSheetFrame } from "./EditSheetFrame";
import { SURFACE_GROUP } from "@/ui/shared/ui/surface";


export function MarksSheet({
  marks,
  choices,
  onSave,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  /** Отметки мастера как они стоят сейчас: начальные значения полей. */
  marks: { exhaustion: number; inspiration: boolean };
  /** Из чего выбирают: ступени истощения перечнем правил. */
  choices: ChoicesView;
  onSave: (marks: { exhaustion: number; inspiration: boolean }) => void;
  onCancel: () => void;
}) {
  const [exhaustion, setExhaustion] = useState(marks.exhaustion);
  const [inspiration, setInspiration] = useState(marks.inspiration);

  return (
    <EditSheetFrame
      titleRu="Отметки мастера"
      error={error}
      onCancel={onCancel}
      onSave={() => onSave({ exhaustion, inspiration })}
    >
      <div role="radiogroup" aria-label="Ступень истощения" className="flex flex-wrap gap-1">
        {choices.exhaustionSteps.map((step) => (
          <button
            key={step}
            type="button"
            role="radio"
            aria-checked={exhaustion === step}
            aria-label={step === 0 ? "Без истощения" : `Ступень ${step}`}
            onClick={() => setExhaustion(step)}
            className={`min-h-11 min-w-11 rounded-lg px-2 text-sm ${
              exhaustion === step
                ? "bg-action/20 font-medium text-action-strong dark:text-action"
                : `text-slate-600 dark:text-slate-400 ${SURFACE_GROUP}`
            }`}
          >
            {step}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={inspiration}
          onChange={(event) => setInspiration(event.target.checked)}
          className="size-5"
        />
        <span>Вдохновение</span>
      </label>
    </EditSheetFrame>
  );
}
