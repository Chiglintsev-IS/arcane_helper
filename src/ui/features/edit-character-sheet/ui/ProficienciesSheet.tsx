"use client";

import { useState } from "react";

import type { SheetView } from "@/contract/views";
import { asList } from "@/ui/features/edit-character-sheet/lib/lists";
import { EditSheetFrame, TextField } from "./EditSheetFrame";

/**
 * Чем Торн умеет пользоваться: оружие, доспехи, инструменты.
 *
 * Языки правятся своей шторкой: знание языка — не умение обращаться с вещью, и за столом их
 * спрашивают разными вопросами.
 */
export function ProficienciesSheet({
  proficiencies,
  onSave,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  proficiencies: SheetView["proficiencies"];
  onSave: (next: SheetView["proficiencies"]) => void;
  onCancel: () => void;
}) {
  const [weapons, setWeapons] = useState(proficiencies.weapons.join(", "));
  const [armor, setArmor] = useState(proficiencies.armor.join(", "));
  const [tools, setTools] = useState(proficiencies.tools.join(", "));

  return (
    <EditSheetFrame
      titleRu="Владения"
      error={error}
      onCancel={onCancel}
      onSave={() =>
        onSave({
          ...proficiencies,
          weapons: asList(weapons),
          armor: asList(armor),
          tools: asList(tools),
        })
      }
    >
      <TextField labelRu="Оружие" value={weapons} onChange={setWeapons} />
      <TextField labelRu="Доспехи" value={armor} onChange={setArmor} />
      <TextField labelRu="Инструменты" value={tools} onChange={setTools} />
    </EditSheetFrame>
  );
}
