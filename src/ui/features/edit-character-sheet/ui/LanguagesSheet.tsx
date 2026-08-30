"use client";

import { useState } from "react";

import type { SheetView } from "@/contract/views";
import { asList } from "@/ui/features/edit-character-sheet/lib/lists";
import { EditSheetFrame, TextField } from "./EditSheetFrame";

export function LanguagesSheet({
  proficiencies,
  onSave,
  onCancel,
  error = null,
}: {
  error?: string | null;
  proficiencies: SheetView["proficiencies"];
  onSave: (next: SheetView["proficiencies"]) => void;
  onCancel: () => void;
}) {
  const [languages, setLanguages] = useState(proficiencies.languages.join(", "));

  return (
    <EditSheetFrame
      titleRu="Языки"
      error={error}
      onCancel={onCancel}
      onSave={() => onSave({ ...proficiencies, languages: asList(languages) })}
    >
      <TextField labelRu="Знает" value={languages} onChange={setLanguages} />
    </EditSheetFrame>
  );
}
