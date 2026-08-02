"use client";

import { useState } from "react";

import type { CharacterState } from "@/core/domain/character/state";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";

/**
 * База Класса Доспеха: надетый доспех или его отсутствие.
 *
 * Модификатор Ловкости и прибавки вещей сюда не входят — их складывает лист. Здесь только то, во
 * что персонаж одет.
 */
export function ArmorSheet({
  character,
  onSave,
  onCancel,
}: {
  character: CharacterState;
  onSave: (base: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(String(character.equipment.armorClassBase));
  const base = Number.parseInt(text, 10);

  return (
    <EditSheetFrame
      titleRu="Доспех"
      canSave={Number.isInteger(base) && base > 0}
      onCancel={onCancel}
      onSave={() => onSave(base)}
    >
      <NumberField labelRu="База Класса Доспеха" value={text} onChange={setText} min={1} />
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Без доспехов — 10. Ловкость и прибавки вещей прибавляются сверх этого числа сами.
      </p>
    </EditSheetFrame>
  );
}
