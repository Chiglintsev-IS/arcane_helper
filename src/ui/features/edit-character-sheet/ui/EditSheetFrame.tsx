"use client";

import { RULE_MARK } from "@/ui/shared/ui/rule";
import { useId, type ReactNode } from "react";

import { BUTTON_LABELS, editName } from "@/ui/shared/ui/buttonLabels";
import { SURFACE_CONTROL, SURFACE_GROUP, SURFACE_GROUP_BARE, SURFACE_PANEL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

export function EditSheetFrame({
  titleRu,
  children,
  error = null,
  onSave,
  onCancel,
}: {
  titleRu: string;
  children: ReactNode;
  error?: string | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={editName(titleRu)}
      className={`fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col gap-3 p-3 ${SURFACE_PANEL}`}
    >
      <h2 className="text-sm font-semibold">{titleRu}</h2>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">{children}</div>
      {error === null ? null : (
        <p role="alert" className={`${RULE_MARK.reaction} p-2 text-sm ${SURFACE_GROUP_BARE}`}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          className={`min-h-11 flex-1 ${SURFACE_PRIMARY} px-3 text-sm font-semibold`}
        >
          {BUTTON_LABELS.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`min-h-11 shrink-0 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          {BUTTON_LABELS.dismiss}
        </button>
      </div>
    </section>
  );
}

export function NumberField({
  labelRu,
  value,
  onChange,
  min,
  max,
  reasonRu = null,
}: {
  labelRu: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  reasonRu?: string | null;
}) {
  const reasonId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center justify-between gap-2 text-sm">
        <span>{labelRu}</span>
        <input
          type="number"
          inputMode="numeric"
          {...(min === undefined ? {} : { min })}
          {...(max === undefined ? {} : { max })}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={reasonRu !== null}
          aria-describedby={reasonRu === null ? undefined : reasonId}
          className={`min-h-11 w-20 px-3 text-base tabular-nums ${
          reasonRu === null ? SURFACE_GROUP : `${SURFACE_GROUP_BARE} ${RULE_MARK.reaction}`
          }`}
        />
      </label>
      {reasonRu === null ? null : (
        <p
          id={reasonId}
          role="alert"
          className="text-xs font-medium text-reaction"
        >
          {reasonRu}
        </p>
      )}
    </div>
  );
}

export function TextField({
  labelRu,
  value,
  onChange,
}: {
  labelRu: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span>{labelRu}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`min-h-11 w-40 px-3 text-base ${SURFACE_CONTROL}`}
      />
    </label>
  );
}
