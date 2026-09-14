"use client";

import { useState } from "react";

import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { FIELD_TEXT } from "@/ui/shared/ui/field";
import { RULE_ACTIVE } from "@/ui/shared/ui/rule";
import { SURFACE_CONTROL, SURFACE_GROUP_BARE, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

const FROM_MASTER = "со слов мастера";

const WRITE = "Записать";

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
    <div className={`flex flex-col gap-2 p-3 ${SURFACE_GROUP_BARE} ${RULE_ACTIVE}`}>
      <span className="text-[0.625rem] tracking-[0.14em] text-accent">
        {`${labelRu.toLocaleUpperCase("ru")} — ${FROM_MASTER}`}
      </span>

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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={`min-h-11 flex-1 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          {BUTTON_LABELS.dismiss}
        </button>
        <button
          type="button"
          onClick={() => onWrite(typed)}
          className={`min-h-11 flex-1 px-3 text-sm font-semibold ${SURFACE_PRIMARY}`}
        >
          {WRITE}
        </button>
      </div>
    </div>
  );
}
