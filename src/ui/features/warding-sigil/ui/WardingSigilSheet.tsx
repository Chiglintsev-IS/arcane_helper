"use client";

import { useId } from "react";

import type { ResourcesView } from "@/contract/views";
import { WARDING_SIGIL_SHORT_RU } from "@/ui/features/warding-sigil/ui/WardingSigilRow";
import { SURFACE_CONTROL, SURFACE_PANEL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

export function WardingSigilSheet({
  resources,
  refusalRu,
  onSpendRune,
  onClose,
}: {
  resources: ResourcesView;
  refusalRu: string | null;
  onSpendRune: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const { runes } = resources;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto p-3 ${SURFACE_PANEL}`}
    >
      <h2 id={titleId} className="text-sm font-semibold">
        {runes.nameRu}
      </h2>

      <p className="text-xs text-ink-soft">{WARDING_SIGIL_SHORT_RU}</p>

      <div className="flex items-center justify-between gap-2 text-sm">
        <span>Осталось рун</span>
        <span className="font-semibold tabular-nums">
          {runes.remaining}/{runes.maximum}
        </span>
      </div>

      <button
        type="button"
        onClick={onSpendRune}
        className={`min-h-11 ${SURFACE_PRIMARY} px-3 text-sm font-semibold`}
      >
        Потратить руну
      </button>

      {refusalRu === null ? null : (
        <p role="alert" className="text-xs font-medium text-reaction">
          {refusalRu}
        </p>
      )}

      <button
        type="button"
        onClick={onClose}
        className={`min-h-11 px-3 text-sm ${SURFACE_CONTROL}`}
      >
        Закрыть
      </button>
    </section>
  );
}
