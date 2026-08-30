"use client";

import type { SpellRowView } from "@/contract/views";

import { RitualDiagram } from "@/ui/entities/ritual-diagram/ui/RitualDiagram";
import { SURFACE_GROUP, SURFACE_PAGE } from "@/ui/shared/ui/surface";

export function RitualDiagramView({ row, onClose }: { row: SpellRowView; onClose: () => void }) {
  const diagram = row.card.ritualDiagram;
  if (diagram === undefined) return null;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={`Схема ритуала «${row.nameRu}»`}
      className={`fixed inset-0 z-30 flex flex-col ${SURFACE_PAGE}`}
    >
      <header className={`flex items-start justify-between gap-2 p-3 ${SURFACE_GROUP}`}>
        <div>
          <h2 className="text-base font-semibold leading-tight">{row.nameRu}</h2>
          <p className="text-xs text-ink-quiet">Перерисуйте на лист — это и есть ритуал</p>
        </div>
        <button type="button" onClick={onClose} className="px-2 text-sm text-ink-quiet underline">
          Закрыть
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 p-3">
        <RitualDiagram diagram={diagram} />
        <p className="text-center text-xs italic text-ink-quiet">
          {diagram.captionRu}
        </p>
      </div>
    </section>
  );
}
