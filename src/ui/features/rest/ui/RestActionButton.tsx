"use client";

import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

export function RestActionButton({
  onClick,
  name,
  disabledReason,
}: {
  onClick: () => void;
  name: string;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabledReason !== undefined}
      className={`min-h-11 grow px-3 py-1.5 text-sm font-medium disabled:text-ink-quiet ${SURFACE_CONTROL}`}
    >
      <span className="block whitespace-nowrap">{name}</span>{" "}
      {disabledReason === undefined ? null : (
        <span className="block text-xs font-normal">{disabledReason}</span>
      )}
    </button>
  );
}
