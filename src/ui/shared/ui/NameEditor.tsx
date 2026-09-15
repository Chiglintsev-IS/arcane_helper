"use client";

import { useState } from "react";

import { FIELD_TEXT } from "@/ui/shared/ui/field";
import { FieldForm } from "@/ui/shared/ui/FieldForm";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

/** Имя вещи правят везде, где его читают, — и правят одной и той же формой, чтобы не узнавать заново. */
export const NAME_LABEL = "Название";

/** Правка названия: пустое имя и имя без изменений не пишутся вовсе — форма просто закрывается. */
export function NameEditor({
  nameRu,
  onWrite,
  onCancel,
}: {
  nameRu: string;
  onWrite: (nameRu: string) => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState(nameRu);

  const write = (): void => {
    const named = typed.trim();
    if (named === "" || named === nameRu) return onCancel();
    onWrite(named);
  };

  return (
    <FieldForm titleRu={NAME_LABEL} onWrite={write} onCancel={onCancel}>
      <input
        type="text"
        aria-label={NAME_LABEL}
        autoFocus
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") write();
          if (event.key === "Escape") onCancel();
        }}
        className={`min-h-12 w-full px-2.5 ${FIELD_TEXT} ${SURFACE_CONTROL}`}
      />
    </FieldForm>
  );
}
