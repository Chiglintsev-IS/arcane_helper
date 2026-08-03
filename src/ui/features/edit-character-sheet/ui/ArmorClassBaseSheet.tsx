"use client";

import { useState } from "react";

import type { CharacterState } from "@/core/domain/character/state";
import { Equipment } from "@/core/domain/equipment/equipment";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";

/**
 * Перебивка базы КД: действует вместо выведенной из надетого доспеха.
 *
 * Сама база считается из вещей и здесь не правится: чтобы КД вырос от кольчуги, кольчугу заводят
 * в «Сумке» и надевают. Перебивка — для случая, когда за столом действует не то, что даёт счёт.
 */
export function ArmorClassBaseSheet({
  character,
  onSave,
  onCancel,
}: {
  character: CharacterState;
  onSave: (value: number | null) => void;
  onCancel: () => void;
}) {
  const equipment = Equipment.of(character);
  const derivedBase = equipment.armorClassBase;
  const wornArmorNameRu = equipment.wornArmor?.nameRu;
  const [text, setText] = useState(
    String(character.overrides.armorClassBase ?? derivedBase),
  );
  const value = Number.parseInt(text, 10);

  return (
    <EditSheetFrame
      titleRu="База Класса Доспеха"
      canSave={Number.isInteger(value) && value > 0}
      onCancel={onCancel}
      onSave={() => onSave(value)}
    >
      <NumberField labelRu="Значение" value={text} onChange={setText} min={1} />

      <p className="text-xs text-slate-600 dark:text-slate-400">
        По надетому — {derivedBase} ({wornArmorNameRu ?? "без доспехов"}). Ловкость и прибавки
        считаются сверху сами.
      </p>

      <button
        type="button"
        onClick={() => onSave(null)}
        className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
      >
        По надетому
      </button>
    </EditSheetFrame>
  );
}
