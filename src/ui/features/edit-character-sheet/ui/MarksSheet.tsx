"use client";

import { useState } from "react";

import type { CharacterState } from "@/core/domain/assembly/state";
import { EXHAUSTION_STEPS } from "@/core/domain/character/abilities";
import { EditSheetFrame } from "./EditSheetFrame";


export function MarksSheet({
  character,
  onSave,
  onCancel,
}: {
  character: CharacterState;
  onSave: (marks: { exhaustion: number; inspiration: boolean }) => void;
  onCancel: () => void;
}) {
  const [exhaustion, setExhaustion] = useState(character.exhaustion);
  const [inspiration, setInspiration] = useState(character.inspiration);

  return (
    <EditSheetFrame
      titleRu="Отметки мастера"
      onCancel={onCancel}
      onSave={() => onSave({ exhaustion, inspiration })}
    >
      <div role="radiogroup" aria-label="Ступень истощения" className="flex flex-wrap gap-1">
        {EXHAUSTION_STEPS.map((step) => (
          <button
            key={step}
            type="button"
            role="radio"
            aria-checked={exhaustion === step}
            aria-label={step === 0 ? "Без истощения" : `Ступень ${step}`}
            onClick={() => setExhaustion(step)}
            className={`min-h-11 min-w-11 rounded-lg border px-2 text-sm ${
              exhaustion === step
                ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
                : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
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
