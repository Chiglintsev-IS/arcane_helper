"use client";

import { useState } from "react";

import { FIELD_TEXT } from "@/ui/shared/ui/field";
import { FieldForm, type WriteAnswer } from "@/ui/shared/ui/FieldForm";
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
  onClose,
}: {
  labelRu: string;
  value: string;
  numeric?: boolean;
  onWrite: (typed: string) => WriteAnswer;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState(value);

  return (
    <FieldForm
      titleRu={`${labelRu} — ${FROM_MASTER}`}
      onWrite={() => onWrite(typed)}
      onClose={onClose}
    >
      <input
        type={numeric ? "number" : "text"}
        inputMode={numeric ? "numeric" : "text"}
        aria-label={labelRu}
        autoFocus
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        className={`min-h-11 w-full px-2 ${FIELD_TEXT} ${SURFACE_CONTROL}`}
      />
    </FieldForm>
  );
}
