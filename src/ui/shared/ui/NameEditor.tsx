"use client";

import { useState } from "react";

import { FIELD_TEXT } from "@/ui/shared/ui/field";
import { FieldForm, WRITTEN, type WriteAnswer } from "@/ui/shared/ui/FieldForm";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

/** Имя вещи правят везде, где его читают, — и правят одной и той же формой, чтобы не узнавать заново. */
export const NAME_LABEL = "Название";

/** Правка названия: пустое имя и имя без изменений не пишутся вовсе — форма просто закрывается. */
export function NameEditor({
  nameRu,
  subtitleRu = null,
  onWrite,
  onClose,
}: {
  nameRu: string;
  /** Чьё имя правят, когда из самого имени это не видно. */
  subtitleRu?: string | null;
  onWrite: (nameRu: string) => WriteAnswer;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState(nameRu);

  const write = (): WriteAnswer => {
    const named = typed.trim();
    if (named === "" || named === nameRu) return WRITTEN;
    return onWrite(named);
  };

  return (
    <FieldForm titleRu={NAME_LABEL} subtitleRu={subtitleRu} onWrite={write} onClose={onClose}>
      <input
        type="text"
        aria-label={NAME_LABEL}
        autoFocus
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        className={`min-h-12 w-full px-2.5 ${FIELD_TEXT} ${SURFACE_CONTROL}`}
      />
    </FieldForm>
  );
}
