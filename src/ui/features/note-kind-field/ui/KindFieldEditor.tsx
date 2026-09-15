"use client";

import { useState } from "react";

import { FIELD_TEXT } from "@/ui/shared/ui/field";
import { FieldForm } from "@/ui/shared/ui/FieldForm";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

const FROM_MASTER = "со слов мастера";

/**
 * Дописывание поля вида: поле открывается там же, где стоит значение, и записывает одно число или
 * одну строку. Что мастер назвал, то и встаёт на место прежнего — спорить с ним приложению нечем.
 */
export function KindFieldEditor({
  labelRu,
  value,
  numeric = false,
  onWrite,
  onCancel,
}: {
  labelRu: string;
  value: string;
  numeric?: boolean;
  onWrite: (typed: string) => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState(value);

  return (
    <FieldForm
      titleRu={`${labelRu} — ${FROM_MASTER}`}
      onWrite={() => onWrite(typed)}
      onCancel={onCancel}
    >
      <input
        type={numeric ? "number" : "text"}
        inputMode={numeric ? "numeric" : "text"}
        aria-label={labelRu}
        autoFocus
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onWrite(typed);
          if (event.key === "Escape") onCancel();
        }}
        className={`min-h-11 w-full px-2 ${FIELD_TEXT} ${SURFACE_CONTROL}`}
      />
    </FieldForm>
  );
}
