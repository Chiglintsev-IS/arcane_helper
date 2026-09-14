"use client";

import { Sheet } from "@/ui/shared/ui/Sheet";
import { SURFACE_CONTROL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      titleRu={title}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-11 flex-1 ${SURFACE_PRIMARY} px-3 text-sm font-semibold`}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={`min-h-11 shrink-0 px-3 text-sm ${SURFACE_CONTROL}`}
          >
            {cancelLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm text-ink-soft">{body}</p>
    </Sheet>
  );
}
