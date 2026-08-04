"use client";

import { useState } from "react";

import type { CharacterState } from "@/core/domain/assembly/state";
import type { ItemBonuses } from "@/core/domain/shared/schema";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";
import { BONUS_LABELS } from "@/ui/entities/character/lib/labels";

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
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
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

  return (
    <EditSheetFrame
      titleRu="Прочие прибавки"
      error={error}
      onCancel={onCancel}
      onSave={() => onSave(parsed)}
    >
      <NumberField labelRu={BONUS_LABELS.spellcasting} value={spellcasting} onChange={setSpellcasting} />
      <NumberField labelRu={BONUS_LABELS.armorClass} value={armorClass} onChange={setArmorClass} />
      <NumberField labelRu={BONUS_LABELS.savingThrows} value={savingThrows} onChange={setSavingThrows} />
    </EditSheetFrame>
  );
}
