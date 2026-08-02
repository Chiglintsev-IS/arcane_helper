"use client";

import { useState } from "react";

import type { CharacterState, ItemBonuses } from "@/core/domain/character/state";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";

/**
 * Прибавки, не привязанные к вещи.
 *
 * Границ нет: проклятый предмет тоже предмет, и его вклад отрицателен. Вклад надетых вещей сюда не
 * входит — он считается из инвентаря и правится там.
 */
export function ItemBonusesSheet({
  character,
  onSave,
  onCancel,
}: {
  character: CharacterState;
  onSave: (otherBonuses: ItemBonuses) => void;
  onCancel: () => void;
}) {
  const [spellcasting, setSpellcasting] = useState(String(character.equipment.otherBonuses.spellcasting));
  const [armorClass, setArmorClass] = useState(String(character.equipment.otherBonuses.armorClass));
  const [savingThrows, setSavingThrows] = useState(String(character.equipment.otherBonuses.savingThrows));

  const parsed = {
    spellcasting: Number.parseInt(spellcasting, 10),
    armorClass: Number.parseInt(armorClass, 10),
    savingThrows: Number.parseInt(savingThrows, 10),
  };
  const valid = Object.values(parsed).every((value) => Number.isInteger(value));

  return (
    <EditSheetFrame
      titleRu="Прибавки без вещи"
      canSave={valid}
      onCancel={onCancel}
      onSave={() => onSave(parsed)}
    >
      <NumberField labelRu="К магии" value={spellcasting} onChange={setSpellcasting} />
      <NumberField labelRu="К защите" value={armorClass} onChange={setArmorClass} />
      <NumberField labelRu="Ко всем спасброскам" value={savingThrows} onChange={setSavingThrows} />
    </EditSheetFrame>
  );
}
