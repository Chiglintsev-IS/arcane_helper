"use client";

import { useState } from "react";

import type { CharacterState, ItemBonuses } from "@/core/domain/character/state";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";

/**
 * Прочие прибавки персонажа: благословение, дар, обучение — вклад, у которого нет вещи.
 *
 * Границ нет: проклятие — тоже вклад, и его число отрицательно. Прибавки надетых вещей сюда не
 * входят — они считаются из инвентаря и правятся у самой вещи в «Сумке».
 */
export function MiscBonusesSheet({
  character,
  onSave,
  onCancel,
}: {
  character: CharacterState;
  onSave: (miscBonuses: ItemBonuses) => void;
  onCancel: () => void;
}) {
  const [spellcasting, setSpellcasting] = useState(String(character.miscBonuses.spellcasting));
  const [armorClass, setArmorClass] = useState(String(character.miscBonuses.armorClass));
  const [savingThrows, setSavingThrows] = useState(String(character.miscBonuses.savingThrows));

  const parsed = {
    spellcasting: Number.parseInt(spellcasting, 10),
    armorClass: Number.parseInt(armorClass, 10),
    savingThrows: Number.parseInt(savingThrows, 10),
  };
  const valid = Object.values(parsed).every((value) => Number.isInteger(value));

  return (
    <EditSheetFrame
      titleRu="Прочие прибавки"
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
